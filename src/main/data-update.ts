import { createHash, createPublicKey, randomUUID, verify as verifySignature } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import path from 'node:path'
import { parseQuestKnowledgeUpdate } from '@common/quest_knowledge_update'

const DataSchemaVersion = 1
const DataUpdateDirname = 'data-updates'
const VersionsDirname = 'versions'
const ActiveFilename = 'active.json'
const ManifestFilename = 'manifest.json'
const MaxManifestBytes = 1024 * 1024
const MaxDataFileBytes = 2 * 1024 * 1024
const MaxBundleBytes = 64 * 1024 * 1024
const MaxBundleFiles = 512
const DataVersionPattern = /^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/
const MapDataFilePattern = /^map\/[0-9]{3}_[0-9]{2}_map\.json$/
const QuestKnowledgeFilePath = 'quest/knowledge.json'
const Sha256Pattern = /^[0-9a-f]{64}$/
const Base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

export interface DataManifestFile {
  readonly path: string
  readonly sha256: string
  readonly size: number
}

export interface DataManifest {
  readonly schemaVersion: 1
  readonly dataVersion: string
  readonly publishedAt: string
  readonly files: DataManifestFile[]
  readonly signature: string
}

export interface ActiveDataBundle {
  readonly directory: string
  readonly manifest: DataManifest
}

interface DataFetchResponse {
  readonly ok: boolean
  readonly status: number
  readonly url?: string
  readonly body: ReadableStream<Uint8Array> | null
  arrayBuffer(): Promise<ArrayBuffer>
}

export type DataFetch = (
  input: string,
  init: { readonly signal: AbortSignal }
) => Promise<DataFetchResponse>

export interface InstallDataUpdateOptions {
  readonly cacheRoot: string
  readonly manifestUrl: string
  readonly publicKey: string
  readonly fetch: DataFetch
  readonly timeoutMs?: number
  readonly allowInsecureLocalhost?: boolean
}

export type InstallDataUpdateResult =
  | { readonly status: 'current'; readonly version: string }
  | { readonly status: 'installed'; readonly version: string }

export type DataUpdateConfiguration =
  | { readonly status: 'disabled' }
  | {
      readonly status: 'invalid'
      readonly reason:
        | 'missing-manifest-url'
        | 'missing-public-key'
        | 'invalid-manifest-url'
        | 'invalid-public-key'
        | 'invalid-public-key-fingerprint'
    }
  | {
      readonly status: 'enabled'
      readonly manifestUrl: string
      readonly publicKey: string
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isInteger(value: unknown): value is number {
  return Number.isInteger(value)
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isFiniteNumber)
}

function isNumberMatrix(value: unknown): value is number[][] {
  return Array.isArray(value) && value.every(isNumberArray)
}

function isMapSpot(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }
  if (!isInteger(value.no) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) {
    return false
  }
  if (value.label !== undefined && typeof value.label !== 'string') {
    return false
  }
  if (value.type !== undefined && typeof value.type !== 'string') {
    return false
  }
  if (value.enemy !== undefined && !isNumberMatrix(value.enemy)) {
    return false
  }
  if (value.enemy2 !== undefined && !isNumberMatrix(value.enemy2)) {
    return false
  }
  if (value.aa !== undefined && !isNumberArray(value.aa)) {
    return false
  }
  return ['maxAa', 'distance', 'maplos', 'maplosmin', 'maplosmax', 'airsearch'].every(
    (key) => value[key] === undefined || isFiniteNumber(value[key])
  )
}

function isMapCheck(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }
  if (
    !isInteger(value.no) ||
    (value.type !== 'maplos' && value.type !== 'airsearch') ||
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y) ||
    !isRecord(value.info)
  ) {
    return false
  }
  if (value.label !== undefined && typeof value.label !== 'string') {
    return false
  }
  return (
    isFiniteNumber(value.info.value) &&
    isFiniteNumber(value.info.min) &&
    isFiniteNumber(value.info.max)
  )
}

export function isMapData(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.spots) || !value.spots.every(isMapSpot)) {
    return false
  }
  if (value.checks !== undefined) {
    if (!Array.isArray(value.checks) || !value.checks.every(isMapCheck)) {
      return false
    }
  }
  return ['spots_1', 'spots_2', 'spots_3'].every(
    (key) => value[key] === undefined || (Array.isArray(value[key]) && value[key].every(isMapSpot))
  )
}

function parseJson(text: string, description: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${description} is not valid JSON`)
  }
}

function requireExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  description: string
): void {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${description} has unsupported fields`)
  }
}

export function parseDataManifest(text: string): DataManifest {
  if (Buffer.byteLength(text, 'utf8') > MaxManifestBytes) {
    throw new Error('data manifest is too large')
  }

  const value = parseJson(text, 'data manifest')
  if (!isRecord(value)) {
    throw new Error('data manifest must be an object')
  }
  requireExactKeys(
    value,
    ['schemaVersion', 'dataVersion', 'publishedAt', 'files', 'signature'],
    'data manifest'
  )

  if (value.schemaVersion !== DataSchemaVersion) {
    throw new Error('unsupported data manifest schema')
  }
  if (typeof value.dataVersion !== 'string' || !DataVersionPattern.test(value.dataVersion)) {
    throw new Error('invalid data version')
  }
  if (
    typeof value.publishedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.publishedAt)) ||
    new Date(value.publishedAt).toISOString() !== value.publishedAt
  ) {
    throw new Error('invalid data publication time')
  }
  if (
    typeof value.signature !== 'string' ||
    value.signature.length === 0 ||
    !Base64Pattern.test(value.signature)
  ) {
    throw new Error('invalid data manifest signature')
  }
  if (
    !Array.isArray(value.files) ||
    value.files.length === 0 ||
    value.files.length > MaxBundleFiles
  ) {
    throw new Error('invalid data manifest file list')
  }

  const seenPaths = new Set<string>()
  let totalSize = 0
  const files = value.files.map((file, index): DataManifestFile => {
    if (!isRecord(file)) {
      throw new Error(`data manifest file ${index} must be an object`)
    }
    requireExactKeys(file, ['path', 'sha256', 'size'], `data manifest file ${index}`)
    if (
      typeof file.path !== 'string' ||
      (!MapDataFilePattern.test(file.path) && file.path !== QuestKnowledgeFilePath)
    ) {
      throw new Error(`invalid data file path at index ${index}`)
    }
    if (seenPaths.has(file.path)) {
      throw new Error(`duplicate data file path: ${file.path}`)
    }
    if (typeof file.sha256 !== 'string' || !Sha256Pattern.test(file.sha256)) {
      throw new Error(`invalid data file hash: ${file.path}`)
    }
    if (!isInteger(file.size) || file.size <= 0 || file.size > MaxDataFileBytes) {
      throw new Error(`invalid data file size: ${file.path}`)
    }
    seenPaths.add(file.path)
    totalSize += file.size
    return {
      path: file.path,
      sha256: file.sha256,
      size: file.size
    }
  })

  if (totalSize > MaxBundleBytes) {
    throw new Error('data bundle is too large')
  }

  return {
    schemaVersion: DataSchemaVersion,
    dataVersion: value.dataVersion,
    publishedAt: value.publishedAt,
    files,
    signature: value.signature
  }
}

export function dataManifestSigningPayload(manifest: DataManifest): string {
  return JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    dataVersion: manifest.dataVersion,
    publishedAt: manifest.publishedAt,
    files: [...manifest.files]
      .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
      .map((file) => ({
        path: file.path,
        sha256: file.sha256,
        size: file.size
      }))
  })
}

export function verifyDataManifest(manifest: DataManifest, publicKey: string): void {
  const key = parseDataUpdatePublicKey(publicKey)
  const valid = verifySignature(
    null,
    Buffer.from(dataManifestSigningPayload(manifest), 'utf8'),
    key,
    Buffer.from(manifest.signature, 'base64')
  )
  if (!valid) {
    throw new Error('data manifest signature verification failed')
  }
}

function parseDataUpdatePublicKey(publicKey: string): ReturnType<typeof createPublicKey> {
  if (publicKey.length === 0 || !Base64Pattern.test(publicKey)) {
    throw new Error('invalid data update public key')
  }

  try {
    const key = createPublicKey({
      key: Buffer.from(publicKey, 'base64'),
      format: 'der',
      type: 'spki'
    })
    if (key.asymmetricKeyType !== 'ed25519') {
      throw new Error('unsupported data update public key type')
    }
    return key
  } catch {
    throw new Error('invalid data update public key')
  }
}

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

function validateDataFile(file: DataManifestFile, data: Buffer): void {
  if (data.byteLength !== file.size) {
    throw new Error(`data file size mismatch: ${file.path}`)
  }
  if (sha256(data) !== file.sha256) {
    throw new Error(`data file hash mismatch: ${file.path}`)
  }
  const text = data.toString('utf8')
  if (file.path === QuestKnowledgeFilePath) {
    parseQuestKnowledgeUpdate(text)
    return
  }
  const value = parseJson(text, `data file ${file.path}`)
  if (!isMapData(value)) {
    throw new Error(`invalid map data: ${file.path}`)
  }
}

function dataUpdateRoot(cacheRoot: string): string {
  return path.join(cacheRoot, DataUpdateDirname)
}

function versionsRoot(cacheRoot: string): string {
  return path.join(dataUpdateRoot(cacheRoot), VersionsDirname)
}

function versionDirectory(cacheRoot: string, version: string): string {
  return path.join(versionsRoot(cacheRoot), version)
}

function readAndVerifyBundle(
  directory: string,
  publicKey: string,
  expectedVersion?: string
): ActiveDataBundle {
  const manifestText = readFileSync(path.join(directory, ManifestFilename), 'utf8')
  const manifest = parseDataManifest(manifestText)
  verifyDataManifest(manifest, publicKey)
  if (expectedVersion !== undefined && manifest.dataVersion !== expectedVersion) {
    throw new Error('active data version does not match its directory')
  }

  for (const file of manifest.files) {
    const filePath = path.join(directory, ...file.path.split('/'))
    const stats = statSync(filePath)
    if (!stats.isFile()) {
      throw new Error(`data path is not a file: ${file.path}`)
    }
    validateDataFile(file, readFileSync(filePath))
  }
  return { directory, manifest }
}

export function loadActiveDataBundle(
  cacheRoot: string,
  publicKey: string
): ActiveDataBundle | null {
  try {
    const pointer = parseJson(
      readFileSync(path.join(dataUpdateRoot(cacheRoot), ActiveFilename), 'utf8'),
      'active data pointer'
    )
    if (
      !isRecord(pointer) ||
      typeof pointer.version !== 'string' ||
      !DataVersionPattern.test(pointer.version)
    ) {
      return null
    }
    return readAndVerifyBundle(
      versionDirectory(cacheRoot, pointer.version),
      publicKey,
      pointer.version
    )
  } catch {
    return null
  }
}

function validateManifestUrl(value: string, allowInsecureLocalhost: boolean): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('invalid data manifest URL')
  }
  const localHttp =
    allowInsecureLocalhost &&
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]')
  if (url.protocol !== 'https:' && !localHttp) {
    throw new Error('data manifest URL must use HTTPS')
  }
  if (url.username || url.password || url.hash) {
    throw new Error('data manifest URL cannot contain credentials or a fragment')
  }
  return url
}

export function resolveDataUpdateConfiguration(
  manifestUrlValue: string | undefined,
  publicKeyValue: string | undefined,
  allowInsecureLocalhost = false,
  expectedPublicKeySha256Value?: string
): DataUpdateConfiguration {
  const manifestUrl = manifestUrlValue?.trim() ?? ''
  const publicKey = publicKeyValue?.trim() ?? ''
  const expectedPublicKeySha256 = expectedPublicKeySha256Value?.trim() ?? ''

  if (!manifestUrl && !publicKey && !expectedPublicKeySha256) {
    return { status: 'disabled' }
  }
  if (!manifestUrl) {
    return { status: 'invalid', reason: 'missing-manifest-url' }
  }
  if (!publicKey) {
    return { status: 'invalid', reason: 'missing-public-key' }
  }

  try {
    validateManifestUrl(manifestUrl, allowInsecureLocalhost)
  } catch {
    return { status: 'invalid', reason: 'invalid-manifest-url' }
  }
  let parsedPublicKey: ReturnType<typeof createPublicKey>
  try {
    parsedPublicKey = parseDataUpdatePublicKey(publicKey)
  } catch {
    return { status: 'invalid', reason: 'invalid-public-key' }
  }
  if (expectedPublicKeySha256Value !== undefined) {
    const der = parsedPublicKey.export({ format: 'der', type: 'spki' })
    const actualPublicKeySha256 = createHash('sha256').update(der).digest('hex')
    if (
      !Sha256Pattern.test(expectedPublicKeySha256) ||
      actualPublicKeySha256 !== expectedPublicKeySha256
    ) {
      return { status: 'invalid', reason: 'invalid-public-key-fingerprint' }
    }
  }

  return { status: 'enabled', manifestUrl, publicKey }
}

function validateResponseOrigin(
  response: DataFetchResponse,
  expectedOrigin: string,
  description: string
): void {
  if (!response.url) {
    return
  }
  try {
    if (new URL(response.url).origin !== expectedOrigin) {
      throw new Error(`${description} redirected to another origin`)
    }
  } catch (error) {
    if (error instanceof Error && error.message.endsWith('redirected to another origin')) {
      throw error
    }
    throw new Error(`${description} returned an invalid final URL`)
  }
}

async function fetchText(fetchData: DataFetch, url: URL, signal: AbortSignal): Promise<string> {
  const response = await fetchData(url.toString(), { signal })
  if (!response.ok) {
    throw new Error(`data update request failed (${response.status})`)
  }
  validateResponseOrigin(response, url.origin, 'data manifest')
  return (await readResponseBody(response, MaxManifestBytes, 'data manifest')).toString('utf8')
}

async function readResponseBody(
  response: DataFetchResponse,
  maxBytes: number,
  description: string
): Promise<Buffer> {
  if (!response.body) {
    const data = Buffer.from(await response.arrayBuffer())
    if (data.byteLength > maxBytes) {
      throw new Error(`${description} is too large`)
    }
    return data
  }

  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let size = 0
  while (true) {
    const result = await reader.read()
    if (result.done) {
      break
    }
    const chunk = Buffer.from(result.value)
    size += chunk.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      throw new Error(`${description} is too large`)
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, size)
}

async function fetchFile(
  fetchData: DataFetch,
  url: URL,
  expectedOrigin: string,
  signal: AbortSignal
): Promise<Buffer> {
  if (url.origin !== expectedOrigin) {
    throw new Error('data file URL must use the manifest origin')
  }
  const response = await fetchData(url.toString(), { signal })
  if (!response.ok) {
    throw new Error(`data file request failed (${response.status})`)
  }
  validateResponseOrigin(response, expectedOrigin, 'data file')
  return readResponseBody(response, MaxDataFileBytes, 'downloaded data file')
}

function activateBundle(cacheRoot: string, version: string): void {
  const root = dataUpdateRoot(cacheRoot)
  mkdirSync(root, { recursive: true })
  const pointerPath = path.join(root, ActiveFilename)
  const temporaryPointerPath = path.join(root, `${ActiveFilename}.${randomUUID()}.tmp`)
  writeFileSync(temporaryPointerPath, JSON.stringify({ version }), 'utf8')
  try {
    renameSync(temporaryPointerPath, pointerPath)
  } catch {
    writeFileSync(pointerPath, JSON.stringify({ version }), 'utf8')
    rmSync(temporaryPointerPath, { force: true })
  }
}

export async function installDataUpdate(
  options: InstallDataUpdateOptions
): Promise<InstallDataUpdateResult> {
  const manifestUrl = validateManifestUrl(
    options.manifestUrl,
    options.allowInsecureLocalhost === true
  )
  parseDataUpdatePublicKey(options.publicKey)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000)
  let stagingDirectory: string | null = null

  try {
    const manifestText = await fetchText(options.fetch, manifestUrl, controller.signal)
    const manifest = parseDataManifest(manifestText)
    verifyDataManifest(manifest, options.publicKey)

    const current = loadActiveDataBundle(options.cacheRoot, options.publicKey)
    if (current?.manifest.dataVersion === manifest.dataVersion) {
      return { status: 'current', version: manifest.dataVersion }
    }
    if (current && Date.parse(manifest.publishedAt) <= Date.parse(current.manifest.publishedAt)) {
      return { status: 'current', version: current.manifest.dataVersion }
    }

    const finalDirectory = versionDirectory(options.cacheRoot, manifest.dataVersion)
    if (existsSync(finalDirectory)) {
      try {
        readAndVerifyBundle(finalDirectory, options.publicKey, manifest.dataVersion)
        activateBundle(options.cacheRoot, manifest.dataVersion)
        return { status: 'installed', version: manifest.dataVersion }
      } catch {
        const quarantineDirectory = path.join(
          versionsRoot(options.cacheRoot),
          `.invalid-${manifest.dataVersion}-${randomUUID()}`
        )
        renameSync(finalDirectory, quarantineDirectory)
      }
    }

    mkdirSync(versionsRoot(options.cacheRoot), { recursive: true })
    stagingDirectory = path.join(
      versionsRoot(options.cacheRoot),
      `.staging-${manifest.dataVersion}-${randomUUID()}`
    )
    mkdirSync(stagingDirectory)

    for (const file of manifest.files) {
      const fileUrl = new URL(file.path, manifestUrl)
      const data = await fetchFile(options.fetch, fileUrl, manifestUrl.origin, controller.signal)
      validateDataFile(file, data)
      const destination = path.join(stagingDirectory, ...file.path.split('/'))
      mkdirSync(path.dirname(destination), { recursive: true })
      writeFileSync(destination, data)
    }
    writeFileSync(path.join(stagingDirectory, ManifestFilename), JSON.stringify(manifest), 'utf8')
    readAndVerifyBundle(stagingDirectory, options.publicKey, manifest.dataVersion)
    renameSync(stagingDirectory, finalDirectory)
    stagingDirectory = null
    activateBundle(options.cacheRoot, manifest.dataVersion)
    return { status: 'installed', version: manifest.dataVersion }
  } finally {
    clearTimeout(timeout)
    if (stagingDirectory) {
      rmSync(stagingDirectory, { recursive: true, force: true })
    }
  }
}

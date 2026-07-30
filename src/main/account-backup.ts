import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { DbName, type DbName as DbNameType } from '@common/record'
import type { DatabaseSnapshotInfo } from '@main/worker/msg'

const BackupSchemaVersion = 1
const ManifestFilename = 'manifest.json'
const DataDirectory = 'data'
const MaxManifestBytes = 1024 * 1024
const MaxDatabaseFileBytes = 4 * 1024 * 1024 * 1024
const MaxProfileFileBytes = 64 * 1024 * 1024
const MaxBundleBytes = 16 * 1024 * 1024 * 1024
const MaxBundleFiles = 12
const UuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const AppVersionPattern = /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$/
const MemberIdPattern = /^[0-9]{1,32}$/
const Sha256Pattern = /^[0-9a-f]{64}$/

const DatabaseNames = Object.values(DbName)
const RequiredDatabasePaths = DatabaseNames.map(
  (dbName) => `${DataDirectory}/${dbName}.db`
)
const ProfileFilenames = [
  'app.json',
  'airbase_spots.json',
  'inherit_score.json'
] as const
const ProfilePaths = ProfileFilenames.map(
  (filename) => `${DataDirectory}/${filename}`
)
const AllowedPaths = new Set([
  ...RequiredDatabasePaths,
  ...ProfilePaths
])

export interface AccountBackupFile {
  readonly path: string
  readonly category: 'database' | 'account-profile'
  readonly size: number
  readonly sha256: string
  readonly recordCount: number | null
  readonly oldestRecordAt: string | null
  readonly newestRecordAt: string | null
}

export interface AccountBackupSummary {
  readonly databaseFiles: number
  readonly profileFiles: number
  readonly records: number
  readonly oldestRecordAt: string | null
  readonly newestRecordAt: string | null
}

export interface AccountBackupManifest {
  readonly schemaVersion: 1
  readonly bundleId: string
  readonly appVersion: string
  readonly createdAt: string
  readonly sourceDeviceId: string
  readonly mode: 'backup'
  readonly protection: 'none-local-only'
  readonly account: {
    readonly serverId: number
    readonly memberId: string
  }
  readonly summary: AccountBackupSummary
  readonly files: AccountBackupFile[]
}

export interface CreateLocalAccountBackupOptions {
  readonly sourceDirectory: string
  readonly destinationRoot: string
  readonly appDataRoot: string
  readonly appVersion: string
  readonly sourceDeviceId: string
  readonly account: {
    readonly serverId: number
    readonly memberId: string
  }
  readonly databases: DatabaseSnapshotInfo[]
  readonly includeAppProfile?: boolean
  readonly createdAt?: Date
  readonly bundleId?: string
}

export interface VerifiedAccountBackup {
  readonly directory: string
  readonly manifest: AccountBackupManifest
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  description: string
): void {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${description} has unsupported fields`)
  }
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  )
}

function isNullableIsoTimestamp(value: unknown): value is string | null {
  return value === null || isIsoTimestamp(value)
}

function parseJson(text: string, description: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${description} is not valid JSON`)
  }
}

function databaseNameFromPath(filePath: string): DbNameType | null {
  const match = /^data\/([a-z]+)\.db$/.exec(filePath)
  if (!match || !DatabaseNames.includes(match[1] as DbNameType)) {
    return null
  }
  return match[1] as DbNameType
}

function validateTimeRange(
  oldestRecordAt: string | null,
  newestRecordAt: string | null,
  description: string
): void {
  if ((oldestRecordAt === null) !== (newestRecordAt === null)) {
    throw new Error(`${description} has an incomplete record range`)
  }
  if (
    oldestRecordAt !== null &&
    newestRecordAt !== null &&
    Date.parse(oldestRecordAt) > Date.parse(newestRecordAt)
  ) {
    throw new Error(`${description} has an invalid record range`)
  }
}

function summarizeFiles(files: readonly AccountBackupFile[]): AccountBackupSummary {
  let databaseFiles = 0
  let profileFiles = 0
  let records = 0
  let oldestTimestamp = Number.POSITIVE_INFINITY
  let newestTimestamp = Number.NEGATIVE_INFINITY

  for (const file of files) {
    if (file.category === 'database') {
      databaseFiles += 1
      records += file.recordCount ?? 0
    } else {
      profileFiles += 1
    }
    if (file.oldestRecordAt) {
      oldestTimestamp = Math.min(
        oldestTimestamp,
        Date.parse(file.oldestRecordAt)
      )
    }
    if (file.newestRecordAt) {
      newestTimestamp = Math.max(
        newestTimestamp,
        Date.parse(file.newestRecordAt)
      )
    }
  }

  return {
    databaseFiles,
    profileFiles,
    records,
    oldestRecordAt:
      Number.isFinite(oldestTimestamp)
        ? new Date(oldestTimestamp).toISOString()
        : null,
    newestRecordAt:
      Number.isFinite(newestTimestamp)
        ? new Date(newestTimestamp).toISOString()
        : null
  }
}

export function parseAccountBackupManifest(
  text: string
): AccountBackupManifest {
  if (Buffer.byteLength(text, 'utf8') > MaxManifestBytes) {
    throw new Error('account backup manifest is too large')
  }

  const value = parseJson(text, 'account backup manifest')
  if (!isRecord(value)) {
    throw new Error('account backup manifest must be an object')
  }
  requireExactKeys(
    value,
    [
      'schemaVersion',
      'bundleId',
      'appVersion',
      'createdAt',
      'sourceDeviceId',
      'mode',
      'protection',
      'account',
      'summary',
      'files'
    ],
    'account backup manifest'
  )

  if (value.schemaVersion !== BackupSchemaVersion) {
    throw new Error('unsupported account backup schema')
  }
  if (typeof value.bundleId !== 'string' || !UuidPattern.test(value.bundleId)) {
    throw new Error('invalid account backup bundle id')
  }
  if (
    typeof value.appVersion !== 'string' ||
    !AppVersionPattern.test(value.appVersion)
  ) {
    throw new Error('invalid account backup app version')
  }
  if (!isIsoTimestamp(value.createdAt)) {
    throw new Error('invalid account backup creation time')
  }
  if (
    typeof value.sourceDeviceId !== 'string' ||
    !UuidPattern.test(value.sourceDeviceId)
  ) {
    throw new Error('invalid account backup source device id')
  }
  if (value.mode !== 'backup' || value.protection !== 'none-local-only') {
    throw new Error('unsupported account backup mode or protection')
  }
  if (!isRecord(value.account)) {
    throw new Error('invalid account backup account')
  }
  requireExactKeys(
    value.account,
    ['serverId', 'memberId'],
    'account backup account'
  )
  if (
    !Number.isSafeInteger(value.account.serverId) ||
    (value.account.serverId as number) <= 0 ||
    typeof value.account.memberId !== 'string' ||
    !MemberIdPattern.test(value.account.memberId)
  ) {
    throw new Error('invalid account backup account identity')
  }

  if (
    !Array.isArray(value.files) ||
    value.files.length < RequiredDatabasePaths.length ||
    value.files.length > MaxBundleFiles
  ) {
    throw new Error('invalid account backup file list')
  }

  const seenPaths = new Set<string>()
  let totalSize = 0
  const files = value.files.map((rawFile, index): AccountBackupFile => {
    if (!isRecord(rawFile)) {
      throw new Error(`account backup file ${index} must be an object`)
    }
    requireExactKeys(
      rawFile,
      [
        'path',
        'category',
        'size',
        'sha256',
        'recordCount',
        'oldestRecordAt',
        'newestRecordAt'
      ],
      `account backup file ${index}`
    )

    if (
      typeof rawFile.path !== 'string' ||
      !AllowedPaths.has(rawFile.path) ||
      rawFile.path.includes('\\') ||
      path.posix.isAbsolute(rawFile.path) ||
      rawFile.path.split('/').includes('..')
    ) {
      throw new Error(`invalid account backup file path at index ${index}`)
    }
    if (seenPaths.has(rawFile.path)) {
      throw new Error(`duplicate account backup file path: ${rawFile.path}`)
    }

    const dbName = databaseNameFromPath(rawFile.path)
    const expectedCategory = dbName ? 'database' : 'account-profile'
    if (rawFile.category !== expectedCategory) {
      throw new Error(`invalid account backup category: ${rawFile.path}`)
    }
    const maxBytes = dbName ? MaxDatabaseFileBytes : MaxProfileFileBytes
    if (
      !Number.isSafeInteger(rawFile.size) ||
      (rawFile.size as number) < 0 ||
      (rawFile.size as number) > maxBytes
    ) {
      throw new Error(`invalid account backup file size: ${rawFile.path}`)
    }
    if (
      typeof rawFile.sha256 !== 'string' ||
      !Sha256Pattern.test(rawFile.sha256)
    ) {
      throw new Error(`invalid account backup file hash: ${rawFile.path}`)
    }
    if (
      dbName
        ? !Number.isSafeInteger(rawFile.recordCount) ||
          (rawFile.recordCount as number) < 0
        : rawFile.recordCount !== null
    ) {
      throw new Error(`invalid account backup record count: ${rawFile.path}`)
    }
    if (
      !isNullableIsoTimestamp(rawFile.oldestRecordAt) ||
      !isNullableIsoTimestamp(rawFile.newestRecordAt)
    ) {
      throw new Error(`invalid account backup record range: ${rawFile.path}`)
    }
    if (!dbName && (
      rawFile.oldestRecordAt !== null ||
      rawFile.newestRecordAt !== null
    )) {
      throw new Error(`profile file cannot have a record range: ${rawFile.path}`)
    }
    validateTimeRange(
      rawFile.oldestRecordAt,
      rawFile.newestRecordAt,
      `account backup file ${rawFile.path}`
    )

    seenPaths.add(rawFile.path)
    totalSize += rawFile.size as number
    return {
      path: rawFile.path,
      category: expectedCategory,
      size: rawFile.size as number,
      sha256: rawFile.sha256,
      recordCount: rawFile.recordCount as number | null,
      oldestRecordAt: rawFile.oldestRecordAt,
      newestRecordAt: rawFile.newestRecordAt
    }
  })

  for (const requiredPath of RequiredDatabasePaths) {
    if (!seenPaths.has(requiredPath)) {
      throw new Error(`missing account backup database: ${requiredPath}`)
    }
  }
  if (totalSize > MaxBundleBytes) {
    throw new Error('account backup bundle is too large')
  }

  if (!isRecord(value.summary)) {
    throw new Error('invalid account backup summary')
  }
  requireExactKeys(
    value.summary,
    [
      'databaseFiles',
      'profileFiles',
      'records',
      'oldestRecordAt',
      'newestRecordAt'
    ],
    'account backup summary'
  )
  const expectedSummary = summarizeFiles(files)
  const actualSummary = value.summary
  if (
    actualSummary.databaseFiles !== expectedSummary.databaseFiles ||
    actualSummary.profileFiles !== expectedSummary.profileFiles ||
    actualSummary.records !== expectedSummary.records ||
    actualSummary.oldestRecordAt !== expectedSummary.oldestRecordAt ||
    actualSummary.newestRecordAt !== expectedSummary.newestRecordAt
  ) {
    throw new Error('account backup summary does not match its files')
  }

  return {
    schemaVersion: BackupSchemaVersion,
    bundleId: value.bundleId,
    appVersion: value.appVersion,
    createdAt: value.createdAt,
    sourceDeviceId: value.sourceDeviceId,
    mode: 'backup',
    protection: 'none-local-only',
    account: {
      serverId: value.account.serverId as number,
      memberId: value.account.memberId
    },
    summary: expectedSummary,
    files: [...files].sort((left, right) =>
      left.path.localeCompare(right.path)
    )
  }
}

function samePath(left: string, right: string): boolean {
  const normalize = (value: string): string => {
    const resolved = path.resolve(value)
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved
  }
  return normalize(left) === normalize(right)
}

function isWithinPath(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate)
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  )
}

async function requireRealDirectory(directory: string, description: string) {
  const stats = await fs.promises.lstat(directory)
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`${description} must be a real directory`)
  }
  return fs.promises.realpath(directory)
}

async function hashFile(
  filePath: string,
  maxBytes: number
): Promise<{ readonly size: number; readonly sha256: string }> {
  const stats = await fs.promises.lstat(filePath)
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error('account backup path must be a regular file')
  }
  if (stats.size > maxBytes) {
    throw new Error('account backup file exceeds its size limit')
  }

  const hash = createHash('sha256')
  let size = 0
  for await (const chunk of fs.createReadStream(filePath)) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += data.byteLength
    if (size > maxBytes) {
      throw new Error('account backup file exceeds its size limit')
    }
    hash.update(data)
  }
  if (size !== stats.size) {
    throw new Error('account backup file changed while being read')
  }
  return { size, sha256: hash.digest('hex') }
}

async function copyRegularFile(
  sourcePath: string,
  destinationPath: string,
  maxBytes: number,
  description: string
): Promise<void> {
  const sourceStats = await fs.promises.lstat(sourcePath)
  if (sourceStats.isSymbolicLink() || !sourceStats.isFile()) {
    throw new Error(`${description} must be a regular file`)
  }
  if (sourceStats.size > maxBytes) {
    throw new Error(`${description} exceeds its size limit`)
  }
  await fs.promises.copyFile(
    sourcePath,
    destinationPath,
    fs.constants.COPYFILE_EXCL
  )
}

async function validateNeDbFile(
  filePath: string,
  expectedRecordCount: number
): Promise<void> {
  const input = fs.createReadStream(filePath, { encoding: 'utf8' })
  const lines = readline.createInterface({ input, crlfDelay: Infinity })
  let recordCount = 0

  try {
    for await (const line of lines) {
      if (line.length === 0) {
        continue
      }
      const value = parseJson(line, 'account backup database line')
      if (!isRecord(value)) {
        throw new Error('account backup database line must be an object')
      }
      if (typeof value._id === 'string') {
        recordCount += 1
      } else if (!isRecord(value.$$indexCreated)) {
        throw new Error('account backup database contains an invalid record')
      }
    }
  } finally {
    lines.close()
  }

  if (recordCount !== expectedRecordCount) {
    throw new Error('account backup database record count mismatch')
  }
}

async function validateProfileFile(filePath: string): Promise<void> {
  parseJson(
    await fs.promises.readFile(filePath, 'utf8'),
    'account backup profile'
  )
}

export async function verifyAccountBackupPayloadFile(
  filePath: string,
  file: AccountBackupFile
): Promise<void> {
  const maxBytes =
    file.category === 'database'
      ? MaxDatabaseFileBytes
      : MaxProfileFileBytes
  const actual = await hashFile(filePath, maxBytes)
  if (actual.size !== file.size) {
    throw new Error(`account backup file size mismatch: ${file.path}`)
  }
  if (actual.sha256 !== file.sha256) {
    throw new Error(`account backup file hash mismatch: ${file.path}`)
  }
  if (file.category === 'database') {
    if (file.recordCount === null) {
      throw new Error(`account backup database has no record count: ${file.path}`)
    }
    await validateNeDbFile(filePath, file.recordCount)
  } else {
    await validateProfileFile(filePath)
  }
}

async function collectBundleFiles(
  directory: string,
  relativeDirectory: string = '',
  files: string[] = []
): Promise<string[]> {
  const absoluteDirectory = relativeDirectory
    ? path.join(directory, ...relativeDirectory.split('/'))
    : directory
  const entries = await fs.promises.readdir(absoluteDirectory, {
    withFileTypes: true
  })
  for (const entry of entries) {
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name
    const absolutePath = path.join(absoluteDirectory, entry.name)
    const stats = await fs.promises.lstat(absolutePath)
    if (stats.isSymbolicLink()) {
      throw new Error('account backup bundle cannot contain symlinks')
    }
    if (stats.isDirectory()) {
      await collectBundleFiles(directory, relativePath, files)
    } else if (stats.isFile()) {
      files.push(relativePath)
    } else {
      throw new Error('account backup bundle contains an unsupported path')
    }
    if (files.length > MaxBundleFiles + 1) {
      throw new Error('account backup bundle contains too many files')
    }
  }
  return files
}

export async function verifyLocalAccountBackup(
  directory: string
): Promise<VerifiedAccountBackup> {
  const realDirectory = await requireRealDirectory(
    directory,
    'account backup bundle'
  )
  const manifestPath = path.join(realDirectory, ManifestFilename)
  const manifestStats = await fs.promises.lstat(manifestPath)
  if (
    manifestStats.isSymbolicLink() ||
    !manifestStats.isFile() ||
    manifestStats.size > MaxManifestBytes
  ) {
    throw new Error('invalid account backup manifest file')
  }
  const manifest = parseAccountBackupManifest(
    await fs.promises.readFile(manifestPath, 'utf8')
  )

  const expectedFiles = new Set([
    ManifestFilename,
    ...manifest.files.map((file) => file.path)
  ])
  const actualFiles = await collectBundleFiles(realDirectory)
  if (
    actualFiles.length !== expectedFiles.size ||
    actualFiles.some((filePath) => !expectedFiles.has(filePath))
  ) {
    throw new Error('account backup bundle file list does not match manifest')
  }

  for (const file of manifest.files) {
    const filePath = path.join(realDirectory, ...file.path.split('/'))
    await verifyAccountBackupPayloadFile(filePath, file)
  }

  return { directory: realDirectory, manifest }
}

function snapshotMap(
  databases: readonly DatabaseSnapshotInfo[]
): Map<DbNameType, DatabaseSnapshotInfo> {
  const snapshots = new Map<DbNameType, DatabaseSnapshotInfo>()
  for (const database of databases) {
    if (snapshots.has(database.dbName)) {
      throw new Error(`duplicate database snapshot: ${database.dbName}`)
    }
    snapshots.set(database.dbName, database)
  }
  for (const dbName of DatabaseNames) {
    if (!snapshots.has(dbName)) {
      throw new Error(`missing database snapshot: ${dbName}`)
    }
  }
  if (snapshots.size !== DatabaseNames.length) {
    throw new Error('database snapshot contains an unsupported database')
  }
  return snapshots
}

function bundleDirectoryName(createdAt: string, bundleId: string): string {
  const timestamp = createdAt.replace(/[-:.]/g, '')
  return `koubrowser-backup-${timestamp}-${bundleId}`
}

export async function createVerifiedLocalAccountBackup(
  options: CreateLocalAccountBackupOptions
): Promise<VerifiedAccountBackup> {
  const createdAt = (options.createdAt ?? new Date()).toISOString()
  const bundleId = options.bundleId ?? randomUUID()
  if (!UuidPattern.test(bundleId) || !UuidPattern.test(options.sourceDeviceId)) {
    throw new Error('invalid account backup identifier')
  }
  if (!AppVersionPattern.test(options.appVersion)) {
    throw new Error('invalid account backup app version')
  }
  if (
    !Number.isSafeInteger(options.account.serverId) ||
    options.account.serverId <= 0 ||
    !MemberIdPattern.test(options.account.memberId)
  ) {
    throw new Error('invalid account backup account identity')
  }

  const snapshots = snapshotMap(options.databases)
  const appDataRoot = await requireRealDirectory(
    options.appDataRoot,
    'application data root'
  )
  const sourceDirectory = await requireRealDirectory(
    options.sourceDirectory,
    'account data directory'
  )
  const expectedSource = await fs.promises.realpath(
    path.join(
      appDataRoot,
      'store',
      `${options.account.serverId}_${options.account.memberId}`
    )
  )
  if (
    !samePath(sourceDirectory, expectedSource) ||
    !isWithinPath(sourceDirectory, appDataRoot)
  ) {
    throw new Error('account data directory does not match the target account')
  }

  const destinationRoot = await requireRealDirectory(
    options.destinationRoot,
    'account backup destination'
  )
  if (isWithinPath(destinationRoot, appDataRoot)) {
    throw new Error('account backup destination cannot be inside application data')
  }

  const directoryName = bundleDirectoryName(createdAt, bundleId)
  const finalDirectory = path.join(destinationRoot, directoryName)
  const stagingDirectory = path.join(
    destinationRoot,
    `.${directoryName}.partial`
  )
  if (
    fs.existsSync(finalDirectory) ||
    fs.existsSync(stagingDirectory)
  ) {
    throw new Error('account backup bundle already exists')
  }

  let stagingCreated = false
  let published = false
  try {
    await fs.promises.mkdir(stagingDirectory)
    stagingCreated = true
    await fs.promises.mkdir(path.join(stagingDirectory, DataDirectory))

    const files: AccountBackupFile[] = []
    for (const dbName of DatabaseNames) {
      const snapshot = snapshots.get(dbName)!
      const relativePath = `${DataDirectory}/${dbName}.db`
      const sourcePath = path.join(sourceDirectory, `${dbName}.db`)
      const destinationPath = path.join(
        stagingDirectory,
        ...relativePath.split('/')
      )
      await copyRegularFile(
        sourcePath,
        destinationPath,
        MaxDatabaseFileBytes,
        `account database ${dbName}`
      )
      const hashed = await hashFile(destinationPath, MaxDatabaseFileBytes)
      files.push({
        path: relativePath,
        category: 'database',
        ...hashed,
        recordCount: snapshot.recordCount,
        oldestRecordAt: snapshot.oldestRecordAt,
        newestRecordAt: snapshot.newestRecordAt
      })
    }

    for (const filename of ProfileFilenames) {
      if (filename === 'app.json' && options.includeAppProfile === false) {
        continue
      }
      const sourcePath = path.join(sourceDirectory, filename)
      if (!fs.existsSync(sourcePath)) {
        continue
      }
      const relativePath = `${DataDirectory}/${filename}`
      const destinationPath = path.join(
        stagingDirectory,
        ...relativePath.split('/')
      )
      await copyRegularFile(
        sourcePath,
        destinationPath,
        MaxProfileFileBytes,
        `account profile ${filename}`
      )
      const hashed = await hashFile(destinationPath, MaxProfileFileBytes)
      await validateProfileFile(destinationPath)
      files.push({
        path: relativePath,
        category: 'account-profile',
        ...hashed,
        recordCount: null,
        oldestRecordAt: null,
        newestRecordAt: null
      })
    }

    files.sort((left, right) => left.path.localeCompare(right.path))
    const manifest: AccountBackupManifest = {
      schemaVersion: BackupSchemaVersion,
      bundleId,
      appVersion: options.appVersion,
      createdAt,
      sourceDeviceId: options.sourceDeviceId,
      mode: 'backup',
      protection: 'none-local-only',
      account: { ...options.account },
      summary: summarizeFiles(files),
      files
    }
    await fs.promises.writeFile(
      path.join(stagingDirectory, ManifestFilename),
      JSON.stringify(manifest, undefined, 2),
      { encoding: 'utf8', flag: 'wx' }
    )

    await verifyLocalAccountBackup(stagingDirectory)
    await fs.promises.rename(stagingDirectory, finalDirectory)
    stagingCreated = false
    published = true
    return await verifyLocalAccountBackup(finalDirectory)
  } catch (error) {
    if (stagingCreated) {
      await fs.promises.rm(stagingDirectory, {
        recursive: true,
        force: true
      })
    }
    if (published) {
      await fs.promises.rm(finalDirectory, {
        recursive: true,
        force: true
      })
    }
    throw error
  }
}

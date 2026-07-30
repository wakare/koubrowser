const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { validateQuestStrategyKnowledge } = require('./validate-quest-strategy')

const VersionPattern = /^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/
const MapFilenamePattern = /^[0-9]{3}_[0-9]{2}_map\.json$/
const MapPathPattern = /^map\/[0-9]{3}_[0-9]{2}_map\.json$/
const Sha256Pattern = /^[0-9a-f]{64}$/
const Base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
const ManifestFilename = 'manifest.json'
const QuestKnowledgePath = 'quest/knowledge.json'
const MaxManifestBytes = 1024 * 1024
const MaxDataFileBytes = 2 * 1024 * 1024
const MaxBundleBytes = 64 * 1024 * 1024
const MaxBundleFiles = 512
const MaxQuestClaims = 4096
const MaxQuestId = 9_999_999

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

function parseArguments(argv) {
  const values = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]
    const value = argv[index + 1]
    if (!name?.startsWith('--') || value === undefined) {
      throw new Error(`invalid argument near ${name ?? '(end)'}`)
    }
    const normalizedName = name.slice(2)
    if (values.has(normalizedName)) {
      throw new Error(`duplicate argument: --${normalizedName}`)
    }
    values.set(normalizedName, value)
  }
  return values
}

function requireAllowedArguments(argumentsMap, allowedArguments) {
  for (const name of argumentsMap.keys()) {
    if (!allowedArguments.has(name)) {
      throw new Error(`unsupported argument: --${name}`)
    }
  }
}

function requireArgument(argumentsMap, name) {
  const value = argumentsMap.get(name)
  if (!value) {
    throw new Error(`--${name} is required`)
  }
  return value
}

function signingPayload(manifest) {
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

function validateOutputDirectory(outputDirectory) {
  if (!fs.existsSync(outputDirectory)) {
    return
  }
  if (!fs.statSync(outputDirectory).isDirectory()) {
    throw new Error('output path already exists and is not a directory')
  }
  if (fs.readdirSync(outputDirectory).length > 0) {
    throw new Error('output directory must be empty')
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireExactKeys(value, requiredKeys, optionalKeys, description) {
  const allowed = new Set([...requiredKeys, ...optionalKeys])
  if (
    requiredKeys.some((key) => !Object.prototype.hasOwnProperty.call(value, key)) ||
    Object.keys(value).some((key) => !allowed.has(key))
  ) {
    throw new Error(`${description} has unsupported or missing fields`)
  }
}

function isValidText(value, maxLength) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value)
  )
}

function validateQuestReference(value, description) {
  if (!isRecord(value)) {
    throw new Error(`${description} must be an object`)
  }
  requireExactKeys(value, ['questId', 'title'], [], description)
  if (
    !Number.isSafeInteger(value.questId) ||
    value.questId <= 0 ||
    value.questId > MaxQuestId ||
    !isValidText(value.title, 200)
  ) {
    throw new Error(`invalid ${description}`)
  }
}

function validateQuestClaim(value, index) {
  const description = `quest knowledge claim ${index}`
  if (!isRecord(value)) {
    throw new Error(`${description} must be an object`)
  }
  requireExactKeys(
    value,
    [
      'source',
      'sourceLabel',
      'url',
      'lastVerifiedAt',
      'dataVersion',
      'questId',
      'questTitle',
      'prerequisites'
    ],
    ['prerequisitesComplete', 'reviewStatus', 'reviewNote'],
    description
  )
  if (
    (value.source !== 'wikiwiki' && value.source !== 'kcwiki') ||
    !Number.isSafeInteger(value.questId) ||
    value.questId <= 0 ||
    value.questId > MaxQuestId ||
    !isValidText(value.sourceLabel, 100) ||
    !isValidText(value.questTitle, 200) ||
    !isValidText(value.dataVersion, 200) ||
    !isValidText(value.lastVerifiedAt, 10) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.lastVerifiedAt) ||
    new Date(`${value.lastVerifiedAt}T00:00:00.000Z`).toISOString().slice(0, 10) !==
      value.lastVerifiedAt ||
    !Array.isArray(value.prerequisites) ||
    value.prerequisites.length > 16
  ) {
    throw new Error(`invalid ${description}`)
  }
  const expectedSourceLabel = value.source === 'wikiwiki' ? '日本語攻略Wiki' : '中文KCWiki'
  if (value.sourceLabel !== expectedSourceLabel) {
    throw new Error(`invalid ${description} source label`)
  }
  let url
  try {
    url = new URL(value.url)
  } catch {
    throw new Error(`invalid ${description} URL`)
  }
  const expectedHostname = value.source === 'wikiwiki' ? 'wikiwiki.jp' : 'zh.kcwiki.cn'
  if (
    url.protocol !== 'https:' ||
    url.hostname !== expectedHostname ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== ''
  ) {
    throw new Error(`invalid ${description} URL`)
  }
  const groupSignatures = new Set()
  for (const [groupIndex, group] of value.prerequisites.entries()) {
    const groupDescription = `${description} group ${groupIndex}`
    if (!isRecord(group)) {
      throw new Error(`${groupDescription} must be an object`)
    }
    requireExactKeys(group, ['mode', 'quests'], [], groupDescription)
    if (
      (group.mode !== 'all' && group.mode !== 'any') ||
      !Array.isArray(group.quests) ||
      group.quests.length === 0 ||
      group.quests.length > 32
    ) {
      throw new Error(`invalid ${groupDescription}`)
    }
    const questIds = new Set()
    group.quests.forEach((quest, questIndex) => {
      validateQuestReference(quest, `${groupDescription} quest ${questIndex}`)
      if (quest.questId === value.questId) {
        throw new Error(`${groupDescription} contains a self prerequisite`)
      }
      if (questIds.has(quest.questId)) {
        throw new Error(`${groupDescription} contains a duplicate quest`)
      }
      questIds.add(quest.questId)
    })
    const signature = `${group.mode}:${[...questIds].sort((left, right) => left - right).join(',')}`
    if (groupSignatures.has(signature)) {
      throw new Error(`${description} contains a duplicate prerequisite group`)
    }
    groupSignatures.add(signature)
  }
  if (
    value.prerequisitesComplete !== undefined &&
    typeof value.prerequisitesComplete !== 'boolean'
  ) {
    throw new Error(`invalid ${description} prerequisitesComplete`)
  }
  if (
    value.reviewStatus !== undefined &&
    value.reviewStatus !== 'verified' &&
    value.reviewStatus !== 'incomplete' &&
    value.reviewStatus !== 'under-review'
  ) {
    throw new Error(`invalid ${description} review status`)
  }
  if (value.reviewNote !== undefined && !isValidText(value.reviewNote, 1000)) {
    throw new Error(`invalid ${description} review note`)
  }
  if (
    (value.prerequisitesComplete === false ||
      value.reviewStatus === 'incomplete' ||
      value.reviewStatus === 'under-review') &&
    value.reviewNote === undefined
  ) {
    throw new Error(`${description} requires a review note`)
  }
}

function validateQuestKnowledgeData(data, filename) {
  if (data.byteLength === 0 || data.byteLength > MaxDataFileBytes) {
    throw new Error(`invalid quest knowledge file size: ${filename}`)
  }
  const value = JSON.parse(data.toString('utf8'))
  if (!isRecord(value)) {
    throw new Error('quest knowledge update must be an object')
  }
  requireExactKeys(value, ['schemaVersion', 'claims'], ['strategy'], 'quest knowledge update')
  if (
    value.schemaVersion !== 1 ||
    !Array.isArray(value.claims) ||
    value.claims.length === 0 ||
    value.claims.length > MaxQuestClaims
  ) {
    throw new Error('invalid quest knowledge update')
  }
  const seenSources = new Set()
  value.claims.forEach((claim, index) => {
    validateQuestClaim(claim, index)
    const key = `${claim.questId}:${claim.source}`
    if (seenSources.has(key)) {
      throw new Error(`duplicate quest knowledge source: ${key}`)
    }
    seenSources.add(key)
  })
  if (value.strategy !== undefined) {
    validateQuestStrategyKnowledge(value.strategy)
  }
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNumberArray(value) {
  return Array.isArray(value) && value.every(isFiniteNumber)
}

function isNumberMatrix(value) {
  return Array.isArray(value) && value.every(isNumberArray)
}

function isMapSpot(value) {
  if (!isRecord(value)) {
    return false
  }
  if (!Number.isInteger(value.no) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) {
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

function isMapCheck(value) {
  if (!isRecord(value)) {
    return false
  }
  if (
    !Number.isInteger(value.no) ||
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

function isMapData(value) {
  if (!isRecord(value) || !Array.isArray(value.spots) || !value.spots.every(isMapSpot)) {
    return false
  }
  if (
    value.checks !== undefined &&
    (!Array.isArray(value.checks) || !value.checks.every(isMapCheck))
  ) {
    return false
  }
  return ['spots_1', 'spots_2', 'spots_3'].every(
    (key) => value[key] === undefined || (Array.isArray(value[key]) && value[key].every(isMapSpot))
  )
}

function validateMapData(data, filename) {
  if (data.byteLength === 0 || data.byteLength > MaxDataFileBytes) {
    throw new Error(`invalid map data file size: ${filename}`)
  }
  const value = JSON.parse(data.toString('utf8'))
  if (!isMapData(value)) {
    throw new Error(`invalid map data file: ${filename}`)
  }
}

function parseManifest(data) {
  if (data.byteLength === 0 || data.byteLength > MaxManifestBytes) {
    throw new Error('invalid data manifest size')
  }
  const value = JSON.parse(data.toString('utf8'))
  if (!isRecord(value)) {
    throw new Error('data manifest must be an object')
  }
  requireExactKeys(
    value,
    ['schemaVersion', 'dataVersion', 'publishedAt', 'files', 'signature'],
    [],
    'data manifest'
  )
  if (value.schemaVersion !== 1) {
    throw new Error('unsupported data manifest schema')
  }
  if (typeof value.dataVersion !== 'string' || !VersionPattern.test(value.dataVersion)) {
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

  const paths = new Set()
  let totalSize = 0
  value.files.forEach((file, index) => {
    if (!isRecord(file)) {
      throw new Error(`data manifest file ${index} must be an object`)
    }
    requireExactKeys(file, ['path', 'sha256', 'size'], [], `data manifest file ${index}`)
    if (
      typeof file.path !== 'string' ||
      (!MapPathPattern.test(file.path) && file.path !== QuestKnowledgePath)
    ) {
      throw new Error(`invalid data file path at index ${index}`)
    }
    if (paths.has(file.path)) {
      throw new Error(`duplicate data file path: ${file.path}`)
    }
    if (typeof file.sha256 !== 'string' || !Sha256Pattern.test(file.sha256)) {
      throw new Error(`invalid data file hash: ${file.path}`)
    }
    if (!Number.isInteger(file.size) || file.size <= 0 || file.size > MaxDataFileBytes) {
      throw new Error(`invalid data file size: ${file.path}`)
    }
    paths.add(file.path)
    totalSize += file.size
  })
  if (totalSize > MaxBundleBytes) {
    throw new Error('data bundle is too large')
  }
  return value
}

function parsePublicKey(publicKey) {
  if (typeof publicKey !== 'string' || publicKey.length === 0 || !Base64Pattern.test(publicKey)) {
    throw new Error('invalid data update public key')
  }
  try {
    const key = crypto.createPublicKey({
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

function publicKeySha256(publicKey) {
  return inspectPublicKey(publicKey).sha256
}

function inspectPublicKey(publicKey) {
  const key = parsePublicKey(publicKey)
  const der = key.export({ format: 'der', type: 'spki' })
  return {
    algorithm: 'Ed25519',
    publicKey: der.toString('base64'),
    sha256: crypto.createHash('sha256').update(der).digest('hex')
  }
}

function collectBundleFiles(rootDirectory, currentDirectory = rootDirectory) {
  const files = []
  for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
    const entryPath = path.join(currentDirectory, entry.name)
    if (entry.isSymbolicLink()) {
      throw new Error('data bundle cannot contain symbolic links')
    }
    if (entry.isDirectory()) {
      files.push(...collectBundleFiles(rootDirectory, entryPath))
      continue
    }
    if (!entry.isFile()) {
      throw new Error('data bundle contains an unsupported filesystem entry')
    }
    files.push(path.relative(rootDirectory, entryPath).split(path.sep).join('/'))
  }
  return files.sort()
}

function verifyBundleDirectory(bundleDirectory, publicKey) {
  const directory = path.resolve(bundleDirectory)
  const directoryStats = fs.lstatSync(directory)
  if (directoryStats.isSymbolicLink() || !directoryStats.isDirectory()) {
    throw new Error('data bundle path must be a real directory')
  }

  const actualFiles = collectBundleFiles(directory)
  const manifestData = fs.readFileSync(path.join(directory, ManifestFilename))
  const manifest = parseManifest(manifestData)
  const key = parsePublicKey(publicKey)
  const signatureValid = crypto.verify(
    null,
    Buffer.from(signingPayload(manifest), 'utf8'),
    key,
    Buffer.from(manifest.signature, 'base64')
  )
  if (!signatureValid) {
    throw new Error('data manifest signature verification failed')
  }

  const expectedFiles = [ManifestFilename, ...manifest.files.map((file) => file.path)].sort()
  if (
    actualFiles.length !== expectedFiles.length ||
    actualFiles.some((file, index) => file !== expectedFiles[index])
  ) {
    throw new Error('data bundle file list does not match its manifest')
  }

  for (const file of manifest.files) {
    const data = fs.readFileSync(path.join(directory, ...file.path.split('/')))
    if (data.byteLength !== file.size) {
      throw new Error(`data file size mismatch: ${file.path}`)
    }
    const hash = crypto.createHash('sha256').update(data).digest('hex')
    if (hash !== file.sha256) {
      throw new Error(`data file hash mismatch: ${file.path}`)
    }
    if (file.path === QuestKnowledgePath) {
      validateQuestKnowledgeData(data, file.path)
    } else {
      validateMapData(data, file.path)
    }
  }

  return {
    dataVersion: manifest.dataVersion,
    publishedAt: manifest.publishedAt,
    fileCount: manifest.files.length,
    totalSize: manifest.files.reduce((total, file) => total + file.size, 0),
    hasQuestKnowledge: manifest.files.some((file) => file.path === QuestKnowledgePath),
    files: manifest.files.map((file) => ({ ...file }))
  }
}

function requireRealFile(filename, description) {
  const resolved = path.resolve(filename)
  const stats = fs.lstatSync(resolved)
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`${description} must be a real file`)
  }
  return resolved
}

function readPrivateKeyPassphrase(passphraseFilename) {
  const passphrasePath = requireRealFile(passphraseFilename, 'private key passphrase path')
  const passphraseData = fs.readFileSync(passphrasePath)
  try {
    if (passphraseData.byteLength === 0 || passphraseData.byteLength > 4096) {
      throw new Error('private key passphrase file must contain one non-empty line')
    }

    let end = passphraseData.byteLength
    if (passphraseData[end - 1] === 0x0a) {
      end -= 1
      if (end > 0 && passphraseData[end - 1] === 0x0d) {
        end -= 1
      }
    }
    const passphrase = Buffer.from(passphraseData.subarray(0, end))
    if (
      passphrase.byteLength === 0 ||
      passphrase.includes(0x0a) ||
      passphrase.includes(0x0d) ||
      passphrase.includes(0x00)
    ) {
      passphrase.fill(0)
      throw new Error('private key passphrase file must contain one non-empty line')
    }
    return passphrase
  } finally {
    passphraseData.fill(0)
  }
}

function readPrivateKey(privateKeyFilename, passphraseFilename) {
  const privateKeyPath = requireRealFile(privateKeyFilename, 'private key path')
  const privateKeyData = fs.readFileSync(privateKeyPath)
  let passphrase

  try {
    if (passphraseFilename !== undefined) {
      passphrase = readPrivateKeyPassphrase(passphraseFilename)
    }

    try {
      return crypto.createPrivateKey({
        key: privateKeyData,
        format: 'pem',
        passphrase
      })
    } catch {
      throw new Error(
        'private key could not be read; encrypted PEM requires --private-key-passphrase-file'
      )
    }
  } finally {
    privateKeyData.fill(0)
    passphrase?.fill(0)
  }
}

function createBundle(argv) {
  const argumentsMap = parseArguments(argv)
  requireAllowedArguments(
    argumentsMap,
    new Set([
      'version',
      'private-key',
      'private-key-passphrase-file',
      'output',
      'source',
      'quest-knowledge',
      'published-at'
    ])
  )
  const dataVersion = requireArgument(argumentsMap, 'version')
  const privateKeyPath = requireArgument(argumentsMap, 'private-key')
  const privateKeyPassphrasePath = argumentsMap.get('private-key-passphrase-file')
  const outputDirectory = path.resolve(requireArgument(argumentsMap, 'output'))
  const sourceDirectory = path.resolve(argumentsMap.get('source') ?? 'resources/map')
  const questKnowledgePath = argumentsMap.has('quest-knowledge')
    ? path.resolve(argumentsMap.get('quest-knowledge'))
    : null
  const publishedAt = argumentsMap.get('published-at') ?? new Date().toISOString()

  if (!VersionPattern.test(dataVersion)) {
    throw new Error('invalid data version')
  }
  if (
    !Number.isFinite(Date.parse(publishedAt)) ||
    new Date(publishedAt).toISOString() !== publishedAt
  ) {
    throw new Error('published-at must be an ISO timestamp')
  }
  if (!fs.statSync(sourceDirectory).isDirectory()) {
    throw new Error('source path is not a directory')
  }
  validateOutputDirectory(outputDirectory)

  const filenames = fs
    .readdirSync(sourceDirectory)
    .filter((filename) => MapFilenamePattern.test(filename))
    .sort()
  if (filenames.length === 0) {
    throw new Error('source directory has no map data files')
  }

  const files = filenames.map((filename) => {
    const sourcePath = path.join(sourceDirectory, filename)
    const data = fs.readFileSync(sourcePath)
    validateMapData(data, filename)
    return {
      path: `map/${filename}`,
      sha256: crypto.createHash('sha256').update(data).digest('hex'),
      size: data.byteLength,
      data
    }
  })
  if (questKnowledgePath) {
    const data = fs.readFileSync(questKnowledgePath)
    validateQuestKnowledgeData(data, questKnowledgePath)
    files.push({
      path: 'quest/knowledge.json',
      sha256: crypto.createHash('sha256').update(data).digest('hex'),
      size: data.byteLength,
      data
    })
  }

  const privateKey = readPrivateKey(privateKeyPath, privateKeyPassphrasePath)
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('private key must be Ed25519')
  }
  const manifest = {
    schemaVersion: 1,
    dataVersion,
    publishedAt,
    files: files.map(({ data: _data, ...file }) => file),
    signature: ''
  }
  manifest.signature = crypto
    .sign(null, Buffer.from(signingPayload(manifest), 'utf8'), privateKey)
    .toString('base64')

  for (const file of files) {
    const destination = path.join(outputDirectory, ...file.path.split('/'))
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.writeFileSync(destination, file.data)
  }
  fs.writeFileSync(
    path.join(outputDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  )

  const publicKey = crypto
    .createPublicKey(privateKey)
    .export({ format: 'der', type: 'spki' })
    .toString('base64')
  verifyBundleDirectory(outputDirectory, publicKey)
  console.log(
    `Created data bundle ${dataVersion} with ${filenames.length} map files` +
      `${questKnowledgePath ? ' and quest knowledge' : ''}.`
  )
  console.log(`KOU_DATA_UPDATE_PUBLIC_KEY=${publicKey}`)
  console.log(`KOU_DATA_UPDATE_PUBLIC_KEY_SHA256=${publicKeySha256(publicKey)}`)
}

if (require.main === module) {
  try {
    createBundle(process.argv.slice(2))
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}

module.exports = {
  createBundle,
  inspectPublicKey,
  parseArguments,
  publicKeySha256,
  readPrivateKeyPassphrase,
  requireAllowedArguments,
  requireArgument,
  verifyBundleDirectory
}

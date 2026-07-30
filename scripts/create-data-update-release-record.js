const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const {
  parseArguments,
  publicKeySha256,
  requireAllowedArguments,
  requireArgument,
  verifyBundleDirectory
} = require('./create-data-update-bundle')

const QuestKnowledgePath = 'quest/knowledge.json'
const ReleaseRecordMaxBytes = 64 * 1024
const DataVersionPattern = /^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/
const Sha256Pattern = /^[0-9a-f]{64}$/

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

function requireRealFile(filename, description) {
  const resolved = path.resolve(filename)
  const stats = fs.lstatSync(resolved)
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`${description} must be a real file`)
  }
  return resolved
}

function parseManifestUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('release manifest URL is invalid')
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.hash !== '') {
    throw new Error('release manifest URL must use HTTPS without credentials or a fragment')
  }
  return url.toString()
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireExactKeys(value, expected, description) {
  const actual = Object.keys(value).sort()
  const sortedExpected = [...expected].sort()
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    throw new Error(`${description} has unsupported fields`)
  }
}

function requirePositiveInteger(value, description) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${description} must be a positive integer`)
  }
  return value
}

function requireNonNegativeInteger(value, description) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${description} must be a non-negative integer`)
  }
  return value
}

function requireSha256(value, description) {
  if (typeof value !== 'string' || !Sha256Pattern.test(value)) {
    throw new Error(`${description} must be a SHA-256 hash`)
  }
  return value
}

function parseDataUpdateReleaseRecord(data) {
  if (data.byteLength === 0 || data.byteLength > ReleaseRecordMaxBytes) {
    throw new Error('release review record has an invalid size')
  }

  let value
  try {
    value = JSON.parse(data.toString('utf8'))
  } catch {
    throw new Error('release review record is not valid JSON')
  }
  if (!isRecord(value)) {
    throw new Error('release review record must be an object')
  }
  requireExactKeys(
    value,
    [
      'schemaVersion',
      'dataVersion',
      'publishedAt',
      'manifestUrl',
      'publicKeySha256',
      'manifestSha256',
      'fileCount',
      'payloadBytes',
      'mapFileCount',
      'questKnowledge'
    ],
    'release review record'
  )

  if (value.schemaVersion !== 1) {
    throw new Error('unsupported release review record schema')
  }
  if (typeof value.dataVersion !== 'string' || !DataVersionPattern.test(value.dataVersion)) {
    throw new Error('release review record has an invalid data version')
  }
  if (
    typeof value.publishedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.publishedAt)) ||
    new Date(value.publishedAt).toISOString() !== value.publishedAt
  ) {
    throw new Error('release review record has an invalid publication time')
  }
  if (
    typeof value.manifestUrl !== 'string' ||
    parseManifestUrl(value.manifestUrl) !== value.manifestUrl
  ) {
    throw new Error('release review record has a non-canonical manifest URL')
  }
  if (!isRecord(value.questKnowledge)) {
    throw new Error('release review record quest knowledge must be an object')
  }
  requireExactKeys(
    value.questKnowledge,
    ['sha256', 'size', 'claimCount'],
    'release review record quest knowledge'
  )

  const record = {
    schemaVersion: 1,
    dataVersion: value.dataVersion,
    publishedAt: value.publishedAt,
    manifestUrl: value.manifestUrl,
    publicKeySha256: requireSha256(value.publicKeySha256, 'release review record public key'),
    manifestSha256: requireSha256(value.manifestSha256, 'release review record manifest'),
    fileCount: requirePositiveInteger(value.fileCount, 'release review record file count'),
    payloadBytes: requirePositiveInteger(value.payloadBytes, 'release review record payload bytes'),
    mapFileCount: requireNonNegativeInteger(
      value.mapFileCount,
      'release review record map file count'
    ),
    questKnowledge: {
      sha256: requireSha256(value.questKnowledge.sha256, 'release review record quest knowledge'),
      size: requirePositiveInteger(
        value.questKnowledge.size,
        'release review record quest knowledge size'
      ),
      claimCount: requirePositiveInteger(
        value.questKnowledge.claimCount,
        'release review record quest knowledge claim count'
      )
    }
  }
  if (record.mapFileCount + 1 !== record.fileCount) {
    throw new Error('release review record file counts are inconsistent')
  }
  return record
}

function collectDataUpdateReleaseEvidence(options) {
  const bundleDirectory = path.resolve(options.bundle)
  const publicKeyPath = requireRealFile(options.publicKeyFile, 'public key path')
  const questCandidatePath = requireRealFile(options.questCandidate, 'quest candidate path')
  const manifestUrl = parseManifestUrl(options.manifestUrl)

  const publicKey = fs.readFileSync(publicKeyPath, 'utf8').trim()
  const report = verifyBundleDirectory(bundleDirectory, publicKey)
  const questFile = report.files.find((file) => file.path === QuestKnowledgePath)
  if (!questFile) {
    throw new Error('release bundle must include quest knowledge')
  }

  const questCandidate = fs.readFileSync(questCandidatePath)
  const questCandidateSha256 = crypto.createHash('sha256').update(questCandidate).digest('hex')
  if (questCandidate.byteLength !== questFile.size || questCandidateSha256 !== questFile.sha256) {
    throw new Error('release bundle quest knowledge does not match the reviewed candidate')
  }
  const questKnowledge = JSON.parse(questCandidate.toString('utf8'))
  const manifestData = fs.readFileSync(path.join(bundleDirectory, 'manifest.json'))
  return {
    schemaVersion: 1,
    dataVersion: report.dataVersion,
    publishedAt: report.publishedAt,
    manifestUrl,
    publicKeySha256: publicKeySha256(publicKey),
    manifestSha256: crypto.createHash('sha256').update(manifestData).digest('hex'),
    fileCount: report.fileCount,
    payloadBytes: report.totalSize,
    mapFileCount: report.files.filter((file) =>
      /^map\/[0-9]{3}_[0-9]{2}_map\.json$/.test(file.path)
    ).length,
    questKnowledge: {
      sha256: questFile.sha256,
      size: questFile.size,
      claimCount: questKnowledge.claims.length
    }
  }
}

function createDataUpdateReleaseRecord(argv) {
  const argumentsMap = parseArguments(argv)
  requireAllowedArguments(
    argumentsMap,
    new Set(['bundle', 'public-key-file', 'manifest-url', 'quest-candidate', 'output'])
  )

  const options = {
    bundle: requireArgument(argumentsMap, 'bundle'),
    publicKeyFile: requireArgument(argumentsMap, 'public-key-file'),
    manifestUrl: requireArgument(argumentsMap, 'manifest-url'),
    questCandidate: requireArgument(argumentsMap, 'quest-candidate')
  }
  const outputPath = path.resolve(requireArgument(argumentsMap, 'output'))
  if (fs.existsSync(outputPath)) {
    throw new Error('release record output already exists')
  }
  const record = collectDataUpdateReleaseEvidence(options)

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
  console.log(`Created release review record for ${record.dataVersion}.`)
  console.log(`Public key SHA-256: ${record.publicKeySha256}`)
  console.log(`Manifest SHA-256: ${record.manifestSha256}`)
  console.log(`Quest knowledge SHA-256: ${record.questKnowledge.sha256}`)
}

if (require.main === module) {
  try {
    createDataUpdateReleaseRecord(process.argv.slice(2))
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}

module.exports = {
  collectDataUpdateReleaseEvidence,
  parseDataUpdateReleaseRecord,
  requireRealFile,
  createDataUpdateReleaseRecord
}

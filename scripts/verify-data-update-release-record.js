const fs = require('node:fs')
const { isDeepStrictEqual } = require('node:util')
const {
  parseArguments,
  requireAllowedArguments,
  requireArgument
} = require('./create-data-update-bundle')
const {
  collectDataUpdateReleaseEvidence,
  parseDataUpdateReleaseRecord,
  requireRealFile
} = require('./create-data-update-release-record')

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

function verifyDataUpdateReleaseRecord(argv) {
  const argumentsMap = parseArguments(argv)
  requireAllowedArguments(
    argumentsMap,
    new Set(['bundle', 'public-key-file', 'manifest-url', 'quest-candidate', 'record'])
  )

  const options = {
    bundle: requireArgument(argumentsMap, 'bundle'),
    publicKeyFile: requireArgument(argumentsMap, 'public-key-file'),
    manifestUrl: requireArgument(argumentsMap, 'manifest-url'),
    questCandidate: requireArgument(argumentsMap, 'quest-candidate')
  }
  const recordPath = requireRealFile(
    requireArgument(argumentsMap, 'record'),
    'release review record path'
  )
  const record = parseDataUpdateReleaseRecord(fs.readFileSync(recordPath))
  const expected = collectDataUpdateReleaseEvidence(options)
  if (!isDeepStrictEqual(record, expected)) {
    throw new Error('release review record does not match the supplied release evidence')
  }

  console.log(`Verified release review record for ${record.dataVersion}.`)
  console.log(`Public key SHA-256: ${record.publicKeySha256}`)
  console.log(`Manifest SHA-256: ${record.manifestSha256}`)
  console.log(`Quest knowledge SHA-256: ${record.questKnowledge.sha256}`)
}

if (require.main === module) {
  try {
    verifyDataUpdateReleaseRecord(process.argv.slice(2))
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}

module.exports = {
  verifyDataUpdateReleaseRecord
}

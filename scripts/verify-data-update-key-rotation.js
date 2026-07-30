const fs = require('node:fs')
const path = require('node:path')
const {
  inspectPublicKey,
  parseArguments,
  requireAllowedArguments,
  requireArgument,
  verifyBundleDirectory
} = require('./create-data-update-bundle')

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

function requireSignatureMismatch(bundleDirectory, publicKey, description) {
  try {
    verifyBundleDirectory(bundleDirectory, publicKey)
  } catch (error) {
    if (error instanceof Error && error.message === 'data manifest signature verification failed') {
      return
    }
    throw new Error(
      `${description} failed before the signature mismatch: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
  throw new Error(`${description} unexpectedly accepted the wrong public key`)
}

function verifyDataUpdateKeyRotation(argv) {
  const argumentsMap = parseArguments(argv)
  requireAllowedArguments(
    argumentsMap,
    new Set(['old-bundle', 'old-public-key-file', 'new-bundle', 'new-public-key-file'])
  )

  const oldBundleDirectory = path.resolve(requireArgument(argumentsMap, 'old-bundle'))
  const newBundleDirectory = path.resolve(requireArgument(argumentsMap, 'new-bundle'))
  const oldPublicKey = fs
    .readFileSync(path.resolve(requireArgument(argumentsMap, 'old-public-key-file')), 'utf8')
    .trim()
  const newPublicKey = fs
    .readFileSync(path.resolve(requireArgument(argumentsMap, 'new-public-key-file')), 'utf8')
    .trim()
  const oldKeyReport = inspectPublicKey(oldPublicKey)
  const newKeyReport = inspectPublicKey(newPublicKey)

  if (oldKeyReport.sha256 === newKeyReport.sha256) {
    throw new Error('old and new public keys must differ')
  }

  const oldBundleReport = verifyBundleDirectory(oldBundleDirectory, oldPublicKey)
  const newBundleReport = verifyBundleDirectory(newBundleDirectory, newPublicKey)
  if (oldBundleReport.dataVersion === newBundleReport.dataVersion) {
    throw new Error('old and new data versions must differ')
  }
  if (Date.parse(newBundleReport.publishedAt) <= Date.parse(oldBundleReport.publishedAt)) {
    throw new Error('new bundle published-at must be later than old bundle')
  }

  requireSignatureMismatch(oldBundleDirectory, newPublicKey, 'old bundle with new public key')
  requireSignatureMismatch(newBundleDirectory, oldPublicKey, 'new bundle with old public key')

  console.log('Verified data update key rotation.')
  console.log(`Old data version: ${oldBundleReport.dataVersion}`)
  console.log(`Old public key SHA-256: ${oldKeyReport.sha256}`)
  console.log(`New data version: ${newBundleReport.dataVersion}`)
  console.log(`New public key SHA-256: ${newKeyReport.sha256}`)
}

if (require.main === module) {
  try {
    verifyDataUpdateKeyRotation(process.argv.slice(2))
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}

module.exports = {
  verifyDataUpdateKeyRotation
}

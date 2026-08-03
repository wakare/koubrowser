const fs = require('node:fs')
const path = require('node:path')
const {
  inspectPublicKey,
  parseArguments,
  requireAllowedArguments,
  requireArgument
} = require('./create-data-update-bundle')

const Sha256Pattern = /^[a-f0-9]{64}$/

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

function validateProductionManifestUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('production manifest URL is invalid')
  }
  if (url.protocol !== 'https:') {
    throw new Error('production manifest URL must use HTTPS')
  }
  if (url.username || url.password || url.hash || url.search) {
    throw new Error('production manifest URL cannot contain credentials, a query, or a fragment')
  }
  return url
}

function verifyDataUpdateProductionTrustInputs(argv) {
  const argumentsMap = parseArguments(argv)
  requireAllowedArguments(
    argumentsMap,
    new Set(['manifest-url', 'public-key-file', 'public-key-sha256'])
  )

  const manifestUrl = requireArgument(argumentsMap, 'manifest-url').trim()
  const publicKeyFile = path.resolve(requireArgument(argumentsMap, 'public-key-file'))
  const expectedFingerprint = requireArgument(argumentsMap, 'public-key-sha256').trim()
  validateProductionManifestUrl(manifestUrl)
  if (!Sha256Pattern.test(expectedFingerprint)) {
    throw new Error('public key SHA-256 fingerprint must be 64 lowercase hex characters')
  }

  const suppliedPublicKey = fs.readFileSync(publicKeyFile, 'utf8').trim()
  const report = inspectPublicKey(suppliedPublicKey)
  if (report.algorithm !== 'Ed25519') {
    throw new Error('public key must use Ed25519')
  }
  if (report.sha256 !== expectedFingerprint) {
    throw new Error('public key SHA-256 fingerprint does not match')
  }

  console.log('Status: PASS')
  console.log('Manifest URL: valid credential-free HTTPS')
  console.log(`Algorithm: ${report.algorithm}`)
  console.log(`Public key SHA-256: ${report.sha256}`)
  console.log('Network access: none')
  return {
    manifestUrl,
    publicKey: report.publicKey,
    publicKeySha256: report.sha256
  }
}

if (require.main === module) {
  try {
    verifyDataUpdateProductionTrustInputs(process.argv.slice(2))
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}

module.exports = {
  validateProductionManifestUrl,
  verifyDataUpdateProductionTrustInputs
}

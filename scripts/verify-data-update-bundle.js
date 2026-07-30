const fs = require('node:fs')
const path = require('node:path')
const {
  parseArguments,
  publicKeySha256,
  requireAllowedArguments,
  requireArgument,
  verifyBundleDirectory
} = require('./create-data-update-bundle')

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

function verifyBundle(argv) {
  const argumentsMap = parseArguments(argv)
  requireAllowedArguments(argumentsMap, new Set(['bundle', 'public-key', 'public-key-file']))

  const bundleDirectory = path.resolve(requireArgument(argumentsMap, 'bundle'))
  const inlinePublicKey = argumentsMap.get('public-key')
  const publicKeyFile = argumentsMap.get('public-key-file')
  if ((inlinePublicKey ? 1 : 0) + (publicKeyFile ? 1 : 0) !== 1) {
    throw new Error('exactly one of --public-key or --public-key-file is required')
  }
  const publicKey = inlinePublicKey ?? fs.readFileSync(path.resolve(publicKeyFile), 'utf8').trim()
  const report = verifyBundleDirectory(bundleDirectory, publicKey)

  console.log(`Verified data bundle ${report.dataVersion}.`)
  console.log(`Published at: ${report.publishedAt}`)
  console.log(`Files: ${report.fileCount}`)
  console.log(`Payload bytes: ${report.totalSize}`)
  console.log(`Quest knowledge: ${report.hasQuestKnowledge ? 'included' : 'not included'}`)
  console.log(`Public key SHA-256: ${publicKeySha256(publicKey)}`)
}

try {
  verifyBundle(process.argv.slice(2))
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

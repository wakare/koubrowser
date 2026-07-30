const fs = require('node:fs')
const path = require('node:path')
const {
  inspectPublicKey,
  parseArguments,
  requireAllowedArguments
} = require('./create-data-update-bundle')

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

function inspectDataUpdatePublicKey(argv) {
  const argumentsMap = parseArguments(argv)
  requireAllowedArguments(argumentsMap, new Set(['public-key', 'public-key-file']))

  const inlinePublicKey = argumentsMap.get('public-key')
  const publicKeyFile = argumentsMap.get('public-key-file')
  if ((inlinePublicKey ? 1 : 0) + (publicKeyFile ? 1 : 0) !== 1) {
    throw new Error('exactly one of --public-key or --public-key-file is required')
  }

  const suppliedPublicKey =
    inlinePublicKey ?? fs.readFileSync(path.resolve(publicKeyFile), 'utf8').trim()
  const report = inspectPublicKey(suppliedPublicKey)

  console.log(`Algorithm: ${report.algorithm}`)
  console.log(`KOU_DATA_UPDATE_PUBLIC_KEY=${report.publicKey}`)
  console.log(`KOU_DATA_UPDATE_PUBLIC_KEY_SHA256=${report.sha256}`)
}

if (require.main === module) {
  try {
    inspectDataUpdatePublicKey(process.argv.slice(2))
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}

module.exports = {
  inspectDataUpdatePublicKey
}

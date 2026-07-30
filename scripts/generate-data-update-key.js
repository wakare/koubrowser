const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const {
  inspectPublicKey,
  parseArguments,
  readPrivateKeyPassphrase,
  requireAllowedArguments,
  requireArgument
} = require('./create-data-update-bundle')

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

function requireNewOutput(filename, description) {
  const resolved = path.resolve(filename)
  if (fs.existsSync(resolved)) {
    throw new Error(`${description} already exists`)
  }
  return resolved
}

function closeFileQuietly(file) {
  if (file === undefined) {
    return
  }
  try {
    fs.closeSync(file)
  } catch {
    // Cleanup continues even if an earlier write already closed the descriptor.
  }
}

function generateDataUpdateKey(argv) {
  const argumentsMap = parseArguments(argv)
  requireAllowedArguments(
    argumentsMap,
    new Set(['private-key-output', 'public-key-output', 'private-key-passphrase-file'])
  )

  const privateKeyOutput = requireNewOutput(
    requireArgument(argumentsMap, 'private-key-output'),
    'private key output'
  )
  const publicKeyOutput = requireNewOutput(
    requireArgument(argumentsMap, 'public-key-output'),
    'public key output'
  )
  const privateKeyIdentity =
    process.platform === 'win32' ? privateKeyOutput.toLowerCase() : privateKeyOutput
  const publicKeyIdentity =
    process.platform === 'win32' ? publicKeyOutput.toLowerCase() : publicKeyOutput
  if (privateKeyIdentity === publicKeyIdentity) {
    throw new Error('private key and public key outputs must differ')
  }

  const passphrase = readPrivateKeyPassphrase(
    requireArgument(argumentsMap, 'private-key-passphrase-file')
  )
  let privateKeyData
  let privateKeyWritten = false
  let publicKeyWritten = false
  let privateKeyFile
  let publicKeyFile

  try {
    const keys = crypto.generateKeyPairSync('ed25519')
    privateKeyData = Buffer.from(
      keys.privateKey.export({
        format: 'pem',
        type: 'pkcs8',
        cipher: 'aes-256-cbc',
        passphrase
      })
    )
    const publicKey = keys.publicKey.export({ format: 'der', type: 'spki' }).toString('base64')
    const publicKeyReport = inspectPublicKey(publicKey)

    fs.mkdirSync(path.dirname(privateKeyOutput), { recursive: true })
    fs.mkdirSync(path.dirname(publicKeyOutput), { recursive: true })
    privateKeyFile = fs.openSync(privateKeyOutput, 'wx', 0o600)
    privateKeyWritten = true
    fs.writeFileSync(privateKeyFile, privateKeyData)
    fs.closeSync(privateKeyFile)
    privateKeyFile = undefined
    publicKeyFile = fs.openSync(publicKeyOutput, 'wx', 0o644)
    publicKeyWritten = true
    fs.writeFileSync(publicKeyFile, `${publicKeyReport.publicKey}\n`, 'utf8')
    fs.closeSync(publicKeyFile)
    publicKeyFile = undefined

    console.log('Created encrypted Ed25519 data update signing key.')
    console.log(`KOU_DATA_UPDATE_PUBLIC_KEY=${publicKeyReport.publicKey}`)
    console.log(`KOU_DATA_UPDATE_PUBLIC_KEY_SHA256=${publicKeyReport.sha256}`)
  } catch (error) {
    closeFileQuietly(publicKeyFile)
    publicKeyFile = undefined
    closeFileQuietly(privateKeyFile)
    privateKeyFile = undefined
    if (publicKeyWritten) {
      fs.rmSync(publicKeyOutput, { force: true })
    }
    if (privateKeyWritten) {
      fs.rmSync(privateKeyOutput, { force: true })
    }
    throw error
  } finally {
    closeFileQuietly(publicKeyFile)
    closeFileQuietly(privateKeyFile)
    privateKeyData?.fill(0)
    passphrase.fill(0)
  }
}

if (require.main === module) {
  try {
    generateDataUpdateKey(process.argv.slice(2))
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}

module.exports = {
  generateDataUpdateKey
}

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
  scrypt
} from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { FileHandle } from 'node:fs/promises'
import {
  verifyLocalAccountBackup,
  type VerifiedAccountBackup
} from '@main/account-backup'

const TransferMagic = Buffer.from('KCTRF001', 'ascii')
const PayloadMagic = Buffer.from('KCPAY001', 'ascii')
const TransferPrefixBytes = TransferMagic.byteLength + 4
const PayloadPrefixBytes = PayloadMagic.byteLength + 4
const TransferSchemaVersion = 1
const PayloadSchemaVersion = 1
const MaxTransferHeaderBytes = 4 * 1024
const MaxPayloadMetadataBytes = 64 * 1024
const MaxTransferPayloadBytes = 16 * 1024 * 1024 * 1024
const MaxTransferFileBytes = 4 * 1024 * 1024 * 1024
const MaxTransferFiles = 13
const SaltBytes = 16
const IvBytes = 12
const AuthenticationTagBytes = 16
const DerivedKeyBytes = 32
const ScryptN = 2 ** 15
const ScryptR = 8
const ScryptP = 3
const ScryptMaxmem = 64 * 1024 * 1024
const MinPassphraseCodePoints = 12
const MaxPassphraseBytes = 1024

interface AccountTransferHeader {
  readonly format: 'koubrowser-account-transfer'
  readonly schemaVersion: 1
  readonly kdf: {
    readonly name: 'scrypt'
    readonly salt: string
    readonly N: number
    readonly r: number
    readonly p: number
    readonly keyLength: number
  }
  readonly cipher: {
    readonly name: 'aes-256-gcm'
    readonly iv: string
    readonly tagLength: number
  }
  readonly ciphertextBytes: number
}

interface AccountTransferPayloadFile {
  readonly path: string
  readonly size: number
}

interface AccountTransferPayloadMetadata {
  readonly schemaVersion: 1
  readonly files: readonly AccountTransferPayloadFile[]
}

export interface EncryptedAccountTransferResult {
  readonly filePath: string
  readonly fileName: string
  readonly bytes: number
  readonly databaseFiles: number
  readonly profileFiles: number
  readonly records: number
}

export interface EncryptedAccountTransferInspection {
  readonly bytes: number
  readonly databaseFiles: number
  readonly profileFiles: number
  readonly records: number
}

export function encryptedAccountTransferFilename(createdAt: Date): string {
  const timestamp = createdAt.toISOString().replace(/[-:.]/g, '')
  return `koubrowser-transfer-${timestamp}.koubrowser-transfer`
}

export function isValidAccountTransferPassphrase(
  value: unknown
): value is string {
  if (typeof value !== 'string') {
    return false
  }
  const normalized = value.normalize('NFC')
  return (
    [...normalized].length >= MinPassphraseCodePoints &&
    Buffer.byteLength(normalized, 'utf8') <= MaxPassphraseBytes
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
  description: string
): void {
  const actual = Object.keys(value).sort()
  const expected = [...expectedKeys].sort()
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${description} has unsupported fields`)
  }
}

function parseStrictBase64(
  value: unknown,
  expectedBytes: number,
  description: string
): Buffer {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    throw new Error(`invalid ${description}`)
  }
  const decoded = Buffer.from(value, 'base64')
  if (
    decoded.byteLength !== expectedBytes ||
    decoded.toString('base64') !== value
  ) {
    throw new Error(`invalid ${description}`)
  }
  return decoded
}

function parseTransferHeader(text: string): {
  readonly header: AccountTransferHeader
  readonly salt: Buffer
  readonly iv: Buffer
} {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('encrypted account transfer header is not valid JSON')
  }
  if (!isRecord(parsed)) {
    throw new Error('encrypted account transfer header must be an object')
  }
  requireExactKeys(
    parsed,
    ['format', 'schemaVersion', 'kdf', 'cipher', 'ciphertextBytes'],
    'encrypted account transfer header'
  )
  if (
    parsed.format !== 'koubrowser-account-transfer' ||
    parsed.schemaVersion !== TransferSchemaVersion
  ) {
    throw new Error('unsupported encrypted account transfer format')
  }
  if (!isRecord(parsed.kdf)) {
    throw new Error('invalid encrypted account transfer KDF')
  }
  requireExactKeys(
    parsed.kdf,
    ['name', 'salt', 'N', 'r', 'p', 'keyLength'],
    'encrypted account transfer KDF'
  )
  if (
    parsed.kdf.name !== 'scrypt' ||
    parsed.kdf.N !== ScryptN ||
    parsed.kdf.r !== ScryptR ||
    parsed.kdf.p !== ScryptP ||
    parsed.kdf.keyLength !== DerivedKeyBytes
  ) {
    throw new Error('unsupported encrypted account transfer KDF')
  }
  if (!isRecord(parsed.cipher)) {
    throw new Error('invalid encrypted account transfer cipher')
  }
  requireExactKeys(
    parsed.cipher,
    ['name', 'iv', 'tagLength'],
    'encrypted account transfer cipher'
  )
  if (
    parsed.cipher.name !== 'aes-256-gcm' ||
    parsed.cipher.tagLength !== AuthenticationTagBytes
  ) {
    throw new Error('unsupported encrypted account transfer cipher')
  }
  if (
    !Number.isSafeInteger(parsed.ciphertextBytes) ||
    (parsed.ciphertextBytes as number) < PayloadPrefixBytes ||
    (parsed.ciphertextBytes as number) > MaxTransferPayloadBytes
  ) {
    throw new Error('invalid encrypted account transfer payload size')
  }

  const salt = parseStrictBase64(
    parsed.kdf.salt,
    SaltBytes,
    'encrypted account transfer salt'
  )
  const iv = parseStrictBase64(
    parsed.cipher.iv,
    IvBytes,
    'encrypted account transfer IV'
  )
  return {
    header: parsed as unknown as AccountTransferHeader,
    salt,
    iv
  }
}

function passphraseBytes(passphrase: string): Buffer {
  if (!isValidAccountTransferPassphrase(passphrase)) {
    throw new Error(
      `account transfer passphrase must contain at least ${MinPassphraseCodePoints} characters and at most ${MaxPassphraseBytes} UTF-8 bytes`
    )
  }
  const normalized = passphrase.normalize('NFC')
  const encoded = Buffer.from(normalized, 'utf8')
  return encoded
}

function deriveTransferKey(passphrase: Buffer, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      passphrase,
      salt,
      DerivedKeyBytes,
      {
        N: ScryptN,
        r: ScryptR,
        p: ScryptP,
        maxmem: ScryptMaxmem
      },
      (error, derivedKey) => {
        if (error) {
          reject(error)
        } else {
          resolve(derivedKey)
        }
      }
    )
  })
}

async function requireRealDirectory(
  directory: string,
  description: string
): Promise<string> {
  const stats = await fs.promises.lstat(directory)
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`${description} must be a real directory`)
  }
  return fs.promises.realpath(directory)
}

async function writeAll(handle: FileHandle, data: Buffer): Promise<void> {
  let offset = 0
  while (offset < data.byteLength) {
    const { bytesWritten } = await handle.write(
      data,
      offset,
      data.byteLength - offset
    )
    if (bytesWritten < 1) {
      throw new Error('encrypted account transfer write made no progress')
    }
    offset += bytesWritten
  }
}

function transferPayloadFiles(
  backup: VerifiedAccountBackup
): AccountTransferPayloadFile[] {
  return [
    {
      path: 'manifest.json',
      size: fs.statSync(path.join(backup.directory, 'manifest.json')).size
    },
    ...backup.manifest.files.map((file) => ({
      path: file.path,
      size: file.size
    }))
  ]
}

function payloadMetadata(
  files: readonly AccountTransferPayloadFile[]
): {
  readonly metadata: AccountTransferPayloadMetadata
  readonly encoded: Buffer
  readonly payloadBytes: number
} {
  const metadata: AccountTransferPayloadMetadata = {
    schemaVersion: PayloadSchemaVersion,
    files
  }
  const encoded = Buffer.from(JSON.stringify(metadata), 'utf8')
  if (encoded.byteLength > MaxPayloadMetadataBytes) {
    throw new Error('encrypted account transfer metadata is too large')
  }
  const payloadBytes =
    PayloadPrefixBytes +
    encoded.byteLength +
    files.reduce((total, file) => total + file.size, 0)
  if (
    !Number.isSafeInteger(payloadBytes) ||
    payloadBytes > MaxTransferPayloadBytes
  ) {
    throw new Error('encrypted account transfer payload is too large')
  }
  return { metadata, encoded, payloadBytes }
}

function encodeHeader(
  salt: Buffer,
  iv: Buffer,
  ciphertextBytes: number
): {
  readonly header: AccountTransferHeader
  readonly encoded: Buffer
  readonly authenticatedPrefix: Buffer
} {
  const header: AccountTransferHeader = {
    format: 'koubrowser-account-transfer',
    schemaVersion: TransferSchemaVersion,
    kdf: {
      name: 'scrypt',
      salt: salt.toString('base64'),
      N: ScryptN,
      r: ScryptR,
      p: ScryptP,
      keyLength: DerivedKeyBytes
    },
    cipher: {
      name: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tagLength: AuthenticationTagBytes
    },
    ciphertextBytes
  }
  const encoded = Buffer.from(JSON.stringify(header), 'utf8')
  if (encoded.byteLength > MaxTransferHeaderBytes) {
    throw new Error('encrypted account transfer header is too large')
  }
  const length = Buffer.alloc(4)
  length.writeUInt32BE(encoded.byteLength)
  return {
    header,
    encoded,
    authenticatedPrefix: Buffer.concat([TransferMagic, length, encoded])
  }
}

async function publishWithoutOverwrite(
  stagingPath: string,
  finalPath: string
): Promise<void> {
  let published = false
  try {
    try {
      await fs.promises.link(stagingPath, finalPath)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'EEXIST') {
        throw new Error('encrypted account transfer already exists')
      }
      try {
        await fs.promises.copyFile(
          stagingPath,
          finalPath,
          fs.constants.COPYFILE_EXCL
        )
      } catch (copyError) {
        if ((copyError as NodeJS.ErrnoException).code === 'EEXIST') {
          throw new Error('encrypted account transfer already exists')
        }
        throw copyError
      }
    }
    published = true
    await fs.promises.unlink(stagingPath)
  } catch (error) {
    if (published) {
      await fs.promises.rm(finalPath, { force: true })
    }
    throw error
  }
}

async function createPrivateTemporaryDirectory(prefix: string): Promise<string> {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), prefix))
  await fs.promises.chmod(directory, 0o700)
  return directory
}

export async function createEncryptedAccountTransfer(
  backupDirectory: string,
  outputPath: string,
  passphrase: string
): Promise<EncryptedAccountTransferResult> {
  const verified = await verifyLocalAccountBackup(backupDirectory)
  const parentDirectory = await requireRealDirectory(
    path.dirname(path.resolve(outputPath)),
    'encrypted account transfer destination'
  )
  const finalPath = path.join(parentDirectory, path.basename(outputPath))
  if (fs.existsSync(finalPath)) {
    throw new Error('encrypted account transfer already exists')
  }

  const files = transferPayloadFiles(verified)
  const payload = payloadMetadata(files)
  const salt = randomBytes(SaltBytes)
  const iv = randomBytes(IvBytes)
  const outer = encodeHeader(salt, iv, payload.payloadBytes)
  const encodedPassphrase = passphraseBytes(passphrase)
  let key: Buffer | undefined
  const stagingPath = path.join(
    parentDirectory,
    `.${path.basename(finalPath)}.${randomUUID()}.partial`
  )
  let stagingCreated = false
  let published = false

  try {
    key = await deriveTransferKey(encodedPassphrase, salt)
    const handle = await fs.promises.open(stagingPath, 'wx', 0o600)
    stagingCreated = true
    try {
      await writeAll(handle, outer.authenticatedPrefix)
      const cipher = createCipheriv('aes-256-gcm', key, iv, {
        authTagLength: AuthenticationTagBytes
      })
      cipher.setAAD(outer.authenticatedPrefix)
      const encryptAndWrite = async (plaintext: Buffer): Promise<void> => {
        const ciphertext = cipher.update(plaintext)
        if (ciphertext.byteLength > 0) {
          await writeAll(handle, ciphertext)
        }
      }

      const metadataLength = Buffer.alloc(4)
      metadataLength.writeUInt32BE(payload.encoded.byteLength)
      await encryptAndWrite(PayloadMagic)
      await encryptAndWrite(metadataLength)
      await encryptAndWrite(payload.encoded)

      for (const file of files) {
        const filePath = path.join(
          verified.directory,
          ...file.path.split('/')
        )
        const stats = await fs.promises.lstat(filePath)
        if (
          stats.isSymbolicLink() ||
          !stats.isFile() ||
          stats.size !== file.size
        ) {
          throw new Error(
            `account backup file changed before encryption: ${file.path}`
          )
        }
        let bytesRead = 0
        for await (const chunk of fs.createReadStream(filePath)) {
          const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          bytesRead += data.byteLength
          if (bytesRead > file.size) {
            throw new Error(
              `account backup file changed during encryption: ${file.path}`
            )
          }
          await encryptAndWrite(data)
        }
        if (bytesRead !== file.size) {
          throw new Error(
            `account backup file changed during encryption: ${file.path}`
          )
        }
      }

      const finalCiphertext = cipher.final()
      if (finalCiphertext.byteLength > 0) {
        await writeAll(handle, finalCiphertext)
      }
      await writeAll(handle, cipher.getAuthTag())
      await handle.sync()
    } finally {
      await handle.close()
    }

    const verificationRoot = await createPrivateTemporaryDirectory(
      'koubrowser-transfer-verify-'
    )
    try {
      await decryptAccountTransferToDirectory(
        stagingPath,
        passphrase,
        verificationRoot
      )
    } finally {
      await fs.promises.rm(verificationRoot, {
        recursive: true,
        force: true
      })
    }

    await publishWithoutOverwrite(stagingPath, finalPath)
    stagingCreated = false
    published = true
    const stats = await fs.promises.lstat(finalPath)
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error('encrypted account transfer was not published as a file')
    }
    return {
      filePath: finalPath,
      fileName: path.basename(finalPath),
      bytes: stats.size,
      databaseFiles: verified.manifest.summary.databaseFiles,
      profileFiles: verified.manifest.summary.profileFiles,
      records: verified.manifest.summary.records
    }
  } catch (error) {
    if (stagingCreated) {
      await fs.promises.rm(stagingPath, { force: true })
    }
    if (published) {
      await fs.promises.rm(finalPath, { force: true })
    }
    throw error
  } finally {
    encodedPassphrase.fill(0)
    key?.fill(0)
    salt.fill(0)
    iv.fill(0)
  }
}

function isSafePayloadPath(filePath: string): boolean {
  return (
    filePath === 'manifest.json' ||
    /^data\/[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(filePath)
  )
}

function parsePayloadMetadata(
  text: string,
  expectedPayloadBytes: number
): AccountTransferPayloadMetadata {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('encrypted account transfer payload metadata is not valid JSON')
  }
  if (!isRecord(parsed)) {
    throw new Error('encrypted account transfer payload metadata must be an object')
  }
  requireExactKeys(
    parsed,
    ['schemaVersion', 'files'],
    'encrypted account transfer payload metadata'
  )
  if (
    parsed.schemaVersion !== PayloadSchemaVersion ||
    !Array.isArray(parsed.files) ||
    parsed.files.length < 2 ||
    parsed.files.length > MaxTransferFiles
  ) {
    throw new Error('unsupported encrypted account transfer payload')
  }

  const seen = new Set<string>()
  const files = parsed.files.map((value, index) => {
    if (!isRecord(value)) {
      throw new Error('invalid encrypted account transfer payload file')
    }
    requireExactKeys(
      value,
      ['path', 'size'],
      'encrypted account transfer payload file'
    )
    if (
      typeof value.path !== 'string' ||
      !isSafePayloadPath(value.path) ||
      seen.has(value.path) ||
      !Number.isSafeInteger(value.size) ||
      (value.size as number) < 0 ||
      (value.size as number) > MaxTransferFileBytes
    ) {
      throw new Error('invalid encrypted account transfer payload file')
    }
    if (index === 0 && value.path !== 'manifest.json') {
      throw new Error('encrypted account transfer manifest must be first')
    }
    if (index > 0 && value.path === 'manifest.json') {
      throw new Error('duplicate encrypted account transfer manifest')
    }
    seen.add(value.path)
    return {
      path: value.path,
      size: value.size as number
    }
  })
  const fileBytes = files.reduce((total, file) => total + file.size, 0)
  if (
    !Number.isSafeInteger(fileBytes) ||
    fileBytes !== expectedPayloadBytes
  ) {
    throw new Error('encrypted account transfer payload size does not match')
  }
  return {
    schemaVersion: PayloadSchemaVersion,
    files
  }
}

class AccountTransferPayloadExtractor {
  private prefix = Buffer.alloc(0)
  private files: readonly AccountTransferPayloadFile[] | undefined
  private fileIndex = 0
  private fileBytesWritten = 0
  private fileHandle: FileHandle | undefined

  public constructor(
    private readonly destinationDirectory: string,
    private readonly payloadBytes: number
  ) {}

  public async consume(data: Buffer): Promise<void> {
    if (data.byteLength === 0) {
      return
    }
    if (!this.files) {
      this.prefix = Buffer.concat([this.prefix, data])
      if (this.prefix.byteLength < PayloadPrefixBytes) {
        return
      }
      if (
        !this.prefix
          .subarray(0, PayloadMagic.byteLength)
          .equals(PayloadMagic)
      ) {
        throw new Error('invalid encrypted account transfer payload magic')
      }
      const metadataBytes = this.prefix.readUInt32BE(PayloadMagic.byteLength)
      if (
        metadataBytes < 1 ||
        metadataBytes > MaxPayloadMetadataBytes
      ) {
        throw new Error('invalid encrypted account transfer metadata size')
      }
      const prefixBytes = PayloadPrefixBytes + metadataBytes
      if (this.prefix.byteLength < prefixBytes) {
        if (this.prefix.byteLength > PayloadPrefixBytes + MaxPayloadMetadataBytes) {
          throw new Error('encrypted account transfer metadata is too large')
        }
        return
      }
      const metadata = parsePayloadMetadata(
        this.prefix
          .subarray(PayloadPrefixBytes, prefixBytes)
          .toString('utf8'),
        this.payloadBytes - prefixBytes
      )
      this.files = metadata.files
      const remaining = this.prefix.subarray(prefixBytes)
      this.prefix = Buffer.alloc(0)
      await this.consumeFileBytes(remaining)
      return
    }
    await this.consumeFileBytes(data)
  }

  private async consumeFileBytes(data: Buffer): Promise<void> {
    let offset = 0
    await this.advanceEmptyFiles()
    while (offset < data.byteLength) {
      const file = this.files?.[this.fileIndex]
      if (!file) {
        throw new Error('encrypted account transfer payload has trailing bytes')
      }
      if (!this.fileHandle) {
        const destinationPath = path.join(
          this.destinationDirectory,
          ...file.path.split('/')
        )
        await fs.promises.mkdir(path.dirname(destinationPath), {
          recursive: true
        })
        this.fileHandle = await fs.promises.open(
          destinationPath,
          'wx',
          0o600
        )
      }
      const remaining = file.size - this.fileBytesWritten
      const bytes = Math.min(remaining, data.byteLength - offset)
      if (bytes > 0) {
        await writeAll(
          this.fileHandle,
          data.subarray(offset, offset + bytes)
        )
        this.fileBytesWritten += bytes
        offset += bytes
      }
      if (this.fileBytesWritten === file.size) {
        await this.fileHandle.close()
        this.fileHandle = undefined
        this.fileIndex += 1
        this.fileBytesWritten = 0
        await this.advanceEmptyFiles()
      }
    }
  }

  private async advanceEmptyFiles(): Promise<void> {
    let file = this.files?.[this.fileIndex]
    while (file?.size === 0) {
      const destinationPath = path.join(
        this.destinationDirectory,
        ...file.path.split('/')
      )
      await fs.promises.mkdir(path.dirname(destinationPath), {
        recursive: true
      })
      const handle = await fs.promises.open(destinationPath, 'wx', 0o600)
      await handle.close()
      this.fileIndex += 1
      file = this.files?.[this.fileIndex]
    }
  }

  public async finish(): Promise<void> {
    await this.fileHandle?.close()
    this.fileHandle = undefined
    await this.advanceEmptyFiles()
    if (
      !this.files ||
      this.fileIndex !== this.files.length ||
      this.fileBytesWritten !== 0
    ) {
      throw new Error('encrypted account transfer payload is incomplete')
    }
  }

  public async close(): Promise<void> {
    await this.fileHandle?.close()
    this.fileHandle = undefined
  }
}

async function readExactly(
  handle: FileHandle,
  bytes: number,
  position: number
): Promise<Buffer> {
  const buffer = Buffer.alloc(bytes)
  let offset = 0
  while (offset < bytes) {
    const { bytesRead } = await handle.read(
      buffer,
      offset,
      bytes - offset,
      position + offset
    )
    if (bytesRead < 1) {
      throw new Error('encrypted account transfer ended unexpectedly')
    }
    offset += bytesRead
  }
  return buffer
}

async function readTransferEnvelope(filePath: string): Promise<{
  readonly realPath: string
  readonly size: number
  readonly header: AccountTransferHeader
  readonly salt: Buffer
  readonly iv: Buffer
  readonly authenticatedPrefix: Buffer
  readonly ciphertextOffset: number
  readonly authenticationTag: Buffer
}> {
  const stats = await fs.promises.lstat(filePath)
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error('encrypted account transfer must be a regular file')
  }
  if (
    stats.size <
      TransferPrefixBytes + 1 + PayloadPrefixBytes + AuthenticationTagBytes ||
    stats.size >
      TransferPrefixBytes +
        MaxTransferHeaderBytes +
        MaxTransferPayloadBytes +
        AuthenticationTagBytes
  ) {
    throw new Error('invalid encrypted account transfer file size')
  }
  const realPath = await fs.promises.realpath(filePath)
  const handle = await fs.promises.open(realPath, 'r')
  try {
    const prefix = await readExactly(handle, TransferPrefixBytes, 0)
    if (
      !prefix.subarray(0, TransferMagic.byteLength).equals(TransferMagic)
    ) {
      throw new Error('invalid encrypted account transfer magic')
    }
    const headerBytes = prefix.readUInt32BE(TransferMagic.byteLength)
    if (headerBytes < 1 || headerBytes > MaxTransferHeaderBytes) {
      throw new Error('invalid encrypted account transfer header size')
    }
    const encodedHeader = await readExactly(
      handle,
      headerBytes,
      TransferPrefixBytes
    )
    const parsed = parseTransferHeader(encodedHeader.toString('utf8'))
    const ciphertextOffset = TransferPrefixBytes + headerBytes
    const expectedSize =
      ciphertextOffset +
      parsed.header.ciphertextBytes +
      AuthenticationTagBytes
    if (stats.size !== expectedSize) {
      parsed.salt.fill(0)
      parsed.iv.fill(0)
      throw new Error('encrypted account transfer file size does not match')
    }
    const authenticationTag = await readExactly(
      handle,
      AuthenticationTagBytes,
      stats.size - AuthenticationTagBytes
    )
    return {
      realPath,
      size: stats.size,
      header: parsed.header,
      salt: parsed.salt,
      iv: parsed.iv,
      authenticatedPrefix: Buffer.concat([prefix, encodedHeader]),
      ciphertextOffset,
      authenticationTag
    }
  } finally {
    await handle.close()
  }
}

export async function decryptAccountTransferToDirectory(
  filePath: string,
  passphrase: string,
  destinationRoot: string
): Promise<VerifiedAccountBackup> {
  const envelope = await readTransferEnvelope(filePath)
  const realDestinationRoot = await requireRealDirectory(
    destinationRoot,
    'encrypted account transfer extraction destination'
  )
  const encodedPassphrase = passphraseBytes(passphrase)
  let key: Buffer | undefined
  const extractionId = randomUUID()
  const stagingDirectory = path.join(
    realDestinationRoot,
    `.koubrowser-transfer-${extractionId}.partial`
  )
  const finalDirectory = path.join(
    realDestinationRoot,
    `koubrowser-transfer-${extractionId}`
  )
  let stagingCreated = false
  let published = false
  let extractor: AccountTransferPayloadExtractor | undefined

  try {
    key = await deriveTransferKey(encodedPassphrase, envelope.salt)
    await fs.promises.mkdir(stagingDirectory, { mode: 0o700 })
    stagingCreated = true
    extractor = new AccountTransferPayloadExtractor(
      stagingDirectory,
      envelope.header.ciphertextBytes
    )
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      envelope.iv,
      { authTagLength: AuthenticationTagBytes }
    )
    decipher.setAAD(envelope.authenticatedPrefix)
    decipher.setAuthTag(envelope.authenticationTag)

    let payloadError: unknown
    const ciphertextEnd =
      envelope.ciphertextOffset + envelope.header.ciphertextBytes - 1
    for await (const chunk of fs.createReadStream(envelope.realPath, {
      start: envelope.ciphertextOffset,
      end: ciphertextEnd
    })) {
      const plaintext = decipher.update(
        Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      )
      if (!payloadError) {
        try {
          await extractor.consume(plaintext)
        } catch (error) {
          payloadError = error
        }
      }
    }

    let finalPlaintext: Buffer
    try {
      finalPlaintext = decipher.final()
    } catch {
      throw new Error(
        'encrypted account transfer authentication failed; the passphrase is incorrect or the file is damaged'
      )
    }
    if (!payloadError) {
      try {
        await extractor.consume(finalPlaintext)
        await extractor.finish()
      } catch (error) {
        payloadError = error
      }
    }
    if (payloadError) {
      throw new Error('invalid authenticated account transfer payload', {
        cause: payloadError
      })
    }

    await verifyLocalAccountBackup(stagingDirectory)
    await fs.promises.rename(stagingDirectory, finalDirectory)
    stagingCreated = false
    published = true
    return await verifyLocalAccountBackup(finalDirectory)
  } catch (error) {
    await extractor?.close()
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
  } finally {
    encodedPassphrase.fill(0)
    key?.fill(0)
    envelope.salt.fill(0)
    envelope.iv.fill(0)
    envelope.authenticationTag.fill(0)
  }
}

export async function inspectEncryptedAccountTransfer(
  filePath: string,
  passphrase: string
): Promise<EncryptedAccountTransferInspection> {
  const temporaryRoot = await createPrivateTemporaryDirectory(
    'koubrowser-transfer-inspect-'
  )
  try {
    const verified = await decryptAccountTransferToDirectory(
      filePath,
      passphrase,
      temporaryRoot
    )
    return {
      bytes: (await fs.promises.lstat(filePath)).size,
      databaseFiles: verified.manifest.summary.databaseFiles,
      profileFiles: verified.manifest.summary.profileFiles,
      records: verified.manifest.summary.records
    }
  } finally {
    await fs.promises.rm(temporaryRoot, {
      recursive: true,
      force: true
    })
  }
}

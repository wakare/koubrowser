import fs from 'node:fs'
import path from 'node:path'
import { DbName, type DbName as DbNameType } from '@common/record'
import {
  parseAccountBackupManifest,
  verifyAccountBackupPayloadFile,
  verifyLocalAccountBackup,
  type AccountBackupManifest,
  type VerifiedAccountBackup
} from '@main/account-backup'
import type { RestoreStageDatabaseFile } from '@main/worker/msg'
export type { RestoreStageDatabaseFile } from '@main/worker/msg'

const RestoreStagingDirectory = 'restore-staging'
const StageMetadataFilename = 'stage.json'
const StageAccountDirectory = 'account'
const MaxStageMetadataBytes = 1024 * 1024

export interface VerifiedAccountRestoreStage {
  readonly directory: string
  readonly accountDirectory: string
  readonly bundleId: string
  readonly account: {
    readonly serverId: number
    readonly memberId: string
  }
  readonly databaseFiles: readonly RestoreStageDatabaseFile[]
  readonly manifest: AccountBackupManifest
}

export type ValidateRestoreStageDatabases = (
  accountDirectory: string,
  files: readonly RestoreStageDatabaseFile[]
) => Promise<void>

export interface CreateAccountRestoreStageOptions {
  readonly verified: VerifiedAccountBackup
  readonly appDataRoot: string
  readonly expectedAccount: {
    readonly serverId: number
    readonly memberId: string
  }
  readonly validateDatabases: ValidateRestoreStageDatabases
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

function samePath(left: string, right: string): boolean {
  const normalize = (value: string): string => {
    const resolved = path.resolve(value)
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved
  }
  return normalize(left) === normalize(right)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
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

async function createRestoreStagingRoot(
  appDataRoot: string
): Promise<string> {
  const realAppDataRoot = await requireRealDirectory(
    appDataRoot,
    'application data root'
  )
  const stagingRoot = path.join(realAppDataRoot, RestoreStagingDirectory)
  try {
    await fs.promises.mkdir(stagingRoot, { mode: 0o700 })
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !('code' in error) ||
      error.code !== 'EEXIST'
    ) {
      throw error
    }
  }
  const realStagingRoot = await requireRealDirectory(
    stagingRoot,
    'restore staging root'
  )
  if (!isWithinPath(realStagingRoot, realAppDataRoot)) {
    throw new Error('restore staging root is outside application data')
  }
  return realStagingRoot
}

function databaseNameFromPath(filePath: string): DbNameType | null {
  const match = /^data\/([a-z]+)\.db$/.exec(filePath)
  if (!match || !Object.values(DbName).includes(match[1] as DbNameType)) {
    return null
  }
  return match[1] as DbNameType
}

function restoreStageDatabaseFiles(
  manifest: AccountBackupManifest
): RestoreStageDatabaseFile[] {
  return manifest.files.flatMap((file) => {
    const dbName = databaseNameFromPath(file.path)
    if (!dbName) {
      return []
    }
    if (file.recordCount === null) {
      throw new Error(`restore stage database has no record count: ${dbName}`)
    }
    return [{
      dbName,
      filename: path.posix.basename(file.path),
      size: file.size,
      sha256: file.sha256,
      recordCount: file.recordCount
    }]
  })
}

export async function verifyAccountRestoreStage(
  directory: string,
  appDataRoot: string,
  expectedAccount?: {
    readonly serverId: number
    readonly memberId: string
  }
): Promise<VerifiedAccountRestoreStage> {
  const realAppDataRoot = await requireRealDirectory(
    appDataRoot,
    'application data root'
  )
  const stagingRoot = await requireRealDirectory(
    path.join(realAppDataRoot, RestoreStagingDirectory),
    'restore staging root'
  )
  const realDirectory = await requireRealDirectory(
    directory,
    'restore stage'
  )
  if (
    !isWithinPath(realDirectory, stagingRoot) ||
    !samePath(path.dirname(realDirectory), stagingRoot)
  ) {
    throw new Error('restore stage is outside the staging root')
  }

  const metadataPath = path.join(realDirectory, StageMetadataFilename)
  const metadataStats = await fs.promises.lstat(metadataPath)
  if (
    metadataStats.isSymbolicLink() ||
    !metadataStats.isFile() ||
    metadataStats.size > MaxStageMetadataBytes
  ) {
    throw new Error('restore stage metadata is invalid')
  }
  let rawMetadata: unknown
  try {
    rawMetadata = JSON.parse(
      await fs.promises.readFile(metadataPath, 'utf8')
    )
  } catch {
    throw new Error('restore stage metadata is not valid JSON')
  }
  if (!isPlainObject(rawMetadata)) {
    throw new Error('restore stage metadata must be an object')
  }
  requireExactKeys(
    rawMetadata,
    ['schemaVersion', 'stagedAt', 'manifest'],
    'restore stage metadata'
  )
  if (rawMetadata.schemaVersion !== 1 || !isIsoTimestamp(rawMetadata.stagedAt)) {
    throw new Error('restore stage metadata version or timestamp is invalid')
  }
  const manifest = parseAccountBackupManifest(
    JSON.stringify(rawMetadata.manifest)
  )
  if (path.basename(realDirectory) !== manifest.bundleId) {
    throw new Error('restore stage directory does not match its bundle')
  }
  if (
    expectedAccount &&
    (
      manifest.account.serverId !== expectedAccount.serverId ||
      manifest.account.memberId !== expectedAccount.memberId
    )
  ) {
    throw new Error('restore stage account does not match the current account')
  }

  const accountDirectory = await requireRealDirectory(
    path.join(realDirectory, StageAccountDirectory),
    'restore stage account directory'
  )
  const expectedNames = new Set(
    manifest.files.map((file) => path.posix.basename(file.path))
  )
  const entries = await fs.promises.readdir(accountDirectory, {
    withFileTypes: true
  })
  if (
    entries.length !== expectedNames.size ||
    entries.some((entry) => !entry.isFile() || !expectedNames.has(entry.name))
  ) {
    throw new Error('restore stage account file set does not match its manifest')
  }
  for (const file of manifest.files) {
    await verifyAccountBackupPayloadFile(
      path.join(accountDirectory, path.posix.basename(file.path)),
      file
    )
  }

  const databaseFiles = restoreStageDatabaseFiles(manifest)
  if (databaseFiles.length !== Object.values(DbName).length) {
    throw new Error('restore stage database set is incomplete')
  }
  return {
    directory: realDirectory,
    accountDirectory,
    bundleId: manifest.bundleId,
    account: manifest.account,
    databaseFiles,
    manifest
  }
}

/**
 * Copy a freshly re-verified bundle into an isolated account-directory
 * candidate. The active account directory is never read, renamed, or written.
 */
export async function createVerifiedAccountRestoreStage(
  options: CreateAccountRestoreStageOptions
): Promise<VerifiedAccountRestoreStage> {
  const source = await verifyLocalAccountBackup(options.verified.directory)
  if (
    source.manifest.account.serverId !== options.expectedAccount.serverId ||
    source.manifest.account.memberId !== options.expectedAccount.memberId
  ) {
    throw new Error('restore stage account does not match the current account')
  }
  const stagingRoot = await createRestoreStagingRoot(options.appDataRoot)
  const finalDirectory = path.join(stagingRoot, source.manifest.bundleId)
  const partialDirectory = `${finalDirectory}.partial`
  const accountDirectory = path.join(
    partialDirectory,
    StageAccountDirectory
  )
  let partialCreated = false
  let renamed = false
  let finalized = false

  try {
    await fs.promises.mkdir(partialDirectory, { mode: 0o700 })
    partialCreated = true
    await fs.promises.mkdir(accountDirectory, { mode: 0o700 })

    const databaseFiles: RestoreStageDatabaseFile[] = []
    const destinationNames = new Set<string>()
    for (const file of source.manifest.files) {
      const filename = path.posix.basename(file.path)
      if (destinationNames.has(filename)) {
        throw new Error(`restore stage contains a duplicate filename: ${filename}`)
      }
      destinationNames.add(filename)

      const sourcePath = path.join(
        source.directory,
        ...file.path.split('/')
      )
      const destinationPath = path.join(accountDirectory, filename)
      await fs.promises.copyFile(
        sourcePath,
        destinationPath,
        fs.constants.COPYFILE_EXCL
      )
      await verifyAccountBackupPayloadFile(destinationPath, file)

      const dbName = databaseNameFromPath(file.path)
      if (dbName) {
        if (file.recordCount === null) {
          throw new Error(`restore stage database has no record count: ${dbName}`)
        }
        databaseFiles.push({
          dbName,
          filename,
          size: file.size,
          sha256: file.sha256,
          recordCount: file.recordCount
        })
      }
    }

    if (databaseFiles.length !== Object.values(DbName).length) {
      throw new Error('restore stage database set is incomplete')
    }
    await options.validateDatabases(accountDirectory, databaseFiles)

    const metadata = {
      schemaVersion: 1,
      stagedAt: new Date().toISOString(),
      manifest: source.manifest
    }
    await fs.promises.writeFile(
      path.join(partialDirectory, StageMetadataFilename),
      `${JSON.stringify(metadata, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx', mode: 0o600 }
    )

    await fs.promises.rename(partialDirectory, finalDirectory)
    renamed = true
    const result = await verifyAccountRestoreStage(
      finalDirectory,
      options.appDataRoot,
      options.expectedAccount
    )
    finalized = true
    return result
  } finally {
    if (partialCreated && !finalized) {
      await fs.promises.rm(renamed ? finalDirectory : partialDirectory, {
        recursive: true,
        force: true
      })
    }
  }
}

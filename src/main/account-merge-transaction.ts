import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { DbName } from '@common/record'
import {
  DefaultAccountRestoreRetentionPolicy,
  type AccountBackupDatabasePreview,
  type AccountRestoreRetentionPolicy
} from '@common/account-backup'
import type {
  DatabaseAuditInfo,
  RestoreStageDatabaseFile
} from '@main/worker/msg'
import {
  verifyAccountDatabaseMergeStage,
  type ValidateMergeStageDatabases,
  type VerifiedAccountDatabaseMergeStage
} from '@main/account-merge-staging'

export const PendingAccountMergeFilename =
  'account-merge-pending.json'
export const PendingAccountMergeRollbackFilename =
  'account-merge-rollback-pending.json'
export const PendingAccountMergeRedoFilename =
  'account-merge-redo-pending.json'

const MergeStagingDirectory = 'merge-staging'
const MergeApplyDirectory = 'merge-apply'
const MergeRollbackDirectory = 'merge-rollbacks'
const StoreDirectory = 'store'
const AccountDirectory = 'account'
const MergedAccountDirectory = 'merged-account'
const RollbackMetadataFilename = 'merge-rollback.json'
const MaxTransactionBytes = 2 * 1024 * 1024
const Sha256Pattern = /^[0-9a-f]{64}$/u
const UuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u

type AccountMergePhase =
  | 'ready'
  | 'prepared'
  | 'current-moved'
  | 'candidate-installed'

export interface AccountMergeIdentity {
  readonly serverId: number
  readonly memberId: string
}

interface PendingAccountMerge {
  readonly schemaVersion: 1
  readonly phase: AccountMergePhase
  readonly createdAt: string
  readonly stageName: string
  readonly bundleId: string
  readonly planSetSha256: string
  readonly account: AccountMergeIdentity
}

interface AccountMergeRollbackMetadata {
  readonly schemaVersion: 1
  readonly createdAt: string
  readonly stageName: string
  readonly bundleId: string
  readonly planSetSha256: string
  readonly account: AccountMergeIdentity
  readonly databaseFiles: readonly RestoreStageDatabaseFile[]
  readonly redoDatabaseFiles: readonly RestoreStageDatabaseFile[]
}

type AccountMergeRollbackPhase =
  | 'ready'
  | 'current-moved'
  | 'rollback-installed'

type AccountMergeRedoPhase =
  | 'ready'
  | 'current-moved'
  | 'redo-installed'

interface PendingAccountMergeRollback {
  readonly schemaVersion: 1
  readonly phase: AccountMergeRollbackPhase
  readonly createdAt: string
  readonly stageName: string
  readonly bundleId: string
  readonly planSetSha256: string
  readonly account: AccountMergeIdentity
}

interface PendingAccountMergeRedo {
  readonly schemaVersion: 1
  readonly phase: AccountMergeRedoPhase
  readonly createdAt: string
  readonly stageName: string
  readonly bundleId: string
  readonly planSetSha256: string
  readonly account: AccountMergeIdentity
}

export interface AvailableAccountMergeRollback {
  readonly directory: string
  readonly stageName: string
  readonly bundleId: string
  readonly createdAt: string
  readonly account: AccountMergeIdentity
}

export interface AvailableAccountMergeRedo {
  readonly directory: string
  readonly stageName: string
  readonly bundleId: string
  readonly createdAt: string
  readonly account: AccountMergeIdentity
}

export type ApplyPendingAccountMergeRollbackResult =
  | { readonly status: 'none' }
  | { readonly status: 'different-account' }
  | {
      readonly status: 'applied'
      readonly stageName: string
      readonly bundleId: string
    }

export type ApplyPendingAccountMergeRedoResult =
  | { readonly status: 'none' }
  | { readonly status: 'different-account' }
  | {
      readonly status: 'applied'
      readonly stageName: string
      readonly bundleId: string
    }

export type AccountMergeRetentionReason =
  | 'age'
  | 'generation'
  | 'capacity'

export interface AccountMergeRetentionDeletion {
  readonly stageName: string
  readonly reason: AccountMergeRetentionReason
  readonly bytes: number
}

export interface AccountMergeRetentionReport {
  readonly deleted: readonly AccountMergeRetentionDeletion[]
  readonly retainedBytes: number
  readonly protectedBytes: number
  readonly overCapacityBytes: number
}

export type AuditAccountDirectoryDatabases = (
  accountDirectory: string
) => Promise<readonly DatabaseAuditInfo[]>

export type InspectAccountDirectoryDatabases = (
  accountDirectory: string
) => Promise<readonly RestoreStageDatabaseFile[]>

export type ApplyPendingAccountMergeResult =
  | { readonly status: 'none' }
  | { readonly status: 'different-account' }
  | {
      readonly status: 'expired'
      readonly bundleId: string
      readonly changedDatabases: readonly DbName[]
    }
  | {
      readonly status: 'applied'
      readonly bundleId: string
      readonly rollbackDirectory: string
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

function samePath(left: string, right: string): boolean {
  const normalize = (value: string): string => {
    const resolved = path.resolve(value)
    return process.platform === 'win32'
      ? resolved.toLowerCase()
      : resolved
  }
  return normalize(left) === normalize(right)
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

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await fs.promises.lstat(candidate)
    return true
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return false
    }
    throw error
  }
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

async function ensureRealDirectory(
  directory: string,
  description: string
): Promise<string> {
  try {
    await fs.promises.mkdir(directory, { mode: 0o700 })
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !('code' in error) ||
      error.code !== 'EEXIST'
    ) {
      throw error
    }
  }
  return requireRealDirectory(directory, description)
}

function validateAccountIdentity(account: AccountMergeIdentity): void {
  if (
    !Number.isSafeInteger(account.serverId) ||
    account.serverId <= 0 ||
    !/^[0-9]{1,32}$/u.test(account.memberId)
  ) {
    throw new Error('invalid account merge identity')
  }
}

function accountDirectoryName(account: AccountMergeIdentity): string {
  validateAccountIdentity(account)
  return `${account.serverId}_${account.memberId}`
}

function accountsMatch(
  left: AccountMergeIdentity,
  right: AccountMergeIdentity
): boolean {
  return (
    left.serverId === right.serverId &&
    left.memberId === right.memberId
  )
}

function validateStageIdentity(
  stageName: string,
  bundleId: string,
  planSetSha256: string
): void {
  if (
    !UuidPattern.test(bundleId) ||
    !Sha256Pattern.test(planSetSha256) ||
    stageName !== `${bundleId}-${planSetSha256}`
  ) {
    throw new Error('pending account merge stage identity is invalid')
  }
}

function parseAccount(
  value: unknown,
  description: string
): AccountMergeIdentity {
  if (!isPlainObject(value)) {
    throw new Error(`${description} must be an object`)
  }
  requireExactKeys(value, ['serverId', 'memberId'], description)
  const account = {
    serverId: value.serverId as number,
    memberId: value.memberId as string
  }
  validateAccountIdentity(account)
  return account
}

function parsePendingAccountMerge(text: string): PendingAccountMerge {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('pending account merge is not valid JSON')
  }
  if (!isPlainObject(value)) {
    throw new Error('pending account merge must be an object')
  }
  requireExactKeys(
    value,
    [
      'schemaVersion',
      'phase',
      'createdAt',
      'stageName',
      'bundleId',
      'planSetSha256',
      'account'
    ],
    'pending account merge'
  )
  if (
    value.schemaVersion !== 1 ||
    ![
      'ready',
      'prepared',
      'current-moved',
      'candidate-installed'
    ].includes(String(value.phase)) ||
    !isIsoTimestamp(value.createdAt) ||
    typeof value.stageName !== 'string' ||
    typeof value.bundleId !== 'string' ||
    typeof value.planSetSha256 !== 'string'
  ) {
    throw new Error('pending account merge has invalid state')
  }
  validateStageIdentity(
    value.stageName,
    value.bundleId,
    value.planSetSha256
  )
  return {
    schemaVersion: 1,
    phase: value.phase as AccountMergePhase,
    createdAt: value.createdAt,
    stageName: value.stageName,
    bundleId: value.bundleId,
    planSetSha256: value.planSetSha256,
    account: parseAccount(value.account, 'pending account merge account')
  }
}

function validateDatabaseFiles(
  value: unknown
): RestoreStageDatabaseFile[] {
  if (!Array.isArray(value)) {
    throw new Error('account merge rollback database files must be an array')
  }
  const byName = new Map<DbName, RestoreStageDatabaseFile>()
  for (const [index, entry] of value.entries()) {
    if (!isPlainObject(entry)) {
      throw new Error(
        `account merge rollback database file ${index} must be an object`
      )
    }
    requireExactKeys(
      entry,
      ['dbName', 'filename', 'size', 'sha256', 'recordCount'],
      `account merge rollback database file ${index}`
    )
    if (
      typeof entry.dbName !== 'string' ||
      !Object.values(DbName).includes(entry.dbName as DbName) ||
      entry.filename !== `${entry.dbName}.db` ||
      !Number.isSafeInteger(entry.size) ||
      (entry.size as number) < 0 ||
      typeof entry.sha256 !== 'string' ||
      !Sha256Pattern.test(entry.sha256) ||
      !Number.isSafeInteger(entry.recordCount) ||
      (entry.recordCount as number) < 0 ||
      byName.has(entry.dbName as DbName)
    ) {
      throw new Error(
        `account merge rollback database file ${index} is invalid`
      )
    }
    byName.set(entry.dbName as DbName, {
      dbName: entry.dbName as DbName,
      filename: entry.filename,
      size: entry.size as number,
      sha256: entry.sha256,
      recordCount: entry.recordCount as number
    })
  }
  if (byName.size !== Object.values(DbName).length) {
    throw new Error('account merge rollback database set is incomplete')
  }
  return Object.values(DbName).map((dbName) => byName.get(dbName)!)
}

function parseRollbackMetadata(
  text: string
): AccountMergeRollbackMetadata {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('account merge rollback metadata is not valid JSON')
  }
  if (!isPlainObject(value)) {
    throw new Error('account merge rollback metadata must be an object')
  }
  requireExactKeys(
    value,
    [
      'schemaVersion',
      'createdAt',
      'stageName',
      'bundleId',
      'planSetSha256',
      'account',
      'databaseFiles',
      'redoDatabaseFiles'
    ],
    'account merge rollback metadata'
  )
  if (
    value.schemaVersion !== 1 ||
    !isIsoTimestamp(value.createdAt) ||
    typeof value.stageName !== 'string' ||
    typeof value.bundleId !== 'string' ||
    typeof value.planSetSha256 !== 'string'
  ) {
    throw new Error('account merge rollback metadata has invalid state')
  }
  validateStageIdentity(
    value.stageName,
    value.bundleId,
    value.planSetSha256
  )
  return {
    schemaVersion: 1,
    createdAt: value.createdAt,
    stageName: value.stageName,
    bundleId: value.bundleId,
    planSetSha256: value.planSetSha256,
    account: parseAccount(
      value.account,
      'account merge rollback account'
    ),
    databaseFiles: validateDatabaseFiles(value.databaseFiles),
    redoDatabaseFiles: validateDatabaseFiles(value.redoDatabaseFiles)
  }
}

async function writeJsonAtomically(
  filePath: string,
  value: unknown
): Promise<void> {
  const temporaryPath = `${filePath}.${randomUUID()}.partial`
  const handle = await fs.promises.open(temporaryPath, 'wx', 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  try {
    await fs.promises.rename(temporaryPath, filePath)
  } finally {
    await fs.promises.rm(temporaryPath, { force: true })
  }
}

async function readPendingAccountMerge(
  appDataRoot: string
): Promise<PendingAccountMerge | null> {
  const markerPath = path.join(
    appDataRoot,
    PendingAccountMergeFilename
  )
  if (!(await pathExists(markerPath))) {
    return null
  }
  const stats = await fs.promises.lstat(markerPath)
  if (
    stats.isSymbolicLink() ||
    !stats.isFile() ||
    stats.size > MaxTransactionBytes
  ) {
    throw new Error('pending account merge marker is invalid')
  }
  return parsePendingAccountMerge(
    await fs.promises.readFile(markerPath, 'utf8')
  )
}

function parsePendingAccountMergeRollback(
  text: string
): PendingAccountMergeRollback {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('pending account merge rollback is not valid JSON')
  }
  if (!isPlainObject(value)) {
    throw new Error('pending account merge rollback must be an object')
  }
  requireExactKeys(
    value,
    [
      'schemaVersion',
      'phase',
      'createdAt',
      'stageName',
      'bundleId',
      'planSetSha256',
      'account'
    ],
    'pending account merge rollback'
  )
  if (
    value.schemaVersion !== 1 ||
    !['ready', 'current-moved', 'rollback-installed'].includes(
      String(value.phase)
    ) ||
    !isIsoTimestamp(value.createdAt) ||
    typeof value.stageName !== 'string' ||
    typeof value.bundleId !== 'string' ||
    typeof value.planSetSha256 !== 'string'
  ) {
    throw new Error('pending account merge rollback has invalid state')
  }
  validateStageIdentity(
    value.stageName,
    value.bundleId,
    value.planSetSha256
  )
  return {
    schemaVersion: 1,
    phase: value.phase as AccountMergeRollbackPhase,
    createdAt: value.createdAt,
    stageName: value.stageName,
    bundleId: value.bundleId,
    planSetSha256: value.planSetSha256,
    account: parseAccount(
      value.account,
      'pending account merge rollback account'
    )
  }
}

function parsePendingAccountMergeRedo(
  text: string
): PendingAccountMergeRedo {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('pending account merge redo is not valid JSON')
  }
  if (!isPlainObject(value)) {
    throw new Error('pending account merge redo must be an object')
  }
  requireExactKeys(
    value,
    [
      'schemaVersion',
      'phase',
      'createdAt',
      'stageName',
      'bundleId',
      'planSetSha256',
      'account'
    ],
    'pending account merge redo'
  )
  if (
    value.schemaVersion !== 1 ||
    !['ready', 'current-moved', 'redo-installed'].includes(
      String(value.phase)
    ) ||
    !isIsoTimestamp(value.createdAt) ||
    typeof value.stageName !== 'string' ||
    typeof value.bundleId !== 'string' ||
    typeof value.planSetSha256 !== 'string'
  ) {
    throw new Error('pending account merge redo has invalid state')
  }
  validateStageIdentity(
    value.stageName,
    value.bundleId,
    value.planSetSha256
  )
  return {
    schemaVersion: 1,
    phase: value.phase as AccountMergeRedoPhase,
    createdAt: value.createdAt,
    stageName: value.stageName,
    bundleId: value.bundleId,
    planSetSha256: value.planSetSha256,
    account: parseAccount(
      value.account,
      'pending account merge redo account'
    )
  }
}

async function readTransactionMarker<T>(
  appDataRoot: string,
  filename: string,
  description: string,
  parse: (text: string) => T
): Promise<T | null> {
  const markerPath = path.join(appDataRoot, filename)
  if (!(await pathExists(markerPath))) {
    return null
  }
  const stats = await fs.promises.lstat(markerPath)
  if (
    stats.isSymbolicLink() ||
    !stats.isFile() ||
    stats.size > MaxTransactionBytes
  ) {
    throw new Error(`${description} marker is invalid`)
  }
  return parse(await fs.promises.readFile(markerPath, 'utf8'))
}

async function readPendingAccountMergeRollback(
  appDataRoot: string
): Promise<PendingAccountMergeRollback | null> {
  return readTransactionMarker(
    appDataRoot,
    PendingAccountMergeRollbackFilename,
    'pending account merge rollback',
    parsePendingAccountMergeRollback
  )
}

async function readPendingAccountMergeRedo(
  appDataRoot: string
): Promise<PendingAccountMergeRedo | null> {
  return readTransactionMarker(
    appDataRoot,
    PendingAccountMergeRedoFilename,
    'pending account merge redo',
    parsePendingAccountMergeRedo
  )
}

async function hashFile(
  filename: string
): Promise<{ readonly size: number; readonly sha256: string }> {
  const hash = createHash('sha256')
  let size = 0
  for await (const chunk of fs.createReadStream(filename)) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += data.byteLength
    hash.update(data)
  }
  return { size, sha256: hash.digest('hex') }
}

async function copyRegularFileVerified(
  source: string,
  destination: string
): Promise<void> {
  const sourceStats = await fs.promises.lstat(source)
  if (sourceStats.isSymbolicLink() || !sourceStats.isFile()) {
    throw new Error('account merge source entry is not a regular file')
  }
  await fs.promises.copyFile(
    source,
    destination,
    fs.constants.COPYFILE_EXCL
  )
  const handle = await fs.promises.open(destination, 'r+')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
  const [sourceHash, destinationHash] = await Promise.all([
    hashFile(source),
    hashFile(destination)
  ])
  if (
    sourceHash.size !== sourceStats.size ||
    sourceHash.size !== destinationHash.size ||
    sourceHash.sha256 !== destinationHash.sha256
  ) {
    throw new Error('account merge source changed while being copied')
  }
}

async function copyPreservedEntries(
  sourceDirectory: string,
  destinationDirectory: string,
  topLevel = true
): Promise<void> {
  const entries = await fs.promises.readdir(sourceDirectory, {
    withFileTypes: true
  })
  for (const entry of entries) {
    if (
      topLevel &&
      Object.values(DbName).some(
        (dbName) => entry.name === `${dbName}.db`
      )
    ) {
      continue
    }
    const source = path.join(sourceDirectory, entry.name)
    const destination = path.join(destinationDirectory, entry.name)
    const stats = await fs.promises.lstat(source)
    if (stats.isSymbolicLink()) {
      throw new Error('account merge cannot preserve symbolic links')
    }
    if (stats.isDirectory()) {
      await fs.promises.mkdir(destination, { mode: 0o700 })
      await copyPreservedEntries(source, destination, false)
    } else if (stats.isFile()) {
      await copyRegularFileVerified(source, destination)
    } else {
      throw new Error('account merge cannot preserve special files')
    }
  }
}

async function validateAccountDirectoryTree(
  directory: string,
  topLevel = true
): Promise<void> {
  const entries = await fs.promises.readdir(directory, {
    withFileTypes: true
  })
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    const stats = await fs.promises.lstat(entryPath)
    if (stats.isSymbolicLink()) {
      throw new Error('account merge retained data contains a symbolic link')
    }
    if (stats.isDirectory()) {
      await validateAccountDirectoryTree(entryPath, false)
      continue
    }
    if (!stats.isFile()) {
      throw new Error('account merge retained data contains a special file')
    }
    if (
      topLevel &&
      [
        'app.json',
        'airbase_spots.json',
        'inherit_score.json'
      ].includes(entry.name)
    ) {
      try {
        JSON.parse(await fs.promises.readFile(entryPath, 'utf8'))
      } catch {
        throw new Error(
          `account merge retained profile is invalid JSON: ${entry.name}`
        )
      }
    }
  }
}

function changedCurrentDatabases(
  previews: readonly AccountBackupDatabasePreview[],
  audits: readonly DatabaseAuditInfo[]
): DbName[] {
  const previewByName = new Map(
    previews.map((preview) => [preview.dbName, preview])
  )
  const auditByName = new Map(
    audits.map((audit) => [audit.dbName, audit])
  )
  if (
    previews.length !== previewByName.size ||
    audits.length !== auditByName.size ||
    previewByName.size !== Object.values(DbName).length ||
    auditByName.size !== Object.values(DbName).length
  ) {
    throw new Error(
      'account merge current-state audit is incomplete or duplicated'
    )
  }
  return Object.values(DbName).filter((dbName) =>
    previewByName.get(dbName)!.mergePlan.currentStateSha256 !==
      auditByName.get(dbName)!.semanticSha256
  )
}

async function readRollbackMetadata(
  rollbackDirectory: string
): Promise<AccountMergeRollbackMetadata> {
  const metadataPath = path.join(
    rollbackDirectory,
    RollbackMetadataFilename
  )
  const stats = await fs.promises.lstat(metadataPath)
  if (
    stats.isSymbolicLink() ||
    !stats.isFile() ||
    stats.size > MaxTransactionBytes
  ) {
    throw new Error('account merge rollback metadata is invalid')
  }
  const metadata = parseRollbackMetadata(
    await fs.promises.readFile(metadataPath, 'utf8')
  )
  if (
    ![
      metadata.stageName,
      `${metadata.stageName}.partial`
    ].includes(path.basename(rollbackDirectory))
  ) {
    throw new Error('account merge rollback directory does not match metadata')
  }
  return metadata
}

async function verifyRollbackMetadata(
  rollbackDirectory: string,
  pending: PendingAccountMerge
): Promise<AccountMergeRollbackMetadata> {
  const metadata = await readRollbackMetadata(rollbackDirectory)
  if (
    metadata.stageName !== pending.stageName ||
    metadata.bundleId !== pending.bundleId ||
    metadata.planSetSha256 !== pending.planSetSha256 ||
    !accountsMatch(metadata.account, pending.account)
  ) {
    throw new Error('account merge rollback metadata does not match marker')
  }
  return metadata
}

async function verifyStageForPending(
  pending: PendingAccountMerge,
  appDataRoot: string,
  validateDatabases: ValidateMergeStageDatabases
): Promise<VerifiedAccountDatabaseMergeStage> {
  const stage = await verifyAccountDatabaseMergeStage({
    directory: path.join(
      appDataRoot,
      MergeStagingDirectory,
      pending.stageName
    ),
    appDataRoot,
    expectedAccount: pending.account,
    validateDatabases
  })
  if (
    stage.bundleId !== pending.bundleId ||
    stage.planSetSha256 !== pending.planSetSha256
  ) {
    throw new Error('account merge stage changed after scheduling')
  }
  return stage
}

export async function scheduleAccountMerge(
  stage: VerifiedAccountDatabaseMergeStage,
  appDataRoot: string,
  expectedAccount: AccountMergeIdentity,
  validateDatabases: ValidateMergeStageDatabases
): Promise<void> {
  const realAppDataRoot = await requireRealDirectory(
    appDataRoot,
    'application data root'
  )
  validateAccountIdentity(expectedAccount)
  const verified = await verifyAccountDatabaseMergeStage({
    directory: stage.directory,
    appDataRoot: realAppDataRoot,
    expectedAccount,
    validateDatabases
  })
  if (
    verified.bundleId !== stage.bundleId ||
    verified.planSetSha256 !== stage.planSetSha256
  ) {
    throw new Error('account merge stage changed after verification')
  }
  const stageName = path.basename(verified.directory)
  validateStageIdentity(
    stageName,
    verified.bundleId,
    verified.planSetSha256
  )
  const pendingMarkers = [
    PendingAccountMergeFilename,
    PendingAccountMergeRollbackFilename,
    PendingAccountMergeRedoFilename,
    'account-restore-pending.json',
    'account-rollback-pending.json',
    'account-redo-pending.json'
  ]
  for (const filename of pendingMarkers) {
    if (await pathExists(path.join(realAppDataRoot, filename))) {
      throw new Error('an account data transaction is already pending')
    }
  }
  await writeJsonAtomically(
    path.join(realAppDataRoot, PendingAccountMergeFilename),
    {
      schemaVersion: 1,
      phase: 'ready',
      createdAt: new Date().toISOString(),
      stageName,
      bundleId: verified.bundleId,
      planSetSha256: verified.planSetSha256,
      account: expectedAccount
    } satisfies PendingAccountMerge
  )
}

export async function applyPendingAccountMerge(
  appDataRoot: string,
  currentAccount: AccountMergeIdentity,
  validateDatabases: ValidateMergeStageDatabases,
  auditDatabases: AuditAccountDirectoryDatabases,
  inspectDatabases: InspectAccountDirectoryDatabases
): Promise<ApplyPendingAccountMergeResult> {
  const realAppDataRoot = await requireRealDirectory(
    appDataRoot,
    'application data root'
  )
  let pending = await readPendingAccountMerge(realAppDataRoot)
  if (!pending) {
    return { status: 'none' }
  }
  validateAccountIdentity(currentAccount)
  if (!accountsMatch(pending.account, currentAccount)) {
    return { status: 'different-account' }
  }
  for (const filename of [
    PendingAccountMergeRollbackFilename,
    PendingAccountMergeRedoFilename,
    'account-restore-pending.json',
    'account-rollback-pending.json',
    'account-redo-pending.json'
  ]) {
    if (await pathExists(path.join(realAppDataRoot, filename))) {
      const error = new Error(
        'account merge cannot run while another transaction is pending'
      )
      if (pending.phase !== 'ready') {
        throw new AggregateError(
          [error],
          'active account merge has a conflicting transaction marker'
        )
      }
      throw error
    }
  }

  const markerPath = path.join(
    realAppDataRoot,
    PendingAccountMergeFilename
  )
  const storeRoot = await ensureRealDirectory(
    path.join(realAppDataRoot, StoreDirectory),
    'account store root'
  )
  if (!isWithinPath(storeRoot, realAppDataRoot)) {
    throw new Error('account store root is outside application data')
  }
  const currentDirectory = path.join(
    storeRoot,
    accountDirectoryName(currentAccount)
  )

  const applyRoot = await ensureRealDirectory(
    path.join(realAppDataRoot, MergeApplyDirectory),
    'account merge apply root'
  )
  const rollbackRoot = await ensureRealDirectory(
    path.join(realAppDataRoot, MergeRollbackDirectory),
    'account merge rollback root'
  )
  if (
    !isWithinPath(applyRoot, realAppDataRoot) ||
    !isWithinPath(rollbackRoot, realAppDataRoot)
  ) {
    throw new Error('account merge transaction root is outside application data')
  }
  const applyDirectory = path.join(
    applyRoot,
    `${pending.stageName}.partial`
  )
  const candidateDirectory = path.join(
    applyDirectory,
    AccountDirectory
  )
  const rollbackDirectory = path.join(
    rollbackRoot,
    pending.stageName
  )
  const rollbackPartialDirectory = `${rollbackDirectory}.partial`
  const rollbackAccountDirectory = path.join(
    rollbackPartialDirectory,
    AccountDirectory
  )
  let rollbackFinalized = false

  try {
    let stage: VerifiedAccountDatabaseMergeStage | null = null
    if (pending.phase === 'ready') {
      const realCurrent = await requireRealDirectory(
        currentDirectory,
        'current account directory'
      )
      if (
        !isWithinPath(realCurrent, storeRoot) ||
        !samePath(path.dirname(realCurrent), storeRoot)
      ) {
        throw new Error(
          'current account directory is outside the store root'
        )
      }
      stage = await verifyStageForPending(
        pending,
        realAppDataRoot,
        validateDatabases
      )
      const changed = changedCurrentDatabases(
        stage.previews,
        await auditDatabases(realCurrent)
      )
      if (changed.length > 0) {
        await fs.promises.rm(markerPath)
        return {
          status: 'expired',
          bundleId: pending.bundleId,
          changedDatabases: changed
        }
      }
      if (
        await pathExists(applyDirectory) ||
        await pathExists(rollbackDirectory) ||
        await pathExists(rollbackPartialDirectory)
      ) {
        throw new Error('account merge transaction destination already exists')
      }
      await fs.promises.mkdir(applyDirectory, { mode: 0o700 })
      await fs.promises.mkdir(candidateDirectory, { mode: 0o700 })
      await copyPreservedEntries(realCurrent, candidateDirectory)
      for (const file of stage.databaseFiles) {
        await copyRegularFileVerified(
          path.join(stage.databaseDirectory, file.filename),
          path.join(candidateDirectory, file.filename)
        )
      }
      await validateDatabases(
        candidateDirectory,
        stage.databaseFiles
      )
      const changedAfterCopy = changedCurrentDatabases(
        stage.previews,
        await auditDatabases(realCurrent)
      )
      if (changedAfterCopy.length > 0) {
        await fs.promises.rm(applyDirectory, {
          recursive: true,
          force: true
        })
        await fs.promises.rm(markerPath)
        return {
          status: 'expired',
          bundleId: pending.bundleId,
          changedDatabases: changedAfterCopy
        }
      }
      const rollbackFiles = validateDatabaseFiles(
        await inspectDatabases(realCurrent)
      )
      await fs.promises.mkdir(rollbackPartialDirectory, { mode: 0o700 })
      await writeJsonAtomically(
        path.join(
          rollbackPartialDirectory,
          RollbackMetadataFilename
        ),
        {
          schemaVersion: 1,
          createdAt: pending.createdAt,
          stageName: pending.stageName,
          bundleId: pending.bundleId,
          planSetSha256: pending.planSetSha256,
          account: pending.account,
          databaseFiles: rollbackFiles,
          redoDatabaseFiles: stage.databaseFiles
        } satisfies AccountMergeRollbackMetadata
      )
      pending = { ...pending, phase: 'prepared' }
      await writeJsonAtomically(markerPath, pending)
    }

    if (pending.phase === 'prepared') {
      await verifyRollbackMetadata(
        rollbackPartialDirectory,
        pending
      )
      const candidateExists = await pathExists(candidateDirectory)
      const currentExists = await pathExists(currentDirectory)
      const rollbackExists = await pathExists(rollbackAccountDirectory)
      if (!candidateExists && currentExists && rollbackExists) {
        pending = { ...pending, phase: 'candidate-installed' }
        await writeJsonAtomically(markerPath, pending)
      } else if (candidateExists && !currentExists && rollbackExists) {
        pending = { ...pending, phase: 'current-moved' }
        await writeJsonAtomically(markerPath, pending)
      } else {
        if (
          !candidateExists ||
          !currentExists ||
          rollbackExists
        ) {
          throw new Error('prepared account merge has inconsistent paths')
        }
        stage ??= await verifyStageForPending(
          pending,
          realAppDataRoot,
          validateDatabases
        )
        const changed = changedCurrentDatabases(
          stage.previews,
          await auditDatabases(currentDirectory)
        )
        if (changed.length > 0) {
          await fs.promises.rm(applyDirectory, {
            recursive: true,
            force: true
          })
          await fs.promises.rm(rollbackPartialDirectory, {
            recursive: true,
            force: true
          })
          await fs.promises.rm(markerPath)
          return {
            status: 'expired',
            bundleId: pending.bundleId,
            changedDatabases: changed
          }
        }
        await fs.promises.rename(
          currentDirectory,
          rollbackAccountDirectory
        )
        pending = { ...pending, phase: 'current-moved' }
        await writeJsonAtomically(markerPath, pending)
      }
    }

    if (pending.phase === 'current-moved') {
      await verifyRollbackMetadata(
        rollbackPartialDirectory,
        pending
      )
      const candidateExists = await pathExists(candidateDirectory)
      const currentExists = await pathExists(currentDirectory)
      const rollbackExists = await pathExists(rollbackAccountDirectory)
      if (!candidateExists && currentExists && rollbackExists) {
        pending = { ...pending, phase: 'candidate-installed' }
        await writeJsonAtomically(markerPath, pending)
      } else {
        if (
          !candidateExists ||
          currentExists ||
          !rollbackExists
        ) {
          throw new Error('account merge candidate paths are inconsistent')
        }
        await fs.promises.rename(
          candidateDirectory,
          currentDirectory
        )
        pending = { ...pending, phase: 'candidate-installed' }
        await writeJsonAtomically(markerPath, pending)
      }
    }

    const installedStage = stage ?? await verifyStageForPending(
      pending,
      realAppDataRoot,
      validateDatabases
    )
    const rollbackPartialExists = await pathExists(
      rollbackPartialDirectory
    )
    const rollbackExists = await pathExists(rollbackDirectory)
    if (rollbackPartialExists === rollbackExists) {
      throw new Error(
        'account merge rollback finalization paths are inconsistent'
      )
    }
    const activeRollbackDirectory = rollbackExists
      ? rollbackDirectory
      : rollbackPartialDirectory
    if (rollbackExists) {
      rollbackFinalized = true
    }
    try {
      await verifyRollbackMetadata(activeRollbackDirectory, pending)
      const changedRollbackDatabases = changedCurrentDatabases(
        installedStage.previews,
        await auditDatabases(
          path.join(activeRollbackDirectory, AccountDirectory)
        )
      )
      if (changedRollbackDatabases.length > 0) {
        throw new Error(
          'account merge rollback no longer matches the planned current state'
        )
      }
    } catch (error) {
      if (rollbackFinalized) {
        throw new AggregateError(
          [error],
          'finalized account merge rollback validation failed'
        )
      }
      throw error
    }
    await validateDatabases(
      currentDirectory,
      installedStage.databaseFiles
    )
    if (!rollbackExists) {
      await fs.promises.rename(
        rollbackPartialDirectory,
        rollbackDirectory
      )
      rollbackFinalized = true
    }
    await fs.promises.rm(markerPath)
    await fs.promises.rm(
      path.join(
        realAppDataRoot,
        MergeStagingDirectory,
        pending.stageName
      ),
      { recursive: true, force: true }
    )
    await fs.promises.rm(applyDirectory, {
      recursive: true,
      force: true
    })
    return {
      status: 'applied',
      bundleId: pending.bundleId,
      rollbackDirectory
    }
  } catch (error) {
    if (!rollbackFinalized && pending.phase !== 'ready') {
      try {
        if (
          await pathExists(currentDirectory) &&
          !(await pathExists(candidateDirectory))
        ) {
          await fs.promises.rename(
            currentDirectory,
            candidateDirectory
          )
        }
        if (await pathExists(rollbackAccountDirectory)) {
          await fs.promises.rename(
            rollbackAccountDirectory,
            currentDirectory
          )
        }
        await fs.promises.rm(rollbackPartialDirectory, {
          recursive: true,
          force: true
        })
        await fs.promises.rm(applyDirectory, {
          recursive: true,
          force: true
        })
        await fs.promises.rm(markerPath, { force: true })
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          'account merge failed and rollback could not be completed'
        )
      }
    }
    throw error
  }
}

const AccountDataTransactionMarkers = [
  PendingAccountMergeFilename,
  PendingAccountMergeRollbackFilename,
  PendingAccountMergeRedoFilename,
  'account-restore-pending.json',
  'account-rollback-pending.json',
  'account-redo-pending.json'
] as const

async function hasAnyAccountDataTransaction(
  appDataRoot: string,
  except?: string
): Promise<boolean> {
  for (const filename of AccountDataTransactionMarkers) {
    if (
      filename !== except &&
      await pathExists(path.join(appDataRoot, filename))
    ) {
      return true
    }
  }
  return false
}

function rollbackMetadataMatches(
  metadata: AccountMergeRollbackMetadata,
  pending: {
    readonly stageName: string
    readonly bundleId: string
    readonly planSetSha256: string
    readonly account: AccountMergeIdentity
  }
): boolean {
  return (
    metadata.stageName === pending.stageName &&
    metadata.bundleId === pending.bundleId &&
    metadata.planSetSha256 === pending.planSetSha256 &&
    accountsMatch(metadata.account, pending.account)
  )
}

async function requireMergeRollbackRoot(
  appDataRoot: string
): Promise<string> {
  const rollbackRoot = await requireRealDirectory(
    path.join(appDataRoot, MergeRollbackDirectory),
    'account merge rollback root'
  )
  if (!isWithinPath(rollbackRoot, appDataRoot)) {
    throw new Error('account merge rollback root is outside application data')
  }
  return rollbackRoot
}

async function verifyMergeRollbackDirectory(
  directory: string,
  rollbackRoot: string,
  expectedAccount: AccountMergeIdentity,
  mode: 'rollback' | 'redo',
  validateDatabases: ValidateMergeStageDatabases
): Promise<{
  readonly metadata: AccountMergeRollbackMetadata
  readonly accountDirectory: string
}> {
  const realDirectory = await requireRealDirectory(
    directory,
    `account merge ${mode} directory`
  )
  if (
    !samePath(path.dirname(realDirectory), rollbackRoot) ||
    !isWithinPath(realDirectory, rollbackRoot)
  ) {
    throw new Error(`account merge ${mode} is outside the rollback root`)
  }
  const metadata = await readRollbackMetadata(realDirectory)
  if (path.basename(realDirectory) !== metadata.stageName) {
    throw new Error(
      `account merge ${mode} directory does not match metadata`
    )
  }
  if (!accountsMatch(metadata.account, expectedAccount)) {
    throw new Error(`account merge ${mode} belongs to another account`)
  }
  const accountName =
    mode === 'rollback' ? AccountDirectory : MergedAccountDirectory
  const otherName =
    mode === 'rollback' ? MergedAccountDirectory : AccountDirectory
  const accountDirectory = await requireRealDirectory(
    path.join(realDirectory, accountName),
    `account merge ${mode} data`
  )
  if (!samePath(path.dirname(accountDirectory), realDirectory)) {
    throw new Error(`account merge ${mode} data is outside its directory`)
  }
  const entries = await fs.promises.readdir(realDirectory, {
    withFileTypes: true
  })
  const allowedNames = new Set([
    RollbackMetadataFilename,
    accountName
  ])
  if (
    entries.length !== allowedNames.size ||
    entries.some(
      (entry) =>
        !allowedNames.has(entry.name) ||
        entry.isSymbolicLink() ||
        (entry.name === otherName)
    )
  ) {
    throw new Error(`account merge ${mode} directory has unexpected entries`)
  }
  await validateAccountDirectoryTree(accountDirectory)
  await validateDatabases(
    accountDirectory,
    mode === 'rollback'
      ? metadata.databaseFiles
      : metadata.redoDatabaseFiles
  )
  return { metadata, accountDirectory }
}

async function findLatestAccountMergeSwitch(
  appDataRoot: string,
  expectedAccount: AccountMergeIdentity,
  mode: 'rollback' | 'redo',
  validateDatabases: ValidateMergeStageDatabases
): Promise<AvailableAccountMergeRollback | AvailableAccountMergeRedo | null> {
  const realAppDataRoot = await requireRealDirectory(
    appDataRoot,
    'application data root'
  )
  validateAccountIdentity(expectedAccount)
  const rollbackRootPath = path.join(
    realAppDataRoot,
    MergeRollbackDirectory
  )
  if (
    !(await pathExists(rollbackRootPath)) ||
    await hasAnyAccountDataTransaction(realAppDataRoot)
  ) {
    return null
  }
  const rollbackRoot = await requireMergeRollbackRoot(realAppDataRoot)
  const candidates: Array<
    AvailableAccountMergeRollback | AvailableAccountMergeRedo
  > = []
  const entries = await fs.promises.readdir(rollbackRoot, {
    withFileTypes: true
  })
  for (const entry of entries) {
    if (
      entry.isSymbolicLink() ||
      !entry.isDirectory() ||
      entry.name.endsWith('.partial')
    ) {
      continue
    }
    try {
      const verified = await verifyMergeRollbackDirectory(
        path.join(rollbackRoot, entry.name),
        rollbackRoot,
        expectedAccount,
        mode,
        validateDatabases
      )
      candidates.push({
        directory: path.join(rollbackRoot, entry.name),
        stageName: verified.metadata.stageName,
        bundleId: verified.metadata.bundleId,
        createdAt: verified.metadata.createdAt,
        account: verified.metadata.account
      })
    } catch {
      // Incomplete, corrupt, other-account, and opposite-state generations
      // are deliberately ignored during discovery.
    }
  }
  candidates.sort(
    (left, right) =>
      Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
      right.stageName.localeCompare(left.stageName)
  )
  return candidates[0] ?? null
}

export async function findLatestAccountMergeRollback(
  appDataRoot: string,
  expectedAccount: AccountMergeIdentity,
  validateDatabases: ValidateMergeStageDatabases
): Promise<AvailableAccountMergeRollback | null> {
  return findLatestAccountMergeSwitch(
    appDataRoot,
    expectedAccount,
    'rollback',
    validateDatabases
  ) as Promise<AvailableAccountMergeRollback | null>
}

export async function findLatestAccountMergeRedo(
  appDataRoot: string,
  expectedAccount: AccountMergeIdentity,
  validateDatabases: ValidateMergeStageDatabases
): Promise<AvailableAccountMergeRedo | null> {
  return findLatestAccountMergeSwitch(
    appDataRoot,
    expectedAccount,
    'redo',
    validateDatabases
  ) as Promise<AvailableAccountMergeRedo | null>
}

async function scheduleAccountMergeSwitch(
  candidate: AvailableAccountMergeRollback | AvailableAccountMergeRedo,
  appDataRoot: string,
  expectedAccount: AccountMergeIdentity,
  mode: 'rollback' | 'redo',
  validateDatabases: ValidateMergeStageDatabases
): Promise<void> {
  const realAppDataRoot = await requireRealDirectory(
    appDataRoot,
    'application data root'
  )
  validateAccountIdentity(expectedAccount)
  const rollbackRoot = await requireMergeRollbackRoot(realAppDataRoot)
  const verified = await verifyMergeRollbackDirectory(
    candidate.directory,
    rollbackRoot,
    expectedAccount,
    mode,
    validateDatabases
  )
  if (
    verified.metadata.stageName !== candidate.stageName ||
    verified.metadata.bundleId !== candidate.bundleId ||
    verified.metadata.createdAt !== candidate.createdAt
  ) {
    throw new Error(`account merge ${mode} changed after discovery`)
  }
  if (await hasAnyAccountDataTransaction(realAppDataRoot)) {
    throw new Error('an account data transaction is already pending')
  }
  const filename =
    mode === 'rollback'
      ? PendingAccountMergeRollbackFilename
      : PendingAccountMergeRedoFilename
  const markerPath = path.join(realAppDataRoot, filename)
  const createdAt = new Date().toISOString()
  if (mode === 'rollback') {
    await writeJsonAtomically(markerPath, {
      schemaVersion: 1,
      phase: 'ready',
      createdAt,
      stageName: verified.metadata.stageName,
      bundleId: verified.metadata.bundleId,
      planSetSha256: verified.metadata.planSetSha256,
      account: verified.metadata.account
    } satisfies PendingAccountMergeRollback)
  } else {
    await writeJsonAtomically(markerPath, {
      schemaVersion: 1,
      phase: 'ready',
      createdAt,
      stageName: verified.metadata.stageName,
      bundleId: verified.metadata.bundleId,
      planSetSha256: verified.metadata.planSetSha256,
      account: verified.metadata.account
    } satisfies PendingAccountMergeRedo)
  }
}

export async function scheduleAccountMergeRollback(
  rollback: AvailableAccountMergeRollback,
  appDataRoot: string,
  expectedAccount: AccountMergeIdentity,
  validateDatabases: ValidateMergeStageDatabases
): Promise<void> {
  return scheduleAccountMergeSwitch(
    rollback,
    appDataRoot,
    expectedAccount,
    'rollback',
    validateDatabases
  )
}

export async function scheduleAccountMergeRedo(
  redo: AvailableAccountMergeRedo,
  appDataRoot: string,
  expectedAccount: AccountMergeIdentity,
  validateDatabases: ValidateMergeStageDatabases
): Promise<void> {
  return scheduleAccountMergeSwitch(
    redo,
    appDataRoot,
    expectedAccount,
    'redo',
    validateDatabases
  )
}

export async function applyPendingAccountMergeRollback(
  appDataRoot: string,
  currentAccount: AccountMergeIdentity,
  validateDatabases: ValidateMergeStageDatabases,
  inspectDatabases: InspectAccountDirectoryDatabases
): Promise<ApplyPendingAccountMergeRollbackResult> {
  const realAppDataRoot = await requireRealDirectory(
    appDataRoot,
    'application data root'
  )
  const markerPath = path.join(
    realAppDataRoot,
    PendingAccountMergeRollbackFilename
  )
  const pending = await readPendingAccountMergeRollback(realAppDataRoot)
  if (!pending) {
    return { status: 'none' }
  }
  validateAccountIdentity(currentAccount)
  if (!accountsMatch(pending.account, currentAccount)) {
    return { status: 'different-account' }
  }
  if (
    await hasAnyAccountDataTransaction(
      realAppDataRoot,
      PendingAccountMergeRollbackFilename
    )
  ) {
    throw new Error(
      'account merge rollback cannot run while another transaction is pending'
    )
  }

  const storeRoot = await ensureRealDirectory(
    path.join(realAppDataRoot, StoreDirectory),
    'account store root'
  )
  if (!isWithinPath(storeRoot, realAppDataRoot)) {
    throw new Error('account store root is outside application data')
  }
  const currentDirectory = path.join(
    storeRoot,
    accountDirectoryName(currentAccount)
  )
  const rollbackRoot = await requireMergeRollbackRoot(realAppDataRoot)
  const rollbackDirectory = await requireRealDirectory(
    path.join(rollbackRoot, pending.stageName),
    'account merge rollback directory'
  )
  const metadataPath = path.join(
    rollbackDirectory,
    RollbackMetadataFilename
  )
  let metadata = await readRollbackMetadata(rollbackDirectory)
  if (!rollbackMetadataMatches(metadata, pending)) {
    throw new Error('pending account merge rollback does not match retained data')
  }
  const rollbackAccountDirectory = path.join(
    rollbackDirectory,
    AccountDirectory
  )
  const redoPartialDirectory = path.join(
    rollbackDirectory,
    `${MergedAccountDirectory}.partial`
  )
  const redoDirectory = path.join(
    rollbackDirectory,
    MergedAccountDirectory
  )
  let phase = pending.phase
  let transactionStarted = phase !== 'ready'
  let rollbackFinalized = false

  const updatePhase = async (
    nextPhase: AccountMergeRollbackPhase
  ): Promise<void> => {
    phase = nextPhase
    await writeJsonAtomically(markerPath, {
      ...pending,
      phase: nextPhase
    } satisfies PendingAccountMergeRollback)
  }

  try {
    if (phase === 'ready') {
      const currentExists = await pathExists(currentDirectory)
      const rollbackExists = await pathExists(rollbackAccountDirectory)
      const redoPartialExists = await pathExists(redoPartialDirectory)
      const redoExists = await pathExists(redoDirectory)
      if (
        !currentExists &&
        rollbackExists &&
        redoPartialExists &&
        !redoExists
      ) {
        transactionStarted = true
        await updatePhase('current-moved')
      } else if (
        currentExists &&
        !rollbackExists &&
        redoPartialExists &&
        !redoExists
      ) {
        transactionStarted = true
        await updatePhase('rollback-installed')
      } else {
        if (
          !currentExists ||
          !rollbackExists ||
          redoPartialExists ||
          redoExists
        ) {
          throw new Error('ready account merge rollback has inconsistent paths')
        }
        const verified = await verifyMergeRollbackDirectory(
          rollbackDirectory,
          rollbackRoot,
          currentAccount,
          'rollback',
          validateDatabases
        )
        const realCurrent = await requireRealDirectory(
          currentDirectory,
          'current account directory'
        )
        if (!samePath(path.dirname(realCurrent), storeRoot)) {
          throw new Error('current account directory is outside the store root')
        }
        await validateAccountDirectoryTree(realCurrent)
        const redoDatabaseFiles = validateDatabaseFiles(
          await inspectDatabases(realCurrent)
        )
        await validateDatabases(realCurrent, redoDatabaseFiles)
        metadata = {
          ...verified.metadata,
          redoDatabaseFiles
        }
        await writeJsonAtomically(metadataPath, metadata)
        await fs.promises.rename(realCurrent, redoPartialDirectory)
        transactionStarted = true
        await updatePhase('current-moved')
      }
    }

    if (phase === 'current-moved') {
      const currentExists = await pathExists(currentDirectory)
      const rollbackExists = await pathExists(rollbackAccountDirectory)
      const redoPartialExists = await pathExists(redoPartialDirectory)
      if (
        currentExists &&
        !rollbackExists &&
        redoPartialExists
      ) {
        await updatePhase('rollback-installed')
      } else {
        if (
          currentExists ||
          !rollbackExists ||
          !redoPartialExists
        ) {
          throw new Error(
            'active account merge rollback has inconsistent paths'
          )
        }
        await validateAccountDirectoryTree(redoPartialDirectory)
        await validateDatabases(
          redoPartialDirectory,
          metadata.redoDatabaseFiles
        )
        await validateAccountDirectoryTree(rollbackAccountDirectory)
        await validateDatabases(
          rollbackAccountDirectory,
          metadata.databaseFiles
        )
        await fs.promises.rename(
          rollbackAccountDirectory,
          currentDirectory
        )
        await updatePhase('rollback-installed')
      }
    }

    await validateAccountDirectoryTree(currentDirectory)
    await validateDatabases(currentDirectory, metadata.databaseFiles)
    const redoPartialExists = await pathExists(redoPartialDirectory)
    const redoExists = await pathExists(redoDirectory)
    if (redoPartialExists === redoExists) {
      throw new Error(
        'installed account merge rollback redo paths are inconsistent'
      )
    }
    const activeRedoDirectory = redoExists
      ? redoDirectory
      : redoPartialDirectory
    await validateAccountDirectoryTree(activeRedoDirectory)
    await validateDatabases(
      activeRedoDirectory,
      metadata.redoDatabaseFiles
    )
    if (!redoExists) {
      await fs.promises.rename(redoPartialDirectory, redoDirectory)
    }
    await fs.promises.rm(markerPath)
    rollbackFinalized = true
    return {
      status: 'applied',
      stageName: pending.stageName,
      bundleId: pending.bundleId
    }
  } catch (error) {
    if (transactionStarted && !rollbackFinalized) {
      try {
        if (
          await pathExists(currentDirectory) &&
          !(await pathExists(rollbackAccountDirectory))
        ) {
          await fs.promises.rename(
            currentDirectory,
            rollbackAccountDirectory
          )
        }
        if (
          await pathExists(redoDirectory) &&
          !(await pathExists(redoPartialDirectory))
        ) {
          await fs.promises.rename(redoDirectory, redoPartialDirectory)
        }
        if (
          await pathExists(redoPartialDirectory) &&
          !(await pathExists(currentDirectory))
        ) {
          await fs.promises.rename(
            redoPartialDirectory,
            currentDirectory
          )
        }
        if (
          !(await pathExists(currentDirectory)) ||
          !(await pathExists(rollbackAccountDirectory)) ||
          await pathExists(redoPartialDirectory) ||
          await pathExists(redoDirectory)
        ) {
          throw new Error(
            'account merge rollback recovery paths are inconsistent'
          )
        }
        await fs.promises.rm(markerPath, { force: true })
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          'account merge rollback failed and current data could not be recovered'
        )
      }
    }
    throw error
  }
}

export async function applyPendingAccountMergeRedo(
  appDataRoot: string,
  currentAccount: AccountMergeIdentity,
  validateDatabases: ValidateMergeStageDatabases,
  inspectDatabases: InspectAccountDirectoryDatabases
): Promise<ApplyPendingAccountMergeRedoResult> {
  const realAppDataRoot = await requireRealDirectory(
    appDataRoot,
    'application data root'
  )
  const markerPath = path.join(
    realAppDataRoot,
    PendingAccountMergeRedoFilename
  )
  const pending = await readPendingAccountMergeRedo(realAppDataRoot)
  if (!pending) {
    return { status: 'none' }
  }
  validateAccountIdentity(currentAccount)
  if (!accountsMatch(pending.account, currentAccount)) {
    return { status: 'different-account' }
  }
  if (
    await hasAnyAccountDataTransaction(
      realAppDataRoot,
      PendingAccountMergeRedoFilename
    )
  ) {
    throw new Error(
      'account merge redo cannot run while another transaction is pending'
    )
  }

  const storeRoot = await ensureRealDirectory(
    path.join(realAppDataRoot, StoreDirectory),
    'account store root'
  )
  if (!isWithinPath(storeRoot, realAppDataRoot)) {
    throw new Error('account store root is outside application data')
  }
  const currentDirectory = path.join(
    storeRoot,
    accountDirectoryName(currentAccount)
  )
  const rollbackRoot = await requireMergeRollbackRoot(realAppDataRoot)
  const rollbackDirectory = await requireRealDirectory(
    path.join(rollbackRoot, pending.stageName),
    'account merge redo directory'
  )
  const metadataPath = path.join(
    rollbackDirectory,
    RollbackMetadataFilename
  )
  let metadata = await readRollbackMetadata(rollbackDirectory)
  if (!rollbackMetadataMatches(metadata, pending)) {
    throw new Error('pending account merge redo does not match retained data')
  }
  const redoDirectory = path.join(
    rollbackDirectory,
    MergedAccountDirectory
  )
  const rollbackAccountDirectory = path.join(
    rollbackDirectory,
    AccountDirectory
  )
  const rollbackPartialDirectory = path.join(
    rollbackDirectory,
    `${AccountDirectory}.partial`
  )
  let phase = pending.phase
  let transactionStarted = phase !== 'ready'
  let redoFinalized = false

  const updatePhase = async (
    nextPhase: AccountMergeRedoPhase
  ): Promise<void> => {
    phase = nextPhase
    await writeJsonAtomically(markerPath, {
      ...pending,
      phase: nextPhase
    } satisfies PendingAccountMergeRedo)
  }

  try {
    if (phase === 'ready') {
      const currentExists = await pathExists(currentDirectory)
      const redoExists = await pathExists(redoDirectory)
      const rollbackExists = await pathExists(rollbackAccountDirectory)
      const rollbackPartialExists = await pathExists(
        rollbackPartialDirectory
      )
      if (
        !currentExists &&
        redoExists &&
        !rollbackExists &&
        rollbackPartialExists
      ) {
        transactionStarted = true
        await updatePhase('current-moved')
      } else if (
        currentExists &&
        !redoExists &&
        !rollbackExists &&
        rollbackPartialExists
      ) {
        transactionStarted = true
        await updatePhase('redo-installed')
      } else {
        if (
          !currentExists ||
          !redoExists ||
          rollbackExists ||
          rollbackPartialExists
        ) {
          throw new Error('ready account merge redo has inconsistent paths')
        }
        const verified = await verifyMergeRollbackDirectory(
          rollbackDirectory,
          rollbackRoot,
          currentAccount,
          'redo',
          validateDatabases
        )
        const realCurrent = await requireRealDirectory(
          currentDirectory,
          'current account directory'
        )
        if (!samePath(path.dirname(realCurrent), storeRoot)) {
          throw new Error('current account directory is outside the store root')
        }
        await validateAccountDirectoryTree(realCurrent)
        const databaseFiles = validateDatabaseFiles(
          await inspectDatabases(realCurrent)
        )
        await validateDatabases(realCurrent, databaseFiles)
        metadata = {
          ...verified.metadata,
          databaseFiles
        }
        await writeJsonAtomically(metadataPath, metadata)
        await fs.promises.rename(
          realCurrent,
          rollbackPartialDirectory
        )
        transactionStarted = true
        await updatePhase('current-moved')
      }
    }

    if (phase === 'current-moved') {
      const currentExists = await pathExists(currentDirectory)
      const redoExists = await pathExists(redoDirectory)
      const rollbackExists = await pathExists(rollbackAccountDirectory)
      const rollbackPartialExists = await pathExists(
        rollbackPartialDirectory
      )
      if (
        currentExists &&
        !redoExists &&
        !rollbackExists &&
        rollbackPartialExists
      ) {
        await updatePhase('redo-installed')
      } else {
        if (
          currentExists ||
          !redoExists ||
          rollbackExists ||
          !rollbackPartialExists
        ) {
          throw new Error('active account merge redo has inconsistent paths')
        }
        await validateAccountDirectoryTree(redoDirectory)
        await validateDatabases(
          redoDirectory,
          metadata.redoDatabaseFiles
        )
        await validateAccountDirectoryTree(rollbackPartialDirectory)
        await validateDatabases(
          rollbackPartialDirectory,
          metadata.databaseFiles
        )
        await fs.promises.rename(redoDirectory, currentDirectory)
        await updatePhase('redo-installed')
      }
    }

    await validateAccountDirectoryTree(currentDirectory)
    await validateDatabases(
      currentDirectory,
      metadata.redoDatabaseFiles
    )
    const rollbackExists = await pathExists(rollbackAccountDirectory)
    const rollbackPartialExists = await pathExists(
      rollbackPartialDirectory
    )
    if (rollbackExists === rollbackPartialExists) {
      throw new Error(
        'installed account merge redo rollback paths are inconsistent'
      )
    }
    const activeRollbackDirectory = rollbackExists
      ? rollbackAccountDirectory
      : rollbackPartialDirectory
    await validateAccountDirectoryTree(activeRollbackDirectory)
    await validateDatabases(
      activeRollbackDirectory,
      metadata.databaseFiles
    )
    if (!rollbackExists) {
      await fs.promises.rename(
        rollbackPartialDirectory,
        rollbackAccountDirectory
      )
    }
    await fs.promises.rm(markerPath)
    redoFinalized = true
    return {
      status: 'applied',
      stageName: pending.stageName,
      bundleId: pending.bundleId
    }
  } catch (error) {
    if (transactionStarted && !redoFinalized) {
      try {
        if (
          await pathExists(rollbackAccountDirectory) &&
          !(await pathExists(rollbackPartialDirectory))
        ) {
          await fs.promises.rename(
            rollbackAccountDirectory,
            rollbackPartialDirectory
          )
        }
        if (
          await pathExists(currentDirectory) &&
          !(await pathExists(redoDirectory))
        ) {
          await fs.promises.rename(currentDirectory, redoDirectory)
        }
        if (
          await pathExists(rollbackPartialDirectory) &&
          !(await pathExists(currentDirectory))
        ) {
          await fs.promises.rename(
            rollbackPartialDirectory,
            currentDirectory
          )
        }
        if (
          !(await pathExists(currentDirectory)) ||
          !(await pathExists(redoDirectory)) ||
          await pathExists(rollbackAccountDirectory) ||
          await pathExists(rollbackPartialDirectory)
        ) {
          throw new Error(
            'account merge redo recovery paths are inconsistent'
          )
        }
        await fs.promises.rm(markerPath, { force: true })
      } catch (redoError) {
        throw new AggregateError(
          [error, redoError],
          'account merge redo failed and current data could not be recovered'
        )
      }
    }
    throw error
  }
}

interface MergeRetentionCandidate {
  readonly directory: string
  readonly stageName: string
  readonly createdAt: string
  readonly accountKey: string
  readonly bytes: number
}

async function measureRetainedEntry(entryPath: string): Promise<number> {
  const stats = await fs.promises.lstat(entryPath)
  if (stats.isSymbolicLink() || stats.isFile()) {
    return stats.size
  }
  if (!stats.isDirectory()) {
    return stats.size
  }
  let bytes = stats.size
  const entries = await fs.promises.readdir(entryPath)
  for (const entry of entries) {
    bytes += await measureRetainedEntry(path.join(entryPath, entry))
  }
  return bytes
}

function validateMergeRetentionPolicy(
  policy: AccountRestoreRetentionPolicy
): void {
  if (
    !Number.isSafeInteger(policy.maxAgeDays) ||
    policy.maxAgeDays < 0 ||
    !Number.isSafeInteger(policy.maxGenerationsPerAccount) ||
    policy.maxGenerationsPerAccount < 1 ||
    !Number.isSafeInteger(policy.maxTotalBytes) ||
    policy.maxTotalBytes < 0
  ) {
    throw new Error('account merge retention policy is invalid')
  }
}

async function inspectMergeRetentionCandidate(
  directory: string,
  rollbackRoot: string,
  validateDatabases: ValidateMergeStageDatabases
): Promise<MergeRetentionCandidate | null> {
  const realDirectory = await requireRealDirectory(
    directory,
    'account merge retention candidate'
  )
  if (
    !samePath(path.dirname(realDirectory), rollbackRoot) ||
    !isWithinPath(realDirectory, rollbackRoot)
  ) {
    throw new Error('account merge retention candidate is outside its root')
  }
  const metadata = await readRollbackMetadata(realDirectory)
  let valid = false
  for (const mode of ['rollback', 'redo'] as const) {
    try {
      await verifyMergeRollbackDirectory(
        realDirectory,
        rollbackRoot,
        metadata.account,
        mode,
        validateDatabases
      )
      valid = true
      break
    } catch {
      // Only one of the two finalized layouts can be active.
    }
  }
  if (!valid) {
    return null
  }
  return {
    directory: realDirectory,
    stageName: metadata.stageName,
    createdAt: metadata.createdAt,
    accountKey: `${metadata.account.serverId}:${metadata.account.memberId}`,
    bytes: await measureRetainedEntry(realDirectory)
  }
}

export interface EnforceAccountMergeRetentionOptions {
  readonly now?: Date
  readonly policy?: AccountRestoreRetentionPolicy
  readonly protectedStageNames?: readonly string[]
}

export async function enforceAccountMergeRetention(
  appDataRoot: string,
  validateDatabases: ValidateMergeStageDatabases,
  options: EnforceAccountMergeRetentionOptions = {}
): Promise<AccountMergeRetentionReport> {
  const policy = options.policy ?? DefaultAccountRestoreRetentionPolicy
  validateMergeRetentionPolicy(policy)
  const now = options.now ?? new Date()
  if (!Number.isFinite(now.getTime())) {
    throw new Error('account merge retention time is invalid')
  }
  const protectedStageNames = new Set(
    options.protectedStageNames ?? []
  )
  for (const stageName of protectedStageNames) {
    if (
      typeof stageName !== 'string' ||
      stageName.length === 0 ||
      path.basename(stageName) !== stageName
    ) {
      throw new Error('protected account merge rollback id is invalid')
    }
  }

  const realAppDataRoot = await requireRealDirectory(
    appDataRoot,
    'application data root'
  )
  const rollbackRootPath = path.join(
    realAppDataRoot,
    MergeRollbackDirectory
  )
  if (!(await pathExists(rollbackRootPath))) {
    return {
      deleted: [],
      retainedBytes: 0,
      protectedBytes: 0,
      overCapacityBytes: 0
    }
  }
  const rollbackRoot = await requireMergeRollbackRoot(realAppDataRoot)
  const transactionPending = await hasAnyAccountDataTransaction(
    realAppDataRoot
  )
  const candidates: MergeRetentionCandidate[] = []
  let protectedBytes = 0
  const entries = await fs.promises.readdir(rollbackRoot, {
    withFileTypes: true
  })
  for (const entry of entries) {
    const entryPath = path.join(rollbackRoot, entry.name)
    const bytes = await measureRetainedEntry(entryPath)
    if (
      entry.isSymbolicLink() ||
      !entry.isDirectory() ||
      entry.name.endsWith('.partial')
    ) {
      protectedBytes += bytes
      continue
    }
    try {
      const candidate = await inspectMergeRetentionCandidate(
        entryPath,
        rollbackRoot,
        validateDatabases
      )
      if (!candidate) {
        protectedBytes += bytes
      } else {
        candidates.push(candidate)
      }
    } catch {
      protectedBytes += bytes
    }
  }

  const reasons = new Map<string, AccountMergeRetentionReason>()
  const byAccount = new Map<string, MergeRetentionCandidate[]>()
  for (const candidate of candidates) {
    const accountCandidates = byAccount.get(candidate.accountKey) ?? []
    accountCandidates.push(candidate)
    byAccount.set(candidate.accountKey, accountCandidates)
  }
  for (const accountCandidates of byAccount.values()) {
    accountCandidates.sort(
      (left, right) =>
        Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
        right.stageName.localeCompare(left.stageName)
    )
    for (const [index, candidate] of accountCandidates.entries()) {
      const ageMs = now.getTime() - Date.parse(candidate.createdAt)
      if (
        ageMs >
        policy.maxAgeDays * 24 * 60 * 60 * 1000
      ) {
        reasons.set(candidate.stageName, 'age')
      } else if (index >= policy.maxGenerationsPerAccount) {
        reasons.set(candidate.stageName, 'generation')
      }
    }
  }

  const capacityCandidates = candidates
    .filter((candidate) => !reasons.has(candidate.stageName))
    .sort(
      (left, right) =>
        Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
        left.stageName.localeCompare(right.stageName)
    )
  let retainedCandidateBytes = capacityCandidates.reduce(
    (total, candidate) => total + candidate.bytes,
    0
  )
  if (!transactionPending) {
    const latestByAccount = new Set(
      [...byAccount.values()]
        .map((accountCandidates) =>
          accountCandidates.find(
            (candidate) => !reasons.has(candidate.stageName)
          )
        )
        .filter(
          (candidate): candidate is MergeRetentionCandidate =>
            candidate !== undefined
        )
        .map((candidate) => candidate.stageName)
    )
    for (const candidate of capacityCandidates) {
      if (
        retainedCandidateBytes + protectedBytes <=
          policy.maxTotalBytes ||
        latestByAccount.has(candidate.stageName) ||
        protectedStageNames.has(candidate.stageName)
      ) {
        continue
      }
      reasons.set(candidate.stageName, 'capacity')
      retainedCandidateBytes -= candidate.bytes
    }
  }

  const deleted: AccountMergeRetentionDeletion[] = []
  for (const candidate of candidates) {
    const reason = reasons.get(candidate.stageName)
    if (
      !reason ||
      transactionPending ||
      protectedStageNames.has(candidate.stageName)
    ) {
      continue
    }
    const refreshed = await inspectMergeRetentionCandidate(
      candidate.directory,
      rollbackRoot,
      validateDatabases
    )
    if (
      !refreshed ||
      refreshed.stageName !== candidate.stageName ||
      refreshed.createdAt !== candidate.createdAt ||
      refreshed.bytes !== candidate.bytes
    ) {
      protectedBytes += candidate.bytes
      continue
    }
    const realDirectory = await fs.promises.realpath(candidate.directory)
    if (
      !samePath(path.dirname(realDirectory), rollbackRoot) ||
      !isWithinPath(realDirectory, rollbackRoot)
    ) {
      throw new Error('account merge retention cleanup target is outside root')
    }
    await fs.promises.rm(realDirectory, {
      recursive: true,
      force: false
    })
    deleted.push({
      stageName: candidate.stageName,
      reason,
      bytes: candidate.bytes
    })
  }

  const deletedNames = new Set(deleted.map((entry) => entry.stageName))
  const retainedBytes =
    protectedBytes +
    candidates
      .filter((candidate) => !deletedNames.has(candidate.stageName))
      .reduce((total, candidate) => total + candidate.bytes, 0)
  return {
    deleted,
    retainedBytes,
    protectedBytes,
    overCapacityBytes: Math.max(
      0,
      retainedBytes - policy.maxTotalBytes
    )
  }
}

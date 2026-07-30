import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { DbName, type DbName as DbNameType } from '@common/record'
import {
  parseAccountBackupManifest,
  verifyAccountBackupPayloadFile,
  type AccountBackupManifest
} from '@main/account-backup'
import {
  verifyAccountRestoreStage,
  type ValidateRestoreStageDatabases,
  type VerifiedAccountRestoreStage
} from '@main/account-backup-staging'
import type { RestoreStageDatabaseFile } from '@main/worker/msg'
import {
  DefaultAccountRestoreRetentionPolicy,
  type AccountRestoreRetentionPolicy
} from '@common/account-backup'
import {
  PendingAccountMergeFilename,
  PendingAccountMergeRedoFilename,
  PendingAccountMergeRollbackFilename
} from '@main/account-merge-transaction'

const PendingRestoreFilename = 'account-restore-pending.json'
const PendingRollbackFilename = 'account-rollback-pending.json'
const PendingRedoFilename = 'account-redo-pending.json'
const RestoreStagingDirectory = 'restore-staging'
const RestoreRollbackDirectory = 'restore-rollbacks'
const StoreDirectory = 'store'
const AccountDirectory = 'account'
const RollbackMetadataFilename = 'rollback.json'
const ReplacedAccountDirectory = 'replaced-account'
const MaxTransactionBytes = 2 * 1024 * 1024
const MaxRuntimeProfileBytes = 64 * 1024 * 1024
const RestorableAccountProfileFilenames = [
  'app.json',
  'airbase_spots.json',
  'inherit_score.json'
] as const
const RuntimeAccountProfileFilenames = new Set<string>([
  ...RestorableAccountProfileFilenames,
  'mapinfo.json',
  'missionlist.json',
  'questlist.json'
])
const BundleIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type RestorePhase =
  | 'ready'
  | 'prepared'
  | 'current-moved'
  | 'candidate-installed'

interface PendingAccountRestore {
  readonly schemaVersion: 1
  readonly phase: RestorePhase
  readonly createdAt: string
  readonly hadCurrent: boolean | null
  readonly manifest: AccountBackupManifest
}

export interface AccountRestoreIdentity {
  readonly serverId: number
  readonly memberId: string
}

export type InspectAccountDirectoryDatabases = (
  accountDirectory: string
) => Promise<readonly RestoreStageDatabaseFile[]>

export type ApplyPendingAccountRestoreResult =
  | { readonly status: 'none' }
  | { readonly status: 'different-account' }
  | {
      readonly status: 'already-applied'
      readonly bundleId: string
      readonly rollbackDirectory: string
    }
  | {
      readonly status: 'applied'
      readonly bundleId: string
      readonly rollbackDirectory: string
    }

export interface AvailableAccountRollback {
  readonly directory: string
  readonly bundleId: string
  readonly createdAt: string
  readonly account: AccountRestoreIdentity
}

export interface AvailableAccountRedo {
  readonly directory: string
  readonly bundleId: string
  readonly createdAt: string
  readonly account: AccountRestoreIdentity
}

export type ApplyPendingAccountRollbackResult =
  | { readonly status: 'none' }
  | { readonly status: 'different-account' }
  | {
      readonly status: 'applied'
      readonly bundleId: string
    }

export type ApplyPendingAccountRedoResult =
  | { readonly status: 'none' }
  | { readonly status: 'different-account' }
  | {
      readonly status: 'applied'
      readonly bundleId: string
    }

interface AccountRollbackMetadata {
  readonly schemaVersion: 1
  readonly createdAt: string
  readonly hadCurrent: true
  readonly incomingManifest: AccountBackupManifest
  readonly databaseFiles: RestoreStageDatabaseFile[]
}

interface PendingAccountRollback {
  readonly schemaVersion: 1
  readonly phase: 'ready' | 'current-moved' | 'rollback-installed'
  readonly createdAt: string
  readonly bundleId: string
  readonly account: AccountRestoreIdentity
}

interface PendingAccountRedo {
  readonly schemaVersion: 1
  readonly phase: 'ready' | 'current-moved' | 'redo-installed'
  readonly createdAt: string
  readonly bundleId: string
  readonly account: AccountRestoreIdentity
}

interface VerifiedAccountRollback extends AvailableAccountRollback {
  readonly accountDirectory: string
  readonly metadata: AccountRollbackMetadata
}

interface VerifiedAccountRedo extends AvailableAccountRedo {
  readonly accountDirectory: string
  readonly metadata: AccountRollbackMetadata
}

export type AccountRestoreRetentionReason =
  | 'expired'
  | 'generation-limit'
  | 'capacity-limit'

export interface AccountRestoreRetentionDeletion {
  readonly bundleId: string
  readonly bytes: number
  readonly reason: AccountRestoreRetentionReason
}

export interface AccountRestoreRetentionReport {
  readonly scannedEntries: number
  readonly eligibleGenerations: number
  readonly deleted: readonly AccountRestoreRetentionDeletion[]
  readonly retainedBytes: number
  readonly overCapacityBytes: number
  readonly skippedForPendingTransaction: boolean
}

interface RetentionCandidate {
  readonly directory: string
  readonly bundleId: string
  readonly createdAt: string
  readonly createdAtMs: number
  readonly accountKey: string
  readonly bytes: number
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
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved
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

async function hasPendingAccountMergeTransaction(
  appDataRoot: string
): Promise<boolean> {
  for (const filename of [
    PendingAccountMergeFilename,
    PendingAccountMergeRollbackFilename,
    PendingAccountMergeRedoFilename
  ]) {
    if (await pathExists(path.join(appDataRoot, filename))) {
      return true
    }
  }
  return false
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

function parsePendingAccountRestore(text: string): PendingAccountRestore {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('pending account restore is not valid JSON')
  }
  if (!isPlainObject(value)) {
    throw new Error('pending account restore must be an object')
  }
  requireExactKeys(
    value,
    ['schemaVersion', 'phase', 'createdAt', 'hadCurrent', 'manifest'],
    'pending account restore'
  )
  if (
    value.schemaVersion !== 1 ||
    !['ready', 'prepared', 'current-moved', 'candidate-installed']
      .includes(String(value.phase)) ||
    !isIsoTimestamp(value.createdAt) ||
    (
      value.hadCurrent !== null &&
      typeof value.hadCurrent !== 'boolean'
    )
  ) {
    throw new Error('pending account restore has invalid state')
  }
  if (value.phase === 'ready' && value.hadCurrent !== null) {
    throw new Error('ready account restore cannot have current-data state')
  }
  if (value.phase !== 'ready' && typeof value.hadCurrent !== 'boolean') {
    throw new Error('active account restore must have current-data state')
  }
  return {
    schemaVersion: 1,
    phase: value.phase as RestorePhase,
    createdAt: value.createdAt,
    hadCurrent: value.hadCurrent,
    manifest: parseAccountBackupManifest(JSON.stringify(value.manifest))
  }
}

function parseRollbackDatabaseFiles(
  value: unknown
): RestoreStageDatabaseFile[] {
  if (!Array.isArray(value)) {
    throw new Error('account rollback database files must be an array')
  }
  const names = new Set<DbNameType>()
  const files = value.map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new Error(`account rollback database file ${index} must be an object`)
    }
    requireExactKeys(
      entry,
      ['dbName', 'filename', 'size', 'sha256', 'recordCount'],
      `account rollback database file ${index}`
    )
    if (
      typeof entry.dbName !== 'string' ||
      !Object.values(DbName).includes(entry.dbName as DbNameType) ||
      entry.filename !== `${entry.dbName}.db` ||
      !Number.isSafeInteger(entry.size) ||
      (entry.size as number) < 0 ||
      typeof entry.sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(entry.sha256) ||
      !Number.isSafeInteger(entry.recordCount) ||
      (entry.recordCount as number) < 0
    ) {
      throw new Error(`account rollback database file ${index} is invalid`)
    }
    const dbName = entry.dbName as DbNameType
    if (names.has(dbName)) {
      throw new Error(`account rollback database is duplicated: ${dbName}`)
    }
    names.add(dbName)
    return {
      dbName,
      filename: entry.filename as string,
      size: entry.size as number,
      sha256: entry.sha256,
      recordCount: entry.recordCount as number
    }
  })
  if (names.size !== Object.values(DbName).length) {
    throw new Error('account rollback database set is incomplete')
  }
  return files.sort((left, right) =>
    left.dbName.localeCompare(right.dbName)
  )
}

function parseAccountRollbackMetadata(
  text: string
): AccountRollbackMetadata {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('account rollback metadata is not valid JSON')
  }
  if (!isPlainObject(value)) {
    throw new Error('account rollback metadata must be an object')
  }
  requireExactKeys(
    value,
    [
      'schemaVersion',
      'createdAt',
      'hadCurrent',
      'incomingManifest',
      'databaseFiles'
    ],
    'account rollback metadata'
  )
  if (
    value.schemaVersion !== 1 ||
    value.hadCurrent !== true ||
    !isIsoTimestamp(value.createdAt)
  ) {
    throw new Error('account rollback metadata state is invalid')
  }
  return {
    schemaVersion: 1,
    createdAt: value.createdAt,
    hadCurrent: true,
    incomingManifest: parseAccountBackupManifest(
      JSON.stringify(value.incomingManifest)
    ),
    databaseFiles: parseRollbackDatabaseFiles(value.databaseFiles)
  }
}

function parsePendingAccountRollback(text: string): PendingAccountRollback {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('pending account rollback is not valid JSON')
  }
  if (!isPlainObject(value)) {
    throw new Error('pending account rollback must be an object')
  }
  requireExactKeys(
    value,
    ['schemaVersion', 'phase', 'createdAt', 'bundleId', 'account'],
    'pending account rollback'
  )
  if (
    value.schemaVersion !== 1 ||
    !['ready', 'current-moved', 'rollback-installed']
      .includes(String(value.phase)) ||
    !isIsoTimestamp(value.createdAt) ||
    typeof value.bundleId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value.bundleId) ||
    !isPlainObject(value.account)
  ) {
    throw new Error('pending account rollback has invalid state')
  }
  requireExactKeys(
    value.account,
    ['serverId', 'memberId'],
    'pending account rollback account'
  )
  const account = {
    serverId: value.account.serverId as number,
    memberId: value.account.memberId as string
  }
  accountDirectoryName(account)
  return {
    schemaVersion: 1,
    phase: value.phase as PendingAccountRollback['phase'],
    createdAt: value.createdAt,
    bundleId: value.bundleId,
    account
  }
}

function parsePendingAccountRedo(text: string): PendingAccountRedo {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('pending account redo is not valid JSON')
  }
  if (!isPlainObject(value)) {
    throw new Error('pending account redo must be an object')
  }
  requireExactKeys(
    value,
    ['schemaVersion', 'phase', 'createdAt', 'bundleId', 'account'],
    'pending account redo'
  )
  if (
    value.schemaVersion !== 1 ||
    !['ready', 'current-moved', 'redo-installed']
      .includes(String(value.phase)) ||
    !isIsoTimestamp(value.createdAt) ||
    typeof value.bundleId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value.bundleId) ||
    !isPlainObject(value.account)
  ) {
    throw new Error('pending account redo has invalid state')
  }
  requireExactKeys(
    value.account,
    ['serverId', 'memberId'],
    'pending account redo account'
  )
  const account = {
    serverId: value.account.serverId as number,
    memberId: value.account.memberId as string
  }
  accountDirectoryName(account)
  return {
    schemaVersion: 1,
    phase: value.phase as PendingAccountRedo['phase'],
    createdAt: value.createdAt,
    bundleId: value.bundleId,
    account
  }
}

async function readPendingAccountRestore(
  appDataRoot: string
): Promise<PendingAccountRestore | null> {
  const markerPath = path.join(appDataRoot, PendingRestoreFilename)
  if (!(await pathExists(markerPath))) {
    return null
  }
  const stats = await fs.promises.lstat(markerPath)
  if (
    stats.isSymbolicLink() ||
    !stats.isFile() ||
    stats.size > MaxTransactionBytes
  ) {
    throw new Error('pending account restore marker is invalid')
  }
  return parsePendingAccountRestore(
    await fs.promises.readFile(markerPath, 'utf8')
  )
}

async function readPendingAccountRollback(
  appDataRoot: string
): Promise<PendingAccountRollback | null> {
  const markerPath = path.join(appDataRoot, PendingRollbackFilename)
  if (!(await pathExists(markerPath))) {
    return null
  }
  const stats = await fs.promises.lstat(markerPath)
  if (
    stats.isSymbolicLink() ||
    !stats.isFile() ||
    stats.size > MaxTransactionBytes
  ) {
    throw new Error('pending account rollback marker is invalid')
  }
  return parsePendingAccountRollback(
    await fs.promises.readFile(markerPath, 'utf8')
  )
}

async function readPendingAccountRedo(
  appDataRoot: string
): Promise<PendingAccountRedo | null> {
  const markerPath = path.join(appDataRoot, PendingRedoFilename)
  if (!(await pathExists(markerPath))) {
    return null
  }
  const stats = await fs.promises.lstat(markerPath)
  if (
    stats.isSymbolicLink() ||
    !stats.isFile() ||
    stats.size > MaxTransactionBytes
  ) {
    throw new Error('pending account redo marker is invalid')
  }
  return parsePendingAccountRedo(
    await fs.promises.readFile(markerPath, 'utf8')
  )
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

function accountDirectoryName(account: AccountRestoreIdentity): string {
  if (
    !Number.isSafeInteger(account.serverId) ||
    account.serverId <= 0 ||
    !/^[0-9]{1,32}$/.test(account.memberId)
  ) {
    throw new Error('invalid account restore identity')
  }
  return `${account.serverId}_${account.memberId}`
}

function accountMatches(
  manifest: AccountBackupManifest,
  account: AccountRestoreIdentity
): boolean {
  return (
    manifest.account.serverId === account.serverId &&
    manifest.account.memberId === account.memberId
  )
}

function validateRetentionPolicy(
  policy: AccountRestoreRetentionPolicy
): void {
  const maxAgeMs = policy.maxAgeDays * 24 * 60 * 60 * 1000
  if (
    !Number.isSafeInteger(policy.maxAgeDays) ||
    policy.maxAgeDays < 1 ||
    !Number.isSafeInteger(maxAgeMs) ||
    !Number.isSafeInteger(policy.maxGenerationsPerAccount) ||
    policy.maxGenerationsPerAccount < 1 ||
    !Number.isSafeInteger(policy.maxTotalBytes) ||
    policy.maxTotalBytes < 1
  ) {
    throw new Error('account restore retention policy is invalid')
  }
}

async function measureRetentionEntry(
  candidate: string
): Promise<{ readonly bytes: number; readonly safe: boolean }> {
  const stats = await fs.promises.lstat(candidate)
  if (stats.isSymbolicLink()) {
    return { bytes: stats.size, safe: false }
  }
  if (stats.isFile()) {
    return { bytes: stats.size, safe: true }
  }
  if (!stats.isDirectory()) {
    return { bytes: stats.size, safe: false }
  }

  let bytes = 0
  let safe = true
  const entries = await fs.promises.readdir(candidate)
  for (const entry of entries) {
    const measured = await measureRetentionEntry(
      path.join(candidate, entry)
    )
    bytes += measured.bytes
    safe = safe && measured.safe
  }
  return { bytes, safe }
}

async function inspectRetentionCandidate(
  directory: string,
  rollbackRoot: string,
  measured?: { readonly bytes: number; readonly safe: boolean }
): Promise<RetentionCandidate | null> {
  const bundleId = path.basename(directory)
  if (!BundleIdPattern.test(bundleId)) {
    return null
  }
  const stats = await fs.promises.lstat(directory)
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    return null
  }
  const realDirectory = await fs.promises.realpath(directory)
  if (
    !samePath(path.dirname(realDirectory), rollbackRoot) ||
    path.basename(realDirectory) !== bundleId
  ) {
    return null
  }

  const entries = await fs.promises.readdir(realDirectory, {
    withFileTypes: true
  })
  const names = entries.map((entry) => entry.name).sort()
  const hasAccount = names.includes(AccountDirectory)
  const hasReplaced = names.includes(ReplacedAccountDirectory)
  const expectedDataDirectory = hasAccount
    ? AccountDirectory
    : ReplacedAccountDirectory
  if (
    hasAccount === hasReplaced ||
    names.length !== 2 ||
    !names.includes(expectedDataDirectory) ||
    !names.includes(RollbackMetadataFilename)
  ) {
    return null
  }
  const dataEntry = entries.find(
    (entry) => entry.name === expectedDataDirectory
  )
  const metadataEntry = entries.find(
    (entry) => entry.name === RollbackMetadataFilename
  )
  if (
    !dataEntry?.isDirectory() ||
    dataEntry.isSymbolicLink() ||
    !metadataEntry?.isFile() ||
    metadataEntry.isSymbolicLink()
  ) {
    return null
  }

  let metadata: AccountRollbackMetadata
  try {
    metadata = await readRollbackMetadata(realDirectory)
  } catch {
    return null
  }
  const measurement = measured ?? await measureRetentionEntry(realDirectory)
  if (!measurement.safe) {
    return null
  }
  return {
    directory: realDirectory,
    bundleId,
    createdAt: metadata.createdAt,
    createdAtMs: Date.parse(metadata.createdAt),
    accountKey:
      `${metadata.incomingManifest.account.serverId}\0` +
      metadata.incomingManifest.account.memberId,
    bytes: measurement.bytes
  }
}

async function hasPendingAccountTransaction(
  appDataRoot: string
): Promise<boolean> {
  return (
    await pathExists(path.join(appDataRoot, PendingRestoreFilename)) ||
    await pathExists(path.join(appDataRoot, PendingRollbackFilename)) ||
    await pathExists(path.join(appDataRoot, PendingRedoFilename)) ||
    await hasPendingAccountMergeTransaction(appDataRoot)
  )
}

export interface EnforceAccountRestoreRetentionOptions {
  readonly now?: Date
  readonly policy?: AccountRestoreRetentionPolicy
  readonly protectedBundleIds?: readonly string[]
}

/**
 * Prune only fully finalized rollback generations. Unknown, corrupt, partial,
 * symlinked, and transaction-active data is intentionally retained.
 */
export async function enforceAccountRestoreRetention(
  appDataRoot: string,
  options: EnforceAccountRestoreRetentionOptions = {}
): Promise<AccountRestoreRetentionReport> {
  const policy = options.policy ?? DefaultAccountRestoreRetentionPolicy
  validateRetentionPolicy(policy)
  const now = options.now ?? new Date()
  const nowMs = now.getTime()
  if (!Number.isFinite(nowMs)) {
    throw new Error('account restore retention time is invalid')
  }
  const protectedBundleIds = new Set(options.protectedBundleIds ?? [])
  for (const bundleId of protectedBundleIds) {
    if (!BundleIdPattern.test(bundleId)) {
      throw new Error('protected account rollback id is invalid')
    }
  }

  const realAppDataRoot = await requireRealDirectory(
    appDataRoot,
    'application data root'
  )
  const rollbackRootPath = path.join(
    realAppDataRoot,
    RestoreRollbackDirectory
  )
  if (!(await pathExists(rollbackRootPath))) {
    return {
      scannedEntries: 0,
      eligibleGenerations: 0,
      deleted: [],
      retainedBytes: 0,
      overCapacityBytes: 0,
      skippedForPendingTransaction: false
    }
  }
  const rollbackRoot = await requireRealDirectory(
    rollbackRootPath,
    'restore rollback root'
  )
  if (!isWithinPath(rollbackRoot, realAppDataRoot)) {
    throw new Error('restore rollback root is outside application data')
  }

  const entries = await fs.promises.readdir(rollbackRoot, {
    withFileTypes: true
  })
  const candidates: RetentionCandidate[] = []
  let retainedBytes = 0
  for (const entry of entries) {
    const entryPath = path.join(rollbackRoot, entry.name)
    const measured = await measureRetentionEntry(entryPath)
    retainedBytes += measured.bytes
    if (
      entry.isDirectory() &&
      !entry.isSymbolicLink() &&
      !entry.name.endsWith('.partial')
    ) {
      const candidate = await inspectRetentionCandidate(
        entryPath,
        rollbackRoot,
        measured
      )
      if (candidate) {
        candidates.push(candidate)
      }
    }
  }

  if (await hasPendingAccountTransaction(realAppDataRoot)) {
    return {
      scannedEntries: entries.length,
      eligibleGenerations: candidates.length,
      deleted: [],
      retainedBytes,
      overCapacityBytes: Math.max(
        0,
        retainedBytes - policy.maxTotalBytes
      ),
      skippedForPendingTransaction: true
    }
  }

  candidates.sort((left, right) =>
    left.createdAtMs - right.createdAtMs ||
    left.bundleId.localeCompare(right.bundleId)
  )
  const reasons = new Map<string, AccountRestoreRetentionReason>()
  const expirationCutoff =
    nowMs - policy.maxAgeDays * 24 * 60 * 60 * 1000
  for (const candidate of candidates) {
    if (
      candidate.createdAtMs < expirationCutoff &&
      !protectedBundleIds.has(candidate.bundleId)
    ) {
      reasons.set(candidate.bundleId, 'expired')
    }
  }

  const byAccount = new Map<string, RetentionCandidate[]>()
  for (const candidate of candidates) {
    if (reasons.has(candidate.bundleId)) {
      continue
    }
    const accountCandidates = byAccount.get(candidate.accountKey) ?? []
    accountCandidates.push(candidate)
    byAccount.set(candidate.accountKey, accountCandidates)
  }
  for (const accountCandidates of byAccount.values()) {
    while (
      accountCandidates.length > policy.maxGenerationsPerAccount
    ) {
      const removableIndex = accountCandidates.findIndex(
        (candidate) => !protectedBundleIds.has(candidate.bundleId)
      )
      if (removableIndex < 0) {
        break
      }
      const [candidate] = accountCandidates.splice(removableIndex, 1)
      reasons.set(candidate.bundleId, 'generation-limit')
    }
  }

  const plannedBytes = (): number =>
    candidates.reduce(
      (sum, candidate) =>
        reasons.has(candidate.bundleId)
          ? sum - candidate.bytes
          : sum,
      retainedBytes
    )
  let bytesAfterPlannedDeletion = plannedBytes()
  if (bytesAfterPlannedDeletion > policy.maxTotalBytes) {
    const latestByAccount = new Set(
      [...byAccount.values()]
        .map((accountCandidates) =>
          accountCandidates
            .filter((candidate) => !reasons.has(candidate.bundleId))
            .at(-1)
        )
        .filter((candidate): candidate is RetentionCandidate =>
          Boolean(candidate)
        )
        .map((candidate) => candidate.bundleId)
    )
    for (const candidate of candidates) {
      if (bytesAfterPlannedDeletion <= policy.maxTotalBytes) {
        break
      }
      if (
        reasons.has(candidate.bundleId) ||
        protectedBundleIds.has(candidate.bundleId) ||
        latestByAccount.has(candidate.bundleId)
      ) {
        continue
      }
      reasons.set(candidate.bundleId, 'capacity-limit')
      bytesAfterPlannedDeletion -= candidate.bytes
    }
  }

  const deleted: AccountRestoreRetentionDeletion[] = []
  let skippedForPendingTransaction = false
  for (const candidate of candidates) {
    const reason = reasons.get(candidate.bundleId)
    if (!reason) {
      continue
    }
    if (await hasPendingAccountTransaction(realAppDataRoot)) {
      skippedForPendingTransaction = true
      break
    }
    const refreshed = await inspectRetentionCandidate(
      candidate.directory,
      rollbackRoot
    )
    if (
      !refreshed ||
      refreshed.bundleId !== candidate.bundleId ||
      refreshed.createdAt !== candidate.createdAt ||
      refreshed.accountKey !== candidate.accountKey ||
      refreshed.bytes !== candidate.bytes
    ) {
      continue
    }
    const realDirectory = await requireRealDirectory(
      candidate.directory,
      'expired account rollback directory'
    )
    if (
      !samePath(path.dirname(realDirectory), rollbackRoot) ||
      path.basename(realDirectory) !== candidate.bundleId
    ) {
      throw new Error('account rollback cleanup target is outside its root')
    }
    await fs.promises.rm(realDirectory, {
      recursive: true,
      force: false
    })
    retainedBytes -= candidate.bytes
    deleted.push({
      bundleId: candidate.bundleId,
      bytes: candidate.bytes,
      reason
    })
  }

  return {
    scannedEntries: entries.length,
    eligibleGenerations: candidates.length,
    deleted,
    retainedBytes,
    overCapacityBytes: Math.max(
      0,
      retainedBytes - policy.maxTotalBytes
    ),
    skippedForPendingTransaction
  }
}

export async function scheduleAccountRestore(
  stage: VerifiedAccountRestoreStage,
  appDataRoot: string,
  expectedAccount: AccountRestoreIdentity
): Promise<void> {
  const realAppDataRoot = await requireRealDirectory(
    appDataRoot,
    'application data root'
  )
  const verifiedStage = await verifyAccountRestoreStage(
    stage.directory,
    realAppDataRoot,
    expectedAccount
  )
  const markerPath = path.join(realAppDataRoot, PendingRestoreFilename)
  if (
    await pathExists(markerPath) ||
    await pathExists(path.join(realAppDataRoot, PendingRollbackFilename)) ||
    await pathExists(path.join(realAppDataRoot, PendingRedoFilename)) ||
    await hasPendingAccountMergeTransaction(realAppDataRoot)
  ) {
    throw new Error('an account data transaction is already pending')
  }
  await writeJsonAtomically(markerPath, {
    schemaVersion: 1,
    phase: 'ready',
    createdAt: new Date().toISOString(),
    hadCurrent: null,
    manifest: verifiedStage.manifest
  } satisfies PendingAccountRestore)
}

async function readRollbackMetadata(
  rollbackDirectory: string
): Promise<AccountRollbackMetadata> {
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
    throw new Error('account rollback metadata is invalid')
  }
  const metadata = parseAccountRollbackMetadata(
    await fs.promises.readFile(metadataPath, 'utf8')
  )
  if (path.basename(rollbackDirectory) !== metadata.incomingManifest.bundleId) {
    throw new Error('account rollback directory does not match its bundle')
  }
  return metadata
}

async function verifyAvailableRollbackDirectory(
  directory: string,
  appDataRoot: string,
  expectedAccount: AccountRestoreIdentity
): Promise<VerifiedAccountRollback> {
  const realAppDataRoot = await requireRealDirectory(
    appDataRoot,
    'application data root'
  )
  const rollbackRoot = await requireRealDirectory(
    path.join(realAppDataRoot, RestoreRollbackDirectory),
    'restore rollback root'
  )
  const realDirectory = await requireRealDirectory(
    directory,
    'account rollback directory'
  )
  if (
    !isWithinPath(realDirectory, rollbackRoot) ||
    !samePath(path.dirname(realDirectory), rollbackRoot)
  ) {
    throw new Error('account rollback is outside the rollback root')
  }

  const metadata = await readRollbackMetadata(realDirectory)
  if (!accountMatches(metadata.incomingManifest, expectedAccount)) {
    throw new Error('account rollback does not match the current account')
  }
  const accountDirectory = await requireRealDirectory(
    path.join(realDirectory, AccountDirectory),
    'account rollback data'
  )
  if (!samePath(path.dirname(accountDirectory), realDirectory)) {
    throw new Error('account rollback data is outside the rollback directory')
  }
  await verifyRollbackProfiles(accountDirectory)

  return {
    directory: realDirectory,
    accountDirectory,
    bundleId: metadata.incomingManifest.bundleId,
    createdAt: metadata.createdAt,
    account: {
      serverId: metadata.incomingManifest.account.serverId,
      memberId: metadata.incomingManifest.account.memberId
    },
    metadata
  }
}

function databaseFilesFromManifest(
  manifest: AccountBackupManifest
): RestoreStageDatabaseFile[] {
  return Object.values(DbName).map((dbName) => {
    const filename = `${dbName}.db`
    const file = manifest.files.find(
      (candidate) => candidate.path === `data/${filename}`
    )
    if (
      !file ||
      file.category !== 'database' ||
      file.recordCount === null
    ) {
      throw new Error(
        `account restore manifest is missing database: ${dbName}`
      )
    }
    return {
      dbName,
      filename,
      size: file.size,
      sha256: file.sha256,
      recordCount: file.recordCount
    }
  })
}

async function verifyAvailableRedoDirectory(
  directory: string,
  appDataRoot: string,
  expectedAccount: AccountRestoreIdentity,
  validateDatabases: ValidateRestoreStageDatabases
): Promise<VerifiedAccountRedo> {
  const realAppDataRoot = await requireRealDirectory(
    appDataRoot,
    'application data root'
  )
  const rollbackRoot = await requireRealDirectory(
    path.join(realAppDataRoot, RestoreRollbackDirectory),
    'restore rollback root'
  )
  const realDirectory = await requireRealDirectory(
    directory,
    'account redo directory'
  )
  if (
    !isWithinPath(realDirectory, rollbackRoot) ||
    !samePath(path.dirname(realDirectory), rollbackRoot)
  ) {
    throw new Error('account redo is outside the rollback root')
  }

  const metadata = await readRollbackMetadata(realDirectory)
  if (!accountMatches(metadata.incomingManifest, expectedAccount)) {
    throw new Error('account redo does not match the current account')
  }
  if (
    await pathExists(path.join(realDirectory, AccountDirectory)) ||
    await pathExists(
      path.join(realDirectory, `${AccountDirectory}.partial`)
    ) ||
    await pathExists(
      path.join(realDirectory, `${ReplacedAccountDirectory}.partial`)
    )
  ) {
    throw new Error('account redo directory has an active transaction')
  }
  const accountDirectory = await requireRealDirectory(
    path.join(realDirectory, ReplacedAccountDirectory),
    'account redo data'
  )
  if (!samePath(path.dirname(accountDirectory), realDirectory)) {
    throw new Error('account redo data is outside the rollback directory')
  }
  await verifyCandidateDirectory(
    accountDirectory,
    metadata.incomingManifest,
    true
  )
  await validateDatabases(
    accountDirectory,
    databaseFilesFromManifest(metadata.incomingManifest)
  )

  return {
    directory: realDirectory,
    accountDirectory,
    bundleId: metadata.incomingManifest.bundleId,
    createdAt: metadata.createdAt,
    account: {
      serverId: metadata.incomingManifest.account.serverId,
      memberId: metadata.incomingManifest.account.memberId
    },
    metadata
  }
}

export async function findLatestAccountRollback(
  appDataRoot: string,
  expectedAccount: AccountRestoreIdentity
): Promise<AvailableAccountRollback | null> {
  const realAppDataRoot = await requireRealDirectory(
    appDataRoot,
    'application data root'
  )
  accountDirectoryName(expectedAccount)
  const rollbackRoot = path.join(
    realAppDataRoot,
    RestoreRollbackDirectory
  )
  if (!(await pathExists(rollbackRoot))) {
    return null
  }
  const realRollbackRoot = await requireRealDirectory(
    rollbackRoot,
    'restore rollback root'
  )
  if (!isWithinPath(realRollbackRoot, realAppDataRoot)) {
    throw new Error('restore rollback root is outside application data')
  }

  const candidates: VerifiedAccountRollback[] = []
  const entries = await fs.promises.readdir(realRollbackRoot, {
    withFileTypes: true
  })
  for (const entry of entries) {
    if (
      !entry.isDirectory() ||
      entry.isSymbolicLink() ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(entry.name)
    ) {
      continue
    }
    try {
      candidates.push(
        await verifyAvailableRollbackDirectory(
          path.join(realRollbackRoot, entry.name),
          realAppDataRoot,
          expectedAccount
        )
      )
    } catch {
      // Ignore incomplete, corrupt, and other-account rollback directories.
    }
  }
  candidates.sort((left, right) =>
    Date.parse(right.createdAt) - Date.parse(left.createdAt)
  )
  const latest = candidates[0]
  return latest
    ? {
        directory: latest.directory,
        bundleId: latest.bundleId,
        createdAt: latest.createdAt,
        account: latest.account
      }
    : null
}

export async function scheduleAccountRollback(
  rollback: AvailableAccountRollback,
  appDataRoot: string,
  expectedAccount: AccountRestoreIdentity
): Promise<void> {
  const realAppDataRoot = await requireRealDirectory(
    appDataRoot,
    'application data root'
  )
  const verified = await verifyAvailableRollbackDirectory(
    rollback.directory,
    realAppDataRoot,
    expectedAccount
  )
  if (
    verified.bundleId !== rollback.bundleId ||
    verified.createdAt !== rollback.createdAt
  ) {
    throw new Error('account rollback changed after discovery')
  }
  const markerPath = path.join(realAppDataRoot, PendingRollbackFilename)
  if (
    await pathExists(markerPath) ||
    await pathExists(path.join(realAppDataRoot, PendingRestoreFilename)) ||
    await pathExists(path.join(realAppDataRoot, PendingRedoFilename)) ||
    await hasPendingAccountMergeTransaction(realAppDataRoot)
  ) {
    throw new Error('an account data transaction is already pending')
  }
  await writeJsonAtomically(markerPath, {
    schemaVersion: 1,
    phase: 'ready',
    createdAt: new Date().toISOString(),
    bundleId: verified.bundleId,
    account: verified.account
  } satisfies PendingAccountRollback)
}

export async function findLatestAccountRedo(
  appDataRoot: string,
  expectedAccount: AccountRestoreIdentity,
  validateDatabases: ValidateRestoreStageDatabases
): Promise<AvailableAccountRedo | null> {
  const realAppDataRoot = await requireRealDirectory(
    appDataRoot,
    'application data root'
  )
  accountDirectoryName(expectedAccount)
  const rollbackRoot = path.join(
    realAppDataRoot,
    RestoreRollbackDirectory
  )
  if (!(await pathExists(rollbackRoot))) {
    return null
  }
  const realRollbackRoot = await requireRealDirectory(
    rollbackRoot,
    'restore rollback root'
  )
  if (!isWithinPath(realRollbackRoot, realAppDataRoot)) {
    throw new Error('restore rollback root is outside application data')
  }

  const candidates: VerifiedAccountRedo[] = []
  const entries = await fs.promises.readdir(realRollbackRoot, {
    withFileTypes: true
  })
  for (const entry of entries) {
    if (
      !entry.isDirectory() ||
      entry.isSymbolicLink() ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(entry.name)
    ) {
      continue
    }
    try {
      candidates.push(
        await verifyAvailableRedoDirectory(
          path.join(realRollbackRoot, entry.name),
          realAppDataRoot,
          expectedAccount,
          validateDatabases
        )
      )
    } catch {
      // Ignore incomplete, corrupt, and other-account redo directories.
    }
  }
  candidates.sort((left, right) =>
    Date.parse(right.createdAt) - Date.parse(left.createdAt)
  )
  const latest = candidates[0]
  return latest
    ? {
        directory: latest.directory,
        bundleId: latest.bundleId,
        createdAt: latest.createdAt,
        account: latest.account
      }
    : null
}

export async function scheduleAccountRedo(
  redo: AvailableAccountRedo,
  appDataRoot: string,
  expectedAccount: AccountRestoreIdentity,
  validateDatabases: ValidateRestoreStageDatabases
): Promise<void> {
  const realAppDataRoot = await requireRealDirectory(
    appDataRoot,
    'application data root'
  )
  const verified = await verifyAvailableRedoDirectory(
    redo.directory,
    realAppDataRoot,
    expectedAccount,
    validateDatabases
  )
  if (
    verified.bundleId !== redo.bundleId ||
    verified.createdAt !== redo.createdAt
  ) {
    throw new Error('account redo changed after discovery')
  }
  const markerPath = path.join(realAppDataRoot, PendingRedoFilename)
  if (
    await pathExists(markerPath) ||
    await pathExists(path.join(realAppDataRoot, PendingRestoreFilename)) ||
    await pathExists(path.join(realAppDataRoot, PendingRollbackFilename)) ||
    await hasPendingAccountMergeTransaction(realAppDataRoot)
  ) {
    throw new Error('an account data transaction is already pending')
  }
  await writeJsonAtomically(markerPath, {
    schemaVersion: 1,
    phase: 'ready',
    createdAt: new Date().toISOString(),
    bundleId: verified.bundleId,
    account: verified.account
  } satisfies PendingAccountRedo)
}

async function verifyCandidateDirectory(
  accountDirectory: string,
  manifest: AccountBackupManifest,
  allowRuntimeProfiles = false
): Promise<void> {
  const realDirectory = await requireRealDirectory(
    accountDirectory,
    'restored account directory'
  )
  const expectedNames = new Set(
    manifest.files.map((file) => path.posix.basename(file.path))
  )
  const entries = await fs.promises.readdir(realDirectory, {
    withFileTypes: true
  })
  const actualNames = new Set(entries.map((entry) => entry.name))
  if (
    [...expectedNames].some((filename) => !actualNames.has(filename)) ||
    entries.some(
      (entry) =>
        !entry.isFile() ||
        (!expectedNames.has(entry.name) &&
          (!allowRuntimeProfiles ||
            !RuntimeAccountProfileFilenames.has(entry.name)))
    )
  ) {
    throw new Error('restored account file set does not match its manifest')
  }
  for (const file of manifest.files) {
    await verifyAccountBackupPayloadFile(
      path.join(realDirectory, path.posix.basename(file.path)),
      file
    )
  }
  if (allowRuntimeProfiles) {
    for (const entry of entries) {
      if (expectedNames.has(entry.name)) {
        continue
      }
      const filePath = path.join(realDirectory, entry.name)
      const stats = await fs.promises.lstat(filePath)
      if (
        stats.isSymbolicLink() ||
        !stats.isFile() ||
        stats.size > MaxRuntimeProfileBytes
      ) {
        throw new Error(
          `restored account runtime profile is invalid: ${entry.name}`
        )
      }
      try {
        JSON.parse(await fs.promises.readFile(filePath, 'utf8'))
      } catch {
        throw new Error(
          `restored account runtime profile is invalid JSON: ${entry.name}`
        )
      }
    }
  }
}

function databaseFilesFromStage(
  stage: VerifiedAccountRestoreStage
) {
  return [...stage.databaseFiles]
}

/**
 * Apply a scheduled restore only after the game account is known and before
 * KcRecord opens any account database. Directory moves stay on appData's
 * filesystem, and the previous account directory remains as rollback data.
 */
export async function applyPendingAccountRestore(
  appDataRoot: string,
  currentAccount: AccountRestoreIdentity,
  validateDatabases: ValidateRestoreStageDatabases,
  inspectDatabases: InspectAccountDirectoryDatabases
): Promise<ApplyPendingAccountRestoreResult> {
  const realAppDataRoot = await requireRealDirectory(
    appDataRoot,
    'application data root'
  )
  let pending = await readPendingAccountRestore(realAppDataRoot)
  if (!pending) {
    return { status: 'none' }
  }
  accountDirectoryName(currentAccount)
  if (
    await pathExists(
      path.join(realAppDataRoot, PendingRollbackFilename)
    ) ||
    await pathExists(path.join(realAppDataRoot, PendingRedoFilename)) ||
    await hasPendingAccountMergeTransaction(realAppDataRoot)
  ) {
    throw new Error(
      'account restore cannot run while another transaction is pending'
    )
  }
  if (!accountMatches(pending.manifest, currentAccount)) {
    return { status: 'different-account' }
  }

  const markerPath = path.join(realAppDataRoot, PendingRestoreFilename)
  const stagingDirectory = path.join(
    realAppDataRoot,
    RestoreStagingDirectory,
    pending.manifest.bundleId
  )
  const stageAccountDirectory = path.join(
    stagingDirectory,
    AccountDirectory
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
  const rollbackRoot = await ensureRealDirectory(
    path.join(realAppDataRoot, RestoreRollbackDirectory),
    'restore rollback root'
  )
  if (!isWithinPath(rollbackRoot, realAppDataRoot)) {
    throw new Error('restore rollback root is outside application data')
  }
  const rollbackDirectory = path.join(
    rollbackRoot,
    pending.manifest.bundleId
  )
  const rollbackPartialDirectory = `${rollbackDirectory}.partial`
  const rollbackAccountDirectory = path.join(
    rollbackPartialDirectory,
    AccountDirectory
  )
  let rollbackFinalized = false

  try {
    if (pending.phase === 'ready') {
      const stage = await verifyAccountRestoreStage(
        stagingDirectory,
        realAppDataRoot,
        currentAccount
      )
      await validateDatabases(
        stage.accountDirectory,
        databaseFilesFromStage(stage)
      )
      const rollbackExists = await pathExists(rollbackDirectory)
      const rollbackPartialExists = await pathExists(
        rollbackPartialDirectory
      )
      if (rollbackExists && !rollbackPartialExists) {
        const existingRollback = await verifyAvailableRollbackDirectory(
          rollbackDirectory,
          realAppDataRoot,
          currentAccount
        )
        if (
          !isDeepStrictEqual(
            existingRollback.metadata.incomingManifest,
            pending.manifest
          )
        ) {
          throw new Error(
            'restore rollback destination belongs to a different manifest'
          )
        }
        await verifyCandidateDirectory(
          currentDirectory,
          pending.manifest,
          true
        )
        await validateDatabases(
          currentDirectory,
          databaseFilesFromStage(stage)
        )
        await validateDatabases(
          existingRollback.accountDirectory,
          existingRollback.metadata.databaseFiles
        )
        await fs.promises.rm(markerPath)
        await fs.promises.rm(stagingDirectory, {
          recursive: true,
          force: true
        })
        return {
          status: 'already-applied',
          bundleId: pending.manifest.bundleId,
          rollbackDirectory
        }
      }
      if (rollbackExists || rollbackPartialExists) {
        throw new Error('restore rollback destination already exists')
      }
      const hadCurrent = await pathExists(currentDirectory)
      if (hadCurrent) {
        const realCurrent = await requireRealDirectory(
          currentDirectory,
          'current account directory'
        )
        if (
          !isWithinPath(realCurrent, storeRoot) ||
          !samePath(path.dirname(realCurrent), storeRoot)
        ) {
          throw new Error('current account directory is outside the store root')
        }
      }
      await fs.promises.mkdir(rollbackPartialDirectory, { mode: 0o700 })
      await writeJsonAtomically(
        path.join(rollbackPartialDirectory, RollbackMetadataFilename),
        {
          schemaVersion: 1,
          createdAt: new Date().toISOString(),
          hadCurrent,
          incomingManifest: pending.manifest
        }
      )
      pending = {
        ...pending,
        phase: 'prepared',
        hadCurrent
      }
      await writeJsonAtomically(markerPath, pending)
    }

    if (pending.phase === 'prepared') {
      const rollbackAccountExists = await pathExists(
        rollbackAccountDirectory
      )
      const currentExists = await pathExists(currentDirectory)
      const stageAccountExists = await pathExists(stageAccountDirectory)
      if (
        rollbackAccountExists &&
        !currentExists &&
        stageAccountExists
      ) {
        pending = { ...pending, phase: 'current-moved' }
        await writeJsonAtomically(markerPath, pending)
      } else if (
        rollbackAccountExists &&
        currentExists &&
        !stageAccountExists
      ) {
        pending = { ...pending, phase: 'candidate-installed' }
        await writeJsonAtomically(markerPath, pending)
      } else {
        if (
          rollbackAccountExists ||
          !stageAccountExists ||
          (
            pending.hadCurrent === true &&
            !currentExists
          ) ||
          (
            pending.hadCurrent === false &&
            currentExists
          )
        ) {
          throw new Error('prepared account restore has inconsistent paths')
        }
        if (pending.hadCurrent) {
          await fs.promises.rename(
            currentDirectory,
            rollbackAccountDirectory
          )
        }
        pending = { ...pending, phase: 'current-moved' }
        await writeJsonAtomically(markerPath, pending)
      }
    }

    if (
      pending.phase === 'current-moved' &&
      pending.hadCurrent
    ) {
      const rollbackFiles = await inspectDatabases(
        rollbackAccountDirectory
      )
      if (rollbackFiles.length === 0) {
        throw new Error('restore rollback database validation is incomplete')
      }
      await verifyRollbackProfiles(rollbackAccountDirectory)
      await writeJsonAtomically(
        path.join(rollbackPartialDirectory, RollbackMetadataFilename),
        {
          schemaVersion: 1,
          createdAt: pending.createdAt,
          hadCurrent: true,
          incomingManifest: pending.manifest,
          databaseFiles: rollbackFiles
        }
      )
    }

    if (pending.phase === 'current-moved') {
      const currentExists = await pathExists(currentDirectory)
      const stageAccountExists = await pathExists(stageAccountDirectory)
      if (currentExists && !stageAccountExists) {
        pending = { ...pending, phase: 'candidate-installed' }
        await writeJsonAtomically(markerPath, pending)
      } else {
        if (currentExists || !stageAccountExists) {
          throw new Error('account restore candidate paths are inconsistent')
        }
        await fs.promises.rename(stageAccountDirectory, currentDirectory)
        pending = { ...pending, phase: 'candidate-installed' }
        await writeJsonAtomically(markerPath, pending)
      }
    }

    await verifyCandidateDirectory(currentDirectory, pending.manifest)
    const stageMetadata = await verifyAccountRestoreStageMetadataOnly(
      stagingDirectory,
      realAppDataRoot,
      currentAccount
    )
    await validateDatabases(
      currentDirectory,
      stageMetadata.databaseFiles
    )

    if (!(await pathExists(rollbackDirectory))) {
      await fs.promises.rename(
        rollbackPartialDirectory,
        rollbackDirectory
      )
    }
    rollbackFinalized = true
    await fs.promises.rm(markerPath)
    await fs.promises.rm(stagingDirectory, {
      recursive: true,
      force: true
    }).catch(() => undefined)
    return {
      status: 'applied',
      bundleId: pending.manifest.bundleId,
      rollbackDirectory
    }
  } catch (error) {
    if (!rollbackFinalized && pending.phase !== 'ready') {
      try {
        if (
          await pathExists(currentDirectory) &&
          !(await pathExists(stageAccountDirectory))
        ) {
          await fs.promises.rename(
            currentDirectory,
            stageAccountDirectory
          )
        }
        if (pending.hadCurrent && await pathExists(rollbackAccountDirectory)) {
          await fs.promises.rename(
            rollbackAccountDirectory,
            currentDirectory
          )
        }
        await fs.promises.rm(rollbackPartialDirectory, {
          recursive: true,
          force: true
        })
        await fs.promises.rm(markerPath, { force: true })
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          'account restore failed and rollback could not be completed'
        )
      }
    }
    throw error
  }
}

/**
 * Replace the currently restored account directory with the retained prior
 * directory. The replaced directory is kept beside the rollback metadata so a
 * failed switch can always be reversed and a successful switch retains redo
 * data for manual recovery.
 */
export async function applyPendingAccountRollback(
  appDataRoot: string,
  currentAccount: AccountRestoreIdentity,
  validateDatabases: ValidateRestoreStageDatabases
): Promise<ApplyPendingAccountRollbackResult> {
  const realAppDataRoot = await requireRealDirectory(
    appDataRoot,
    'application data root'
  )
  const pendingRestorePath = path.join(
    realAppDataRoot,
    PendingRestoreFilename
  )
  const pendingRedoPath = path.join(
    realAppDataRoot,
    PendingRedoFilename
  )
  const markerPath = path.join(realAppDataRoot, PendingRollbackFilename)
  const pending = await readPendingAccountRollback(realAppDataRoot)
  if (!pending) {
    return { status: 'none' }
  }
  accountDirectoryName(currentAccount)
  if (
    await pathExists(pendingRestorePath) ||
    await pathExists(pendingRedoPath) ||
    await hasPendingAccountMergeTransaction(realAppDataRoot)
  ) {
    throw new Error(
      'account rollback cannot run while another transaction is pending'
    )
  }
  if (
    pending.account.serverId !== currentAccount.serverId ||
    pending.account.memberId !== currentAccount.memberId
  ) {
    return { status: 'different-account' }
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
  const rollbackRoot = await requireRealDirectory(
    path.join(realAppDataRoot, RestoreRollbackDirectory),
    'restore rollback root'
  )
  if (!isWithinPath(rollbackRoot, realAppDataRoot)) {
    throw new Error('restore rollback root is outside application data')
  }
  const rollbackDirectory = await requireRealDirectory(
    path.join(rollbackRoot, pending.bundleId),
    'account rollback directory'
  )
  if (
    !samePath(path.dirname(rollbackDirectory), rollbackRoot) ||
    path.basename(rollbackDirectory) !== pending.bundleId
  ) {
    throw new Error('account rollback directory is outside the rollback root')
  }
  const metadata = await readRollbackMetadata(rollbackDirectory)
  if (
    metadata.incomingManifest.bundleId !== pending.bundleId ||
    !accountMatches(metadata.incomingManifest, currentAccount)
  ) {
    throw new Error('pending rollback does not match its retained data')
  }

  const rollbackAccountDirectory = path.join(
    rollbackDirectory,
    AccountDirectory
  )
  const replacedPartialDirectory = path.join(
    rollbackDirectory,
    `${ReplacedAccountDirectory}.partial`
  )
  const replacedDirectory = path.join(
    rollbackDirectory,
    ReplacedAccountDirectory
  )
  let phase = pending.phase
  let transactionStarted = phase !== 'ready'
  let rollbackFinalized = false

  const updatePhase = async (
    nextPhase: PendingAccountRollback['phase']
  ): Promise<void> => {
    phase = nextPhase
    await writeJsonAtomically(markerPath, {
      ...pending,
      phase: nextPhase
    })
  }

  try {
    if (phase === 'ready') {
      const rollbackExists = await pathExists(rollbackAccountDirectory)
      const currentExists = await pathExists(currentDirectory)
      const replacedPartialExists = await pathExists(
        replacedPartialDirectory
      )
      const replacedExists = await pathExists(replacedDirectory)

      if (
        rollbackExists &&
        !currentExists &&
        replacedPartialExists &&
        !replacedExists
      ) {
        transactionStarted = true
        await updatePhase('current-moved')
      } else if (
        !rollbackExists &&
        currentExists &&
        replacedPartialExists &&
        !replacedExists
      ) {
        transactionStarted = true
        await updatePhase('rollback-installed')
      } else {
        if (
          !rollbackExists ||
          !currentExists ||
          replacedPartialExists ||
          replacedExists
        ) {
          throw new Error('ready account rollback has inconsistent paths')
        }
        const realCurrent = await requireRealDirectory(
          currentDirectory,
          'current account directory'
        )
        if (
          !isWithinPath(realCurrent, storeRoot) ||
          !samePath(path.dirname(realCurrent), storeRoot)
        ) {
          throw new Error('current account directory is outside the store root')
        }
        const realRollbackAccount = await requireRealDirectory(
          rollbackAccountDirectory,
          'account rollback data'
        )
        if (!samePath(path.dirname(realRollbackAccount), rollbackDirectory)) {
          throw new Error('account rollback data is outside its directory')
        }
        await validateDatabases(
          realRollbackAccount,
          metadata.databaseFiles
        )
        await verifyRollbackProfiles(realRollbackAccount)
        await fs.promises.rename(
          realCurrent,
          replacedPartialDirectory
        )
        transactionStarted = true
        await updatePhase('current-moved')
      }
    }

    if (phase === 'current-moved') {
      const rollbackExists = await pathExists(rollbackAccountDirectory)
      const currentExists = await pathExists(currentDirectory)
      const replacedPartialExists = await pathExists(
        replacedPartialDirectory
      )
      if (
        !rollbackExists &&
        currentExists &&
        replacedPartialExists
      ) {
        await updatePhase('rollback-installed')
      } else {
        if (
          !rollbackExists ||
          currentExists ||
          !replacedPartialExists
        ) {
          throw new Error('active account rollback has inconsistent paths')
        }
        const realRollbackAccount = await requireRealDirectory(
          rollbackAccountDirectory,
          'account rollback data'
        )
        await validateDatabases(
          realRollbackAccount,
          metadata.databaseFiles
        )
        await verifyRollbackProfiles(realRollbackAccount)
        await fs.promises.rename(
          realRollbackAccount,
          currentDirectory
        )
        await updatePhase('rollback-installed')
      }
    }

    const realCurrent = await requireRealDirectory(
      currentDirectory,
      'rolled back account directory'
    )
    if (
      !isWithinPath(realCurrent, storeRoot) ||
      !samePath(path.dirname(realCurrent), storeRoot)
    ) {
      throw new Error('rolled back account directory is outside the store root')
    }
    await validateDatabases(realCurrent, metadata.databaseFiles)
    await verifyRollbackProfiles(realCurrent)

    if (await pathExists(replacedDirectory)) {
      if (await pathExists(replacedPartialDirectory)) {
        throw new Error('account rollback redo destinations conflict')
      }
    } else {
      await fs.promises.rename(
        replacedPartialDirectory,
        replacedDirectory
      )
    }
    rollbackFinalized = true
    await fs.promises.rm(markerPath)
    return {
      status: 'applied',
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
          await pathExists(replacedPartialDirectory) &&
          !(await pathExists(currentDirectory))
        ) {
          await fs.promises.rename(
            replacedPartialDirectory,
            currentDirectory
          )
        }
        if (
          !(await pathExists(currentDirectory)) ||
          !(await pathExists(rollbackAccountDirectory)) ||
          await pathExists(replacedPartialDirectory)
        ) {
          throw new Error('account rollback recovery paths are inconsistent')
        }
        await fs.promises.rm(markerPath, { force: true })
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          'account rollback failed and current data could not be recovered'
        )
      }
    }
    throw error
  }
}

/**
 * Reapply the account directory retained by a completed rollback. The current
 * directory is preserved as the next rollback source, restoring the standard
 * current/account layout so the operation remains reversible.
 */
export async function applyPendingAccountRedo(
  appDataRoot: string,
  currentAccount: AccountRestoreIdentity,
  validateDatabases: ValidateRestoreStageDatabases,
  inspectDatabases: InspectAccountDirectoryDatabases
): Promise<ApplyPendingAccountRedoResult> {
  const realAppDataRoot = await requireRealDirectory(
    appDataRoot,
    'application data root'
  )
  const markerPath = path.join(realAppDataRoot, PendingRedoFilename)
  const pending = await readPendingAccountRedo(realAppDataRoot)
  if (!pending) {
    return { status: 'none' }
  }
  accountDirectoryName(currentAccount)
  if (
    await pathExists(
      path.join(realAppDataRoot, PendingRestoreFilename)
    ) ||
    await pathExists(
      path.join(realAppDataRoot, PendingRollbackFilename)
    ) ||
    await hasPendingAccountMergeTransaction(realAppDataRoot)
  ) {
    throw new Error(
      'account redo cannot run while another transaction is pending'
    )
  }
  if (
    pending.account.serverId !== currentAccount.serverId ||
    pending.account.memberId !== currentAccount.memberId
  ) {
    return { status: 'different-account' }
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
  const rollbackRoot = await requireRealDirectory(
    path.join(realAppDataRoot, RestoreRollbackDirectory),
    'restore rollback root'
  )
  if (!isWithinPath(rollbackRoot, realAppDataRoot)) {
    throw new Error('restore rollback root is outside application data')
  }
  const rollbackDirectory = await requireRealDirectory(
    path.join(rollbackRoot, pending.bundleId),
    'account redo directory'
  )
  if (
    !samePath(path.dirname(rollbackDirectory), rollbackRoot) ||
    path.basename(rollbackDirectory) !== pending.bundleId
  ) {
    throw new Error('account redo directory is outside the rollback root')
  }
  const metadata = await readRollbackMetadata(rollbackDirectory)
  if (
    metadata.incomingManifest.bundleId !== pending.bundleId ||
    !accountMatches(metadata.incomingManifest, currentAccount)
  ) {
    throw new Error('pending redo does not match its retained data')
  }

  const redoDirectory = path.join(
    rollbackDirectory,
    ReplacedAccountDirectory
  )
  const rollbackAccountDirectory = path.join(
    rollbackDirectory,
    AccountDirectory
  )
  const rollbackAccountPartialDirectory = path.join(
    rollbackDirectory,
    `${AccountDirectory}.partial`
  )
  const incomingDatabaseFiles = databaseFilesFromManifest(
    metadata.incomingManifest
  )
  let phase = pending.phase
  let transactionStarted = phase !== 'ready'
  let redoFinalized = false

  const updatePhase = async (
    nextPhase: PendingAccountRedo['phase']
  ): Promise<void> => {
    phase = nextPhase
    await writeJsonAtomically(markerPath, {
      ...pending,
      phase: nextPhase
    })
  }

  const verifyRedoCandidate = async (
    directory: string,
    expectedParent = rollbackDirectory
  ): Promise<void> => {
    const realDirectory = await requireRealDirectory(
      directory,
      'account redo data'
    )
    if (!samePath(path.dirname(realDirectory), expectedParent)) {
      throw new Error('account redo data is outside its directory')
    }
    await verifyCandidateDirectory(
      realDirectory,
      metadata.incomingManifest,
      true
    )
    await validateDatabases(realDirectory, incomingDatabaseFiles)
  }

  try {
    if (phase === 'ready') {
      const redoExists = await pathExists(redoDirectory)
      const currentExists = await pathExists(currentDirectory)
      const rollbackExists = await pathExists(
        rollbackAccountDirectory
      )
      const rollbackPartialExists = await pathExists(
        rollbackAccountPartialDirectory
      )

      if (
        redoExists &&
        !currentExists &&
        !rollbackExists &&
        rollbackPartialExists
      ) {
        transactionStarted = true
        await updatePhase('current-moved')
      } else if (
        !redoExists &&
        currentExists &&
        !rollbackExists &&
        rollbackPartialExists
      ) {
        transactionStarted = true
        await updatePhase('redo-installed')
      } else if (
        !redoExists &&
        currentExists &&
        rollbackExists &&
        !rollbackPartialExists
      ) {
        transactionStarted = true
        await updatePhase('redo-installed')
      } else {
        if (
          !redoExists ||
          !currentExists ||
          rollbackExists ||
          rollbackPartialExists
        ) {
          throw new Error('ready account redo has inconsistent paths')
        }
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
        await verifyRedoCandidate(redoDirectory)
        await fs.promises.rename(
          realCurrent,
          rollbackAccountPartialDirectory
        )
        transactionStarted = true
        await updatePhase('current-moved')
      }
    }

    if (phase === 'current-moved') {
      const redoExists = await pathExists(redoDirectory)
      const currentExists = await pathExists(currentDirectory)
      const rollbackExists = await pathExists(
        rollbackAccountDirectory
      )
      const rollbackPartialExists = await pathExists(
        rollbackAccountPartialDirectory
      )
      if (
        !redoExists &&
        currentExists &&
        !rollbackExists &&
        rollbackPartialExists
      ) {
        await updatePhase('redo-installed')
      } else {
        if (
          !redoExists ||
          currentExists ||
          rollbackExists ||
          !rollbackPartialExists
        ) {
          throw new Error('active account redo has inconsistent paths')
        }
        await verifyRedoCandidate(redoDirectory)
        await fs.promises.rename(redoDirectory, currentDirectory)
        await updatePhase('redo-installed')
      }
    }

    const currentExists = await pathExists(currentDirectory)
    const redoExists = await pathExists(redoDirectory)
    const rollbackExists = await pathExists(
      rollbackAccountDirectory
    )
    const rollbackPartialExists = await pathExists(
      rollbackAccountPartialDirectory
    )
    if (
      currentExists &&
      !redoExists &&
      rollbackExists &&
      !rollbackPartialExists
    ) {
      await verifyRedoCandidate(currentDirectory, storeRoot)
      await validateDatabases(
        rollbackAccountDirectory,
        metadata.databaseFiles
      )
      await verifyRollbackProfiles(rollbackAccountDirectory)
      redoFinalized = true
      await fs.promises.rm(markerPath)
      return {
        status: 'applied',
        bundleId: pending.bundleId
      }
    }
    if (
      !currentExists ||
      redoExists ||
      rollbackExists ||
      !rollbackPartialExists
    ) {
      throw new Error('installed account redo has inconsistent paths')
    }

    await verifyRedoCandidate(currentDirectory, storeRoot)
    const rollbackFiles = await inspectDatabases(
      rollbackAccountPartialDirectory
    )
    if (rollbackFiles.length === 0) {
      throw new Error('account redo rollback validation is incomplete')
    }
    await verifyRollbackProfiles(rollbackAccountPartialDirectory)
    await writeJsonAtomically(
      path.join(rollbackDirectory, RollbackMetadataFilename),
      {
        schemaVersion: 1,
        createdAt: pending.createdAt,
        hadCurrent: true,
        incomingManifest: metadata.incomingManifest,
        databaseFiles: [...rollbackFiles]
      } satisfies AccountRollbackMetadata
    )
    await fs.promises.rename(
      rollbackAccountPartialDirectory,
      rollbackAccountDirectory
    )
    await fs.promises.rm(markerPath)
    redoFinalized = true
    return {
      status: 'applied',
      bundleId: pending.bundleId
    }
  } catch (error) {
    if (transactionStarted && !redoFinalized) {
      try {
        if (
          await pathExists(rollbackAccountDirectory) &&
          !(await pathExists(rollbackAccountPartialDirectory))
        ) {
          await fs.promises.rename(
            rollbackAccountDirectory,
            rollbackAccountPartialDirectory
          )
        }
        if (
          await pathExists(currentDirectory) &&
          !(await pathExists(redoDirectory))
        ) {
          await fs.promises.rename(
            currentDirectory,
            redoDirectory
          )
        }
        if (
          await pathExists(rollbackAccountPartialDirectory) &&
          !(await pathExists(currentDirectory))
        ) {
          await fs.promises.rename(
            rollbackAccountPartialDirectory,
            currentDirectory
          )
        }
        if (
          !(await pathExists(currentDirectory)) ||
          !(await pathExists(redoDirectory)) ||
          await pathExists(rollbackAccountDirectory) ||
          await pathExists(rollbackAccountPartialDirectory)
        ) {
          throw new Error('account redo recovery paths are inconsistent')
        }
        await fs.promises.rm(markerPath, { force: true })
      } catch (redoError) {
        throw new AggregateError(
          [error, redoError],
          'account redo failed and current data could not be recovered'
        )
      }
    }
    throw error
  }
}

async function verifyRollbackProfiles(
  accountDirectory: string
): Promise<void> {
  for (const filename of RestorableAccountProfileFilenames) {
    const filePath = path.join(accountDirectory, filename)
    if (!(await pathExists(filePath))) {
      continue
    }
    const stats = await fs.promises.lstat(filePath)
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(`restore rollback profile is not a regular file: ${filename}`)
    }
    try {
      JSON.parse(await fs.promises.readFile(filePath, 'utf8'))
    } catch {
      throw new Error(`restore rollback profile is invalid JSON: ${filename}`)
    }
  }
}

async function verifyAccountRestoreStageMetadataOnly(
  stagingDirectory: string,
  appDataRoot: string,
  expectedAccount: AccountRestoreIdentity
): Promise<VerifiedAccountRestoreStage> {
  const accountDirectory = path.join(stagingDirectory, AccountDirectory)
  if (await pathExists(accountDirectory)) {
    return verifyAccountRestoreStage(
      stagingDirectory,
      appDataRoot,
      expectedAccount
    )
  }

  const metadataPath = path.join(stagingDirectory, 'stage.json')
  const stats = await fs.promises.lstat(metadataPath)
  if (
    stats.isSymbolicLink() ||
    !stats.isFile() ||
    stats.size > MaxTransactionBytes
  ) {
    throw new Error('restore stage metadata is invalid')
  }
  const raw = JSON.parse(await fs.promises.readFile(metadataPath, 'utf8'))
  if (!isPlainObject(raw)) {
    throw new Error('restore stage metadata must be an object')
  }
  requireExactKeys(raw, ['schemaVersion', 'stagedAt', 'manifest'], 'restore stage metadata')
  if (raw.schemaVersion !== 1 || !isIsoTimestamp(raw.stagedAt)) {
    throw new Error('restore stage metadata state is invalid')
  }
  const manifest = parseAccountBackupManifest(JSON.stringify(raw.manifest))
  if (
    manifest.bundleId !== path.basename(stagingDirectory) ||
    !accountMatches(manifest, expectedAccount)
  ) {
    throw new Error('restore stage metadata does not match the transaction')
  }
  const databaseFiles = manifest.files.flatMap((file) => {
    const match = /^data\/([a-z]+)\.db$/.exec(file.path)
    if (!match || file.recordCount === null) {
      return []
    }
    return [{
      dbName: match[1] as VerifiedAccountRestoreStage['databaseFiles'][number]['dbName'],
      filename: path.posix.basename(file.path),
      size: file.size,
      sha256: file.sha256,
      recordCount: file.recordCount
    }]
  })
  return {
    directory: stagingDirectory,
    accountDirectory,
    bundleId: manifest.bundleId,
    account: manifest.account,
    databaseFiles,
    manifest
  }
}

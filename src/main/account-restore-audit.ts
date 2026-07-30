import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { DbName, type DbName as DbNameType } from '@common/record'
import type {
  LocalAccountAuditComparisonResult,
  LocalAccountAuditSummary
} from '@common/account-backup'
import type { DatabaseAuditInfo } from '@main/worker/msg'

const AuditBaselineFilename = 'account-restore-audit-baseline.json'
const MaxAuditBaselineBytes = 1024 * 1024
const MaxAuditProfileBytes = 64 * 1024 * 1024
const AuditProfileFilenames = Object.freeze([
  'app.json',
  'airbase_spots.json',
  'inherit_score.json'
])

export interface AccountAuditIdentity {
  readonly serverId: number
  readonly memberId: string
}

interface AccountAuditProfile {
  readonly filename: string
  readonly present: boolean
  readonly size: number
  readonly sha256: string | null
}

export interface AccountAuditSnapshot {
  readonly schemaVersion: 1
  readonly capturedAt: string
  readonly accountFingerprint: string
  readonly databases: readonly DatabaseAuditInfo[]
  readonly profiles: readonly AccountAuditProfile[]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
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

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  )
}

function validateIdentity(account: AccountAuditIdentity): void {
  if (
    !Number.isSafeInteger(account.serverId) ||
    account.serverId <= 0 ||
    !/^[0-9]{1,32}$/.test(account.memberId)
  ) {
    throw new Error('invalid account audit identity')
  }
}

export function createAccountAuditFingerprint(
  account: AccountAuditIdentity
): string {
  validateIdentity(account)
  return createHash('sha256')
    .update('account-audit-v1\0')
    .update(String(account.serverId))
    .update('\0')
    .update(account.memberId)
    .digest('hex')
}

function normalizeDatabaseAudits(
  databases: readonly DatabaseAuditInfo[]
): DatabaseAuditInfo[] {
  const names = new Set<DbNameType>()
  const normalized = databases.map((database) => {
    if (
      !Object.values(DbName).includes(database.dbName) ||
      names.has(database.dbName) ||
      !Number.isSafeInteger(database.recordCount) ||
      database.recordCount < 0 ||
      !/^[0-9a-f]{64}$/.test(database.semanticSha256) ||
      (
        database.oldestRecordAt !== null &&
        !isIsoTimestamp(database.oldestRecordAt)
      ) ||
      (
        database.newestRecordAt !== null &&
        !isIsoTimestamp(database.newestRecordAt)
      )
    ) {
      throw new Error('account audit database result is invalid')
    }
    names.add(database.dbName)
    return { ...database }
  })
  if (names.size !== Object.values(DbName).length) {
    throw new Error('account audit database set is incomplete')
  }
  return normalized.sort((left, right) =>
    left.dbName.localeCompare(right.dbName)
  )
}

async function hashProfile(
  accountDirectory: string,
  filename: string
): Promise<AccountAuditProfile> {
  const filePath = path.join(accountDirectory, filename)
  let stats: fs.Stats
  try {
    stats = await fs.promises.lstat(filePath)
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return {
        filename,
        present: false,
        size: 0,
        sha256: null
      }
    }
    throw error
  }
  if (
    stats.isSymbolicLink() ||
    !stats.isFile() ||
    stats.size > MaxAuditProfileBytes
  ) {
    throw new Error(`account audit profile is invalid: ${filename}`)
  }
  const hash = createHash('sha256')
  let size = 0
  for await (const chunk of fs.createReadStream(filePath)) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += data.byteLength
    if (size > MaxAuditProfileBytes) {
      throw new Error(`account audit profile is too large: ${filename}`)
    }
    hash.update(data)
  }
  if (size !== stats.size) {
    throw new Error(`account audit profile changed while reading: ${filename}`)
  }
  return {
    filename,
    present: true,
    size,
    sha256: hash.digest('hex')
  }
}

export async function createAccountAuditSnapshot(
  accountDirectory: string,
  account: AccountAuditIdentity,
  databases: readonly DatabaseAuditInfo[],
  capturedAt = new Date()
): Promise<AccountAuditSnapshot> {
  validateIdentity(account)
  const stats = await fs.promises.lstat(accountDirectory)
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error('account audit source must be a real directory')
  }
  const profiles = (await Promise.all(
    AuditProfileFilenames.map((filename) =>
      hashProfile(accountDirectory, filename)
    )
  )).sort((left, right) =>
    left.filename.localeCompare(right.filename)
  )
  return {
    schemaVersion: 1,
    capturedAt: capturedAt.toISOString(),
    accountFingerprint: createAccountAuditFingerprint(account),
    databases: normalizeDatabaseAudits(databases),
    profiles
  }
}

function parseDatabase(value: unknown): DatabaseAuditInfo {
  if (!isPlainObject(value)) {
    throw new Error('account audit database must be an object')
  }
  requireExactKeys(
    value,
    [
      'dbName',
      'recordCount',
      'oldestRecordAt',
      'newestRecordAt',
      'semanticSha256'
    ],
    'account audit database'
  )
  return value as unknown as DatabaseAuditInfo
}

function parseProfile(value: unknown): AccountAuditProfile {
  if (!isPlainObject(value)) {
    throw new Error('account audit profile must be an object')
  }
  requireExactKeys(
    value,
    ['filename', 'present', 'size', 'sha256'],
    'account audit profile'
  )
  if (
    typeof value.filename !== 'string' ||
    !AuditProfileFilenames.includes(value.filename) ||
    typeof value.present !== 'boolean' ||
    !Number.isSafeInteger(value.size) ||
    (value.size as number) < 0 ||
    (
      value.sha256 !== null &&
      (
        typeof value.sha256 !== 'string' ||
        !/^[0-9a-f]{64}$/.test(value.sha256)
      )
    ) ||
    (
      value.present &&
      value.sha256 === null
    ) ||
    (
      !value.present &&
      (value.size !== 0 || value.sha256 !== null)
    )
  ) {
    throw new Error('account audit profile is invalid')
  }
  return {
    filename: value.filename,
    present: value.present,
    size: value.size as number,
    sha256: value.sha256
  }
}

export function parseAccountAuditSnapshot(
  text: string
): AccountAuditSnapshot {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('account audit baseline is not valid JSON')
  }
  if (!isPlainObject(value)) {
    throw new Error('account audit baseline must be an object')
  }
  requireExactKeys(
    value,
    [
      'schemaVersion',
      'capturedAt',
      'accountFingerprint',
      'databases',
      'profiles'
    ],
    'account audit baseline'
  )
  if (
    value.schemaVersion !== 1 ||
    !isIsoTimestamp(value.capturedAt) ||
    typeof value.accountFingerprint !== 'string' ||
    !/^[0-9a-f]{64}$/.test(value.accountFingerprint) ||
    !Array.isArray(value.databases) ||
    !Array.isArray(value.profiles)
  ) {
    throw new Error('account audit baseline has invalid state')
  }
  const databases = normalizeDatabaseAudits(
    value.databases.map(parseDatabase)
  )
  const profiles = value.profiles.map(parseProfile)
  const profileNames = new Set(profiles.map((profile) => profile.filename))
  if (
    profiles.length !== AuditProfileFilenames.length ||
    profileNames.size !== AuditProfileFilenames.length
  ) {
    throw new Error('account audit profile set is incomplete')
  }
  profiles.sort((left, right) =>
    left.filename.localeCompare(right.filename)
  )
  return {
    schemaVersion: 1,
    capturedAt: value.capturedAt,
    accountFingerprint: value.accountFingerprint,
    databases,
    profiles
  }
}

function baselinePath(appDataRoot: string): string {
  return path.join(appDataRoot, AuditBaselineFilename)
}

export async function saveAccountAuditBaseline(
  appDataRoot: string,
  snapshot: AccountAuditSnapshot
): Promise<void> {
  const rootStats = await fs.promises.lstat(appDataRoot)
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    throw new Error('application data root must be a real directory')
  }
  const parsed = parseAccountAuditSnapshot(JSON.stringify(snapshot))
  const destination = baselinePath(appDataRoot)
  const temporary = `${destination}.${randomUUID()}.partial`
  const handle = await fs.promises.open(temporary, 'wx', 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  try {
    await fs.promises.rename(temporary, destination)
  } finally {
    await fs.promises.rm(temporary, { force: true })
  }
}

export async function loadAccountAuditBaseline(
  appDataRoot: string
): Promise<AccountAuditSnapshot | null> {
  const filePath = baselinePath(appDataRoot)
  let stats: fs.Stats
  try {
    stats = await fs.promises.lstat(filePath)
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return null
    }
    throw error
  }
  if (
    stats.isSymbolicLink() ||
    !stats.isFile() ||
    stats.size > MaxAuditBaselineBytes
  ) {
    throw new Error('account audit baseline file is invalid')
  }
  return parseAccountAuditSnapshot(
    await fs.promises.readFile(filePath, 'utf8')
  )
}

export function toLocalAccountAuditSummary(
  snapshot: AccountAuditSnapshot
): LocalAccountAuditSummary {
  return {
    capturedAt: snapshot.capturedAt,
    databases: snapshot.databases.map((database) => ({
      dbName: database.dbName,
      records: database.recordCount
    })),
    profileFiles: snapshot.profiles.filter((profile) => profile.present).length,
    records: snapshot.databases.reduce(
      (sum, database) => sum + database.recordCount,
      0
    )
  }
}

export function compareAccountAuditSnapshots(
  baseline: AccountAuditSnapshot,
  current: AccountAuditSnapshot
): LocalAccountAuditComparisonResult {
  if (baseline.accountFingerprint !== current.accountFingerprint) {
    return {
      status: 'different-account',
      capturedAt: baseline.capturedAt
    }
  }
  const changedDatabases = baseline.databases
    .filter((database, index) =>
      !isDeepStrictEqual(database, current.databases[index])
    )
    .map((database) => database.dbName)
  const changedProfiles = baseline.profiles
    .filter((profile, index) =>
      !isDeepStrictEqual(profile, current.profiles[index])
    )
    .map((profile) => profile.filename)
  const summary = toLocalAccountAuditSummary(baseline)
  return changedDatabases.length === 0 && changedProfiles.length === 0
    ? { status: 'match', summary }
    : {
        status: 'different',
        summary,
        changedDatabases,
        changedProfiles
      }
}

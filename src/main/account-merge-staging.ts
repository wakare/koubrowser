import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { DbName } from '@common/record'
import type {
  AccountBackupDatabasePreview,
  AccountBackupMergeConflictSummary
} from '@common/account-backup'
import {
  verifyAccountBackupPayloadFile,
  verifyLocalAccountBackup,
  type AccountBackupFile,
  type VerifiedAccountBackup
} from '@main/account-backup'
import type {
  DatabaseBackupPreviewFile,
  RestoreStageDatabaseFile
} from '@main/worker/msg'
import {
  AccountRecordMergeConflictGroupOrder,
  AccountRecordMergeConflictPolicyVersion,
  AccountRecordMergeConflictResolution,
  isAccountRecordMergeConflictGroup
} from '@main/account-record-merge-policy'

const MergeStagingDirectory = 'merge-staging'
const MergeStageDatabaseDirectory = 'databases'
const MergeStageMetadataFilename = 'merge-stage.json'
const MaxMergeStageMetadataBytes = 1024 * 1024
const Sha256Pattern = /^[0-9a-f]{64}$/u
const UuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
const MemberIdPattern = /^[0-9]+$/u

export interface VerifiedAccountDatabaseMergeStage {
  readonly directory: string
  readonly databaseDirectory: string
  readonly bundleId: string
  readonly account: {
    readonly serverId: number
    readonly memberId: string
  }
  readonly planSetSha256: string
  readonly databaseFiles: readonly RestoreStageDatabaseFile[]
  readonly previews: readonly AccountBackupDatabasePreview[]
}

export type CreateMergeStageDatabases = (
  source: VerifiedAccountBackup,
  databaseDirectory: string,
  files: readonly DatabaseBackupPreviewFile[],
  previews: readonly AccountBackupDatabasePreview[]
) => Promise<readonly RestoreStageDatabaseFile[]>

export type ValidateMergeStageDatabases = (
  databaseDirectory: string,
  files: readonly RestoreStageDatabaseFile[]
) => Promise<void>

export interface CreateAccountDatabaseMergeStageOptions {
  readonly verified: VerifiedAccountBackup
  readonly appDataRoot: string
  readonly expectedAccount: {
    readonly serverId: number
    readonly memberId: string
  }
  readonly previews: readonly AccountBackupDatabasePreview[]
  readonly createDatabases: CreateMergeStageDatabases
  readonly validateDatabases: ValidateMergeStageDatabases
}

export interface VerifyAccountDatabaseMergeStageOptions {
  readonly directory: string
  readonly appDataRoot: string
  readonly expectedAccount: {
    readonly serverId: number
    readonly memberId: string
  }
  readonly validateDatabases: ValidateMergeStageDatabases
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

function isSafeCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
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

function validatedConflictReasons(
  dbName: DbName,
  conflictCount: number,
  value: unknown
): AccountBackupMergeConflictSummary[] {
  if (!Array.isArray(value)) {
    throw new Error(`invalid database merge conflict reasons: ${dbName}`)
  }
  const seen = new Set<string>()
  let previousOrder = -1
  const reasons = value.map((rawReason) => {
    if (!isPlainObject(rawReason)) {
      throw new Error(`invalid database merge conflict reasons: ${dbName}`)
    }
    requireExactKeys(
      rawReason,
      ['group', 'records'],
      `database merge conflict reason: ${dbName}`
    )
    const group = rawReason.group
    const records = rawReason.records
    if (typeof records !== 'number') {
      throw new Error(`invalid database merge conflict reasons: ${dbName}`)
    }
    if (!isAccountRecordMergeConflictGroup(dbName, group)) {
      throw new Error(`invalid database merge conflict reasons: ${dbName}`)
    }
    const order = AccountRecordMergeConflictGroupOrder.indexOf(group)
    if (
      !isSafeCount(records) ||
      records === 0 ||
      records > conflictCount ||
      seen.has(group) ||
      order <= previousOrder
    ) {
      throw new Error(`invalid database merge conflict reasons: ${dbName}`)
    }
    seen.add(group)
    previousOrder = order
    return { group, records }
  })
  if (
    (conflictCount === 0 && reasons.length !== 0) ||
    (conflictCount > 0 && reasons.length === 0)
  ) {
    throw new Error(`invalid database merge conflict reasons: ${dbName}`)
  }
  return reasons
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  )
}

function databaseSourceFiles(
  verified: VerifiedAccountBackup
): DatabaseBackupPreviewFile[] {
  return Object.values(DbName).map((dbName) => {
    const relativePath = `data/${dbName}.db`
    const file = verified.manifest.files.find(
      (candidate) => candidate.path === relativePath
    )
    if (
      !file ||
      file.category !== 'database' ||
      file.recordCount === null
    ) {
      throw new Error(`merge source is missing database: ${dbName}`)
    }
    return {
      dbName,
      path: relativePath,
      size: file.size,
      sha256: file.sha256,
      recordCount: file.recordCount
    }
  })
}

function validatePreviewSet(
  previews: readonly AccountBackupDatabasePreview[],
  files?: readonly DatabaseBackupPreviewFile[]
): AccountBackupDatabasePreview[] {
  const filesByName = files
    ? new Map(files.map((file) => [file.dbName, file]))
    : null
  const byName = new Map<DbName, AccountBackupDatabasePreview>()
  for (const preview of previews) {
    if (byName.has(preview.dbName)) {
      throw new Error(`duplicate database merge plan: ${preview.dbName}`)
    }
    const source = filesByName?.get(preview.dbName)
    const plan = preview.mergePlan
    const expectedMode = preview.dbName === DbName.quest
      ? 'quest-monotonic-v1'
      : 'append-only-v1'
    const previewCounts = [
      preview.incomingRecords,
      preview.add,
      preview.duplicate,
      preview.legacyDuplicate,
      preview.conflict,
      preview.currentOnly
    ]
    const planCounts = [
      plan.safeAdd,
      plan.skip,
      plan.conflict,
      plan.manualReview,
      plan.currentOnly
    ]
    let conflictReasonsValid = true
    try {
      validatedConflictReasons(
        preview.dbName,
        plan.conflict,
        plan.conflictReasons
      )
    } catch {
      conflictReasonsValid = false
    }
    if (
      (filesByName !== null && !source) ||
      plan.schemaVersion !== 1 ||
      plan.comparisonPolicyVersion !== 1 ||
      plan.conflictPolicyVersion !==
        AccountRecordMergeConflictPolicyVersion ||
      plan.conflictResolution !==
        AccountRecordMergeConflictResolution ||
      plan.mode !== expectedMode ||
      (source !== undefined && plan.sourceSha256 !== source.sha256) ||
      !Sha256Pattern.test(plan.sourceSha256) ||
      !Sha256Pattern.test(plan.currentStateSha256) ||
      !Sha256Pattern.test(plan.incomingStateSha256) ||
      !Sha256Pattern.test(plan.decisionSha256) ||
      previewCounts.some((count) => !isSafeCount(count)) ||
      planCounts.some((count) => !isSafeCount(count)) ||
      !conflictReasonsValid ||
      (
        preview.add +
        preview.duplicate +
        preview.legacyDuplicate +
        preview.conflict
      ) !== preview.incomingRecords ||
      (
        plan.safeAdd +
        plan.skip +
        plan.conflict +
        plan.manualReview
      ) !== preview.incomingRecords
      || plan.currentOnly !== preview.currentOnly
    ) {
      throw new Error(`invalid database merge plan: ${preview.dbName}`)
    }
    byName.set(preview.dbName, preview)
  }
  if (
    byName.size !== Object.values(DbName).length ||
    (filesByName !== null && filesByName.size !== byName.size)
  ) {
    throw new Error('database merge plan set is incomplete')
  }
  return Object.values(DbName).map((dbName) => byName.get(dbName)!)
}

function parsePreviewSet(value: unknown): AccountBackupDatabasePreview[] {
  if (!Array.isArray(value)) {
    throw new Error('database merge stage previews must be an array')
  }
  const previews = value.map((rawPreview, index) => {
    if (!isPlainObject(rawPreview)) {
      throw new Error(`database merge stage preview ${index} is invalid`)
    }
    requireExactKeys(
      rawPreview,
      [
        'dbName',
        'incomingRecords',
        'add',
        'duplicate',
        'legacyDuplicate',
        'conflict',
        'currentOnly',
        'mergePlan'
      ],
      `database merge stage preview ${index}`
    )
    if (
      typeof rawPreview.dbName !== 'string' ||
      !Object.values(DbName).includes(rawPreview.dbName as DbName) ||
      !isPlainObject(rawPreview.mergePlan)
    ) {
      throw new Error(`database merge stage preview ${index} is invalid`)
    }
    requireExactKeys(
      rawPreview.mergePlan,
      [
        'schemaVersion',
        'comparisonPolicyVersion',
        'conflictPolicyVersion',
        'conflictResolution',
        'mode',
        'sourceSha256',
        'currentStateSha256',
        'incomingStateSha256',
        'decisionSha256',
        'safeAdd',
        'skip',
        'conflict',
        'conflictReasons',
        'manualReview',
        'currentOnly'
      ],
      `database merge stage plan ${index}`
    )
    return {
      dbName: rawPreview.dbName as DbName,
      incomingRecords: rawPreview.incomingRecords as number,
      add: rawPreview.add as number,
      duplicate: rawPreview.duplicate as number,
      legacyDuplicate: rawPreview.legacyDuplicate as number,
      conflict: rawPreview.conflict as number,
      currentOnly: rawPreview.currentOnly as number,
      mergePlan: {
        schemaVersion: rawPreview.mergePlan.schemaVersion as 1,
        comparisonPolicyVersion:
          rawPreview.mergePlan.comparisonPolicyVersion as 1,
        conflictPolicyVersion:
          rawPreview.mergePlan.conflictPolicyVersion as 1,
        conflictResolution:
          rawPreview.mergePlan.conflictResolution as
            'preserve-current-v1',
        mode: rawPreview.mergePlan.mode as
          AccountBackupDatabasePreview['mergePlan']['mode'],
        sourceSha256: rawPreview.mergePlan.sourceSha256 as string,
        currentStateSha256:
          rawPreview.mergePlan.currentStateSha256 as string,
        incomingStateSha256:
          rawPreview.mergePlan.incomingStateSha256 as string,
        decisionSha256: rawPreview.mergePlan.decisionSha256 as string,
        safeAdd: rawPreview.mergePlan.safeAdd as number,
        skip: rawPreview.mergePlan.skip as number,
        conflict: rawPreview.mergePlan.conflict as number,
        conflictReasons: validatedConflictReasons(
          rawPreview.dbName as DbName,
          rawPreview.mergePlan.conflict as number,
          rawPreview.mergePlan.conflictReasons
        ),
        manualReview: rawPreview.mergePlan.manualReview as number,
        currentOnly: rawPreview.mergePlan.currentOnly as number
      }
    }
  })
  return validatePreviewSet(previews)
}

function planSetSha256(
  previews: readonly AccountBackupDatabasePreview[]
): string {
  const canonicalPreviews = [...previews]
    .sort((left, right) => left.dbName.localeCompare(right.dbName))
    .map((preview) => ({
      dbName: preview.dbName,
      incomingRecords: preview.incomingRecords,
      add: preview.add,
      duplicate: preview.duplicate,
      legacyDuplicate: preview.legacyDuplicate,
      conflict: preview.conflict,
      currentOnly: preview.currentOnly,
      mergePlan: {
        schemaVersion: preview.mergePlan.schemaVersion,
        comparisonPolicyVersion:
          preview.mergePlan.comparisonPolicyVersion,
        conflictPolicyVersion:
          preview.mergePlan.conflictPolicyVersion,
        conflictResolution:
          preview.mergePlan.conflictResolution,
        mode: preview.mergePlan.mode,
        sourceSha256: preview.mergePlan.sourceSha256,
        currentStateSha256: preview.mergePlan.currentStateSha256,
        incomingStateSha256: preview.mergePlan.incomingStateSha256,
        decisionSha256: preview.mergePlan.decisionSha256,
        safeAdd: preview.mergePlan.safeAdd,
        skip: preview.mergePlan.skip,
        conflict: preview.mergePlan.conflict,
        conflictReasons: preview.mergePlan.conflictReasons,
        manualReview: preview.mergePlan.manualReview,
        currentOnly: preview.mergePlan.currentOnly
      }
    }))
  return createHash('sha256')
    .update(JSON.stringify({
      schemaVersion: 1,
      previews: canonicalPreviews
    }))
    .digest('hex')
}

function validateStagedFiles(
  files: readonly RestoreStageDatabaseFile[]
): RestoreStageDatabaseFile[] {
  const byName = new Map<DbName, RestoreStageDatabaseFile>()
  for (const file of files) {
    if (
      byName.has(file.dbName) ||
      file.filename !== `${file.dbName}.db` ||
      !Number.isSafeInteger(file.recordCount) ||
      file.recordCount < 0 ||
      !Sha256Pattern.test(file.sha256) ||
      !Number.isSafeInteger(file.size) ||
      file.size < 0
    ) {
      throw new Error(`invalid staged merge database: ${file.dbName}`)
    }
    byName.set(file.dbName, file)
  }
  if (byName.size !== Object.values(DbName).length) {
    throw new Error('staged merge database set is incomplete')
  }
  return Object.values(DbName).map((dbName) => byName.get(dbName)!)
}

function parseStagedFiles(value: unknown): RestoreStageDatabaseFile[] {
  if (!Array.isArray(value)) {
    throw new Error('database merge stage files must be an array')
  }
  const files = value.map((rawFile, index) => {
    if (!isPlainObject(rawFile)) {
      throw new Error(`database merge stage file ${index} is invalid`)
    }
    requireExactKeys(
      rawFile,
      ['dbName', 'filename', 'size', 'sha256', 'recordCount'],
      `database merge stage file ${index}`
    )
    if (
      typeof rawFile.dbName !== 'string' ||
      !Object.values(DbName).includes(rawFile.dbName as DbName)
    ) {
      throw new Error(`database merge stage file ${index} is invalid`)
    }
    return {
      dbName: rawFile.dbName as DbName,
      filename: rawFile.filename as string,
      size: rawFile.size as number,
      sha256: rawFile.sha256 as string,
      recordCount: rawFile.recordCount as number
    }
  })
  return validateStagedFiles(files)
}

async function validateDatabaseDirectoryEntries(
  directory: string,
  files: readonly RestoreStageDatabaseFile[]
): Promise<void> {
  const expected = new Set(files.map((file) => file.filename))
  const entries = await fs.promises.readdir(directory, {
    withFileTypes: true
  })
  if (
    entries.length !== expected.size ||
    entries.some((entry) =>
      !entry.isFile() || !expected.has(entry.name)
    )
  ) {
    throw new Error('staged merge database file set is invalid')
  }
}

async function createMergeStagingRoot(
  appDataRoot: string
): Promise<string> {
  const realAppDataRoot = await requireRealDirectory(
    appDataRoot,
    'application data root'
  )
  const root = path.join(realAppDataRoot, MergeStagingDirectory)
  await fs.promises.mkdir(root, { recursive: false, mode: 0o700 })
    .catch((error: unknown) => {
      if (
        !(error instanceof Error) ||
        !('code' in error) ||
        error.code !== 'EEXIST'
      ) {
        throw error
      }
    })
  const realRoot = await requireRealDirectory(root, 'merge staging root')
  if (!isWithinPath(realRoot, realAppDataRoot)) {
    throw new Error('merge staging root is outside application data')
  }
  return realRoot
}

export async function verifyAccountDatabaseMergeStage(
  options: VerifyAccountDatabaseMergeStageOptions
): Promise<VerifiedAccountDatabaseMergeStage> {
  const realAppDataRoot = await requireRealDirectory(
    options.appDataRoot,
    'application data root'
  )
  const stagingRoot = await requireRealDirectory(
    path.join(realAppDataRoot, MergeStagingDirectory),
    'merge staging root'
  )
  if (!isWithinPath(stagingRoot, realAppDataRoot)) {
    throw new Error('merge staging root is outside application data')
  }
  const realDirectory = await requireRealDirectory(
    options.directory,
    'database merge stage'
  )
  if (
    !isWithinPath(realDirectory, stagingRoot) ||
    !samePath(path.dirname(realDirectory), stagingRoot)
  ) {
    throw new Error('database merge stage is outside the staging root')
  }

  const topEntries = await fs.promises.readdir(realDirectory, {
    withFileTypes: true
  })
  if (
    topEntries.length !== 2 ||
    !topEntries.some((entry) =>
      entry.isDirectory() &&
      entry.name === MergeStageDatabaseDirectory
    ) ||
    !topEntries.some((entry) =>
      entry.isFile() &&
      entry.name === MergeStageMetadataFilename
    )
  ) {
    throw new Error('database merge stage file set is invalid')
  }

  const metadataPath = path.join(
    realDirectory,
    MergeStageMetadataFilename
  )
  const metadataStats = await fs.promises.lstat(metadataPath)
  if (
    metadataStats.isSymbolicLink() ||
    !metadataStats.isFile() ||
    metadataStats.size > MaxMergeStageMetadataBytes
  ) {
    throw new Error('database merge stage metadata is invalid')
  }
  let rawMetadata: unknown
  try {
    rawMetadata = JSON.parse(
      await fs.promises.readFile(metadataPath, 'utf8')
    )
  } catch {
    throw new Error('database merge stage metadata is not valid JSON')
  }
  if (!isPlainObject(rawMetadata)) {
    throw new Error('database merge stage metadata must be an object')
  }
  requireExactKeys(
    rawMetadata,
    [
      'schemaVersion',
      'stagedAt',
      'bundleId',
      'account',
      'planSetSha256',
      'previews',
      'databaseFiles'
    ],
    'database merge stage metadata'
  )
  if (
    rawMetadata.schemaVersion !== 1 ||
    !isIsoTimestamp(rawMetadata.stagedAt) ||
    typeof rawMetadata.bundleId !== 'string' ||
    !UuidPattern.test(rawMetadata.bundleId) ||
    typeof rawMetadata.planSetSha256 !== 'string' ||
    !Sha256Pattern.test(rawMetadata.planSetSha256) ||
    !isPlainObject(rawMetadata.account)
  ) {
    throw new Error('database merge stage metadata state is invalid')
  }
  requireExactKeys(
    rawMetadata.account,
    ['serverId', 'memberId'],
    'database merge stage account'
  )
  if (
    !Number.isSafeInteger(rawMetadata.account.serverId) ||
    (rawMetadata.account.serverId as number) <= 0 ||
    typeof rawMetadata.account.memberId !== 'string' ||
    !MemberIdPattern.test(rawMetadata.account.memberId)
  ) {
    throw new Error('database merge stage account is invalid')
  }
  const account = {
    serverId: rawMetadata.account.serverId as number,
    memberId: rawMetadata.account.memberId
  }
  if (
    account.serverId !== options.expectedAccount.serverId ||
    account.memberId !== options.expectedAccount.memberId
  ) {
    throw new Error('merge stage account does not match the current account')
  }

  const previews = parsePreviewSet(rawMetadata.previews)
  const actualPlanSetSha256 = planSetSha256(previews)
  if (
    rawMetadata.planSetSha256 !== actualPlanSetSha256 ||
    path.basename(realDirectory) !==
      `${rawMetadata.bundleId}-${actualPlanSetSha256}`
  ) {
    throw new Error('database merge stage identity is invalid')
  }
  const databaseFiles = parseStagedFiles(rawMetadata.databaseFiles)
  const databaseDirectory = await requireRealDirectory(
    path.join(realDirectory, MergeStageDatabaseDirectory),
    'database merge stage payload'
  )
  if (
    !isWithinPath(databaseDirectory, realDirectory) ||
    !samePath(path.dirname(databaseDirectory), realDirectory)
  ) {
    throw new Error('database merge stage payload is outside its stage')
  }
  await validateDatabaseDirectoryEntries(
    databaseDirectory,
    databaseFiles
  )
  for (const file of databaseFiles) {
    const descriptor: AccountBackupFile = {
      path: `data/${file.filename}`,
      category: 'database',
      size: file.size,
      sha256: file.sha256,
      recordCount: file.recordCount,
      oldestRecordAt: null,
      newestRecordAt: null
    }
    await verifyAccountBackupPayloadFile(
      path.join(databaseDirectory, file.filename),
      descriptor
    )
  }
  await options.validateDatabases(databaseDirectory, databaseFiles)

  return {
    directory: realDirectory,
    databaseDirectory,
    bundleId: rawMetadata.bundleId,
    account,
    planSetSha256: actualPlanSetSha256,
    databaseFiles,
    previews
  }
}

export async function createAccountDatabaseMergeStage(
  options: CreateAccountDatabaseMergeStageOptions
): Promise<VerifiedAccountDatabaseMergeStage> {
  const source = await verifyLocalAccountBackup(options.verified.directory)
  if (
    source.manifest.account.serverId !== options.expectedAccount.serverId ||
    source.manifest.account.memberId !== options.expectedAccount.memberId
  ) {
    throw new Error('merge stage account does not match the current account')
  }
  const files = databaseSourceFiles(source)
  const previews = validatePreviewSet(options.previews, files)
  const planSha256 = planSetSha256(previews)
  const stagingRoot = await createMergeStagingRoot(options.appDataRoot)
  const stageName = `${source.manifest.bundleId}-${planSha256}`
  const finalDirectory = path.join(stagingRoot, stageName)
  const partialDirectory = `${finalDirectory}.partial`
  const databaseDirectory = path.join(
    partialDirectory,
    MergeStageDatabaseDirectory
  )
  let partialCreated = false
  let renamed = false
  let finalized = false

  try {
    await fs.promises.mkdir(partialDirectory, { mode: 0o700 })
    partialCreated = true
    await fs.promises.mkdir(databaseDirectory, { mode: 0o700 })
    const stagedFiles = validateStagedFiles(
      await options.createDatabases(
        source,
        databaseDirectory,
        files,
        previews
      )
    )
    await validateDatabaseDirectoryEntries(databaseDirectory, stagedFiles)
    await options.validateDatabases(databaseDirectory, stagedFiles)

    const metadata = {
      schemaVersion: 1,
      stagedAt: new Date().toISOString(),
      bundleId: source.manifest.bundleId,
      account: source.manifest.account,
      planSetSha256: planSha256,
      previews,
      databaseFiles: stagedFiles
    }
    await fs.promises.writeFile(
      path.join(partialDirectory, MergeStageMetadataFilename),
      `${JSON.stringify(metadata, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx', mode: 0o600 }
    )

    await fs.promises.rename(partialDirectory, finalDirectory)
    renamed = true
    const result = await verifyAccountDatabaseMergeStage({
      directory: finalDirectory,
      appDataRoot: options.appDataRoot,
      expectedAccount: options.expectedAccount,
      validateDatabases: options.validateDatabases
    })
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

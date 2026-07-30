import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { withAccountFileWriteBarrier } from '@main/account-file-writes'
import {
  createVerifiedLocalAccountBackup,
  type VerifiedAccountBackup
} from '@main/account-backup'
import { loadOrCreateBackupSourceDeviceId } from '@main/backup-source-device'
import { getUserDataDir, PathStuff } from '@main/path'
import { svdata } from '@main/svdata'
import {
  getWorkerDriver,
  getWorkerDriverQuest,
  withDatabaseReadBarrier,
  withDatabaseSnapshotBarrier
} from '@main/stuff/wrokers'
import { DbName } from '@common/record'
import type { AccountBackupDatabasePreview } from '@common/account-backup'
import type {
  LocalAccountAuditCaptureResult,
  LocalAccountAuditComparisonResult
} from '@common/account-backup'
import type { DatabaseBackupPreviewFile } from '@main/worker/msg'
import {
  createVerifiedAccountRestoreStage,
  type RestoreStageDatabaseFile,
  type VerifiedAccountRestoreStage
} from '@main/account-backup-staging'
import {
  createAccountDatabaseMergeStage,
  verifyAccountDatabaseMergeStage,
  type VerifiedAccountDatabaseMergeStage
} from '@main/account-merge-staging'
import {
  applyPendingAccountMerge,
  applyPendingAccountMergeRedo,
  applyPendingAccountMergeRollback,
  enforceAccountMergeRetention,
  findLatestAccountMergeRedo,
  findLatestAccountMergeRollback,
  scheduleAccountMergeRedo,
  scheduleAccountMergeRollback,
  scheduleAccountMerge,
  type ApplyPendingAccountMergeRedoResult,
  type ApplyPendingAccountMergeResult,
  type ApplyPendingAccountMergeRollbackResult,
  type AccountMergeRetentionReport,
  type AvailableAccountMergeRedo,
  type AvailableAccountMergeRollback
} from '@main/account-merge-transaction'
import {
  applyPendingAccountRedo,
  applyPendingAccountRollback,
  applyPendingAccountRestore,
  enforceAccountRestoreRetention,
  findLatestAccountRedo,
  findLatestAccountRollback,
  scheduleAccountRedo,
  scheduleAccountRollback,
  scheduleAccountRestore,
  type ApplyPendingAccountRedoResult,
  type ApplyPendingAccountRollbackResult,
  type ApplyPendingAccountRestoreResult,
  type AccountRestoreRetentionReport,
  type AvailableAccountRedo,
  type AvailableAccountRollback
} from '@main/account-restore-transaction'
import {
  compareAccountAuditSnapshots,
  createAccountAuditFingerprint,
  createAccountAuditSnapshot,
  loadAccountAuditBaseline,
  saveAccountAuditBaseline,
  toLocalAccountAuditSummary,
  type AccountAuditSnapshot
} from '@main/account-restore-audit'
import {
  createEncryptedAccountTransfer,
  decryptAccountTransferToDirectory,
  type EncryptedAccountTransferResult
} from '@main/account-transfer'

export interface CreateCurrentAccountBackupOptions {
  readonly destinationRoot: string
  readonly appVersion: string
  readonly includeAppProfile?: boolean
  readonly createdAt?: Date
  readonly bundleId?: string
}

/**
 * Create one self-verified local bundle while both NeDB mutations and the
 * account JSON writers are held at stable boundaries.
 */
export async function createCurrentAccountBackup(
  options: CreateCurrentAccountBackupOptions
): Promise<VerifiedAccountBackup> {
  const appDataRoot = getUserDataDir()
  const sourceDeviceId = await loadOrCreateBackupSourceDeviceId(appDataRoot)
  return withAccountFileWriteBarrier(async () =>
    withDatabaseSnapshotBarrier(async ({ databases }) =>
      createVerifiedLocalAccountBackup({
        sourceDirectory: PathStuff.storeUser,
        destinationRoot: options.destinationRoot,
        appDataRoot,
        appVersion: options.appVersion,
        sourceDeviceId,
        account: {
          serverId: svdata.serverId,
          memberId: String(svdata.basic.api_member_id)
        },
        databases,
        includeAppProfile: options.includeAppProfile,
        createdAt: options.createdAt,
        bundleId: options.bundleId
      })
    )
  )
}

export interface CreateCurrentAccountTransferOptions {
  readonly outputPath: string
  readonly passphrase: string
  readonly appVersion: string
  readonly createdAt?: Date
  readonly bundleId?: string
}

/**
 * Snapshot the current account into a private temporary local bundle, wrap it
 * in the authenticated encrypted transfer format, and remove the plaintext
 * temporary copy before returning.
 */
export async function createCurrentAccountTransfer(
  options: CreateCurrentAccountTransferOptions
): Promise<EncryptedAccountTransferResult> {
  const temporaryRoot = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'koubrowser-transfer-export-')
  )
  await fs.promises.chmod(temporaryRoot, 0o700)
  try {
    const backup = await createCurrentAccountBackup({
      destinationRoot: temporaryRoot,
      appVersion: options.appVersion,
      createdAt: options.createdAt,
      bundleId: options.bundleId
    })
    return await createEncryptedAccountTransfer(
      backup.directory,
      options.outputPath,
      options.passphrase
    )
  } finally {
    await fs.promises.rm(temporaryRoot, {
      recursive: true,
      force: true
    })
  }
}

const AccountTransferImportPrefix = 'koubrowser-transfer-import-'

export interface DecryptedAccountTransferCandidate {
  readonly temporaryRoot: string
  readonly verified: VerifiedAccountBackup
}

export async function decryptAccountTransferCandidate(
  filePath: string,
  passphrase: string
): Promise<DecryptedAccountTransferCandidate> {
  const temporaryRoot = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), AccountTransferImportPrefix)
  )
  await fs.promises.chmod(temporaryRoot, 0o700)
  try {
    const verified = await decryptAccountTransferToDirectory(
      filePath,
      passphrase,
      temporaryRoot
    )
    return { temporaryRoot, verified }
  } catch (error) {
    await fs.promises.rm(temporaryRoot, {
      recursive: true,
      force: true
    })
    throw error
  }
}

export async function cleanupAccountTransferCandidate(
  temporaryRoot: string
): Promise<void> {
  const resolved = path.resolve(temporaryRoot)
  const temporaryDirectory = path.resolve(os.tmpdir())
  if (
    path.dirname(resolved) !== temporaryDirectory ||
    !path.basename(resolved).startsWith(AccountTransferImportPrefix)
  ) {
    throw new Error('Refusing to remove an invalid account transfer cache')
  }
  await fs.promises.rm(resolved, {
    recursive: true,
    force: true
  })
}

export async function previewVerifiedAccountBackupAgainstCurrent(
  verified: VerifiedAccountBackup
): Promise<AccountBackupDatabasePreview[]> {
  const files = databaseBackupPreviewFiles(verified)

  return withDatabaseSnapshotBarrier(async () => {
    const previews = (
      await Promise.all([
        getWorkerDriver().previewDatabaseBackup(verified.directory, files),
        getWorkerDriverQuest().previewDatabaseBackup(
          verified.directory,
          files
        )
      ])
    ).flat()
    const byName = new Map(
      previews.map((preview) => [preview.dbName, preview])
    )
    if (
      byName.size !== Object.values(DbName).length ||
      previews.length !== byName.size
    ) {
      throw new Error('Database backup preview is incomplete or duplicated')
    }
    return [...byName.values()].sort((left, right) =>
      left.dbName.localeCompare(right.dbName)
    )
  })
}

function databaseBackupPreviewFiles(
  verified: VerifiedAccountBackup
): DatabaseBackupPreviewFile[] {
  return Object.values(DbName).map(
    (dbName) => {
      const relativePath = `data/${dbName}.db`
      const file = verified.manifest.files.find(
        (candidate) => candidate.path === relativePath
      )
      if (
        !file ||
        file.category !== 'database' ||
        file.recordCount === null
      ) {
        throw new Error(`Verified backup is missing database: ${dbName}`)
      }
      return {
        dbName,
        path: relativePath,
        size: file.size,
        sha256: file.sha256,
        recordCount: file.recordCount
      }
    }
  )
}

export async function stageVerifiedAccountBackupMerge(
  verified: VerifiedAccountBackup,
  previews: readonly AccountBackupDatabasePreview[]
): Promise<VerifiedAccountDatabaseMergeStage> {
  return createAccountDatabaseMergeStage({
    verified,
    appDataRoot: getUserDataDir(),
    expectedAccount: {
      serverId: svdata.serverId,
      memberId: String(svdata.basic.api_member_id)
    },
    previews,
    createDatabases: async (
      source,
      databaseDirectory,
      files,
      expectedPreviews
    ) =>
      withDatabaseSnapshotBarrier(async () => {
        const staged = (
          await Promise.all([
            getWorkerDriver().createDatabaseMergeStage(
              source.directory,
              databaseDirectory,
              [...files],
              [...expectedPreviews]
            ),
            getWorkerDriverQuest().createDatabaseMergeStage(
              source.directory,
              databaseDirectory,
              [...files],
              [...expectedPreviews]
            )
          ])
        ).flat()
        const names = new Set(staged.map((file) => file.dbName))
        if (
          names.size !== Object.values(DbName).length ||
          staged.length !== names.size
        ) {
          throw new Error('Database merge stage is incomplete or duplicated')
        }
        return staged.sort((left, right) =>
          left.dbName.localeCompare(right.dbName)
        )
      }),
    validateDatabases: validateAccountDirectoryDatabases
  })
}

export async function verifyCurrentAccountBackupMergeStage(
  directory: string
): Promise<VerifiedAccountDatabaseMergeStage> {
  return withVerifiedCurrentAccountBackupMergeStage(
    directory,
    async (stage) => stage
  )
}

export async function withVerifiedCurrentAccountBackupMergeStage<T>(
  directory: string,
  callback: (
    stage: VerifiedAccountDatabaseMergeStage
  ) => Promise<T>
): Promise<T> {
  return withDatabaseSnapshotBarrier(async () => {
    const stage = await verifyAccountDatabaseMergeStage({
      directory,
      appDataRoot: getUserDataDir(),
      expectedAccount: {
        serverId: svdata.serverId,
        memberId: String(svdata.basic.api_member_id)
      },
      validateDatabases: validateAccountDirectoryDatabases
    })
    await validateMergePlanCurrentState(stage.previews)
    return callback(stage)
  })
}

export async function prepareCurrentAccountBackupMerge(
  directory: string
): Promise<VerifiedAccountDatabaseMergeStage> {
  return withVerifiedCurrentAccountBackupMergeStage(
    directory,
    async (stage) => {
      await scheduleAccountMerge(
        stage,
        getUserDataDir(),
        currentAccountIdentity(),
        validateAccountDirectoryDatabases
      )
      return stage
    }
  )
}

async function validateMergePlanCurrentState(
  previews: readonly AccountBackupDatabasePreview[]
): Promise<void> {
  const audits = (
    await Promise.all([
      getWorkerDriver().auditLoadedDatabases(),
      getWorkerDriverQuest().auditLoadedDatabases()
    ])
  ).flat()
  const auditByName = new Map(
    audits.map((audit) => [audit.dbName, audit])
  )
  const previewByName = new Map(
    previews.map((preview) => [preview.dbName, preview])
  )
  if (
    audits.length !== auditByName.size ||
    previews.length !== previewByName.size ||
    auditByName.size !== Object.values(DbName).length ||
    previewByName.size !== Object.values(DbName).length
  ) {
    throw new Error(
      'Database merge current-state validation is incomplete or duplicated'
    )
  }
  for (const dbName of Object.values(DbName)) {
    const audit = auditByName.get(dbName)
    const preview = previewByName.get(dbName)
    if (!audit || !preview) {
      throw new Error(
        'Database merge current-state validation is incomplete or duplicated'
      )
    }
    if (
      audit.semanticSha256 !== preview.mergePlan.currentStateSha256
    ) {
      throw new Error(`Database merge plan expired: ${dbName}`)
    }
  }
}

export async function stageVerifiedAccountBackupForRestore(
  verified: VerifiedAccountBackup
): Promise<VerifiedAccountRestoreStage> {
  return createVerifiedAccountRestoreStage({
    verified,
    appDataRoot: getUserDataDir(),
    expectedAccount: {
      serverId: svdata.serverId,
      memberId: String(svdata.basic.api_member_id)
    },
    validateDatabases: validateAccountDirectoryDatabases
  })
}

async function validateAccountDirectoryDatabases(
  accountDirectory: string,
  files: readonly RestoreStageDatabaseFile[]
): Promise<void> {
  const mainFiles = files.filter(
    (file) => file.dbName !== DbName.quest
  )
  const questFiles = files.filter(
    (file) => file.dbName === DbName.quest
  )
  const validated = (
    await Promise.all([
      getWorkerDriver().validateRestoreStage(
        accountDirectory,
        mainFiles
      ),
      getWorkerDriverQuest().validateRestoreStage(
        accountDirectory,
        questFiles
      )
    ])
  ).flat()
  const names = new Set(validated)
  if (
    names.size !== Object.values(DbName).length ||
    validated.length !== names.size
  ) {
    throw new Error('Restore stage database validation is incomplete')
  }
}

async function inspectAccountDirectoryDatabases(
  accountDirectory: string
): Promise<RestoreStageDatabaseFile[]> {
  const mainNames = Object.values(DbName).filter(
    (dbName) => dbName !== DbName.quest
  )
  const inspected = (
    await Promise.all([
      getWorkerDriver().inspectAccountDirectory(
        accountDirectory,
        mainNames
      ),
      getWorkerDriverQuest().inspectAccountDirectory(
        accountDirectory,
        [DbName.quest]
      )
    ])
  ).flat()
  const names = new Set(inspected.map((file) => file.dbName))
  if (
    names.size !== Object.values(DbName).length ||
    inspected.length !== names.size
  ) {
    throw new Error('Account directory database inspection is incomplete')
  }
  return inspected.sort((left, right) =>
    left.dbName.localeCompare(right.dbName)
  )
}

async function auditAccountDirectoryDatabases(
  accountDirectory: string
) {
  const mainNames = Object.values(DbName).filter(
    (dbName) => dbName !== DbName.quest
  )
  const audits = (
    await Promise.all([
      getWorkerDriver().auditAccountDirectory(
        accountDirectory,
        mainNames
      ),
      getWorkerDriverQuest().auditAccountDirectory(
        accountDirectory,
        [DbName.quest]
      )
    ])
  ).flat()
  const names = new Set(audits.map((audit) => audit.dbName))
  if (
    names.size !== Object.values(DbName).length ||
    audits.length !== names.size
  ) {
    throw new Error('Account directory database audit is incomplete')
  }
  return audits.sort((left, right) =>
    left.dbName.localeCompare(right.dbName)
  )
}

export async function prepareVerifiedAccountBackupRestore(
  verified: VerifiedAccountBackup
): Promise<VerifiedAccountRestoreStage> {
  const stage = await stageVerifiedAccountBackupForRestore(verified)
  await scheduleAccountRestore(
    stage,
    getUserDataDir(),
    {
      serverId: svdata.serverId,
      memberId: String(svdata.basic.api_member_id)
    }
  )
  return stage
}

export async function applyPendingRestoreForCurrentAccount():
Promise<ApplyPendingAccountRestoreResult> {
  return applyPendingAccountRestore(
    getUserDataDir(),
    {
      serverId: svdata.serverId,
      memberId: String(svdata.basic.api_member_id)
    },
    validateAccountDirectoryDatabases,
    inspectAccountDirectoryDatabases
  )
}

export async function applyPendingMergeForCurrentAccount():
Promise<ApplyPendingAccountMergeResult> {
  return applyPendingAccountMerge(
    getUserDataDir(),
    currentAccountIdentity(),
    validateAccountDirectoryDatabases,
    auditAccountDirectoryDatabases,
    inspectAccountDirectoryDatabases
  )
}

export async function getAvailableMergeRollbackForCurrentAccount():
Promise<AvailableAccountMergeRollback | null> {
  return findLatestAccountMergeRollback(
    getUserDataDir(),
    currentAccountIdentity(),
    validateAccountDirectoryDatabases
  )
}

export async function prepareCurrentAccountMergeRollback(
  rollback: AvailableAccountMergeRollback
): Promise<void> {
  await scheduleAccountMergeRollback(
    rollback,
    getUserDataDir(),
    currentAccountIdentity(),
    validateAccountDirectoryDatabases
  )
}

export async function applyPendingMergeRollbackForCurrentAccount():
Promise<ApplyPendingAccountMergeRollbackResult> {
  return applyPendingAccountMergeRollback(
    getUserDataDir(),
    currentAccountIdentity(),
    validateAccountDirectoryDatabases,
    inspectAccountDirectoryDatabases
  )
}

export async function getAvailableMergeRedoForCurrentAccount():
Promise<AvailableAccountMergeRedo | null> {
  return findLatestAccountMergeRedo(
    getUserDataDir(),
    currentAccountIdentity(),
    validateAccountDirectoryDatabases
  )
}

export async function prepareCurrentAccountMergeRedo(
  redo: AvailableAccountMergeRedo
): Promise<void> {
  await scheduleAccountMergeRedo(
    redo,
    getUserDataDir(),
    currentAccountIdentity(),
    validateAccountDirectoryDatabases
  )
}

export async function applyPendingMergeRedoForCurrentAccount():
Promise<ApplyPendingAccountMergeRedoResult> {
  return applyPendingAccountMergeRedo(
    getUserDataDir(),
    currentAccountIdentity(),
    validateAccountDirectoryDatabases,
    inspectAccountDirectoryDatabases
  )
}

export async function enforceAccountMergeRetentionForCurrentAccount(
  protectedStageNames: readonly string[] = []
): Promise<AccountMergeRetentionReport> {
  return enforceAccountMergeRetention(
    getUserDataDir(),
    validateAccountDirectoryDatabases,
    { protectedStageNames }
  )
}

function currentAccountIdentity(): {
  readonly serverId: number
  readonly memberId: string
} {
  return {
    serverId: svdata.serverId,
    memberId: String(svdata.basic.api_member_id)
  }
}

export async function getAvailableRollbackForCurrentAccount():
Promise<AvailableAccountRollback | null> {
  return findLatestAccountRollback(
    getUserDataDir(),
    currentAccountIdentity()
  )
}

export async function prepareCurrentAccountRollback(
  rollback: AvailableAccountRollback
): Promise<void> {
  await scheduleAccountRollback(
    rollback,
    getUserDataDir(),
    currentAccountIdentity()
  )
}

export async function applyPendingRollbackForCurrentAccount():
Promise<ApplyPendingAccountRollbackResult> {
  return applyPendingAccountRollback(
    getUserDataDir(),
    currentAccountIdentity(),
    validateAccountDirectoryDatabases
  )
}

export async function getAvailableRedoForCurrentAccount():
Promise<AvailableAccountRedo | null> {
  return findLatestAccountRedo(
    getUserDataDir(),
    currentAccountIdentity(),
    validateAccountDirectoryDatabases
  )
}

export async function prepareCurrentAccountRedo(
  redo: AvailableAccountRedo
): Promise<void> {
  await scheduleAccountRedo(
    redo,
    getUserDataDir(),
    currentAccountIdentity(),
    validateAccountDirectoryDatabases
  )
}

export async function applyPendingRedoForCurrentAccount():
Promise<ApplyPendingAccountRedoResult> {
  return applyPendingAccountRedo(
    getUserDataDir(),
    currentAccountIdentity(),
    validateAccountDirectoryDatabases,
    inspectAccountDirectoryDatabases
  )
}

export async function enforceAccountRestoreRetentionForCurrentAccount(
  protectedBundleIds: readonly string[] = []
): Promise<AccountRestoreRetentionReport> {
  return enforceAccountRestoreRetention(getUserDataDir(), {
    protectedBundleIds
  })
}

async function createCurrentAccountAuditSnapshot():
Promise<AccountAuditSnapshot> {
  return withAccountFileWriteBarrier(async () =>
    withDatabaseReadBarrier(async () => {
      const databases = (
        await Promise.all([
          getWorkerDriver().auditLoadedDatabases(),
          getWorkerDriverQuest().auditLoadedDatabases()
        ])
      ).flat()
      return createAccountAuditSnapshot(
        PathStuff.storeUser,
        currentAccountIdentity(),
        databases
      )
    })
  )
}

export async function captureCurrentAccountAuditBaseline():
Promise<LocalAccountAuditCaptureResult> {
  const snapshot = await createCurrentAccountAuditSnapshot()
  await saveAccountAuditBaseline(getUserDataDir(), snapshot)
  return {
    status: 'captured',
    summary: toLocalAccountAuditSummary(snapshot)
  }
}

export async function compareCurrentAccountAuditBaseline():
Promise<LocalAccountAuditComparisonResult> {
  const baseline = await loadAccountAuditBaseline(getUserDataDir())
  if (!baseline) {
    return { status: 'none' }
  }
  const account = currentAccountIdentity()
  if (
    baseline.accountFingerprint !== createAccountAuditFingerprint(account)
  ) {
    return {
      status: 'different-account',
      capturedAt: baseline.capturedAt
    }
  }
  const current = await createCurrentAccountAuditSnapshot()
  return compareAccountAuditSnapshots(baseline, current)
}

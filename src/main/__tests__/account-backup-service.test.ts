import fs from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  events: [] as string[],
  createOptions: null as Record<string, unknown> | null,
  transferOptions: null as Record<string, unknown> | null,
  transferDecryptOptions: null as Record<string, unknown> | null,
  previewFiles: null as Array<Record<string, unknown>> | null,
  stageOptions: null as Record<string, unknown> | null,
  mergeOptions: null as Record<string, unknown> | null,
  mergeVerifyOptions: null as Record<string, unknown> | null,
  mergeTransactionOptions: null as Record<string, unknown> | null,
  expiredMergeAuditDb: null as string | null,
  mergeAuditShape: 'normal' as 'normal' | 'missing' | 'duplicate',
  scheduleOptions: null as Record<string, unknown> | null,
  rollbackOptions: null as Record<string, unknown> | null,
  redoOptions: null as Record<string, unknown> | null,
  retentionOptions: null as Record<string, unknown> | null,
  auditBaseline: null as Record<string, unknown> | null
}))

vi.mock('@main/account-file-writes', () => ({
  withAccountFileWriteBarrier: async <T>(
    callback: () => Promise<T>
  ): Promise<T> => {
    state.events.push('json:start')
    try {
      return await callback()
    } finally {
      state.events.push('json:end')
    }
  }
}))

vi.mock('@main/stuff/wrokers', () => ({
  withDatabaseReadBarrier: async <T>(
    callback: () => Promise<T>
  ): Promise<T> => {
    state.events.push('database-read:start')
    try {
      return await callback()
    } finally {
      state.events.push('database-read:end')
    }
  },
  withDatabaseSnapshotBarrier: async <T>(
    callback: (context: { databases: unknown[] }) => Promise<T>
  ): Promise<T> => {
    state.events.push('database:start')
    try {
      return await callback({ databases: [{ dbName: 'port' }] })
    } finally {
      state.events.push('database:end')
    }
  },
  getWorkerDriver: () => ({
    auditLoadedDatabases: async () => {
      state.events.push('audit:main')
      const audits = Object.values(DbName)
        .filter((dbName) => dbName !== DbName.quest)
        .map((dbName) => ({
          dbName,
          recordCount: 1,
          oldestRecordAt: null,
          newestRecordAt: null,
          semanticSha256: state.expiredMergeAuditDb === dbName
            ? 'f'.repeat(64)
            : 'a'.repeat(64)
        }))
      if (state.mergeAuditShape === 'missing') {
        return audits.filter((audit) => audit.dbName !== DbName.drop)
      }
      if (state.mergeAuditShape === 'duplicate') {
        return [...audits, audits[0]]
      }
      return audits
    },
    previewDatabaseBackup: async (
      _directory: string,
      files: Array<Record<string, unknown>>
    ) => {
      state.events.push('preview:main')
      state.previewFiles = files
      return files.map((file) => ({
        dbName: file.dbName,
        incomingRecords: 1,
        add: 1,
        duplicate: 0,
        legacyDuplicate: 0,
        conflict: 0,
        currentOnly: 0,
        mergePlan: {
          schemaVersion: 1,
          comparisonPolicyVersion: 1,
          conflictPolicyVersion: 1,
          conflictResolution: 'preserve-current-v1',
          mode: file.dbName === DbName.quest
            ? 'quest-monotonic-v1'
            : 'append-only-v1',
          sourceSha256: 'a'.repeat(64),
          currentStateSha256: 'b'.repeat(64),
          incomingStateSha256: 'c'.repeat(64),
          decisionSha256: 'd'.repeat(64),
          safeAdd: file.dbName === DbName.quest ? 0 : 1,
          skip: 0,
          conflict: 0,
          conflictReasons: [],
          manualReview: file.dbName === DbName.quest ? 1 : 0,
          currentOnly: 0
        }
      }))
    },
    validateRestoreStage: async (
      _directory: string,
      files: Array<Record<string, unknown>>
    ) => {
      state.events.push('stage:main')
      return files.map((file) => file.dbName)
    },
    createDatabaseMergeStage: async (
      _sourceDirectory: string,
      _stageDirectory: string,
      files: Array<Record<string, unknown>>
    ) => {
      state.events.push('merge:main')
      return files
        .filter((file) => file.dbName !== DbName.quest)
        .map((file) => ({
          dbName: file.dbName,
          filename: `${file.dbName}.db`,
          size: 20,
          sha256: 'e'.repeat(64),
          recordCount: 2
        }))
    },
    inspectAccountDirectory: async (
      _directory: string,
      dbNames: string[]
    ) => {
      state.events.push('inspect:main')
      return dbNames.map((dbName) => ({
        dbName,
        filename: `${dbName}.db`,
        size: 10,
        sha256: 'a'.repeat(64),
        recordCount: 1
      }))
    },
    auditAccountDirectory: async (
      _directory: string,
      dbNames: string[]
    ) => {
      state.events.push('directory-audit:main')
      return dbNames.map((dbName) => ({
        dbName,
        recordCount: 1,
        oldestRecordAt: null,
        newestRecordAt: null,
        semanticSha256: 'a'.repeat(64)
      }))
    }
  }),
  getWorkerDriverQuest: () => ({
    auditLoadedDatabases: async () => {
      state.events.push('audit:quest')
      return [{
        dbName: DbName.quest,
        recordCount: 1,
        oldestRecordAt: null,
        newestRecordAt: null,
        semanticSha256: state.expiredMergeAuditDb === DbName.quest
          ? 'f'.repeat(64)
          : 'b'.repeat(64)
      }]
    },
    previewDatabaseBackup: async () => {
      state.events.push('preview:quest')
      return []
    },
    validateRestoreStage: async (
      _directory: string,
      files: Array<Record<string, unknown>>
    ) => {
      state.events.push('stage:quest')
      return files.map((file) => file.dbName)
    },
    createDatabaseMergeStage: async (
      _sourceDirectory: string,
      _stageDirectory: string,
      files: Array<Record<string, unknown>>
    ) => {
      state.events.push('merge:quest')
      return files
        .filter((file) => file.dbName === DbName.quest)
        .map((file) => ({
          dbName: file.dbName,
          filename: `${file.dbName}.db`,
          size: 20,
          sha256: 'f'.repeat(64),
          recordCount: 1
        }))
    },
    inspectAccountDirectory: async (
      _directory: string,
      dbNames: string[]
    ) => {
      state.events.push('inspect:quest')
      return dbNames.map((dbName) => ({
        dbName,
        filename: `${dbName}.db`,
        size: 10,
        sha256: 'a'.repeat(64),
        recordCount: 1
      }))
    },
    auditAccountDirectory: async (
      _directory: string,
      dbNames: string[]
    ) => {
      state.events.push('directory-audit:quest')
      return dbNames.map((dbName) => ({
        dbName,
        recordCount: 1,
        oldestRecordAt: null,
        newestRecordAt: null,
        semanticSha256: 'b'.repeat(64)
      }))
    }
  })
}))

vi.mock('@main/account-merge-transaction', () => ({
  scheduleAccountMerge: async (
    stage: Record<string, unknown>,
    appDataRoot: string,
    expectedAccount: Record<string, unknown>,
    validateDatabases: (
      directory: string,
      files: Array<Record<string, unknown>>
    ) => Promise<void>
  ) => {
    state.events.push('merge-transaction:schedule')
    state.mergeTransactionOptions = {
      stage,
      appDataRoot,
      expectedAccount
    }
    const files = Object.values(DbName).map((dbName) => ({
      dbName,
      filename: `${dbName}.db`,
      size: 10,
      sha256: 'a'.repeat(64),
      recordCount: 1
    }))
    await validateDatabases('merge-stage/databases', files)
  },
  applyPendingAccountMerge: async (
    appDataRoot: string,
    account: Record<string, unknown>,
    validateDatabases: (
      directory: string,
      files: Array<Record<string, unknown>>
    ) => Promise<void>,
    auditDatabases: (
      directory: string
    ) => Promise<Array<Record<string, unknown>>>,
    inspectDatabases: (
      directory: string
    ) => Promise<Array<Record<string, unknown>>>
  ) => {
    state.events.push('merge-transaction:apply')
    state.mergeTransactionOptions = { appDataRoot, account }
    const files = Object.values(DbName).map((dbName) => ({
      dbName,
      filename: `${dbName}.db`,
      size: 10,
      sha256: 'a'.repeat(64),
      recordCount: 1
    }))
    await validateDatabases('merge/current', files)
    await auditDatabases('merge/current')
    await inspectDatabases('merge/rollback')
    return {
      status: 'applied',
      bundleId: '11111111-1111-4111-8111-111111111111',
      rollbackDirectory: 'merge-rollback'
    }
  }
}))

vi.mock('@main/account-backup-staging', () => ({
  createVerifiedAccountRestoreStage: async (
    options: Record<string, unknown> & {
      validateDatabases: (
        directory: string,
        files: Array<Record<string, unknown>>
      ) => Promise<void>
    }
  ) => {
    state.events.push('stage:create')
    state.stageOptions = options
    const files = Object.values(DbName).map((dbName) => ({
      dbName,
      filename: `${dbName}.db`,
      size: 10,
      sha256: 'a'.repeat(64),
      recordCount: 1
    }))
    await options.validateDatabases('stage/account', files)
    return {
      directory: 'stage',
      accountDirectory: 'stage/account',
      bundleId: '11111111-1111-4111-8111-111111111111',
      account: { serverId: 8, memberId: '7654321' }
    }
  }
}))

vi.mock('@main/account-merge-staging', () => ({
  createAccountDatabaseMergeStage: async (
    options: Record<string, unknown> & {
      verified: VerifiedAccountBackup
      previews: AccountBackupDatabasePreview[]
      createDatabases: (
        source: VerifiedAccountBackup,
        directory: string,
        files: Array<Record<string, unknown>>,
        previews: AccountBackupDatabasePreview[]
      ) => Promise<Array<Record<string, unknown>>>
      validateDatabases: (
        directory: string,
        files: Array<Record<string, unknown>>
      ) => Promise<void>
    }
  ) => {
    state.events.push('merge-stage:create')
    state.mergeOptions = options
    const files = Object.values(DbName).map((dbName) => ({
      dbName,
      path: `data/${dbName}.db`,
      size: 10,
      sha256: 'a'.repeat(64),
      recordCount: 1
    }))
    const databaseFiles = await options.createDatabases(
      options.verified,
      'merge-stage/databases',
      files,
      options.previews
    )
    await options.validateDatabases(
      'merge-stage/databases',
      databaseFiles
    )
    return {
      directory: 'merge-stage',
      databaseDirectory: 'merge-stage/databases',
      bundleId: '11111111-1111-4111-8111-111111111111',
      planSetSha256: '9'.repeat(64),
      databaseFiles,
      previews: options.previews
    }
  },
  verifyAccountDatabaseMergeStage: async (
    options: Record<string, unknown> & {
      validateDatabases: (
        directory: string,
        files: Array<Record<string, unknown>>
      ) => Promise<void>
    }
  ) => {
    state.events.push('merge-stage:verify')
    state.mergeVerifyOptions = options
    const databaseFiles = Object.values(DbName).map((dbName) => ({
      dbName,
      filename: `${dbName}.db`,
      size: 20,
      sha256: 'e'.repeat(64),
      recordCount: 2
    }))
    await options.validateDatabases(
      'merge-stage/databases',
      databaseFiles
    )
    return {
      directory: 'merge-stage',
      databaseDirectory: 'merge-stage/databases',
      bundleId: '11111111-1111-4111-8111-111111111111',
      account: { serverId: 8, memberId: '7654321' },
      planSetSha256: '9'.repeat(64),
      databaseFiles,
      previews: Object.values(DbName).map((dbName) => ({
        dbName,
        incomingRecords: 1,
        add: 1,
        duplicate: 0,
        legacyDuplicate: 0,
        conflict: 0,
        currentOnly: 0,
        mergePlan: {
          schemaVersion: 1,
          comparisonPolicyVersion: 1,
          conflictPolicyVersion: 1,
          conflictResolution: 'preserve-current-v1',
          mode: dbName === DbName.quest
            ? 'quest-monotonic-v1'
            : 'append-only-v1',
          sourceSha256: 'a'.repeat(64),
          currentStateSha256: (
            dbName === DbName.quest ? 'b' : 'a'
          ).repeat(64),
          incomingStateSha256: 'c'.repeat(64),
          decisionSha256: 'd'.repeat(64),
          safeAdd: dbName === DbName.quest ? 0 : 1,
          skip: 0,
          conflict: 0,
          conflictReasons: [],
          manualReview: dbName === DbName.quest ? 1 : 0,
          currentOnly: 0
        }
      }))
    }
  }
}))

vi.mock('@main/account-restore-transaction', () => ({
  enforceAccountRestoreRetention: async (
    appDataRoot: string,
    options: Record<string, unknown>
  ) => {
    state.events.push('retention:enforce')
    state.retentionOptions = { appDataRoot, options }
    return {
      scannedEntries: 2,
      eligibleGenerations: 2,
      deleted: [],
      retainedBytes: 20,
      overCapacityBytes: 0,
      skippedForPendingTransaction: false
    }
  },
  findLatestAccountRedo: async (
    appDataRoot: string,
    expectedAccount: Record<string, unknown>,
    validateDatabases: (
      directory: string,
      files: Array<Record<string, unknown>>
    ) => Promise<void>
  ) => {
    state.events.push('redo:find')
    state.redoOptions = { appDataRoot, expectedAccount }
    const files = Object.values(DbName).map((dbName) => ({
      dbName,
      filename: `${dbName}.db`,
      size: 10,
      sha256: 'a'.repeat(64),
      recordCount: 1
    }))
    await validateDatabases('redo/replaced-account', files)
    return {
      directory: 'app-data/restore-rollbacks/bundle',
      bundleId: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-07-30T00:00:00.000Z',
      account: expectedAccount
    }
  },
  scheduleAccountRedo: async (
    redo: Record<string, unknown>,
    appDataRoot: string,
    expectedAccount: Record<string, unknown>,
    validateDatabases: (
      directory: string,
      files: Array<Record<string, unknown>>
    ) => Promise<void>
  ) => {
    state.events.push('redo:schedule')
    state.redoOptions = { redo, appDataRoot, expectedAccount }
    const files = Object.values(DbName).map((dbName) => ({
      dbName,
      filename: `${dbName}.db`,
      size: 10,
      sha256: 'a'.repeat(64),
      recordCount: 1
    }))
    await validateDatabases('redo/replaced-account', files)
  },
  applyPendingAccountRedo: async (
    _appDataRoot: string,
    _account: Record<string, unknown>,
    validateDatabases: (
      directory: string,
      files: Array<Record<string, unknown>>
    ) => Promise<void>,
    inspectDatabases: (
      directory: string
    ) => Promise<Array<Record<string, unknown>>>
  ) => {
    state.events.push('redo:apply')
    const files = Object.values(DbName).map((dbName) => ({
      dbName,
      filename: `${dbName}.db`,
      size: 10,
      sha256: 'a'.repeat(64),
      recordCount: 1
    }))
    await validateDatabases('redo/current', files)
    await inspectDatabases('redo/rollback')
    return {
      status: 'applied',
      bundleId: '11111111-1111-4111-8111-111111111111'
    }
  },
  findLatestAccountRollback: async (
    appDataRoot: string,
    expectedAccount: Record<string, unknown>
  ) => {
    state.events.push('rollback:find')
    state.rollbackOptions = { appDataRoot, expectedAccount }
    return {
      directory: 'app-data/restore-rollbacks/bundle',
      bundleId: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-07-30T00:00:00.000Z',
      account: expectedAccount
    }
  },
  scheduleAccountRollback: async (
    rollback: Record<string, unknown>,
    appDataRoot: string,
    expectedAccount: Record<string, unknown>
  ) => {
    state.events.push('rollback:schedule')
    state.rollbackOptions = { rollback, appDataRoot, expectedAccount }
  },
  applyPendingAccountRollback: async (
    _appDataRoot: string,
    _account: Record<string, unknown>,
    validateDatabases: (
      directory: string,
      files: Array<Record<string, unknown>>
    ) => Promise<void>
  ) => {
    state.events.push('rollback:apply')
    const files = Object.values(DbName).map((dbName) => ({
      dbName,
      filename: `${dbName}.db`,
      size: 10,
      sha256: 'a'.repeat(64),
      recordCount: 1
    }))
    await validateDatabases('rollback/account', files)
    return {
      status: 'applied',
      bundleId: '11111111-1111-4111-8111-111111111111'
    }
  },
  scheduleAccountRestore: async (
    stage: Record<string, unknown>,
    appDataRoot: string,
    expectedAccount: Record<string, unknown>
  ) => {
    state.events.push('restore:schedule')
    state.scheduleOptions = { stage, appDataRoot, expectedAccount }
  },
  applyPendingAccountRestore: async (
    _appDataRoot: string,
    _account: Record<string, unknown>,
    validateDatabases: (
      directory: string,
      files: Array<Record<string, unknown>>
    ) => Promise<void>,
    inspectDatabases: (
      directory: string
    ) => Promise<Array<Record<string, unknown>>>
  ) => {
    state.events.push('restore:apply')
    const files = Object.values(DbName).map((dbName) => ({
      dbName,
      filename: `${dbName}.db`,
      size: 10,
      sha256: 'a'.repeat(64),
      recordCount: 1
    }))
    await validateDatabases('restored/account', files)
    await inspectDatabases('rollback/account')
    return {
      status: 'applied',
      bundleId: '11111111-1111-4111-8111-111111111111',
      rollbackDirectory: 'rollback'
    }
  }
}))

vi.mock('@main/account-backup', () => ({
  createVerifiedLocalAccountBackup: async (
    options: Record<string, unknown>
  ) => {
    state.events.push('create')
    state.createOptions = options
    return { directory: 'verified', manifest: {} }
  }
}))

vi.mock('@main/account-transfer', () => ({
  createEncryptedAccountTransfer: async (
    backupDirectory: string,
    outputPath: string,
    passphrase: string
  ) => {
    state.events.push('transfer:create')
    state.transferOptions = {
      backupDirectory,
      outputPath,
      passphrase
    }
    return {
      filePath: outputPath,
      fileName: 'account.koubrowser-transfer',
      bytes: 4096,
      databaseFiles: 9,
      profileFiles: 3,
      records: 42
    }
  },
  decryptAccountTransferToDirectory: async (
    filePath: string,
    passphrase: string,
    destinationRoot: string
  ) => {
    state.events.push('transfer:decrypt')
    state.transferDecryptOptions = {
      filePath,
      passphrase,
      destinationRoot
    }
    return {
      directory: 'decrypted',
      manifest: { summary: {} }
    }
  }
}))

vi.mock('@main/account-restore-audit', () => ({
  createAccountAuditFingerprint: (
    account: { serverId: number; memberId: string }
  ) => `${account.serverId}:${account.memberId}`,
  createAccountAuditSnapshot: async (
    accountDirectory: string,
    account: Record<string, unknown>,
    databases: Array<Record<string, unknown>>
  ) => {
    state.events.push('audit:create')
    return {
      schemaVersion: 1,
      capturedAt: '2026-07-30T00:00:00.000Z',
      accountFingerprint: `${account.serverId}:${account.memberId}`,
      databases,
      profiles: [],
      accountDirectory
    }
  },
  saveAccountAuditBaseline: async (
    _appDataRoot: string,
    snapshot: Record<string, unknown>
  ) => {
    state.events.push('audit:save')
    state.auditBaseline = snapshot
  },
  loadAccountAuditBaseline: async () => {
    state.events.push('audit:load')
    return state.auditBaseline
  },
  toLocalAccountAuditSummary: (
    snapshot: {
      capturedAt: string
      databases: Array<{ dbName: string; recordCount: number }>
    }
  ) => ({
    capturedAt: snapshot.capturedAt,
    databases: snapshot.databases.map((database) => ({
      dbName: database.dbName,
      records: database.recordCount
    })),
    profileFiles: 0,
    records: snapshot.databases.length
  }),
  compareAccountAuditSnapshots: () => {
    state.events.push('audit:compare')
    return {
      status: 'match',
      summary: {
        capturedAt: '2026-07-30T00:00:00.000Z',
        databases: [],
        profileFiles: 0,
        records: 9
      }
    }
  }
}))

vi.mock('@main/backup-source-device', () => ({
  loadOrCreateBackupSourceDeviceId: async () =>
    '22222222-2222-4222-8222-222222222222'
}))

vi.mock('@main/path', () => ({
  getUserDataDir: () => 'app-data',
  PathStuff: { storeUser: 'app-data/store/8_7654321' }
}))

vi.mock('@main/svdata', () => ({
  svdata: {
    serverId: 8,
    basic: { api_member_id: 7654321 }
  }
}))

import { DbName } from '@common/record'
import {
  applyPendingRedoForCurrentAccount,
  applyPendingMergeForCurrentAccount,
  applyPendingRollbackForCurrentAccount,
  applyPendingRestoreForCurrentAccount,
  captureCurrentAccountAuditBaseline,
  cleanupAccountTransferCandidate,
  compareCurrentAccountAuditBaseline,
  createCurrentAccountBackup,
  createCurrentAccountTransfer,
  decryptAccountTransferCandidate,
  enforceAccountRestoreRetentionForCurrentAccount,
  getAvailableRedoForCurrentAccount,
  getAvailableRollbackForCurrentAccount,
  prepareCurrentAccountRedo,
  prepareCurrentAccountBackupMerge,
  prepareCurrentAccountRollback,
  prepareVerifiedAccountBackupRestore,
  previewVerifiedAccountBackupAgainstCurrent,
  stageVerifiedAccountBackupMerge,
  stageVerifiedAccountBackupForRestore,
  verifyCurrentAccountBackupMergeStage,
  withVerifiedCurrentAccountBackupMergeStage
} from '@main/account-backup-service'
import type { VerifiedAccountBackup } from '@main/account-backup'
import type {
  AccountBackupDatabasePreview
} from '@common/account-backup'

describe('current account backup service', () => {
  beforeEach(() => {
    state.events = []
    state.createOptions = null
    state.transferOptions = null
    state.transferDecryptOptions = null
    state.previewFiles = null
    state.stageOptions = null
    state.mergeOptions = null
    state.mergeVerifyOptions = null
    state.mergeTransactionOptions = null
    state.expiredMergeAuditDb = null
    state.mergeAuditShape = 'normal'
    state.scheduleOptions = null
    state.rollbackOptions = null
    state.redoOptions = null
    state.retentionOptions = null
    state.auditBaseline = null
  })

  it('holds JSON and database writes around bundle creation', async () => {
    const result = await createCurrentAccountBackup({
      destinationRoot: 'destination',
      appVersion: '1.0.5'
    })

    expect(result.directory).toBe('verified')
    expect(state.events).toEqual([
      'json:start',
      'database:start',
      'create',
      'database:end',
      'json:end'
    ])
    expect(state.createOptions).toMatchObject({
      sourceDirectory: 'app-data/store/8_7654321',
      destinationRoot: 'destination',
      appDataRoot: 'app-data',
      appVersion: '1.0.5',
      sourceDeviceId: '22222222-2222-4222-8222-222222222222',
      account: {
        serverId: 8,
        memberId: '7654321'
      },
      databases: [{ dbName: 'port' }]
    })
  })

  it('removes its plaintext temporary backup after creating an encrypted transfer', async () => {
    const result = await createCurrentAccountTransfer({
      outputPath: 'destination/account.koubrowser-transfer',
      passphrase: 'a sufficiently long passphrase',
      appVersion: '1.0.5'
    })
    const temporaryRoot = String(state.createOptions?.destinationRoot)

    expect(result.fileName).toBe('account.koubrowser-transfer')
    expect(state.events).toEqual([
      'json:start',
      'database:start',
      'create',
      'database:end',
      'json:end',
      'transfer:create'
    ])
    expect(state.transferOptions).toEqual({
      backupDirectory: 'verified',
      outputPath: 'destination/account.koubrowser-transfer',
      passphrase: 'a sufficiently long passphrase'
    })
    expect(temporaryRoot).toContain('koubrowser-transfer-export-')
    await expect(fs.promises.access(temporaryRoot)).rejects.toThrow()
  })

  it('keeps a decrypted transfer candidate only until explicit safe cleanup', async () => {
    const candidate = await decryptAccountTransferCandidate(
      'selected/account.koubrowser-transfer',
      'a sufficiently long passphrase'
    )

    expect(state.transferDecryptOptions).toEqual({
      filePath: 'selected/account.koubrowser-transfer',
      passphrase: 'a sufficiently long passphrase',
      destinationRoot: candidate.temporaryRoot
    })
    await expect(fs.promises.access(candidate.temporaryRoot)).resolves.toBeUndefined()

    await cleanupAccountTransferCandidate(candidate.temporaryRoot)
    await expect(
      fs.promises.access(candidate.temporaryRoot)
    ).rejects.toThrow()
    await expect(
      cleanupAccountTransferCandidate('app-data')
    ).rejects.toThrow('Refusing to remove')
  })

  it('compares every verified database while the snapshot barrier is active', async () => {
    const files = Object.values(DbName).map((dbName) => ({
      path: `data/${dbName}.db`,
      category: 'database' as const,
      size: 10,
      sha256: 'a'.repeat(64),
      recordCount: 1,
      oldestRecordAt: null,
      newestRecordAt: null
    }))
    const verified = {
      directory: 'verified-bundle',
      manifest: {
        schemaVersion: 1,
        bundleId: '11111111-1111-4111-8111-111111111111',
        appVersion: '1.0.5',
        createdAt: '2026-07-30T00:00:00.000Z',
        sourceDeviceId: '22222222-2222-4222-8222-222222222222',
        mode: 'backup',
        protection: 'none-local-only',
        account: { serverId: 8, memberId: '7654321' },
        summary: {
          databaseFiles: files.length,
          profileFiles: 0,
          records: files.length,
          oldestRecordAt: null,
          newestRecordAt: null
        },
        files
      }
    } satisfies VerifiedAccountBackup

    const previews = await previewVerifiedAccountBackupAgainstCurrent(verified)

    expect(previews).toHaveLength(Object.values(DbName).length)
    expect(state.previewFiles).toHaveLength(Object.values(DbName).length)
    expect(state.events).toEqual([
      'database:start',
      'preview:main',
      'preview:quest',
      'database:end'
    ])
  })

  it('builds a restore stage only after both workers validate every database', async () => {
    const verified = {
      directory: 'verified-bundle',
      manifest: {}
    } as VerifiedAccountBackup

    const stage = await stageVerifiedAccountBackupForRestore(verified)

    expect(stage.accountDirectory).toBe('stage/account')
    expect(state.stageOptions).toMatchObject({
      verified,
      appDataRoot: 'app-data',
      expectedAccount: {
        serverId: 8,
        memberId: '7654321'
      }
    })
    expect(state.events).toEqual([
      'stage:create',
      'stage:main',
      'stage:quest'
    ])
  })

  it('builds an isolated merge stage through both worker partitions', async () => {
    const files = Object.values(DbName).map((dbName) => ({
      path: `data/${dbName}.db`,
      category: 'database' as const,
      size: 10,
      sha256: 'a'.repeat(64),
      recordCount: 1,
      oldestRecordAt: null,
      newestRecordAt: null
    }))
    const verified = {
      directory: 'verified-bundle',
      manifest: {
        schemaVersion: 1,
        bundleId: '11111111-1111-4111-8111-111111111111',
        appVersion: '1.0.5',
        createdAt: '2026-07-30T00:00:00.000Z',
        sourceDeviceId: '22222222-2222-4222-8222-222222222222',
        mode: 'backup',
        protection: 'none-local-only',
        account: { serverId: 8, memberId: '7654321' },
        summary: {
          databaseFiles: files.length,
          profileFiles: 0,
          records: files.length,
          oldestRecordAt: null,
          newestRecordAt: null
        },
        files
      }
    } satisfies VerifiedAccountBackup
    const previews = Object.values(DbName).map((dbName) => {
      const quest = dbName === DbName.quest
      return {
        dbName,
        incomingRecords: 1,
        add: quest ? 0 : 1,
        duplicate: 0,
        legacyDuplicate: 0,
        conflict: 0,
        currentOnly: 0,
        mergePlan: {
          schemaVersion: 1,
          comparisonPolicyVersion: 1,
          conflictPolicyVersion: 1,
          conflictResolution: 'preserve-current-v1',
          mode: quest ? 'quest-monotonic-v1' : 'append-only-v1',
          sourceSha256: 'a'.repeat(64),
          currentStateSha256: 'b'.repeat(64),
          incomingStateSha256: 'c'.repeat(64),
          decisionSha256: 'd'.repeat(64),
          safeAdd: quest ? 0 : 1,
          skip: 0,
          conflict: 0,
          conflictReasons: [],
          manualReview: quest ? 1 : 0,
          currentOnly: 0
        }
      } satisfies AccountBackupDatabasePreview
    })

    const stage = await stageVerifiedAccountBackupMerge(verified, previews)

    expect(stage.databaseDirectory).toBe('merge-stage/databases')
    expect(state.mergeOptions).toMatchObject({
      verified,
      appDataRoot: 'app-data',
      expectedAccount: {
        serverId: 8,
        memberId: '7654321'
      },
      previews
    })
    expect(state.events).toEqual([
      'merge-stage:create',
      'database:start',
      'merge:main',
      'merge:quest',
      'database:end',
      'stage:main',
      'stage:quest'
    ])
  })

  it('revalidates an existing merge stage for the current account', async () => {
    const stage = await verifyCurrentAccountBackupMergeStage(
      'merge-stage'
    )

    expect(stage.account).toEqual({
      serverId: 8,
      memberId: '7654321'
    })
    expect(state.mergeVerifyOptions).toMatchObject({
      directory: 'merge-stage',
      appDataRoot: 'app-data',
      expectedAccount: {
        serverId: 8,
        memberId: '7654321'
      }
    })
    expect(state.events).toEqual([
      'database:start',
      'merge-stage:verify',
      'stage:main',
      'stage:quest',
      'audit:main',
      'audit:quest',
      'database:end'
    ])
  })

  it('rejects a merge stage when an active database changed', async () => {
    state.expiredMergeAuditDb = DbName.drop

    await expect(
      verifyCurrentAccountBackupMergeStage('merge-stage')
    ).rejects.toThrow(`Database merge plan expired: ${DbName.drop}`)

    expect(state.events).toEqual([
      'database:start',
      'merge-stage:verify',
      'stage:main',
      'stage:quest',
      'audit:main',
      'audit:quest',
      'database:end'
    ])
  })

  it('consumes a verified merge stage before releasing the snapshot', async () => {
    const result = await withVerifiedCurrentAccountBackupMergeStage(
      'merge-stage',
      async (stage) => {
        state.events.push('merge-stage:consume')
        return stage.planSetSha256
      }
    )

    expect(result).toBe('9'.repeat(64))
    expect(state.events.slice(-2)).toEqual([
      'merge-stage:consume',
      'database:end'
    ])
  })

  it('schedules a current-state-verified merge before releasing the snapshot', async () => {
    const stage = await prepareCurrentAccountBackupMerge('merge-stage')

    expect(stage.planSetSha256).toBe('9'.repeat(64))
    expect(state.mergeTransactionOptions).toMatchObject({
      appDataRoot: 'app-data',
      expectedAccount: {
        serverId: 8,
        memberId: '7654321'
      }
    })
    expect(state.events).toEqual([
      'database:start',
      'merge-stage:verify',
      'stage:main',
      'stage:quest',
      'audit:main',
      'audit:quest',
      'merge-transaction:schedule',
      'stage:main',
      'stage:quest',
      'database:end'
    ])
  })

  it.each(['missing', 'duplicate'] as const)(
    'rejects an %s active database audit set',
    async (shape) => {
      state.mergeAuditShape = shape

      await expect(
        verifyCurrentAccountBackupMergeStage('merge-stage')
      ).rejects.toThrow(
        'current-state validation is incomplete or duplicated'
      )

      expect(state.events.at(-1)).toBe('database:end')
    }
  )

  it('schedules a verified stage for the current account', async () => {
    const verified = {
      directory: 'verified-bundle',
      manifest: {}
    } as VerifiedAccountBackup

    const stage = await prepareVerifiedAccountBackupRestore(verified)

    expect(stage.accountDirectory).toBe('stage/account')
    expect(state.scheduleOptions).toMatchObject({
      appDataRoot: 'app-data',
      expectedAccount: {
        serverId: 8,
        memberId: '7654321'
      }
    })
    expect(state.events).toEqual([
      'stage:create',
      'stage:main',
      'stage:quest',
      'restore:schedule'
    ])
  })

  it('applies a pending restore through the explicit worker partitions', async () => {
    await expect(
      applyPendingRestoreForCurrentAccount()
    ).resolves.toMatchObject({ status: 'applied' })
    expect(state.events).toEqual([
      'restore:apply',
      'stage:main',
      'stage:quest',
      'inspect:main',
      'inspect:quest'
    ])
  })

  it('applies a pending merge through closed-directory worker audits', async () => {
    await expect(
      applyPendingMergeForCurrentAccount()
    ).resolves.toMatchObject({ status: 'applied' })
    expect(state.mergeTransactionOptions).toEqual({
      appDataRoot: 'app-data',
      account: {
        serverId: 8,
        memberId: '7654321'
      }
    })
    expect(state.events).toEqual([
      'merge-transaction:apply',
      'stage:main',
      'stage:quest',
      'directory-audit:main',
      'directory-audit:quest',
      'inspect:main',
      'inspect:quest'
    ])
  })

  it('discovers and schedules rollback data only for the current account', async () => {
    const rollback = await getAvailableRollbackForCurrentAccount()
    expect(rollback).toMatchObject({
      bundleId: '11111111-1111-4111-8111-111111111111'
    })
    expect(state.rollbackOptions).toEqual({
      appDataRoot: 'app-data',
      expectedAccount: {
        serverId: 8,
        memberId: '7654321'
      }
    })

    await prepareCurrentAccountRollback(rollback!)
    expect(state.rollbackOptions).toMatchObject({
      rollback,
      appDataRoot: 'app-data',
      expectedAccount: {
        serverId: 8,
        memberId: '7654321'
      }
    })
    expect(state.events).toEqual([
      'rollback:find',
      'rollback:schedule'
    ])
  })

  it('applies a pending rollback through the explicit worker partitions', async () => {
    await expect(
      applyPendingRollbackForCurrentAccount()
    ).resolves.toMatchObject({ status: 'applied' })
    expect(state.events).toEqual([
      'rollback:apply',
      'stage:main',
      'stage:quest'
    ])
  })

  it('discovers, schedules, and applies redo data through both workers', async () => {
    const redo = await getAvailableRedoForCurrentAccount()
    expect(redo).toMatchObject({
      bundleId: '11111111-1111-4111-8111-111111111111'
    })
    await prepareCurrentAccountRedo(redo!)
    await expect(
      applyPendingRedoForCurrentAccount()
    ).resolves.toMatchObject({ status: 'applied' })

    expect(state.redoOptions).toMatchObject({
      redo,
      appDataRoot: 'app-data',
      expectedAccount: {
        serverId: 8,
        memberId: '7654321'
      }
    })
    expect(state.events).toEqual([
      'redo:find',
      'stage:main',
      'stage:quest',
      'redo:schedule',
      'stage:main',
      'stage:quest',
      'redo:apply',
      'stage:main',
      'stage:quest',
      'inspect:main',
      'inspect:quest'
    ])
  })

  it('captures and compares a semantic audit under read barriers', async () => {
    const captured = await captureCurrentAccountAuditBaseline()
    expect(captured).toMatchObject({
      status: 'captured',
      summary: { records: 9 }
    })
    const compared = await compareCurrentAccountAuditBaseline()
    expect(compared).toMatchObject({ status: 'match' })
    expect(state.events).toEqual([
      'json:start',
      'database-read:start',
      'audit:main',
      'audit:quest',
      'audit:create',
      'database-read:end',
      'json:end',
      'audit:save',
      'audit:load',
      'json:start',
      'database-read:start',
      'audit:main',
      'audit:quest',
      'audit:create',
      'database-read:end',
      'json:end',
      'audit:compare'
    ])
  })

  it('enforces rollback retention under the application data root', async () => {
    await expect(
      enforceAccountRestoreRetentionForCurrentAccount(['bundle'])
    ).resolves.toMatchObject({
      eligibleGenerations: 2,
      retainedBytes: 20
    })
    expect(state.retentionOptions).toEqual({
      appDataRoot: 'app-data',
      options: {
        protectedBundleIds: ['bundle']
      }
    })
  })
})

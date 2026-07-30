import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DbName } from '@common/record'
import type { AccountBackupDatabasePreview } from '@common/account-backup'
import {
  createVerifiedLocalAccountBackup,
  type VerifiedAccountBackup
} from '@main/account-backup'
import {
  createAccountDatabaseMergeStage,
  type VerifiedAccountDatabaseMergeStage
} from '@main/account-merge-staging'
import {
  applyPendingAccountMerge,
  applyPendingAccountMergeRedo,
  applyPendingAccountMergeRollback,
  enforceAccountMergeRetention,
  findLatestAccountMergeRedo,
  findLatestAccountMergeRollback,
  PendingAccountMergeFilename,
  PendingAccountMergeRedoFilename,
  PendingAccountMergeRollbackFilename,
  scheduleAccountMergeRedo,
  scheduleAccountMergeRollback,
  scheduleAccountMerge
} from '@main/account-merge-transaction'
import { DbStuff } from '@main/stuff/db'
import type {
  DatabaseAuditInfo,
  DatabaseSnapshotInfo,
  RestoreStageDatabaseFile
} from '@main/worker/msg'

const BundleId = '11111111-1111-4111-8111-111111111111'
const SourceDeviceId = '22222222-2222-4222-8222-222222222222'
const Account = { serverId: 3, memberId: '12345678' } as const

function snapshots(): DatabaseSnapshotInfo[] {
  return Object.values(DbName).map((dbName) => ({
    dbName,
    recordCount: 1,
    oldestRecordAt: null,
    newestRecordAt: null
  }))
}

function writeAccountDirectory(directory: string, label: string): void {
  fs.mkdirSync(directory, { recursive: true })
  for (const dbName of Object.values(DbName)) {
    fs.writeFileSync(
      path.join(directory, `${dbName}.db`),
      `${JSON.stringify({
        _id: `${dbName}-${label}`,
        value: label
      })}\n`,
      'utf8'
    )
  }
  fs.writeFileSync(
    path.join(directory, 'app.json'),
    JSON.stringify({ label: 'preserved-profile' }),
    'utf8'
  )
  fs.mkdirSync(path.join(directory, 'local-only'))
  fs.writeFileSync(
    path.join(directory, 'local-only', 'note.json'),
    JSON.stringify({ keep: true }),
    'utf8'
  )
}

async function fileDescriptor(
  directory: string,
  dbName: DbName
): Promise<RestoreStageDatabaseFile> {
  const filename = `${dbName}.db`
  const content = await fs.promises.readFile(
    path.join(directory, filename)
  )
  return {
    dbName,
    filename,
    size: content.byteLength,
    sha256: createHash('sha256').update(content).digest('hex'),
    recordCount: 1
  }
}

describe('account merge transaction', () => {
  let temporaryRoot: string
  let appDataRoot: string
  let currentDirectory: string
  let backupRoot: string
  let verified: VerifiedAccountBackup
  let stage: VerifiedAccountDatabaseMergeStage
  let inspector: DbStuff

  const validateDatabases = async (
    directory: string,
    files: readonly RestoreStageDatabaseFile[]
  ): Promise<void> => {
    await inspector.validateRestoreStage(directory, files)
  }
  const auditDatabases = (
    directory: string
  ): Promise<DatabaseAuditInfo[]> =>
    inspector.auditAccountDirectory(
      directory,
      Object.values(DbName)
    )
  const inspectDatabases = (
    directory: string
  ): Promise<RestoreStageDatabaseFile[]> =>
    inspector.inspectAccountDirectory(
      directory,
      Object.values(DbName)
    )

  beforeEach(async () => {
    temporaryRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'koubrowser-merge-transaction-')
    )
    appDataRoot = path.join(temporaryRoot, 'app-data')
    currentDirectory = path.join(
      appDataRoot,
      'store',
      `${Account.serverId}_${Account.memberId}`
    )
    backupRoot = path.join(temporaryRoot, 'backups')
    fs.mkdirSync(appDataRoot, { recursive: true })
    fs.mkdirSync(backupRoot)
    writeAccountDirectory(currentDirectory, 'incoming')
    inspector = DbStuff.create()

    verified = await createVerifiedLocalAccountBackup({
      sourceDirectory: currentDirectory,
      destinationRoot: backupRoot,
      appDataRoot,
      appVersion: '1.0.5',
      sourceDeviceId: SourceDeviceId,
      account: Account,
      databases: snapshots(),
      createdAt: new Date('2026-07-30T12:34:56.000Z'),
      bundleId: BundleId
    })
    fs.rmSync(currentDirectory, { recursive: true, force: true })
    writeAccountDirectory(currentDirectory, 'current')
    const currentAudits = await auditDatabases(currentDirectory)
    const currentAuditByName = new Map(
      currentAudits.map((audit) => [audit.dbName, audit])
    )
    const previews = Object.values(DbName).map((dbName) => {
      const source = verified.manifest.files.find(
        (file) => file.path === `data/${dbName}.db`
      )!
      const quest = dbName === DbName.quest
      return {
        dbName,
        incomingRecords: 1,
        add: 1,
        duplicate: 0,
        legacyDuplicate: 0,
        conflict: 0,
        currentOnly: 1,
        mergePlan: {
          schemaVersion: 1,
          comparisonPolicyVersion: 1,
          conflictPolicyVersion: 1,
          conflictResolution: 'preserve-current-v1',
          mode: quest ? 'quest-monotonic-v1' : 'append-only-v1',
          sourceSha256: source.sha256,
          currentStateSha256:
            currentAuditByName.get(dbName)!.semanticSha256,
          incomingStateSha256: 'c'.repeat(64),
          decisionSha256: 'd'.repeat(64),
          safeAdd: quest ? 0 : 1,
          skip: 0,
          conflict: 0,
          conflictReasons: [],
          manualReview: quest ? 1 : 0,
          currentOnly: 1
        }
      } satisfies AccountBackupDatabasePreview
    })
    stage = await createAccountDatabaseMergeStage({
      verified,
      appDataRoot,
      expectedAccount: Account,
      previews,
      createDatabases: async (
        _source,
        databaseDirectory
      ) => {
        const files: RestoreStageDatabaseFile[] = []
        for (const dbName of Object.values(DbName)) {
          fs.writeFileSync(
            path.join(databaseDirectory, `${dbName}.db`),
            `${JSON.stringify({
              _id: `${dbName}-merged`,
              value: 'merged'
            })}\n`,
            'utf8'
          )
          files.push(await fileDescriptor(databaseDirectory, dbName))
        }
        return files
      },
      validateDatabases
    })
  })

  afterEach(() => {
    fs.rmSync(temporaryRoot, { recursive: true, force: true })
  })

  async function schedule(): Promise<void> {
    await scheduleAccountMerge(
      stage,
      appDataRoot,
      Account,
      validateDatabases
    )
  }

  function markerPath(): string {
    return path.join(appDataRoot, PendingAccountMergeFilename)
  }

  async function preparePhase(
    phase: 'prepared' | 'current-moved' | 'candidate-installed'
  ): Promise<void> {
    const pending = JSON.parse(
      fs.readFileSync(markerPath(), 'utf8')
    ) as Record<string, unknown>
    const stageName = pending.stageName as string
    const applyAccount = path.join(
      appDataRoot,
      'merge-apply',
      `${stageName}.partial`,
      'account'
    )
    fs.mkdirSync(applyAccount, { recursive: true })
    fs.cpSync(currentDirectory, applyAccount, { recursive: true })
    for (const dbName of Object.values(DbName)) {
      fs.copyFileSync(
        path.join(stage.databaseDirectory, `${dbName}.db`),
        path.join(applyAccount, `${dbName}.db`)
      )
    }

    const rollbackPartial = path.join(
      appDataRoot,
      'merge-rollbacks',
      `${stageName}.partial`
    )
    fs.mkdirSync(rollbackPartial, { recursive: true })
    fs.writeFileSync(
      path.join(rollbackPartial, 'merge-rollback.json'),
      `${JSON.stringify({
        schemaVersion: 1,
        createdAt: pending.createdAt,
        stageName,
        bundleId: pending.bundleId,
        planSetSha256: pending.planSetSha256,
        account: Account,
        databaseFiles: await inspectDatabases(currentDirectory),
        redoDatabaseFiles: stage.databaseFiles
      }, null, 2)}\n`,
      'utf8'
    )

    if (phase !== 'prepared') {
      fs.renameSync(
        currentDirectory,
        path.join(rollbackPartial, 'account')
      )
    }
    if (phase === 'candidate-installed') {
      fs.renameSync(applyAccount, currentDirectory)
    }
    pending.phase = phase
    fs.writeFileSync(
      markerPath(),
      `${JSON.stringify(pending, null, 2)}\n`,
      'utf8'
    )
  }

  it('revalidates after restart, installs only merged databases, and keeps rollback data', async () => {
    await schedule()

    const result = await applyPendingAccountMerge(
      appDataRoot,
      Account,
      validateDatabases,
      auditDatabases,
      inspectDatabases
    )

    expect(result).toMatchObject({
      status: 'applied',
      bundleId: BundleId
    })
    expect(
      fs.readFileSync(path.join(currentDirectory, 'drop.db'), 'utf8')
    ).toContain('drop-merged')
    expect(
      JSON.parse(
        fs.readFileSync(path.join(currentDirectory, 'app.json'), 'utf8')
      )
    ).toEqual({ label: 'preserved-profile' })
    expect(
      fs.existsSync(
        path.join(currentDirectory, 'local-only', 'note.json')
      )
    ).toBe(true)
    const rollbackDirectory = (
      result as Extract<typeof result, { status: 'applied' }>
    ).rollbackDirectory
    expect(
      fs.readFileSync(
        path.join(rollbackDirectory, 'account', 'drop.db'),
        'utf8'
      )
    ).toContain('drop-current')
    expect(fs.existsSync(markerPath())).toBe(false)
    expect(fs.existsSync(stage.directory)).toBe(false)
  })

  it('rolls a merge back, redoes it, and preserves newer rollback-side data', async () => {
    await schedule()
    await applyPendingAccountMerge(
      appDataRoot,
      Account,
      validateDatabases,
      auditDatabases,
      inspectDatabases
    )

    const rollback = await findLatestAccountMergeRollback(
      appDataRoot,
      Account,
      validateDatabases
    )
    expect(rollback).toMatchObject({
      bundleId: BundleId,
      stageName: path.basename(stage.directory)
    })
    await scheduleAccountMergeRollback(
      rollback!,
      appDataRoot,
      Account,
      validateDatabases
    )
    await expect(
      applyPendingAccountMergeRollback(
        appDataRoot,
        Account,
        validateDatabases,
        inspectDatabases
      )
    ).resolves.toMatchObject({
      status: 'applied',
      bundleId: BundleId
    })
    expect(
      fs.readFileSync(path.join(currentDirectory, 'drop.db'), 'utf8')
    ).toContain('drop-current')

    fs.writeFileSync(
      path.join(currentDirectory, 'drop.db'),
      `${JSON.stringify({
        _id: 'drop-after-rollback',
        value: 'after-rollback'
      })}\n`,
      'utf8'
    )
    const redo = await findLatestAccountMergeRedo(
      appDataRoot,
      Account,
      validateDatabases
    )
    expect(redo).toMatchObject({
      bundleId: BundleId,
      stageName: path.basename(stage.directory)
    })
    await scheduleAccountMergeRedo(
      redo!,
      appDataRoot,
      Account,
      validateDatabases
    )
    await expect(
      applyPendingAccountMergeRedo(
        appDataRoot,
        Account,
        validateDatabases,
        inspectDatabases
      )
    ).resolves.toMatchObject({
      status: 'applied',
      bundleId: BundleId
    })
    expect(
      fs.readFileSync(path.join(currentDirectory, 'drop.db'), 'utf8')
    ).toContain('drop-merged')

    const secondRollback = await findLatestAccountMergeRollback(
      appDataRoot,
      Account,
      validateDatabases
    )
    await scheduleAccountMergeRollback(
      secondRollback!,
      appDataRoot,
      Account,
      validateDatabases
    )
    await applyPendingAccountMergeRollback(
      appDataRoot,
      Account,
      validateDatabases,
      inspectDatabases
    )
    expect(
      fs.readFileSync(path.join(currentDirectory, 'drop.db'), 'utf8')
    ).toContain('drop-after-rollback')
  })

  it('prunes an expired finalized merge rollback but protects pending work', async () => {
    await schedule()
    await applyPendingAccountMerge(
      appDataRoot,
      Account,
      validateDatabases,
      auditDatabases,
      inspectDatabases
    )
    const rollback = await findLatestAccountMergeRollback(
      appDataRoot,
      Account,
      validateDatabases
    )
    await scheduleAccountMergeRollback(
      rollback!,
      appDataRoot,
      Account,
      validateDatabases
    )

    const protectedReport = await enforceAccountMergeRetention(
      appDataRoot,
      validateDatabases,
      {
        now: new Date('2030-01-01T00:00:00.000Z'),
        policy: {
          maxAgeDays: 1,
          maxGenerationsPerAccount: 1,
          maxTotalBytes: 0
        }
      }
    )
    expect(protectedReport.deleted).toEqual([])
    expect(fs.existsSync(rollback!.directory)).toBe(true)

    fs.rmSync(
      path.join(appDataRoot, 'account-merge-rollback-pending.json')
    )
    const report = await enforceAccountMergeRetention(
      appDataRoot,
      validateDatabases,
      {
        now: new Date('2030-01-01T00:00:00.000Z'),
        policy: {
          maxAgeDays: 1,
          maxGenerationsPerAccount: 1,
          maxTotalBytes: Number.MAX_SAFE_INTEGER
        }
      }
    )
    expect(report.deleted).toEqual([
      expect.objectContaining({
        stageName: path.basename(stage.directory),
        reason: 'age'
      })
    ])
    expect(fs.existsSync(rollback!.directory)).toBe(false)
  })

  it.each(['current-moved', 'rollback-installed'] as const)(
    'resumes a merge rollback from the %s phase',
    async (phase) => {
      await schedule()
      await applyPendingAccountMerge(
        appDataRoot,
        Account,
        validateDatabases,
        auditDatabases,
        inspectDatabases
      )
      const rollback = await findLatestAccountMergeRollback(
        appDataRoot,
        Account,
        validateDatabases
      )
      await scheduleAccountMergeRollback(
        rollback!,
        appDataRoot,
        Account,
        validateDatabases
      )
      const redoPartial = path.join(
        rollback!.directory,
        'merged-account.partial'
      )
      fs.renameSync(currentDirectory, redoPartial)
      if (phase === 'rollback-installed') {
        fs.renameSync(
          path.join(rollback!.directory, 'account'),
          currentDirectory
        )
      }
      const pendingPath = path.join(
        appDataRoot,
        PendingAccountMergeRollbackFilename
      )
      const pending = JSON.parse(
        fs.readFileSync(pendingPath, 'utf8')
      ) as Record<string, unknown>
      pending.phase = phase
      fs.writeFileSync(
        pendingPath,
        `${JSON.stringify(pending, null, 2)}\n`,
        'utf8'
      )

      await expect(
        applyPendingAccountMergeRollback(
          appDataRoot,
          Account,
          validateDatabases,
          inspectDatabases
        )
      ).resolves.toMatchObject({ status: 'applied' })
      expect(
        fs.readFileSync(path.join(currentDirectory, 'drop.db'), 'utf8')
      ).toContain('drop-current')
      expect(
        fs.existsSync(
          path.join(rollback!.directory, 'merged-account')
        )
      ).toBe(true)
    }
  )

  it.each(['current-moved', 'redo-installed'] as const)(
    'resumes a merge redo from the %s phase',
    async (phase) => {
      await schedule()
      await applyPendingAccountMerge(
        appDataRoot,
        Account,
        validateDatabases,
        auditDatabases,
        inspectDatabases
      )
      const rollback = await findLatestAccountMergeRollback(
        appDataRoot,
        Account,
        validateDatabases
      )
      await scheduleAccountMergeRollback(
        rollback!,
        appDataRoot,
        Account,
        validateDatabases
      )
      await applyPendingAccountMergeRollback(
        appDataRoot,
        Account,
        validateDatabases,
        inspectDatabases
      )
      const redo = await findLatestAccountMergeRedo(
        appDataRoot,
        Account,
        validateDatabases
      )
      await scheduleAccountMergeRedo(
        redo!,
        appDataRoot,
        Account,
        validateDatabases
      )
      const rollbackPartial = path.join(
        redo!.directory,
        'account.partial'
      )
      fs.renameSync(currentDirectory, rollbackPartial)
      if (phase === 'redo-installed') {
        fs.renameSync(
          path.join(redo!.directory, 'merged-account'),
          currentDirectory
        )
      }
      const pendingPath = path.join(
        appDataRoot,
        PendingAccountMergeRedoFilename
      )
      const pending = JSON.parse(
        fs.readFileSync(pendingPath, 'utf8')
      ) as Record<string, unknown>
      pending.phase = phase
      fs.writeFileSync(
        pendingPath,
        `${JSON.stringify(pending, null, 2)}\n`,
        'utf8'
      )

      await expect(
        applyPendingAccountMergeRedo(
          appDataRoot,
          Account,
          validateDatabases,
          inspectDatabases
        )
      ).resolves.toMatchObject({ status: 'applied' })
      expect(
        fs.readFileSync(path.join(currentDirectory, 'drop.db'), 'utf8')
      ).toContain('drop-merged')
      expect(
        fs.existsSync(path.join(redo!.directory, 'account'))
      ).toBe(true)
    }
  )

  it('expires a scheduled merge when the current database changed before restart apply', async () => {
    await schedule()
    fs.writeFileSync(
      path.join(currentDirectory, 'drop.db'),
      `${JSON.stringify({ _id: 'drop-new-current', value: 'new' })}\n`,
      'utf8'
    )

    const result = await applyPendingAccountMerge(
      appDataRoot,
      Account,
      validateDatabases,
      auditDatabases,
      inspectDatabases
    )

    expect(result).toEqual({
      status: 'expired',
      bundleId: BundleId,
      changedDatabases: [DbName.drop]
    })
    expect(
      fs.readFileSync(path.join(currentDirectory, 'drop.db'), 'utf8')
    ).toContain('drop-new-current')
    expect(fs.existsSync(markerPath())).toBe(false)
    expect(fs.existsSync(stage.directory)).toBe(true)
  })

  it('rejects a tampered staged database without touching current data', async () => {
    await schedule()
    fs.appendFileSync(
      path.join(stage.databaseDirectory, 'drop.db'),
      `${JSON.stringify({ _id: 'tampered' })}\n`,
      'utf8'
    )
    const before = fs.readFileSync(
      path.join(currentDirectory, 'drop.db'),
      'utf8'
    )

    await expect(
      applyPendingAccountMerge(
        appDataRoot,
        Account,
        validateDatabases,
        auditDatabases,
        inspectDatabases
      )
    ).rejects.toThrow()

    expect(
      fs.readFileSync(path.join(currentDirectory, 'drop.db'), 'utf8')
    ).toBe(before)
    expect(fs.existsSync(markerPath())).toBe(true)
  })

  it.each([
    'prepared',
    'current-moved',
    'candidate-installed'
  ] as const)(
    'resumes safely from the %s crash-recovery phase',
    async (phase) => {
      await schedule()
      await preparePhase(phase)

      const result = await applyPendingAccountMerge(
        appDataRoot,
        Account,
        validateDatabases,
        auditDatabases,
        inspectDatabases
      )

      expect(result.status).toBe('applied')
      expect(
        fs.readFileSync(
          path.join(currentDirectory, 'mission.db'),
          'utf8'
        )
      ).toContain('mission-merged')
      expect(fs.existsSync(markerPath())).toBe(false)
    }
  )

  it('rejects marker tampering before changing account paths', async () => {
    await schedule()
    const pending = JSON.parse(
      fs.readFileSync(markerPath(), 'utf8')
    ) as Record<string, unknown>
    pending.planSetSha256 = '0'.repeat(64)
    fs.writeFileSync(
      markerPath(),
      `${JSON.stringify(pending, null, 2)}\n`,
      'utf8'
    )

    await expect(
      applyPendingAccountMerge(
        appDataRoot,
        Account,
        validateDatabases,
        auditDatabases,
        inspectDatabases
      )
    ).rejects.toThrow('stage identity is invalid')
    expect(
      fs.readFileSync(path.join(currentDirectory, 'ship.db'), 'utf8')
    ).toContain('ship-current')
  })

  it('requires database startup to stop when an active phase has a conflicting marker', async () => {
    await schedule()
    await preparePhase('current-moved')
    fs.writeFileSync(
      path.join(appDataRoot, 'account-restore-pending.json'),
      '{}',
      'utf8'
    )

    await expect(
      applyPendingAccountMerge(
        appDataRoot,
        Account,
        validateDatabases,
        auditDatabases,
        inspectDatabases
      )
    ).rejects.toBeInstanceOf(AggregateError)
    expect(fs.existsSync(currentDirectory)).toBe(false)
    expect(fs.existsSync(markerPath())).toBe(true)
  })
})

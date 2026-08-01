import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DbName } from '@common/record'
import {
  createVerifiedLocalAccountBackup,
  type VerifiedAccountBackup
} from '@main/account-backup'
import { createVerifiedAccountRestoreStage } from '@main/account-backup-staging'
import {
  applyPendingAccountRedo,
  applyPendingAccountRollback,
  applyPendingAccountRestore,
  enforceAccountRestoreRetention,
  findLatestAccountRedo,
  findLatestAccountRollback,
  scheduleAccountRedo,
  scheduleAccountRollback,
  scheduleAccountRestore
} from '@main/account-restore-transaction'
import type { DatabaseSnapshotInfo } from '@main/worker/msg'

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
    JSON.stringify({ label }),
    'utf8'
  )
  fs.writeFileSync(
    path.join(directory, 'airbase_spots.json'),
    JSON.stringify([{ label }]),
    'utf8'
  )
  fs.writeFileSync(
    path.join(directory, 'inherit_score.json'),
    JSON.stringify([{ label }]),
    'utf8'
  )
}

describe('account restore transaction', () => {
  let temporaryRoot: string
  let appDataRoot: string
  let accountDirectory: string
  let backupRoot: string
  let verified: VerifiedAccountBackup

  beforeEach(async () => {
    temporaryRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'koubrowser-restore-transaction-')
    )
    appDataRoot = path.join(temporaryRoot, 'app-data')
    accountDirectory = path.join(
      appDataRoot,
      'store',
      `${Account.serverId}_${Account.memberId}`
    )
    backupRoot = path.join(temporaryRoot, 'backups')
    fs.mkdirSync(backupRoot, { recursive: true })
    writeAccountDirectory(accountDirectory, 'incoming')

    verified = await createVerifiedLocalAccountBackup({
      sourceDirectory: accountDirectory,
      destinationRoot: backupRoot,
      appDataRoot,
      appVersion: '1.0.5',
      sourceDeviceId: SourceDeviceId,
      account: Account,
      databases: snapshots(),
      createdAt: new Date('2026-07-30T12:34:56.000Z'),
      bundleId: BundleId
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(temporaryRoot, { recursive: true, force: true })
  })

  async function createStage() {
    return createVerifiedAccountRestoreStage({
      verified,
      appDataRoot,
      expectedAccount: Account,
      validateDatabases: async () => undefined
    })
  }

  function replaceCurrentWithOldData(): void {
    fs.rmSync(accountDirectory, { recursive: true, force: true })
    writeAccountDirectory(accountDirectory, 'current')
    fs.writeFileSync(
      path.join(accountDirectory, 'mapinfo.json'),
      JSON.stringify({ keep: true }),
      'utf8'
    )
  }

  function pendingPath(): string {
    return path.join(appDataRoot, 'account-restore-pending.json')
  }

  function rollbackPartialDirectory(): string {
    return path.join(
      appDataRoot,
      'restore-rollbacks',
      `${BundleId}.partial`
    )
  }

  function rollbackDirectory(): string {
    return path.join(
      appDataRoot,
      'restore-rollbacks',
      BundleId
    )
  }

  function rollbackPendingPath(): string {
    return path.join(appDataRoot, 'account-rollback-pending.json')
  }

  function redoPendingPath(): string {
    return path.join(appDataRoot, 'account-redo-pending.json')
  }

  function setPendingPhase(
    phase: 'prepared' | 'current-moved' | 'candidate-installed'
  ): void {
    const pending = JSON.parse(
      fs.readFileSync(pendingPath(), 'utf8')
    ) as Record<string, unknown>
    pending.phase = phase
    pending.hadCurrent = true
    fs.writeFileSync(
      pendingPath(),
      `${JSON.stringify(pending, null, 2)}\n`,
      'utf8'
    )
  }

  async function inspectCurrentDatabases() {
    return Object.values(DbName).map((dbName) => ({
      dbName,
      filename: `${dbName}.db`,
      size: 1,
      sha256: 'a'.repeat(64),
      recordCount: 1
    }))
  }

  async function installRestore(): Promise<void> {
    const stage = await createStage()
    replaceCurrentWithOldData()
    await scheduleAccountRestore(stage, appDataRoot, Account)
    await applyPendingAccountRestore(
      appDataRoot,
      Account,
      async () => undefined,
      inspectCurrentDatabases
    )
  }

  function rewriteRollbackMetadata(
    directory: string,
    bundleId: string,
    createdAt: string
  ): void {
    const metadataPath = path.join(directory, 'rollback.json')
    const metadata = JSON.parse(
      fs.readFileSync(metadataPath, 'utf8')
    ) as {
      createdAt: string
      incomingManifest: {
        bundleId: string
      }
    }
    metadata.createdAt = createdAt
    metadata.incomingManifest.bundleId = bundleId
    fs.writeFileSync(
      metadataPath,
      `${JSON.stringify(metadata, null, 2)}\n`,
      'utf8'
    )
  }

  function cloneRollbackGeneration(
    bundleId: string,
    createdAt: string
  ): string {
    const directory = path.join(
      appDataRoot,
      'restore-rollbacks',
      bundleId
    )
    fs.cpSync(rollbackDirectory(), directory, { recursive: true })
    rewriteRollbackMetadata(directory, bundleId, createdAt)
    return directory
  }

  async function installRollback(
    withRuntimeProfile = false
  ): Promise<void> {
    await installRestore()
    if (withRuntimeProfile) {
      fs.writeFileSync(
        path.join(accountDirectory, 'mapinfo.json'),
        JSON.stringify({ generatedAfterRestore: true }),
        'utf8'
      )
    }
    const rollback = await findLatestAccountRollback(
      appDataRoot,
      Account
    )
    await scheduleAccountRollback(rollback!, appDataRoot, Account)
    await applyPendingAccountRollback(
      appDataRoot,
      Account,
      async () => undefined
    )
  }

  it('atomically installs a candidate and preserves the full prior directory', async () => {
    const stage = await createStage()
    replaceCurrentWithOldData()
    await scheduleAccountRestore(stage, appDataRoot, Account)
    const validateDatabases = vi.fn(async (
      _directory: string,
      files: readonly unknown[]
    ) => {
      expect(files).toHaveLength(Object.values(DbName).length)
    })

    const result = await applyPendingAccountRestore(
      appDataRoot,
      Account,
      validateDatabases,
      inspectCurrentDatabases
    )

    expect(result.status).toBe('applied')
    expect(
      fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
    ).toContain('quest-incoming')
    const rollbackAccount = path.join(
      appDataRoot,
      'restore-rollbacks',
      BundleId,
      'account'
    )
    expect(
      fs.readFileSync(path.join(rollbackAccount, 'quest.db'), 'utf8')
    ).toContain('quest-current')
    expect(fs.existsSync(path.join(rollbackAccount, 'mapinfo.json'))).toBe(true)
    expect(fs.existsSync(pendingPath())).toBe(false)
    expect(
      fs.existsSync(path.join(appDataRoot, 'restore-staging', BundleId))
    ).toBe(false)
    expect(validateDatabases).toHaveBeenCalledTimes(2)

    await expect(
      applyPendingAccountRestore(
        appDataRoot,
        Account,
        validateDatabases,
        inspectCurrentDatabases
      )
    ).resolves.toEqual({ status: 'none' })
  })

  it('treats a repeated restore with runtime profiles as a verified no-op', async () => {
    await installRestore()
    fs.writeFileSync(
      path.join(accountDirectory, 'mapinfo.json'),
      JSON.stringify({ generatedAfterRestore: true }),
      'utf8'
    )
    const rollbackMetadataPath = path.join(
      rollbackDirectory(),
      'rollback.json'
    )
    const rollbackMetadata = fs.readFileSync(
      rollbackMetadataPath,
      'utf8'
    )
    const currentQuest = fs.readFileSync(
      path.join(accountDirectory, 'quest.db'),
      'utf8'
    )
    const stage = await createStage()
    await scheduleAccountRestore(stage, appDataRoot, Account)
    const validateDatabases = vi.fn(async () => undefined)

    await expect(
      applyPendingAccountRestore(
        appDataRoot,
        Account,
        validateDatabases,
        inspectCurrentDatabases
      )
    ).resolves.toEqual({
      status: 'already-applied',
      bundleId: BundleId,
      rollbackDirectory: rollbackDirectory()
    })

    expect(validateDatabases).toHaveBeenCalledTimes(3)
    expect(
      fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
    ).toBe(currentQuest)
    expect(fs.readFileSync(rollbackMetadataPath, 'utf8')).toBe(
      rollbackMetadata
    )
    expect(fs.existsSync(pendingPath())).toBe(false)
    expect(
      fs.existsSync(path.join(appDataRoot, 'restore-staging', BundleId))
    ).toBe(false)
  })

  it('rejects an unexpected file when verifying a repeated restore', async () => {
    await installRestore()
    fs.writeFileSync(
      path.join(accountDirectory, 'unexpected.txt'),
      'not a known runtime profile',
      'utf8'
    )
    const stage = await createStage()
    await scheduleAccountRestore(stage, appDataRoot, Account)

    await expect(
      applyPendingAccountRestore(
        appDataRoot,
        Account,
        async () => undefined,
        inspectCurrentDatabases
      )
    ).rejects.toThrow(
      'restored account file set does not match its manifest'
    )
    expect(fs.existsSync(pendingPath())).toBe(true)
    expect(
      fs.existsSync(path.join(accountDirectory, 'unexpected.txt'))
    ).toBe(true)
  })

  it('rejects a repeated restore after current data changed without mutation', async () => {
    await installRestore()
    fs.appendFileSync(
      path.join(accountDirectory, 'quest.db'),
      `${JSON.stringify({ _id: 'quest-newer', value: 'newer' })}\n`,
      'utf8'
    )
    const currentQuest = fs.readFileSync(
      path.join(accountDirectory, 'quest.db'),
      'utf8'
    )
    const rollbackQuest = fs.readFileSync(
      path.join(rollbackDirectory(), 'account', 'quest.db'),
      'utf8'
    )
    const stage = await createStage()
    await scheduleAccountRestore(stage, appDataRoot, Account)

    await expect(
      applyPendingAccountRestore(
        appDataRoot,
        Account,
        async () => undefined,
        inspectCurrentDatabases
      )
    ).rejects.toThrow()

    expect(
      fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
    ).toBe(currentQuest)
    expect(
      fs.readFileSync(
        path.join(rollbackDirectory(), 'account', 'quest.db'),
        'utf8'
      )
    ).toBe(rollbackQuest)
    expect(fs.existsSync(pendingPath())).toBe(true)
    expect(
      fs.existsSync(path.join(appDataRoot, 'restore-staging', BundleId))
    ).toBe(true)
  })

  it('waits without mutation when a different account logs in', async () => {
    const stage = await createStage()
    replaceCurrentWithOldData()
    await scheduleAccountRestore(stage, appDataRoot, Account)

    await expect(
      applyPendingAccountRestore(
        appDataRoot,
        { serverId: 3, memberId: '99999999' },
        async () => undefined,
        inspectCurrentDatabases
      )
    ).resolves.toEqual({ status: 'different-account' })
    expect(
      fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
    ).toContain('quest-current')
    expect(fs.existsSync(pendingPath())).toBe(true)
  })

  it('keeps current data when preflight worker validation fails', async () => {
    const stage = await createStage()
    replaceCurrentWithOldData()
    const currentQuest = fs.readFileSync(
      path.join(accountDirectory, 'quest.db'),
      'utf8'
    )
    await scheduleAccountRestore(stage, appDataRoot, Account)

    await expect(
      applyPendingAccountRestore(
        appDataRoot,
        Account,
        async () => {
          throw new Error('snapshot worker stopped')
        },
        inspectCurrentDatabases
      )
    ).rejects.toThrow('snapshot worker stopped')

    expect(
      fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
    ).toBe(currentQuest)
    expect(fs.existsSync(rollbackPartialDirectory())).toBe(false)
    expect(fs.existsSync(pendingPath())).toBe(true)
    expect(
      fs.existsSync(path.join(appDataRoot, 'restore-staging', BundleId))
    ).toBe(true)
  })

  it('keeps current data when rollback preparation runs out of space', async () => {
    const stage = await createStage()
    replaceCurrentWithOldData()
    const currentQuest = fs.readFileSync(
      path.join(accountDirectory, 'quest.db'),
      'utf8'
    )
    await scheduleAccountRestore(stage, appDataRoot, Account)
    const originalMkdir = fs.promises.mkdir.bind(fs.promises)
    vi.spyOn(fs.promises, 'mkdir').mockImplementation((async (
      directory: fs.PathLike,
      options?: fs.MakeDirectoryOptions
    ) => {
      if (
        path.resolve(String(directory)) ===
        path.resolve(rollbackPartialDirectory())
      ) {
        throw Object.assign(new Error('no space left on device'), {
          code: 'ENOSPC'
        })
      }
      return originalMkdir(directory, options)
    }) as typeof fs.promises.mkdir)

    await expect(
      applyPendingAccountRestore(
        appDataRoot,
        Account,
        async () => undefined,
        inspectCurrentDatabases
      )
    ).rejects.toMatchObject({ code: 'ENOSPC' })

    expect(
      fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
    ).toBe(currentQuest)
    expect(fs.existsSync(rollbackPartialDirectory())).toBe(false)
    expect(fs.existsSync(pendingPath())).toBe(true)
    expect(
      fs.existsSync(path.join(appDataRoot, 'restore-staging', BundleId))
    ).toBe(true)
  })

  it('restores the prior directory when post-install validation fails', async () => {
    const stage = await createStage()
    replaceCurrentWithOldData()
    await scheduleAccountRestore(stage, appDataRoot, Account)
    let validationCount = 0

    await expect(
      applyPendingAccountRestore(
        appDataRoot,
        Account,
        async () => {
          validationCount += 1
          if (validationCount === 2) {
            throw new Error('post-install validation failed')
          }
        },
        inspectCurrentDatabases
      )
    ).rejects.toThrow('post-install validation failed')

    expect(
      fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
    ).toContain('quest-current')
    expect(
      fs.existsSync(
        path.join(appDataRoot, 'restore-staging', BundleId, 'account')
      )
    ).toBe(true)
    expect(fs.existsSync(pendingPath())).toBe(false)
    expect(
      fs.existsSync(path.join(appDataRoot, 'restore-rollbacks'))
        ? fs.readdirSync(path.join(appDataRoot, 'restore-rollbacks'))
        : []
    ).toEqual([])
  })

  it('resumes after the current directory was moved before the phase update', async () => {
    const stage = await createStage()
    replaceCurrentWithOldData()
    await scheduleAccountRestore(stage, appDataRoot, Account)
    const rollbackPartial = rollbackPartialDirectory()
    fs.mkdirSync(rollbackPartial, { recursive: true })
    fs.writeFileSync(
      path.join(rollbackPartial, 'rollback.json'),
      '{}',
      'utf8'
    )
    fs.renameSync(
      accountDirectory,
      path.join(rollbackPartial, 'account')
    )
    setPendingPhase('prepared')

    await expect(
      applyPendingAccountRestore(
        appDataRoot,
        Account,
        async () => undefined,
        inspectCurrentDatabases
      )
    ).resolves.toMatchObject({ status: 'applied' })
    expect(
      fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
    ).toContain('quest-incoming')
  })

  it('resumes after candidate installation before the phase update', async () => {
    const stage = await createStage()
    replaceCurrentWithOldData()
    await scheduleAccountRestore(stage, appDataRoot, Account)
    const rollbackPartial = rollbackPartialDirectory()
    fs.mkdirSync(rollbackPartial, { recursive: true })
    fs.renameSync(
      accountDirectory,
      path.join(rollbackPartial, 'account')
    )
    fs.renameSync(stage.accountDirectory, accountDirectory)
    setPendingPhase('current-moved')

    await expect(
      applyPendingAccountRestore(
        appDataRoot,
        Account,
        async () => undefined,
        inspectCurrentDatabases
      )
    ).resolves.toMatchObject({ status: 'applied' })
    expect(
      fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
    ).toContain('quest-incoming')
  })

  it('rejects a modified transaction marker before moving current data', async () => {
    const stage = await createStage()
    replaceCurrentWithOldData()
    await scheduleAccountRestore(stage, appDataRoot, Account)
    const pending = JSON.parse(
      fs.readFileSync(pendingPath(), 'utf8')
    ) as Record<string, unknown>
    pending.unexpected = true
    fs.writeFileSync(pendingPath(), JSON.stringify(pending), 'utf8')

    await expect(
      applyPendingAccountRestore(
        appDataRoot,
        Account,
        async () => undefined,
        inspectCurrentDatabases
      )
    ).rejects.toThrow('unsupported fields')
    expect(
      fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
    ).toContain('quest-current')
  })

  it.each([0, 2])(
    'rejects backup schema version %s before moving current data',
    async (schemaVersion) => {
      const stage = await createStage()
      replaceCurrentWithOldData()
      const currentQuest = fs.readFileSync(
        path.join(accountDirectory, 'quest.db'),
        'utf8'
      )
      await scheduleAccountRestore(stage, appDataRoot, Account)
      const pending = JSON.parse(
        fs.readFileSync(pendingPath(), 'utf8')
      ) as {
        manifest: {
          schemaVersion: number
        }
      }
      pending.manifest.schemaVersion = schemaVersion
      fs.writeFileSync(
        pendingPath(),
        `${JSON.stringify(pending, null, 2)}\n`,
        'utf8'
      )

      await expect(
        applyPendingAccountRestore(
          appDataRoot,
          Account,
          async () => undefined,
          inspectCurrentDatabases
        )
      ).rejects.toThrow('unsupported account backup schema')

      expect(
        fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
      ).toBe(currentQuest)
      expect(fs.existsSync(rollbackPartialDirectory())).toBe(false)
      expect(fs.existsSync(pendingPath())).toBe(true)
      expect(
        fs.existsSync(path.join(appDataRoot, 'restore-staging', BundleId))
      ).toBe(true)
    }
  )

  it('discovers and applies the latest rollback while retaining replaced data', async () => {
    await installRestore()
    const available = await findLatestAccountRollback(
      appDataRoot,
      Account
    )
    expect(available).toMatchObject({
      bundleId: BundleId,
      account: Account
    })
    await scheduleAccountRollback(available!, appDataRoot, Account)

    await expect(
      applyPendingAccountRollback(
        appDataRoot,
        Account,
        async () => undefined
      )
    ).resolves.toEqual({
      status: 'applied',
      bundleId: BundleId
    })

    expect(
      fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
    ).toContain('quest-current')
    expect(
      fs.readFileSync(
        path.join(rollbackDirectory(), 'replaced-account', 'quest.db'),
        'utf8'
      )
    ).toContain('quest-incoming')
    expect(fs.existsSync(rollbackPendingPath())).toBe(false)
    await expect(
      findLatestAccountRollback(appDataRoot, Account)
    ).resolves.toBeNull()
  })

  it('reverses a rollback when post-install validation fails', async () => {
    await installRestore()
    const available = await findLatestAccountRollback(
      appDataRoot,
      Account
    )
    await scheduleAccountRollback(available!, appDataRoot, Account)
    let validationCount = 0

    await expect(
      applyPendingAccountRollback(
        appDataRoot,
        Account,
        async () => {
          validationCount += 1
          if (validationCount === 2) {
            throw new Error('rollback post-install validation failed')
          }
        }
      )
    ).rejects.toThrow('rollback post-install validation failed')

    expect(
      fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
    ).toContain('quest-incoming')
    expect(
      fs.readFileSync(
        path.join(rollbackDirectory(), 'account', 'quest.db'),
        'utf8'
      )
    ).toContain('quest-current')
    expect(fs.existsSync(rollbackPendingPath())).toBe(false)
  })

  it('resumes rollback after current data moved before marker update', async () => {
    await installRestore()
    const available = await findLatestAccountRollback(
      appDataRoot,
      Account
    )
    await scheduleAccountRollback(available!, appDataRoot, Account)
    fs.renameSync(
      accountDirectory,
      path.join(rollbackDirectory(), 'replaced-account.partial')
    )

    await expect(
      applyPendingAccountRollback(
        appDataRoot,
        Account,
        async () => undefined
      )
    ).resolves.toMatchObject({ status: 'applied' })
    expect(
      fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
    ).toContain('quest-current')
  })

  it('resumes rollback after retained data installed before marker update', async () => {
    await installRestore()
    const available = await findLatestAccountRollback(
      appDataRoot,
      Account
    )
    await scheduleAccountRollback(available!, appDataRoot, Account)
    fs.renameSync(
      accountDirectory,
      path.join(rollbackDirectory(), 'replaced-account.partial')
    )
    fs.renameSync(
      path.join(rollbackDirectory(), 'account'),
      accountDirectory
    )
    const marker = JSON.parse(
      fs.readFileSync(rollbackPendingPath(), 'utf8')
    ) as Record<string, unknown>
    marker.phase = 'current-moved'
    fs.writeFileSync(
      rollbackPendingPath(),
      `${JSON.stringify(marker, null, 2)}\n`,
      'utf8'
    )

    await expect(
      applyPendingAccountRollback(
        appDataRoot,
        Account,
        async () => undefined
      )
    ).resolves.toMatchObject({ status: 'applied' })
    expect(
      fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
    ).toContain('quest-current')
  })

  it('discovers and reapplies replaced data while preserving the new rollback source', async () => {
    await installRollback(true)
    fs.appendFileSync(
      path.join(accountDirectory, 'quest.db'),
      `${JSON.stringify({ _id: 'quest-after-rollback', value: 'newer' })}\n`,
      'utf8'
    )
    const validateDatabases = vi.fn(async () => undefined)
    const redo = await findLatestAccountRedo(
      appDataRoot,
      Account,
      validateDatabases
    )
    expect(redo).toMatchObject({
      bundleId: BundleId,
      account: Account
    })
    await scheduleAccountRedo(
      redo!,
      appDataRoot,
      Account,
      validateDatabases
    )

    await expect(
      applyPendingAccountRedo(
        appDataRoot,
        Account,
        validateDatabases,
        inspectCurrentDatabases
      )
    ).resolves.toEqual({
      status: 'applied',
      bundleId: BundleId
    })

    expect(
      fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
    ).toContain('quest-incoming')
    expect(
      JSON.parse(
        fs.readFileSync(
          path.join(accountDirectory, 'mapinfo.json'),
          'utf8'
        )
      )
    ).toEqual({ generatedAfterRestore: true })
    expect(
      fs.readFileSync(
        path.join(rollbackDirectory(), 'account', 'quest.db'),
        'utf8'
      )
    ).toContain('quest-after-rollback')
    expect(
      fs.existsSync(
        path.join(rollbackDirectory(), 'replaced-account')
      )
    ).toBe(false)
    expect(fs.existsSync(redoPendingPath())).toBe(false)
    await expect(
      findLatestAccountRollback(appDataRoot, Account)
    ).resolves.toMatchObject({ bundleId: BundleId })
  })

  it('reverses a redo when post-install validation fails', async () => {
    await installRollback()
    const redo = await findLatestAccountRedo(
      appDataRoot,
      Account,
      async () => undefined
    )
    await scheduleAccountRedo(
      redo!,
      appDataRoot,
      Account,
      async () => undefined
    )

    await expect(
      applyPendingAccountRedo(
        appDataRoot,
        Account,
        async (directory) => {
          if (
            path.resolve(directory) === path.resolve(accountDirectory)
          ) {
            throw new Error('redo post-install validation failed')
          }
        },
        inspectCurrentDatabases
      )
    ).rejects.toThrow('redo post-install validation failed')

    expect(
      fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
    ).toContain('quest-current')
    expect(
      fs.readFileSync(
        path.join(
          rollbackDirectory(),
          'replaced-account',
          'quest.db'
        ),
        'utf8'
      )
    ).toContain('quest-incoming')
    expect(
      fs.existsSync(path.join(rollbackDirectory(), 'account'))
    ).toBe(false)
    expect(fs.existsSync(redoPendingPath())).toBe(false)
  })

  it('resumes redo after current data moved before marker update', async () => {
    await installRollback()
    const redo = await findLatestAccountRedo(
      appDataRoot,
      Account,
      async () => undefined
    )
    await scheduleAccountRedo(
      redo!,
      appDataRoot,
      Account,
      async () => undefined
    )
    fs.renameSync(
      accountDirectory,
      path.join(rollbackDirectory(), 'account.partial')
    )

    await expect(
      applyPendingAccountRedo(
        appDataRoot,
        Account,
        async () => undefined,
        inspectCurrentDatabases
      )
    ).resolves.toMatchObject({ status: 'applied' })
    expect(
      fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
    ).toContain('quest-incoming')
  })

  it('finishes redo after both directory moves completed before marker update', async () => {
    await installRollback()
    const redo = await findLatestAccountRedo(
      appDataRoot,
      Account,
      async () => undefined
    )
    await scheduleAccountRedo(
      redo!,
      appDataRoot,
      Account,
      async () => undefined
    )
    fs.renameSync(
      accountDirectory,
      path.join(rollbackDirectory(), 'account')
    )
    fs.renameSync(
      path.join(rollbackDirectory(), 'replaced-account'),
      accountDirectory
    )

    await expect(
      applyPendingAccountRedo(
        appDataRoot,
        Account,
        async () => undefined,
        inspectCurrentDatabases
      )
    ).resolves.toMatchObject({ status: 'applied' })
    expect(fs.existsSync(redoPendingPath())).toBe(false)
    expect(
      fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
    ).toContain('quest-incoming')
    expect(
      fs.readFileSync(
        path.join(rollbackDirectory(), 'account', 'quest.db'),
        'utf8'
      )
    ).toContain('quest-current')
  })

  it('leaves a scheduled rollback untouched for a different account', async () => {
    await installRestore()
    const available = await findLatestAccountRollback(
      appDataRoot,
      Account
    )
    await scheduleAccountRollback(available!, appDataRoot, Account)

    await expect(
      applyPendingAccountRollback(
        appDataRoot,
        { serverId: 3, memberId: '99999999' },
        async () => undefined
      )
    ).resolves.toEqual({ status: 'different-account' })
    expect(fs.existsSync(rollbackPendingPath())).toBe(true)
    expect(
      fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
    ).toContain('quest-incoming')
  })

  it('rejects a modified rollback marker before moving current data', async () => {
    await installRestore()
    const available = await findLatestAccountRollback(
      appDataRoot,
      Account
    )
    await scheduleAccountRollback(available!, appDataRoot, Account)
    const marker = JSON.parse(
      fs.readFileSync(rollbackPendingPath(), 'utf8')
    ) as Record<string, unknown>
    marker.unexpected = true
    fs.writeFileSync(
      rollbackPendingPath(),
      JSON.stringify(marker),
      'utf8'
    )

    await expect(
      applyPendingAccountRollback(
        appDataRoot,
        Account,
        async () => undefined
      )
    ).rejects.toThrow('unsupported fields')
    expect(
      fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
    ).toContain('quest-incoming')
  })

  it('rejects modified rollback metadata before moving current data', async () => {
    await installRestore()
    const available = await findLatestAccountRollback(
      appDataRoot,
      Account
    )
    await scheduleAccountRollback(available!, appDataRoot, Account)
    const metadataPath = path.join(
      rollbackDirectory(),
      'rollback.json'
    )
    const metadata = JSON.parse(
      fs.readFileSync(metadataPath, 'utf8')
    ) as Record<string, unknown>
    metadata.unexpected = true
    fs.writeFileSync(metadataPath, JSON.stringify(metadata), 'utf8')

    await expect(
      applyPendingAccountRollback(
        appDataRoot,
        Account,
        async () => undefined
      )
    ).rejects.toThrow('unsupported fields')
    expect(
      fs.readFileSync(path.join(accountDirectory, 'quest.db'), 'utf8')
    ).toContain('quest-incoming')
    expect(
      fs.existsSync(
        path.join(rollbackDirectory(), 'replaced-account.partial')
      )
    ).toBe(false)
  })

  it('selects the newest valid rollback for the current account', async () => {
    await installRestore()
    rewriteRollbackMetadata(
      rollbackDirectory(),
      BundleId,
      '2026-07-30T00:00:00.000Z'
    )
    const newerBundleId = '33333333-3333-4333-8333-333333333333'
    const newerDirectory = path.join(
      appDataRoot,
      'restore-rollbacks',
      newerBundleId
    )
    fs.cpSync(rollbackDirectory(), newerDirectory, { recursive: true })
    const metadataPath = path.join(newerDirectory, 'rollback.json')
    const metadata = JSON.parse(
      fs.readFileSync(metadataPath, 'utf8')
    ) as {
      createdAt: string
      incomingManifest: {
        bundleId: string
      }
    }
    metadata.createdAt = '2026-07-31T00:00:00.000Z'
    metadata.incomingManifest.bundleId = newerBundleId
    fs.writeFileSync(
      metadataPath,
      `${JSON.stringify(metadata, null, 2)}\n`,
      'utf8'
    )

    await expect(
      findLatestAccountRollback(appDataRoot, Account)
    ).resolves.toMatchObject({
      bundleId: newerBundleId,
      createdAt: '2026-07-31T00:00:00.000Z'
    })
  })

  it('keeps only the newest configured rollback generations per account', async () => {
    await installRestore()
    rewriteRollbackMetadata(
      rollbackDirectory(),
      BundleId,
      '2026-07-27T00:00:00.000Z'
    )
    const secondId = '33333333-3333-4333-8333-333333333333'
    const thirdId = '44444444-4444-4444-8444-444444444444'
    const fourthId = '55555555-5555-4555-8555-555555555555'
    cloneRollbackGeneration(secondId, '2026-07-28T00:00:00.000Z')
    cloneRollbackGeneration(thirdId, '2026-07-29T00:00:00.000Z')
    cloneRollbackGeneration(fourthId, '2026-07-30T00:00:00.000Z')

    const report = await enforceAccountRestoreRetention(appDataRoot, {
      now: new Date('2026-07-31T00:00:00.000Z'),
      policy: {
        maxAgeDays: 365,
        maxGenerationsPerAccount: 3,
        maxTotalBytes: Number.MAX_SAFE_INTEGER
      }
    })

    expect(report.deleted).toEqual([
      expect.objectContaining({
        bundleId: BundleId,
        reason: 'generation-limit'
      })
    ])
    expect(fs.existsSync(rollbackDirectory())).toBe(false)
    expect(fs.existsSync(path.join(
      appDataRoot,
      'restore-rollbacks',
      secondId
    ))).toBe(true)
    expect(fs.existsSync(path.join(
      appDataRoot,
      'restore-rollbacks',
      thirdId
    ))).toBe(true)
    expect(fs.existsSync(path.join(
      appDataRoot,
      'restore-rollbacks',
      fourthId
    ))).toBe(true)
  })

  it('protects active transactions and explicitly protected generations', async () => {
    await installRestore()
    rewriteRollbackMetadata(
      rollbackDirectory(),
      BundleId,
      '2026-06-01T00:00:00.000Z'
    )
    const policy = {
      maxAgeDays: 1,
      maxGenerationsPerAccount: 1,
      maxTotalBytes: 1
    }

    const protectedReport = await enforceAccountRestoreRetention(
      appDataRoot,
      {
        now: new Date('2026-07-31T00:00:00.000Z'),
        policy,
        protectedBundleIds: [BundleId]
      }
    )
    expect(protectedReport.deleted).toEqual([])
    expect(protectedReport.overCapacityBytes).toBeGreaterThan(0)

    const available = await findLatestAccountRollback(
      appDataRoot,
      Account
    )
    await scheduleAccountRollback(available!, appDataRoot, Account)
    const pendingReport = await enforceAccountRestoreRetention(
      appDataRoot,
      {
        now: new Date('2026-07-31T00:00:00.000Z'),
        policy
      }
    )
    expect(pendingReport.skippedForPendingTransaction).toBe(true)
    expect(pendingReport.deleted).toEqual([])
    expect(fs.existsSync(rollbackDirectory())).toBe(true)

    fs.rmSync(rollbackPendingPath())
    const mergePendingPath = path.join(
      appDataRoot,
      'account-merge-pending.json'
    )
    fs.writeFileSync(mergePendingPath, '{}', 'utf8')
    const mergePendingReport = await enforceAccountRestoreRetention(
      appDataRoot,
      {
        now: new Date('2026-07-31T00:00:00.000Z'),
        policy
      }
    )
    expect(mergePendingReport.skippedForPendingTransaction).toBe(true)
    expect(mergePendingReport.deleted).toEqual([])
    fs.rmSync(mergePendingPath)

    const expiredReport = await enforceAccountRestoreRetention(
      appDataRoot,
      {
        now: new Date('2026-07-31T00:00:00.000Z'),
        policy
      }
    )
    expect(expiredReport.deleted).toEqual([
      expect.objectContaining({
        bundleId: BundleId,
        reason: 'expired'
      })
    ])
    expect(fs.existsSync(rollbackDirectory())).toBe(false)
  })

  it('uses capacity pruning without deleting the newest or partial data', async () => {
    await installRestore()
    rewriteRollbackMetadata(
      rollbackDirectory(),
      BundleId,
      '2026-07-29T00:00:00.000Z'
    )
    const newestId = '33333333-3333-4333-8333-333333333333'
    const newestDirectory = cloneRollbackGeneration(
      newestId,
      '2026-07-30T00:00:00.000Z'
    )
    const partialDirectory = path.join(
      appDataRoot,
      'restore-rollbacks',
      '66666666-6666-4666-8666-666666666666.partial'
    )
    fs.mkdirSync(partialDirectory)
    fs.writeFileSync(
      path.join(partialDirectory, 'forensics.bin'),
      Buffer.alloc(256)
    )
    const newestBytes = fs.statSync(
      path.join(newestDirectory, 'rollback.json')
    ).size

    const report = await enforceAccountRestoreRetention(appDataRoot, {
      now: new Date('2026-07-31T00:00:00.000Z'),
      policy: {
        maxAgeDays: 365,
        maxGenerationsPerAccount: 3,
        maxTotalBytes: newestBytes
      }
    })

    expect(report.deleted).toEqual([
      expect.objectContaining({
        bundleId: BundleId,
        reason: 'capacity-limit'
      })
    ])
    expect(fs.existsSync(rollbackDirectory())).toBe(false)
    expect(fs.existsSync(newestDirectory)).toBe(true)
    expect(fs.existsSync(partialDirectory)).toBe(true)
    expect(report.overCapacityBytes).toBeGreaterThan(0)
  })

  it('retains unknown and metadata-corrupt rollback directories', async () => {
    await installRestore()
    const corruptId = '77777777-7777-4777-8777-777777777777'
    const unknownId = '88888888-8888-4888-8888-888888888888'
    const corruptDirectory = cloneRollbackGeneration(
      corruptId,
      '2026-06-01T00:00:00.000Z'
    )
    const corruptMetadataPath = path.join(
      corruptDirectory,
      'rollback.json'
    )
    const corruptMetadata = JSON.parse(
      fs.readFileSync(corruptMetadataPath, 'utf8')
    ) as Record<string, unknown>
    corruptMetadata.unexpected = true
    fs.writeFileSync(
      corruptMetadataPath,
      `${JSON.stringify(corruptMetadata, null, 2)}\n`,
      'utf8'
    )
    const unknownDirectory = cloneRollbackGeneration(
      unknownId,
      '2026-06-02T00:00:00.000Z'
    )
    fs.writeFileSync(
      path.join(unknownDirectory, 'unrecognized.bin'),
      Buffer.alloc(64)
    )

    const report = await enforceAccountRestoreRetention(appDataRoot, {
      now: new Date('2026-07-31T00:00:00.000Z'),
      policy: {
        maxAgeDays: 1,
        maxGenerationsPerAccount: 1,
        maxTotalBytes: 1
      },
      protectedBundleIds: [BundleId]
    })

    expect(report.eligibleGenerations).toBe(1)
    expect(report.deleted).toEqual([])
    expect(report.overCapacityBytes).toBeGreaterThan(0)
    expect(fs.existsSync(corruptDirectory)).toBe(true)
    expect(fs.existsSync(unknownDirectory)).toBe(true)
  })
})

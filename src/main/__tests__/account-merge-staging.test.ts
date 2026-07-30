import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DbName } from '@common/record'
import type { AccountBackupDatabasePreview } from '@common/account-backup'
import {
  createVerifiedLocalAccountBackup,
  type VerifiedAccountBackup
} from '@main/account-backup'
import {
  createAccountDatabaseMergeStage,
  verifyAccountDatabaseMergeStage
} from '@main/account-merge-staging'
import type {
  DatabaseSnapshotInfo,
  RestoreStageDatabaseFile
} from '@main/worker/msg'

const BundleId = '11111111-1111-4111-8111-111111111111'
const SourceDeviceId = '22222222-2222-4222-8222-222222222222'
const Account = { serverId: 3, memberId: '12345678' } as const

function databaseSnapshots(): DatabaseSnapshotInfo[] {
  return Object.values(DbName).map((dbName) => ({
    dbName,
    recordCount: 1,
    oldestRecordAt: null,
    newestRecordAt: null
  }))
}

function mergePreviews(
  verified: VerifiedAccountBackup
): AccountBackupDatabasePreview[] {
  return Object.values(DbName).map((dbName, index) => {
    const source = verified.manifest.files.find(
      (file) => file.path === `data/${dbName}.db`
    )!
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
        mode: dbName === DbName.quest
          ? 'quest-monotonic-v1'
          : 'append-only-v1',
        sourceSha256: source.sha256,
        currentStateSha256: createHash('sha256')
          .update(`current:${index}`)
          .digest('hex'),
        incomingStateSha256: createHash('sha256')
          .update(`incoming:${index}`)
          .digest('hex'),
        decisionSha256: createHash('sha256')
          .update(`decision:${index}`)
          .digest('hex'),
        safeAdd: 0,
        skip: 0,
        conflict: 0,
        conflictReasons: [],
        manualReview: 1,
        currentOnly: 1
      }
    }
  })
}

describe('account database merge staging', () => {
  let temporaryRoot: string
  let appDataRoot: string
  let sourceDirectory: string
  let destinationRoot: string
  let verified: VerifiedAccountBackup

  beforeEach(async () => {
    temporaryRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'koubrowser-merge-stage-')
    )
    appDataRoot = path.join(temporaryRoot, 'app-data')
    sourceDirectory = path.join(
      appDataRoot,
      'store',
      `${Account.serverId}_${Account.memberId}`
    )
    destinationRoot = path.join(temporaryRoot, 'backups')
    fs.mkdirSync(sourceDirectory, { recursive: true })
    fs.mkdirSync(destinationRoot)

    for (const dbName of Object.values(DbName)) {
      fs.writeFileSync(
        path.join(sourceDirectory, `${dbName}.db`),
        `${JSON.stringify({ _id: `${dbName}-1`, value: dbName })}\n`,
        'utf8'
      )
    }
    verified = await createVerifiedLocalAccountBackup({
      sourceDirectory,
      destinationRoot,
      appDataRoot,
      appVersion: '1.0.5',
      sourceDeviceId: SourceDeviceId,
      account: Account,
      databases: databaseSnapshots(),
      createdAt: new Date('2026-07-30T12:34:56.000Z'),
      bundleId: BundleId
    })
  })

  afterEach(() => {
    fs.rmSync(temporaryRoot, { recursive: true, force: true })
  })

  const copySourceDatabases = async (
    source: VerifiedAccountBackup,
    databaseDirectory: string
  ): Promise<RestoreStageDatabaseFile[]> => {
    return Object.values(DbName).map((dbName) => {
      const manifestFile = source.manifest.files.find(
        (file) => file.path === `data/${dbName}.db`
      )!
      fs.copyFileSync(
        path.join(source.directory, 'data', `${dbName}.db`),
        path.join(databaseDirectory, `${dbName}.db`)
      )
      return {
        dbName,
        filename: `${dbName}.db`,
        size: manifestFile.size,
        sha256: manifestFile.sha256,
        recordCount: manifestFile.recordCount!
      }
    })
  }

  it('publishes a self-validated database-only candidate', async () => {
    const validateDatabases = vi.fn(async (
      databaseDirectory: string,
      files: readonly RestoreStageDatabaseFile[]
    ) => {
      expect(files).toHaveLength(Object.values(DbName).length)
      expect(fs.readdirSync(databaseDirectory).sort()).toEqual(
        Object.values(DbName).map((dbName) => `${dbName}.db`).sort()
      )
    })

    const stage = await createAccountDatabaseMergeStage({
      verified,
      appDataRoot,
      expectedAccount: Account,
      previews: mergePreviews(verified),
      createDatabases: copySourceDatabases,
      validateDatabases
    })

    expect(stage.bundleId).toBe(BundleId)
    expect(stage.account).toEqual(Account)
    expect(stage.planSetSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(path.dirname(stage.directory)).toBe(
      path.join(fs.realpathSync(appDataRoot), 'merge-staging')
    )
    expect(fs.readdirSync(stage.directory).sort()).toEqual([
      'databases',
      'merge-stage.json'
    ])
    expect(stage.databaseFiles).toHaveLength(Object.values(DbName).length)
    expect(validateDatabases).toHaveBeenCalledTimes(2)

    await expect(
      verifyAccountDatabaseMergeStage({
        directory: stage.directory,
        appDataRoot,
        expectedAccount: Account,
        validateDatabases
      })
    ).resolves.toMatchObject({
      directory: stage.directory,
      databaseDirectory: stage.databaseDirectory,
      bundleId: BundleId,
      account: Account,
      planSetSha256: stage.planSetSha256
    })
    expect(validateDatabases).toHaveBeenCalledTimes(3)
  })

  it('removes only its partial stage when database generation fails', async () => {
    await expect(
      createAccountDatabaseMergeStage({
        verified,
        appDataRoot,
        expectedAccount: Account,
        previews: mergePreviews(verified),
        createDatabases: async (_source, databaseDirectory) => {
          fs.writeFileSync(
            path.join(databaseDirectory, 'partial.db'),
            'partial',
            'utf8'
          )
          throw new Error('stage generation failed')
        },
        validateDatabases: async () => undefined
      })
    ).rejects.toThrow('stage generation failed')

    expect(
      fs.readdirSync(path.join(appDataRoot, 'merge-staging'))
    ).toEqual([])
    expect(fs.existsSync(sourceDirectory)).toBe(true)
    expect(fs.existsSync(verified.directory)).toBe(true)
  })

  it('rejects malformed plans before creating a staging root', async () => {
    const previews = mergePreviews(verified)
    previews[0] = {
      ...previews[0],
      mergePlan: {
        ...previews[0].mergePlan,
        decisionSha256: 'not-a-sha256'
      }
    }

    await expect(
      createAccountDatabaseMergeStage({
        verified,
        appDataRoot,
        expectedAccount: Account,
        previews,
        createDatabases: copySourceDatabases,
        validateDatabases: async () => undefined
      })
    ).rejects.toThrow('invalid database merge plan')

    expect(fs.existsSync(path.join(appDataRoot, 'merge-staging'))).toBe(false)
  })

  it('rejects unsupported conflict policy and inconsistent summaries', async () => {
    const unsupported = mergePreviews(verified)
    unsupported[0] = {
      ...unsupported[0],
      mergePlan: {
        ...unsupported[0].mergePlan,
        conflictPolicyVersion: 2 as 1
      }
    }
    await expect(
      createAccountDatabaseMergeStage({
        verified,
        appDataRoot,
        expectedAccount: Account,
        previews: unsupported,
        createDatabases: copySourceDatabases,
        validateDatabases: async () => undefined
      })
    ).rejects.toThrow('invalid database merge plan')

    const inconsistent = mergePreviews(verified)
    inconsistent[0] = {
      ...inconsistent[0],
      mergePlan: {
        ...inconsistent[0].mergePlan,
        conflictReasons: [{ group: 'unknown-field', records: 1 }]
      }
    }
    await expect(
      createAccountDatabaseMergeStage({
        verified,
        appDataRoot,
        expectedAccount: Account,
        previews: inconsistent,
        createDatabases: copySourceDatabases,
        validateDatabases: async () => undefined
      })
    ).rejects.toThrow('invalid database merge plan')

    expect(fs.existsSync(path.join(appDataRoot, 'merge-staging'))).toBe(false)
  })

  it('rejects unexpected files and removes the unpublished candidate', async () => {
    await expect(
      createAccountDatabaseMergeStage({
        verified,
        appDataRoot,
        expectedAccount: Account,
        previews: mergePreviews(verified),
        createDatabases: async (source, databaseDirectory) => {
          const files = await copySourceDatabases(
            source,
            databaseDirectory
          )
          fs.writeFileSync(
            path.join(databaseDirectory, 'unexpected.db'),
            'unexpected',
            'utf8'
          )
          return files
        },
        validateDatabases: async () => undefined
      })
    ).rejects.toThrow('database file set is invalid')

    expect(
      fs.readdirSync(path.join(appDataRoot, 'merge-staging'))
    ).toEqual([])
  })

  it('rejects a reloaded candidate for a different account', async () => {
    const stage = await createAccountDatabaseMergeStage({
      verified,
      appDataRoot,
      expectedAccount: Account,
      previews: mergePreviews(verified),
      createDatabases: copySourceDatabases,
      validateDatabases: async () => undefined
    })
    const validateDatabases = vi.fn(async () => undefined)

    await expect(
      verifyAccountDatabaseMergeStage({
        directory: stage.directory,
        appDataRoot,
        expectedAccount: { serverId: 4, memberId: '87654321' },
        validateDatabases
      })
    ).rejects.toThrow('does not match the current account')

    expect(validateDatabases).not.toHaveBeenCalled()
    expect(fs.existsSync(stage.directory)).toBe(true)
  })

  it('detects a replaced staged database without removing evidence', async () => {
    const stage = await createAccountDatabaseMergeStage({
      verified,
      appDataRoot,
      expectedAccount: Account,
      previews: mergePreviews(verified),
      createDatabases: copySourceDatabases,
      validateDatabases: async () => undefined
    })
    fs.appendFileSync(
      path.join(stage.databaseDirectory, `${DbName.drop}.db`),
      `${JSON.stringify({ _id: 'tampered', value: true })}\n`,
      'utf8'
    )
    const validateDatabases = vi.fn(async () => undefined)

    await expect(
      verifyAccountDatabaseMergeStage({
        directory: stage.directory,
        appDataRoot,
        expectedAccount: Account,
        validateDatabases
      })
    ).rejects.toThrow('file size mismatch')

    expect(validateDatabases).not.toHaveBeenCalled()
    expect(fs.existsSync(stage.directory)).toBe(true)
  })

  it('rejects tampered metadata before worker validation', async () => {
    const stage = await createAccountDatabaseMergeStage({
      verified,
      appDataRoot,
      expectedAccount: Account,
      previews: mergePreviews(verified),
      createDatabases: copySourceDatabases,
      validateDatabases: async () => undefined
    })
    const metadataPath = path.join(stage.directory, 'merge-stage.json')
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
    metadata.previews[0].mergePlan.decisionSha256 = '0'.repeat(64)
    fs.writeFileSync(
      metadataPath,
      `${JSON.stringify(metadata, null, 2)}\n`,
      'utf8'
    )
    const validateDatabases = vi.fn(async () => undefined)

    await expect(
      verifyAccountDatabaseMergeStage({
        directory: stage.directory,
        appDataRoot,
        expectedAccount: Account,
        validateDatabases
      })
    ).rejects.toThrow('identity is invalid')

    expect(validateDatabases).not.toHaveBeenCalled()
  })

  it('rejects tampered conflict summaries before worker validation', async () => {
    const stage = await createAccountDatabaseMergeStage({
      verified,
      appDataRoot,
      expectedAccount: Account,
      previews: mergePreviews(verified),
      createDatabases: copySourceDatabases,
      validateDatabases: async () => undefined
    })
    const metadataPath = path.join(stage.directory, 'merge-stage.json')
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
    metadata.previews[0].mergePlan.conflictReasons = [{
      group: 'unknown-field',
      records: 1
    }]
    fs.writeFileSync(
      metadataPath,
      `${JSON.stringify(metadata, null, 2)}\n`,
      'utf8'
    )
    const validateDatabases = vi.fn(async () => undefined)

    await expect(
      verifyAccountDatabaseMergeStage({
        directory: stage.directory,
        appDataRoot,
        expectedAccount: Account,
        validateDatabases
      })
    ).rejects.toThrow('invalid database merge conflict reasons')

    expect(validateDatabases).not.toHaveBeenCalled()
    expect(fs.existsSync(stage.directory)).toBe(true)
  })

  it('rejects a candidate copied outside the merge staging root', async () => {
    const stage = await createAccountDatabaseMergeStage({
      verified,
      appDataRoot,
      expectedAccount: Account,
      previews: mergePreviews(verified),
      createDatabases: copySourceDatabases,
      validateDatabases: async () => undefined
    })
    const outsideDirectory = path.join(
      temporaryRoot,
      path.basename(stage.directory)
    )
    fs.cpSync(stage.directory, outsideDirectory, { recursive: true })
    const validateDatabases = vi.fn(async () => undefined)

    await expect(
      verifyAccountDatabaseMergeStage({
        directory: outsideDirectory,
        appDataRoot,
        expectedAccount: Account,
        validateDatabases
      })
    ).rejects.toThrow('outside the staging root')

    expect(validateDatabases).not.toHaveBeenCalled()
  })

  it('rejects a different account before creating a staging root', async () => {
    await expect(
      createAccountDatabaseMergeStage({
        verified,
        appDataRoot,
        expectedAccount: { serverId: 4, memberId: '87654321' },
        previews: mergePreviews(verified),
        createDatabases: copySourceDatabases,
        validateDatabases: async () => undefined
      })
    ).rejects.toThrow('does not match the current account')

    expect(fs.existsSync(path.join(appDataRoot, 'merge-staging'))).toBe(false)
  })
})

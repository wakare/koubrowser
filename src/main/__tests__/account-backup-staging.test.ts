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
import type { DatabaseSnapshotInfo } from '@main/worker/msg'

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

describe('account backup restore staging', () => {
  let temporaryRoot: string
  let appDataRoot: string
  let sourceDirectory: string
  let destinationRoot: string
  let verified: VerifiedAccountBackup

  beforeEach(async () => {
    temporaryRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'koubrowser-restore-stage-')
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
    fs.writeFileSync(
      path.join(sourceDirectory, 'app.json'),
      JSON.stringify({ theme: 'dark' }),
      'utf8'
    )
    fs.writeFileSync(
      path.join(sourceDirectory, 'airbase_spots.json'),
      JSON.stringify([]),
      'utf8'
    )
    fs.writeFileSync(
      path.join(sourceDirectory, 'inherit_score.json'),
      JSON.stringify([]),
      'utf8'
    )

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

  it('builds and validates an isolated account-directory candidate', async () => {
    const validateDatabases = vi.fn(async (
      accountDirectory: string,
      files: readonly { filename: string }[]
    ) => {
      expect(files).toHaveLength(Object.values(DbName).length)
      for (const file of files) {
        expect(fs.statSync(path.join(accountDirectory, file.filename)).isFile())
          .toBe(true)
      }
    })

    const stage = await createVerifiedAccountRestoreStage({
      verified,
      appDataRoot,
      expectedAccount: Account,
      validateDatabases
    })

    expect(stage.bundleId).toBe(BundleId)
    expect(stage.account).toEqual(Account)
    expect(path.dirname(stage.directory)).toBe(
      path.join(fs.realpathSync(appDataRoot), 'restore-staging')
    )
    expect(fs.existsSync(path.join(stage.directory, 'stage.json'))).toBe(true)
    expect(fs.readdirSync(stage.accountDirectory).sort()).toEqual([
      'airbase_spots.json',
      'app.json',
      'battle.db',
      'clearitemget.db',
      'drop.db',
      'inherit_score.json',
      'item.db',
      'mission.db',
      'port.db',
      'quest.db',
      'remodel.db',
      'ship.db'
    ])
    expect(validateDatabases).toHaveBeenCalledOnce()
    expect(
      fs.readFileSync(path.join(sourceDirectory, 'quest.db'), 'utf8')
    ).toContain('quest-1')
  })

  it('rejects another account before creating a stage', async () => {
    await expect(
      createVerifiedAccountRestoreStage({
        verified,
        appDataRoot,
        expectedAccount: { serverId: 3, memberId: '99999999' },
        validateDatabases: async () => undefined
      })
    ).rejects.toThrow('does not match the current account')
    expect(
      fs.existsSync(path.join(appDataRoot, 'restore-staging'))
    ).toBe(false)
  })

  it('cleans only the partial directory it created when validation fails', async () => {
    await expect(
      createVerifiedAccountRestoreStage({
        verified,
        appDataRoot,
        expectedAccount: Account,
        validateDatabases: async () => {
          throw new Error('stage database validation failed')
        }
      })
    ).rejects.toThrow('stage database validation failed')

    expect(
      fs.readdirSync(path.join(appDataRoot, 'restore-staging'))
    ).toEqual([])
  })

  it('does not remove a pre-existing partial directory', async () => {
    const partialDirectory = path.join(
      appDataRoot,
      'restore-staging',
      `${BundleId}.partial`
    )
    fs.mkdirSync(partialDirectory, { recursive: true })
    fs.writeFileSync(path.join(partialDirectory, 'keep.txt'), 'keep', 'utf8')

    await expect(
      createVerifiedAccountRestoreStage({
        verified,
        appDataRoot,
        expectedAccount: Account,
        validateDatabases: async () => undefined
      })
    ).rejects.toMatchObject({ code: 'EEXIST' })
    expect(
      fs.readFileSync(path.join(partialDirectory, 'keep.txt'), 'utf8')
    ).toBe('keep')
  })
})

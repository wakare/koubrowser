import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DbName } from '@common/record'
import {
  createVerifiedLocalAccountBackup,
  parseAccountBackupManifest,
  verifyLocalAccountBackup,
  type AccountBackupManifest,
  type CreateLocalAccountBackupOptions
} from '@main/account-backup'
import type { DatabaseSnapshotInfo } from '@main/worker/msg'

const BundleId = '11111111-1111-4111-8111-111111111111'
const SourceDeviceId = '22222222-2222-4222-8222-222222222222'
const CreatedAt = new Date('2026-07-30T12:34:56.000Z')
const Account = { serverId: 3, memberId: '12345678' } as const

function databaseContent(dbName: string): string {
  return [
    JSON.stringify({
      _id: `${dbName}-1`,
      date: '2026-07-01T00:00:00.000Z'
    }),
    JSON.stringify({
      _id: `${dbName}-2`,
      date: '2026-07-20T00:00:00.000Z'
    })
  ].join('\n') + '\n'
}

function databaseSnapshots(): DatabaseSnapshotInfo[] {
  return Object.values(DbName).map((dbName) => ({
    dbName,
    recordCount: 2,
    oldestRecordAt: '2026-07-01T00:00:00.000Z',
    newestRecordAt: '2026-07-20T00:00:00.000Z'
  }))
}

describe('local account backup bundles', () => {
  let temporaryRoot: string
  let appDataRoot: string
  let sourceDirectory: string
  let destinationRoot: string

  beforeEach(() => {
    temporaryRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'koubrowser-account-backup-')
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
        databaseContent(dbName),
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
      JSON.stringify([{ area_id: 1, area_no: 1, spots: [] }]),
      'utf8'
    )
    fs.writeFileSync(
      path.join(sourceDirectory, 'inherit_score.json'),
      JSON.stringify([{ id: 1, score: 7 }]),
      'utf8'
    )
  })

  afterEach(() => {
    fs.rmSync(temporaryRoot, { recursive: true, force: true })
  })

  function options(
    overrides: Partial<CreateLocalAccountBackupOptions> = {}
  ): CreateLocalAccountBackupOptions {
    return {
      sourceDirectory,
      destinationRoot,
      appDataRoot,
      appVersion: '1.0.5',
      sourceDeviceId: SourceDeviceId,
      account: Account,
      databases: databaseSnapshots(),
      createdAt: CreatedAt,
      bundleId: BundleId,
      ...overrides
    }
  }

  it('creates and re-verifies a complete immutable account bundle', async () => {
    const verified = await createVerifiedLocalAccountBackup(options())

    expect(path.dirname(verified.directory)).toBe(
      fs.realpathSync(destinationRoot)
    )
    expect(path.basename(verified.directory)).toBe(
      'koubrowser-backup-20260730T123456000Z-11111111-1111-4111-8111-111111111111'
    )
    expect(verified.manifest.protection).toBe('none-local-only')
    expect(verified.manifest.summary).toEqual({
      databaseFiles: Object.values(DbName).length,
      profileFiles: 3,
      records: Object.values(DbName).length * 2,
      oldestRecordAt: '2026-07-01T00:00:00.000Z',
      newestRecordAt: '2026-07-20T00:00:00.000Z'
    })
    expect(verified.manifest.files).toHaveLength(12)
    expect(
      (await verifyLocalAccountBackup(verified.directory)).manifest
    ).toEqual(verified.manifest)
  })

  it('detects content corruption using the manifest hash', async () => {
    const verified = await createVerifiedLocalAccountBackup(options())
    fs.appendFileSync(
      path.join(verified.directory, 'data', `${DbName.port}.db`),
      ' '
    )

    await expect(
      verifyLocalAccountBackup(verified.directory)
    ).rejects.toThrow(/size mismatch|hash mismatch/)
  })

  it('rejects paths outside the fixed backup allowlist', async () => {
    const verified = await createVerifiedLocalAccountBackup(options())
    const manifestPath = path.join(verified.directory, 'manifest.json')
    const manifest = JSON.parse(
      fs.readFileSync(manifestPath, 'utf8')
    ) as AccountBackupManifest
    const unsafeManifest = {
      ...manifest,
      files: manifest.files.map((file, index) =>
        index === 0 ? { ...file, path: '../outside.db' } : file
      )
    }

    expect(() =>
      parseAccountBackupManifest(JSON.stringify(unsafeManifest))
    ).toThrow('invalid account backup file path')
  })

  it('rejects destinations inside application data', async () => {
    const unsafeDestination = path.join(appDataRoot, 'backups')
    fs.mkdirSync(unsafeDestination)

    await expect(
      createVerifiedLocalAccountBackup(
        options({ destinationRoot: unsafeDestination })
      )
    ).rejects.toThrow(
      'account backup destination cannot be inside application data'
    )
    expect(fs.readdirSync(unsafeDestination)).toEqual([])
  })

  it('cleans its partial directory when self-verification fails', async () => {
    fs.writeFileSync(
      path.join(sourceDirectory, `${DbName.quest}.db`),
      '{not-json}\n',
      'utf8'
    )

    await expect(
      createVerifiedLocalAccountBackup(options())
    ).rejects.toThrow('account backup database line is not valid JSON')
    expect(fs.readdirSync(destinationRoot)).toEqual([])
  })

  it('refuses to overwrite an existing bundle directory', async () => {
    const bundleDirectory = path.join(
      destinationRoot,
      'koubrowser-backup-20260730T123456000Z-11111111-1111-4111-8111-111111111111'
    )
    fs.mkdirSync(bundleDirectory)

    await expect(
      createVerifiedLocalAccountBackup(options())
    ).rejects.toThrow('account backup bundle already exists')
    expect(fs.readdirSync(bundleDirectory)).toEqual([])
  })

  it('publishes concurrent device bundles without overwriting either one', async () => {
    const secondBundleId = '33333333-3333-4333-8333-333333333333'
    const secondSourceDeviceId = '44444444-4444-4444-8444-444444444444'

    const [first, second] = await Promise.all([
      createVerifiedLocalAccountBackup(options()),
      createVerifiedLocalAccountBackup(options({
        bundleId: secondBundleId,
        sourceDeviceId: secondSourceDeviceId
      }))
    ])

    expect(first.directory).not.toBe(second.directory)
    expect(fs.readdirSync(destinationRoot).sort()).toEqual([
      'koubrowser-backup-20260730T123456000Z-11111111-1111-4111-8111-111111111111',
      'koubrowser-backup-20260730T123456000Z-33333333-3333-4333-8333-333333333333'
    ])
    await expect(
      verifyLocalAccountBackup(first.directory)
    ).resolves.toEqual(first)
    await expect(
      verifyLocalAccountBackup(second.directory)
    ).resolves.toEqual(second)
  })
})

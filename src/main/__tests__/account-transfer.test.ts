import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DbName } from '@common/record'
import {
  createVerifiedLocalAccountBackup,
  verifyLocalAccountBackup,
  type CreateLocalAccountBackupOptions,
  type VerifiedAccountBackup
} from '@main/account-backup'
import {
  createEncryptedAccountTransfer,
  decryptAccountTransferToDirectory,
  inspectEncryptedAccountTransfer
} from '@main/account-transfer'
import type { DatabaseSnapshotInfo } from '@main/worker/msg'

const BundleId = '11111111-1111-4111-8111-111111111111'
const SourceDeviceId = '22222222-2222-4222-8222-222222222222'
const CreatedAt = new Date('2026-07-30T12:34:56.000Z')
const Account = { serverId: 3, memberId: '12345678' } as const
const Passphrase = '航海日誌を守る長い合言葉-2026'

function databaseContent(dbName: string): string {
  return (
    [
      JSON.stringify({
        _id: `${dbName}-1`,
        date: '2026-07-01T00:00:00.000Z',
        privateMarker: `private-${dbName}-record`
      }),
      JSON.stringify({
        _id: `${dbName}-2`,
        date: '2026-07-20T00:00:00.000Z'
      })
    ].join('\n') + '\n'
  )
}

function databaseSnapshots(): DatabaseSnapshotInfo[] {
  return Object.values(DbName).map((dbName) => ({
    dbName,
    recordCount: 2,
    oldestRecordAt: '2026-07-01T00:00:00.000Z',
    newestRecordAt: '2026-07-20T00:00:00.000Z'
  }))
}

describe('encrypted account transfer container', () => {
  let temporaryRoot: string
  let appDataRoot: string
  let sourceDirectory: string
  let backupRoot: string
  let transferRoot: string
  let extractionRoot: string

  beforeEach(() => {
    temporaryRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'koubrowser-account-transfer-test-')
    )
    appDataRoot = path.join(temporaryRoot, 'app-data')
    sourceDirectory = path.join(
      appDataRoot,
      'store',
      `${Account.serverId}_${Account.memberId}`
    )
    backupRoot = path.join(temporaryRoot, 'backups')
    transferRoot = path.join(temporaryRoot, 'transfers')
    extractionRoot = path.join(temporaryRoot, 'extracted')
    fs.mkdirSync(sourceDirectory, { recursive: true })
    fs.mkdirSync(backupRoot)
    fs.mkdirSync(transferRoot)
    fs.mkdirSync(extractionRoot)

    for (const dbName of Object.values(DbName)) {
      fs.writeFileSync(
        path.join(sourceDirectory, `${dbName}.db`),
        databaseContent(dbName),
        'utf8'
      )
    }
    fs.writeFileSync(
      path.join(sourceDirectory, 'app.json'),
      JSON.stringify({ theme: 'dark', privateMarker: 'private-app-profile' }),
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

  async function createBackup(
    snapshots: DatabaseSnapshotInfo[] = databaseSnapshots()
  ): Promise<VerifiedAccountBackup> {
    const options: CreateLocalAccountBackupOptions = {
      sourceDirectory,
      destinationRoot: backupRoot,
      appDataRoot,
      appVersion: '1.0.5',
      sourceDeviceId: SourceDeviceId,
      account: Account,
      databases: snapshots,
      createdAt: CreatedAt,
      bundleId: BundleId
    }
    return createVerifiedLocalAccountBackup(options)
  }

  it(
    'round-trips a verified bundle without exposing account data in the envelope',
    async () => {
      const backup = await createBackup()
      const transferPath = path.join(
        transferRoot,
        'account.koubrowser-transfer'
      )
      const created = await createEncryptedAccountTransfer(
        backup.directory,
        transferPath,
        Passphrase
      )

      expect(created).toMatchObject({
        filePath: transferPath,
        fileName: 'account.koubrowser-transfer',
        databaseFiles: Object.values(DbName).length,
        profileFiles: 3,
        records: Object.values(DbName).length * 2
      })
      expect(created.bytes).toBeGreaterThan(0)

      const encrypted = fs.readFileSync(transferPath)
      const visibleEnvelope = encrypted.toString('utf8')
      expect(visibleEnvelope).toContain('koubrowser-account-transfer')
      expect(visibleEnvelope).not.toContain(Account.memberId)
      expect(visibleEnvelope).not.toContain(SourceDeviceId)
      expect(visibleEnvelope).not.toContain(BundleId)
      expect(visibleEnvelope).not.toContain('private-port-record')
      expect(visibleEnvelope).not.toContain('private-app-profile')

      await expect(
        inspectEncryptedAccountTransfer(transferPath, Passphrase)
      ).resolves.toEqual({
        bytes: created.bytes,
        databaseFiles: Object.values(DbName).length,
        profileFiles: 3,
        records: Object.values(DbName).length * 2
      })

      const decomposedPassphrase = Passphrase.normalize('NFD')
      const extracted = await decryptAccountTransferToDirectory(
        transferPath,
        decomposedPassphrase,
        extractionRoot
      )
      expect(extracted.manifest).toEqual(backup.manifest)
      await expect(
        verifyLocalAccountBackup(extracted.directory)
      ).resolves.toEqual(extracted)

      await expect(
        createEncryptedAccountTransfer(
          backup.directory,
          transferPath,
          Passphrase
        )
      ).rejects.toThrow('encrypted account transfer already exists')
    },
    30_000
  )

  it(
    'rejects an incorrect passphrase and one-byte corruption without publishing plaintext',
    async () => {
      const backup = await createBackup()
      const transferPath = path.join(
        transferRoot,
        'account.koubrowser-transfer'
      )
      await createEncryptedAccountTransfer(
        backup.directory,
        transferPath,
        Passphrase
      )

      await expect(
        decryptAccountTransferToDirectory(
          transferPath,
          'これは間違っている十分長い合言葉です',
          extractionRoot
        )
      ).rejects.toThrow(
        'the passphrase is incorrect or the file is damaged'
      )
      expect(fs.readdirSync(extractionRoot)).toEqual([])

      const damagedPath = path.join(
        transferRoot,
        'damaged.koubrowser-transfer'
      )
      const damaged = fs.readFileSync(transferPath)
      damaged[Math.floor(damaged.byteLength / 2)] ^= 0x01
      fs.writeFileSync(damagedPath, damaged)

      await expect(
        decryptAccountTransferToDirectory(
          damagedPath,
          Passphrase,
          extractionRoot
        )
      ).rejects.toThrow(
        'the passphrase is incorrect or the file is damaged'
      )
      expect(fs.readdirSync(extractionRoot)).toEqual([])
    },
    30_000
  )

  it('rejects short passphrases before creating a transfer file', async () => {
    const backup = await createBackup()
    const transferPath = path.join(
      transferRoot,
      'account.koubrowser-transfer'
    )

    await expect(
      createEncryptedAccountTransfer(
        backup.directory,
        transferPath,
        'too-short'
      )
    ).rejects.toThrow('at least 12 characters')
    expect(fs.readdirSync(transferRoot)).toEqual([])
  })

  it(
    'preserves trailing empty database files in the encrypted payload',
    async () => {
      for (const dbName of Object.values(DbName)) {
        fs.writeFileSync(path.join(sourceDirectory, `${dbName}.db`), '')
      }
      fs.rmSync(path.join(sourceDirectory, 'app.json'))
      fs.rmSync(path.join(sourceDirectory, 'airbase_spots.json'))
      fs.rmSync(path.join(sourceDirectory, 'inherit_score.json'))
      const emptySnapshots = Object.values(DbName).map((dbName) => ({
        dbName,
        recordCount: 0,
        oldestRecordAt: null,
        newestRecordAt: null
      }))
      const backup = await createBackup(emptySnapshots)
      const transferPath = path.join(
        transferRoot,
        'empty.koubrowser-transfer'
      )

      await createEncryptedAccountTransfer(
        backup.directory,
        transferPath,
        Passphrase
      )
      const extracted = await decryptAccountTransferToDirectory(
        transferPath,
        Passphrase,
        extractionRoot
      )

      expect(extracted.manifest.summary.records).toBe(0)
      for (const dbName of Object.values(DbName)) {
        expect(
          fs.statSync(
            path.join(extracted.directory, 'data', `${dbName}.db`)
          ).size
        ).toBe(0)
      }
    },
    30_000
  )
})

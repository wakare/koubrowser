import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DbName } from '@common/record'
import {
  compareAccountAuditSnapshots,
  createAccountAuditSnapshot,
  loadAccountAuditBaseline,
  parseAccountAuditSnapshot,
  saveAccountAuditBaseline,
  toLocalAccountAuditSummary
} from '@main/account-restore-audit'
import type { DatabaseAuditInfo } from '@main/worker/msg'

const Account = { serverId: 3, memberId: '12345678' } as const

function databases(): DatabaseAuditInfo[] {
  return Object.values(DbName).map((dbName, index) => ({
    dbName,
    recordCount: index + 1,
    oldestRecordAt: '2026-07-30T00:00:00.000Z',
    newestRecordAt: '2026-07-30T01:00:00.000Z',
    semanticSha256: String(index).padStart(64, '0')
  }))
}

describe('account restore audit', () => {
  let temporaryRoot: string
  let appDataRoot: string
  let accountDirectory: string

  beforeEach(() => {
    temporaryRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'koubrowser-account-audit-')
    )
    appDataRoot = path.join(temporaryRoot, 'app-data')
    accountDirectory = path.join(appDataRoot, 'store', '3_12345678')
    fs.mkdirSync(accountDirectory, { recursive: true })
    fs.writeFileSync(
      path.join(accountDirectory, 'app.json'),
      JSON.stringify({ setting: true }),
      'utf8'
    )
  })

  afterEach(() => {
    fs.rmSync(temporaryRoot, { recursive: true, force: true })
  })

  it('creates, stores, and reloads a redacted semantic baseline', async () => {
    const snapshot = await createAccountAuditSnapshot(
      accountDirectory,
      Account,
      databases(),
      new Date('2026-07-30T12:34:56.000Z')
    )
    await saveAccountAuditBaseline(appDataRoot, snapshot)

    await expect(
      loadAccountAuditBaseline(appDataRoot)
    ).resolves.toEqual(snapshot)
    expect(toLocalAccountAuditSummary(snapshot)).toEqual({
      capturedAt: '2026-07-30T12:34:56.000Z',
      databases: expect.arrayContaining([
        expect.objectContaining({ dbName: DbName.quest })
      ]),
      profileFiles: 1,
      records: 45
    })
    const text = fs.readFileSync(
      path.join(appDataRoot, 'account-restore-audit-baseline.json'),
      'utf8'
    )
    expect(text).not.toContain(accountDirectory)
    expect(text).not.toContain(Account.memberId)
    expect(text).not.toContain('setting')
  })

  it('reports exact matches and only redacted changed categories', async () => {
    const baseline = await createAccountAuditSnapshot(
      accountDirectory,
      Account,
      databases(),
      new Date('2026-07-30T12:34:56.000Z')
    )
    const same = await createAccountAuditSnapshot(
      accountDirectory,
      Account,
      [...databases()].reverse(),
      new Date('2026-07-31T12:34:56.000Z')
    )
    expect(compareAccountAuditSnapshots(baseline, same)).toMatchObject({
      status: 'match'
    })

    const changedDatabases = databases().map((database) =>
      database.dbName === DbName.quest
        ? { ...database, recordCount: database.recordCount + 1 }
        : database
    )
    fs.writeFileSync(
      path.join(accountDirectory, 'app.json'),
      JSON.stringify({ setting: false }),
      'utf8'
    )
    const changed = await createAccountAuditSnapshot(
      accountDirectory,
      Account,
      changedDatabases
    )
    expect(compareAccountAuditSnapshots(baseline, changed)).toMatchObject({
      status: 'different',
      changedDatabases: [DbName.quest],
      changedProfiles: ['app.json']
    })
  })

  it('does not compare a baseline belonging to another account', async () => {
    const baseline = await createAccountAuditSnapshot(
      accountDirectory,
      Account,
      databases(),
      new Date('2026-07-30T12:34:56.000Z')
    )
    const current = await createAccountAuditSnapshot(
      accountDirectory,
      { serverId: 3, memberId: '99999999' },
      databases()
    )
    expect(compareAccountAuditSnapshots(baseline, current)).toEqual({
      status: 'different-account',
      capturedAt: '2026-07-30T12:34:56.000Z'
    })
  })

  it('strictly rejects unsupported baseline fields', async () => {
    const snapshot = await createAccountAuditSnapshot(
      accountDirectory,
      Account,
      databases()
    )
    const value = JSON.parse(JSON.stringify(snapshot))
    value.unexpected = true
    expect(() => parseAccountAuditSnapshot(JSON.stringify(value))).toThrow(
      'unsupported fields'
    )
  })

  it('atomically replaces an older saved baseline', async () => {
    const first = await createAccountAuditSnapshot(
      accountDirectory,
      Account,
      databases(),
      new Date('2026-07-30T12:34:56.000Z')
    )
    const second = await createAccountAuditSnapshot(
      accountDirectory,
      Account,
      databases(),
      new Date('2026-07-31T12:34:56.000Z')
    )

    await saveAccountAuditBaseline(appDataRoot, first)
    await saveAccountAuditBaseline(appDataRoot, second)

    await expect(loadAccountAuditBaseline(appDataRoot)).resolves.toEqual(
      second
    )
    await expect(
      fs.promises.readdir(appDataRoot)
    ).resolves.not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('.partial')
      ])
    )
  })
})

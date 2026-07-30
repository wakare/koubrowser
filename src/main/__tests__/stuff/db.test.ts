import { afterEach, describe, expect, it, vi } from 'vitest'
import { DbStuff } from '@main/stuff/db'
import NeDB from 'nedb'
import path from 'node:path'
import * as fs from 'node:fs'
import { fileURLToPath } from 'url'
import { DbName } from '@common/record'
import { fail } from 'node:assert'
import util from 'node:util'
import os from 'node:os'
import { createHash } from 'node:crypto'
const folderPath = path.dirname(fileURLToPath(import.meta.url))

function callLoad(
  dbStuff: DbStuff,
  dbName: DbName,
  userDir: string = folderPath
): Promise<any> {
  return callLoadMany(dbStuff, [dbName], userDir)
}

function callLoadMany(
  dbStuff: DbStuff,
  dbNames: DbName[],
  userDir: string = folderPath
): Promise<any> {
  return new Promise((resolve) => {
    dbStuff.load(userDir, dbNames, (results) => {
      console.log('DbStuff.load callback results:', results)
      resolve(results)
    })
  })
}

describe('DbStuff tests', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  //console.log(folderPath) 

  it('installs NeDB util compatibility', () => {
    expect(util.isArray([])).toBe(true)
    expect(util.isDate(new Date())).toBe(true)
    expect(util.isRegExp(/quest/)).toBe(true)
  })

  it('load method', async () => {

    if(1) {
      const dbStuff = DbStuff.create();
      const results = await callLoad(dbStuff, DbName.quest)
      expect(results[0].err).toBeNull();
    }

    if(1) {
      // Make the file read-only for owner/group/others
      const target = path.join(folderPath, 'battle.db');
      await fs.promises.chmod(target, 0o444);

      try {
        const dbStuff = DbStuff.create();
        const results = await callLoad(dbStuff, DbName.battle)
        expect(results[0].err).not.toBeNull();
        await expect(
          dbStuff.query({ dbName: DbName.battle, find: {} })
        ).rejects.toThrow('DB not found')
      } finally {
        await fs.promises.chmod(target, 0o666);
      }
    }
  });

  it('completes empty and repeated load requests independently', async () => {
    const dbStuff = DbStuff.create()

    await expect(callLoadMany(dbStuff, [])).resolves.toEqual([])

    const [first, second] = await Promise.all([
      callLoad(dbStuff, DbName.quest),
      callLoadMany(dbStuff, [DbName.quest, DbName.quest])
    ])

    expect(first).toEqual([{ name: DbName.quest, err: null }])
    expect(second).toEqual([{ name: DbName.quest, err: null }])
  })

  it('retries a transient NeDB rename failure while loading', async () => {
    const userDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'koubrowser-load-retry-')
    )
    const originalLoadDatabase = NeDB.prototype.loadDatabase
    const transientError = Object.assign(
      new Error('temporary database rename failure'),
      { code: 'EPERM', syscall: 'rename' }
    )
    const load = vi.spyOn(NeDB.prototype, 'loadDatabase')
    load.mockImplementationOnce(function (
      this: NeDB,
      callback?: (error: Error | null) => void
    ) {
      callback?.(transientError)
    })
    load.mockImplementation(function (
      this: NeDB,
      callback?: (error: Error | null) => void
    ) {
      return originalLoadDatabase.call(this, callback)
    })

    try {
      const dbStuff = DbStuff.create()
      await expect(
        callLoad(dbStuff, DbName.quest, userDir)
      ).resolves.toEqual([{ name: DbName.quest, err: null }])
      expect(load).toHaveBeenCalledTimes(2)
    } finally {
      fs.rmSync(userDir, { recursive: true, force: true })
    }
  })

  it('findOne method', async () => {

    if(1) {
      const dbStuff = DbStuff.create();
      const results = await callLoad(dbStuff, DbName.quest)
      expect(results[0].err).toBeNull();

      if(1) {
        const doc = await dbStuff.queryOne({dbName: DbName.quest, find: { key: 'meta' }});
        console.log(doc)
        expect(doc).not.toBeNull();
      }
      if(1) {
        const doc = await dbStuff.queryOne({dbName: DbName.quest, find: { key: 'meta0' }});
        expect(doc).toBeNull();
      }
      if(1) {
        const doc = await dbStuff.queryOne({dbName: DbName.quest, find: { no: 304 }});
        console.log(doc)
        expect(doc).not.toBeNull();
      }
    }
  });

  it('creates a stable compacted snapshot and reports record counts', async () => {
    const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koubrowser-snapshot-'))
    const dbStuff = DbStuff.create()

    try {
      await expect(
        callLoad(dbStuff, DbName.quest, userDir)
      ).resolves.toEqual([{ name: DbName.quest, err: null }])
      await dbStuff.update({
        dbName: DbName.quest,
        query: { key: 'snapshot-test' },
        updateQuery: { key: 'snapshot-test', inProgress: [101] },
        options: { upsert: true }
      })
      dbStuff.operation({
        dbName: DbName.quest,
        autocompactionInterval: 600000
      })

      await expect(dbStuff.beginSnapshot()).resolves.toEqual([
        {
          dbName: DbName.quest,
          recordCount: 1,
          oldestRecordAt: null,
          newestRecordAt: null
        }
      ])
      expect(
        fs.readFileSync(path.join(userDir, 'quest.db'), 'utf8')
      ).toContain('snapshot-test')
      await expect(dbStuff.beginSnapshot()).rejects.toThrow(
        'Database snapshot already active'
      )

      dbStuff.endSnapshot()
      dbStuff.endSnapshot()
    } finally {
      dbStuff.endSnapshot()
      fs.rmSync(userDir, { recursive: true, force: true })
    }
  })

  it('creates a semantic audit without rewriting the active database', async () => {
    const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koubrowser-audit-'))
    const dbStuff = DbStuff.create()

    try {
      await callLoad(dbStuff, DbName.quest, userDir)
      await dbStuff.update({
        dbName: DbName.quest,
        query: { _id: 'audit-b' },
        updateQuery: {
          _id: 'audit-b',
          nested: { z: 2, a: 1 },
          date: '2026-07-30T01:00:00.000Z'
        },
        options: { upsert: true }
      })
      await dbStuff.update({
        dbName: DbName.quest,
        query: { _id: 'audit-a' },
        updateQuery: {
          date: '2026-07-30T00:00:00.000Z',
          nested: { a: 1, z: 2 },
          _id: 'audit-a'
        },
        options: { upsert: true }
      })
      const filePath = path.join(userDir, 'quest.db')
      const before = fs.readFileSync(filePath)

      const first = dbStuff.auditLoadedDatabases()
      const second = dbStuff.auditLoadedDatabases()

      expect(first).toEqual(second)
      expect(first).toEqual([
        expect.objectContaining({
          dbName: DbName.quest,
          recordCount: 2,
          oldestRecordAt: '2026-07-30T00:00:00.000Z',
          newestRecordAt: '2026-07-30T01:00:00.000Z',
          semanticSha256: expect.stringMatching(/^[0-9a-f]{64}$/)
        })
      ])
      expect(fs.readFileSync(filePath)).toEqual(before)
    } finally {
      fs.rmSync(userDir, { recursive: true, force: true })
    }
  })

  it('audits a closed account directory without rewriting it', async () => {
    const userDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'koubrowser-directory-audit-')
    )
    const writer = DbStuff.create()
    const inspector = DbStuff.create()

    try {
      await callLoad(writer, DbName.quest, userDir)
      await writer.update({
        dbName: DbName.quest,
        query: { _id: 'directory-audit' },
        updateQuery: {
          _id: 'directory-audit',
          date: '2026-07-30T02:00:00.000Z',
          nested: { z: 2, a: 1 }
        },
        options: { upsert: true }
      })
      await writer.beginSnapshot()
      const filePath = path.join(userDir, 'quest.db')
      const before = fs.readFileSync(filePath)

      const audits = await inspector.auditAccountDirectory(
        userDir,
        [DbName.quest]
      )

      expect(audits).toEqual([
        expect.objectContaining({
          dbName: DbName.quest,
          recordCount: 1,
          oldestRecordAt: '2026-07-30T02:00:00.000Z',
          newestRecordAt: '2026-07-30T02:00:00.000Z',
          semanticSha256: expect.stringMatching(/^[0-9a-f]{64}$/)
        })
      ])
      expect(fs.readFileSync(filePath)).toEqual(before)
    } finally {
      writer.endSnapshot()
      fs.rmSync(userDir, { recursive: true, force: true })
    }
  })

  it('previews added, duplicate, conflicting, and current-only records', async () => {
    const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koubrowser-preview-current-'))
    const bundleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koubrowser-preview-bundle-'))
    const dbStuff = DbStuff.create()

    try {
      fs.mkdirSync(path.join(bundleDir, 'data'))
      await callLoad(dbStuff, DbName.quest, userDir)
      for (const record of [
        { _id: 'duplicate', value: 1 },
        { _id: 'conflict', value: 'current' },
        { _id: 'current-only', value: true },
        { _id: 'legacy-current', value: 'legacy' }
      ]) {
        await dbStuff.update({
          dbName: DbName.quest,
          query: { _id: record._id },
          updateQuery: record,
          options: { upsert: true }
        })
      }
      const content = [
        JSON.stringify({ _id: 'duplicate', value: 1 }),
        JSON.stringify({ _id: 'conflict', value: 'backup' }),
        JSON.stringify({ _id: 'add', value: 2 }),
        JSON.stringify({ _id: 'legacy-incoming', value: 'legacy' })
      ].join('\n') + '\n'
      const backupPath = path.join(bundleDir, 'data', 'quest.db')
      fs.writeFileSync(backupPath, content, 'utf8')

      await expect(
        dbStuff.previewBackup(bundleDir, [{
          dbName: DbName.quest,
          path: 'data/quest.db',
          size: Buffer.byteLength(content),
          sha256: createHash('sha256').update(content).digest('hex'),
          recordCount: 4
        }])
      ).rejects.toThrow('requires an active snapshot')

      await dbStuff.beginSnapshot()
      await expect(
        dbStuff.previewBackup(bundleDir, [{
          dbName: DbName.quest,
          path: 'data/quest.db',
          size: Buffer.byteLength(content),
          sha256: createHash('sha256').update(content).digest('hex'),
          recordCount: 4
        }])
      ).resolves.toEqual([{
        dbName: DbName.quest,
        incomingRecords: 4,
        add: 2,
        duplicate: 1,
        legacyDuplicate: 0,
        conflict: 1,
        currentOnly: 2,
        mergePlan: {
          schemaVersion: 1,
          comparisonPolicyVersion: 1,
          conflictPolicyVersion: 1,
          conflictResolution: 'preserve-current-v1',
          mode: 'quest-monotonic-v1',
          sourceSha256: expect.any(String),
          currentStateSha256: expect.any(String),
          incomingStateSha256: expect.any(String),
          decisionSha256: expect.any(String),
          safeAdd: 0,
          skip: 1,
          conflict: 0,
          conflictReasons: [],
          manualReview: 3,
          currentOnly: 2
        }
      }])
    } finally {
      dbStuff.endSnapshot()
      fs.rmSync(userDir, { recursive: true, force: true })
      fs.rmSync(bundleDir, { recursive: true, force: true })
    }
  })

  it('stages only monotonic same-period quest counter progress', async () => {
    const userDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'koubrowser-quest-merge-current-')
    )
    const bundleDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'koubrowser-quest-merge-bundle-')
    )
    const stageDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'koubrowser-quest-merge-stage-')
    )
    const dbStuff = DbStuff.create()
    const apiQuest = {
      api_no: 304,
      api_category: 3,
      api_type: 1,
      api_label_type: 2,
      api_state: 2,
      api_title: '演習任務',
      api_detail: '演習で勝利する',
      api_voice_id: 0,
      api_get_material: [0, 50, 0, 50],
      api_bonus_flag: 1,
      api_progress_flag: 0,
      api_invalid_flag: 0
    }
    const currentQuest = {
      _id: 'quest-current',
      no: 304,
      date: '2026-07-30T10:00:00+09:00',
      dateKey: 'daily-20260730',
      quest: apiQuest,
      state: {
        count: [3, 1],
        countMax: [5, 3]
      }
    }
    const currentOnlyQuest = {
      ...currentQuest,
      _id: 'quest-current-only',
      no: 403,
      quest: {
        ...apiQuest,
        api_no: 403,
        api_title: '遠征任務'
      }
    }
    const currentMeta = {
      _id: 'quest-meta-current',
      key: 'meta',
      inProgress: [304, 403]
    }
    const incoming = [
      {
        ...currentQuest,
        _id: 'quest-incoming',
        date: '2026-07-30T11:00:00+09:00',
        quest: {
          ...apiQuest,
          api_state: 3,
          api_progress_flag: 2
        },
        state: {
          count: [2, 2],
          countMax: [5, 3]
        }
      },
      {
        _id: 'quest-meta-incoming',
        key: 'meta',
        inProgress: [304]
      },
      {
        ...currentQuest,
        _id: 'quest-unmatched',
        no: 999,
        quest: {
          ...apiQuest,
          api_no: 999,
          api_title: '未登録任務'
        }
      }
    ]

    try {
      fs.mkdirSync(path.join(bundleDir, 'data'))
      await callLoad(dbStuff, DbName.quest, userDir)
      for (const record of [
        currentQuest,
        currentOnlyQuest,
        currentMeta
      ]) {
        await dbStuff.update({
          dbName: DbName.quest,
          query: { _id: record._id },
          updateQuery: record,
          options: { upsert: true }
        })
      }
      const content = `${incoming.map((record) =>
        JSON.stringify(record)
      ).join('\n')}\n`
      fs.writeFileSync(
        path.join(bundleDir, 'data', 'quest.db'),
        content,
        'utf8'
      )
      const source = {
        dbName: DbName.quest,
        path: 'data/quest.db',
        size: Buffer.byteLength(content),
        sha256: createHash('sha256').update(content).digest('hex'),
        recordCount: incoming.length
      }

      await dbStuff.beginSnapshot()
      const preview = (
        await dbStuff.previewBackup(bundleDir, [source])
      )[0]
      expect(preview).toMatchObject({
        dbName: DbName.quest,
        incomingRecords: 3,
        add: 1,
        duplicate: 0,
        legacyDuplicate: 0,
        conflict: 2,
        currentOnly: 1,
        mergePlan: {
          mode: 'quest-monotonic-v1',
          safeAdd: 1,
          skip: 0,
          conflict: 0,
          conflictReasons: [],
          manualReview: 2,
          currentOnly: 1
        }
      })

      const staged = await dbStuff.createMergeStage(
        bundleDir,
        stageDir,
        [source],
        [preview]
      )
      expect(staged).toEqual([
        expect.objectContaining({
          dbName: DbName.quest,
          recordCount: 3
        })
      ])
      const stagedRecords = fs.readFileSync(
        path.join(stageDir, 'quest.db'),
        'utf8'
      ).trim().split(/\r?\n/u).map((line) => JSON.parse(line))
      expect(
        stagedRecords.find((record) => record._id === 'quest-current')
      ).toMatchObject({
        date: currentQuest.date,
        quest: {
          api_state: 2,
          api_progress_flag: 0
        },
        state: {
          count: [3, 2],
          countMax: [5, 3]
        }
      })
      expect(
        stagedRecords.find((record) => record._id === 'quest-meta-current')
      ).toEqual(currentMeta)
      expect(
        stagedRecords.some((record) => record.no === 999)
      ).toBe(false)
      await expect(
        dbStuff.query({ dbName: DbName.quest, find: { no: 304 } })
      ).resolves.toEqual([currentQuest])
    } finally {
      dbStuff.endSnapshot()
      fs.rmSync(userDir, { recursive: true, force: true })
      fs.rmSync(bundleDir, { recursive: true, force: true })
      fs.rmSync(stageDir, { recursive: true, force: true })
    }
  })

  it('counts legacy duplicate content in append-only databases with multiplicity', async () => {
    const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koubrowser-preview-legacy-current-'))
    const bundleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koubrowser-preview-legacy-bundle-'))
    const dbStuff = DbStuff.create()

    try {
      fs.mkdirSync(path.join(bundleDir, 'data'))
      await callLoad(dbStuff, DbName.drop, userDir)
      for (const record of [
        { _id: 'exact', value: 'same' },
        {
          _id: 'legacy-current-a',
          value: 'legacy',
          nested: { second: 2, first: 1 }
        },
        {
          _id: 'legacy-current-b',
          value: 'legacy',
          nested: { second: 2, first: 1 }
        },
        { _id: 'current-only', value: 'current' }
      ]) {
        await dbStuff.update({
          dbName: DbName.drop,
          query: { _id: record._id },
          updateQuery: record,
          options: { upsert: true }
        })
      }
      const content = [
        JSON.stringify({ _id: 'exact', value: 'same' }),
        JSON.stringify({
          nested: { first: 1, second: 2 },
          value: 'legacy',
          _id: 'legacy-incoming-a'
        }),
        JSON.stringify({
          _id: 'legacy-incoming-b',
          nested: { first: 1, second: 2 },
          value: 'legacy'
        }),
        JSON.stringify({
          value: 'legacy',
          _id: 'legacy-incoming-c',
          nested: { first: 1, second: 2 }
        })
      ].join('\n') + '\n'
      const backupPath = path.join(bundleDir, 'data', 'drop.db')
      fs.writeFileSync(backupPath, content, 'utf8')

      await dbStuff.beginSnapshot()
      await expect(
        dbStuff.previewBackup(bundleDir, [{
          dbName: DbName.drop,
          path: 'data/drop.db',
          size: Buffer.byteLength(content),
          sha256: createHash('sha256').update(content).digest('hex'),
          recordCount: 4
        }])
      ).resolves.toEqual([{
        dbName: DbName.drop,
        incomingRecords: 4,
        add: 1,
        duplicate: 1,
        legacyDuplicate: 2,
        conflict: 0,
        currentOnly: 1,
        mergePlan: {
          schemaVersion: 1,
          comparisonPolicyVersion: 1,
          conflictPolicyVersion: 1,
          conflictResolution: 'preserve-current-v1',
          mode: 'append-only-v1',
          sourceSha256: expect.any(String),
          currentStateSha256: expect.any(String),
          incomingStateSha256: expect.any(String),
          decisionSha256: expect.any(String),
          safeAdd: 0,
          skip: 1,
          conflict: 0,
          conflictReasons: [],
          manualReview: 3,
          currentOnly: 1
        }
      }])
    } finally {
      dbStuff.endSnapshot()
      fs.rmSync(userDir, { recursive: true, force: true })
      fs.rmSync(bundleDir, { recursive: true, force: true })
    }
  })

  it('matches stable record identities before legacy content fingerprints', async () => {
    const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koubrowser-preview-identity-current-'))
    const bundleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koubrowser-preview-identity-bundle-'))
    const dbStuff = DbStuff.create()
    const matchingIdentity = {
      schemaVersion: 1,
      recordId: '11111111-1111-4111-8111-111111111111',
      index: 0
    }
    const conflictingIdentity = {
      schemaVersion: 1,
      recordId: '22222222-2222-4222-8222-222222222222',
      index: 0
    }
    const addedIdentity = {
      schemaVersion: 1,
      recordId: '33333333-3333-4333-8333-333333333333',
      index: 0
    }
    const sameIdIdentity = {
      schemaVersion: 1,
      recordId: '44444444-4444-4444-8444-444444444444',
      index: 0
    }

    try {
      fs.mkdirSync(path.join(bundleDir, 'data'))
      await callLoad(dbStuff, DbName.drop, userDir)
      for (const record of [
        {
          _id: 'identity-match-current',
          value: 'same',
          origin: 'koubrowser/old',
          shipName: '旧表示名',
          recordIdentity: matchingIdentity
        },
        {
          _id: 'identity-conflict-current',
          value: 'current',
          recordIdentity: conflictingIdentity
        },
        {
          _id: 'identity-same-id',
          value: 'same-id',
          origin: 'koubrowser/old',
          questName: '旧任務名',
          recordIdentity: sameIdIdentity
        },
        {
          _id: 'legacy-current',
          value: 'legacy'
        }
      ]) {
        await dbStuff.update({
          dbName: DbName.drop,
          query: { _id: record._id },
          updateQuery: record,
          options: { upsert: true }
        })
      }
      const content = [
        JSON.stringify({
          _id: 'identity-match-incoming',
          value: 'same',
          origin: 'koubrowser/new',
          shipName: '新表示名',
          recordIdentity: matchingIdentity
        }),
        JSON.stringify({
          _id: 'identity-conflict-incoming',
          value: 'backup',
          recordIdentity: conflictingIdentity
        }),
        JSON.stringify({
          _id: 'identity-same-id',
          value: 'same-id',
          origin: 'koubrowser/new',
          questName: '新任務名',
          recordIdentity: sameIdIdentity
        }),
        JSON.stringify({
          _id: 'identity-add',
          value: 'same',
          recordIdentity: addedIdentity
        }),
        JSON.stringify({
          _id: 'legacy-incoming',
          value: 'legacy'
        })
      ].join('\n') + '\n'
      const backupPath = path.join(bundleDir, 'data', 'drop.db')
      fs.writeFileSync(backupPath, content, 'utf8')

      await dbStuff.beginSnapshot()
      await expect(
        dbStuff.previewBackup(bundleDir, [{
          dbName: DbName.drop,
          path: 'data/drop.db',
          size: Buffer.byteLength(content),
          sha256: createHash('sha256').update(content).digest('hex'),
          recordCount: 5
        }])
      ).resolves.toEqual([{
        dbName: DbName.drop,
        incomingRecords: 5,
        add: 1,
        duplicate: 2,
        legacyDuplicate: 1,
        conflict: 1,
        currentOnly: 0,
        mergePlan: {
          schemaVersion: 1,
          comparisonPolicyVersion: 1,
          conflictPolicyVersion: 1,
          conflictResolution: 'preserve-current-v1',
          mode: 'append-only-v1',
          sourceSha256: expect.any(String),
          currentStateSha256: expect.any(String),
          incomingStateSha256: expect.any(String),
          decisionSha256: expect.any(String),
          safeAdd: 1,
          skip: 2,
          conflict: 1,
          conflictReasons: [{ group: 'unknown-field', records: 1 }],
          manualReview: 1,
          currentOnly: 0
        }
      }])
    } finally {
      dbStuff.endSnapshot()
      fs.rmSync(userDir, { recursive: true, force: true })
      fs.rmSync(bundleDir, { recursive: true, force: true })
    }
  })

  it('creates an idempotent order-independent read-only merge plan', async () => {
    const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koubrowser-preview-plan-current-'))
    const bundleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koubrowser-preview-plan-bundle-'))
    const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koubrowser-preview-plan-stage-'))
    const expiredStageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koubrowser-preview-plan-expired-'))
    const dbStuff = DbStuff.create()
    const existingIdentity = {
      schemaVersion: 1,
      recordId: '55555555-5555-4555-8555-555555555555',
      index: 0
    }
    const addedIdentity = {
      schemaVersion: 1,
      recordId: '66666666-6666-4666-8666-666666666666',
      index: 0
    }
    const conflictingIdentity = {
      schemaVersion: 1,
      recordId: '88888888-8888-4888-8888-888888888888',
      index: 0
    }
    const existing = {
      _id: 'plan-current',
      value: 'existing',
      recordIdentity: existingIdentity
    }
    const currentConflict = {
      _id: 'plan-conflict-current',
      value: 'current',
      recordIdentity: conflictingIdentity
    }
    const incoming = [
      {
        _id: 'plan-existing-copy',
        value: 'existing',
        recordIdentity: existingIdentity
      },
      {
        _id: 'plan-safe-add',
        value: 'new',
        recordIdentity: addedIdentity
      },
      {
        _id: 'plan-conflict-incoming',
        value: 'incoming',
        recordIdentity: conflictingIdentity
      }
    ]

    try {
      fs.mkdirSync(path.join(bundleDir, 'data'))
      await callLoad(dbStuff, DbName.drop, userDir)
      await dbStuff.update({
        dbName: DbName.drop,
        query: { _id: existing._id },
        updateQuery: existing,
        options: { upsert: true }
      })
      await dbStuff.update({
        dbName: DbName.drop,
        query: { _id: currentConflict._id },
        updateQuery: currentConflict,
        options: { upsert: true }
      })
      const backupPath = path.join(bundleDir, 'data', 'drop.db')
      const previewContent = async (
        records: readonly Record<string, unknown>[]
      ) => {
        const content = `${records.map((record) =>
          JSON.stringify(record)
        ).join('\n')}\n`
        fs.writeFileSync(backupPath, content, 'utf8')
        return (
          await dbStuff.previewBackup(bundleDir, [{
            dbName: DbName.drop,
            path: 'data/drop.db',
            size: Buffer.byteLength(content),
            sha256: createHash('sha256').update(content).digest('hex'),
            recordCount: records.length
          }])
        )[0]
      }

      await dbStuff.beginSnapshot()
      const first = await previewContent(incoming)
      const repeated = await previewContent(incoming)
      const reordered = await previewContent([...incoming].reverse())

      expect(repeated).toEqual(first)
      expect(first.mergePlan).toMatchObject({
        mode: 'append-only-v1',
        safeAdd: 1,
        skip: 1,
        conflict: 1,
        conflictReasons: [{ group: 'unknown-field', records: 1 }],
        manualReview: 0
      })
      expect(reordered.mergePlan.sourceSha256).not.toBe(
        first.mergePlan.sourceSha256
      )
      expect(reordered.mergePlan.currentStateSha256).toBe(
        first.mergePlan.currentStateSha256
      )
      expect(first.mergePlan.currentStateSha256).toBe(
        dbStuff.auditLoadedDatabases()[0].semanticSha256
      )
      expect(reordered.mergePlan.incomingStateSha256).toBe(
        first.mergePlan.incomingStateSha256
      )
      expect(reordered.mergePlan.decisionSha256).toBe(
        first.mergePlan.decisionSha256
      )
      const reorderedContent = `${[...incoming].reverse().map((record) =>
        JSON.stringify(record)
      ).join('\n')}\n`
      const reorderedFile = {
        dbName: DbName.drop,
        path: 'data/drop.db',
        size: Buffer.byteLength(reorderedContent),
        sha256: createHash('sha256').update(reorderedContent).digest('hex'),
        recordCount: incoming.length
      }
      const staged = await dbStuff.createMergeStage(
        bundleDir,
        stageDir,
        [reorderedFile],
        [reordered]
      )
      expect(staged).toEqual([
        expect.objectContaining({
          dbName: DbName.drop,
          filename: 'drop.db',
          recordCount: 3,
          sha256: expect.stringMatching(/^[0-9a-f]{64}$/)
        })
      ])
      const stagedContent = fs.readFileSync(
        path.join(stageDir, 'drop.db'),
        'utf8'
      )
      expect(stagedContent).toContain('plan-current')
      expect(stagedContent).toContain('plan-conflict-current')
      expect(stagedContent).toContain('plan-safe-add')
      expect(stagedContent).not.toContain('plan-existing-copy')
      expect(stagedContent).not.toContain('plan-conflict-incoming')
      await expect(
        dbStuff.query({ dbName: DbName.drop, find: {} })
      ).resolves.toEqual(expect.arrayContaining([
        existing,
        currentConflict
      ]))

      dbStuff.endSnapshot()
      await dbStuff.update({
        dbName: DbName.drop,
        query: { _id: 'changed-after-plan' },
        updateQuery: {
          _id: 'changed-after-plan',
          value: 'new current state',
          recordIdentity: {
            schemaVersion: 1,
            recordId: '77777777-7777-4777-8777-777777777777',
            index: 0
          }
        },
        options: { upsert: true }
      })
      await dbStuff.beginSnapshot()
      await expect(
        dbStuff.createMergeStage(
          bundleDir,
          expiredStageDir,
          [reorderedFile],
          [reordered]
        )
      ).rejects.toThrow('Database merge plan expired: drop')
      expect(fs.readdirSync(expiredStageDir)).toEqual([])
    } finally {
      dbStuff.endSnapshot()
      fs.rmSync(userDir, { recursive: true, force: true })
      fs.rmSync(bundleDir, { recursive: true, force: true })
      fs.rmSync(stageDir, { recursive: true, force: true })
      fs.rmSync(expiredStageDir, { recursive: true, force: true })
    }
  })

  it('produces the same state when independent bundles are merged in either order', async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koubrowser-merge-order-'))
    const baseDir = path.join(rootDir, 'base')
    const bundleDirs = {
      a: path.join(rootDir, 'bundle-a'),
      b: path.join(rootDir, 'bundle-b')
    }
    const baseRecord = {
      _id: 'merge-order-base',
      value: 'base',
      recordIdentity: {
        schemaVersion: 1,
        recordId: '11111111-1111-4111-8111-111111111111',
        index: 0
      }
    }
    const sharedRecord = {
      _id: 'merge-order-shared',
      value: 'shared',
      recordIdentity: {
        schemaVersion: 1,
        recordId: '22222222-2222-4222-8222-222222222222',
        index: 0
      }
    }
    const recordsByBundle = {
      a: [
        sharedRecord,
        {
          _id: 'merge-order-a',
          value: 'a',
          recordIdentity: {
            schemaVersion: 1,
            recordId: '33333333-3333-4333-8333-333333333333',
            index: 0
          }
        }
      ],
      b: [
        sharedRecord,
        {
          _id: 'merge-order-b',
          value: 'b',
          recordIdentity: {
            schemaVersion: 1,
            recordId: '44444444-4444-4444-8444-444444444444',
            index: 0
          }
        }
      ]
    }

    const writeDatabase = (
      directory: string,
      records: readonly Record<string, unknown>[]
    ) => {
      fs.mkdirSync(directory, { recursive: true })
      fs.writeFileSync(
        path.join(directory, `${DbName.drop}.db`),
        `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
        'utf8'
      )
    }
    const writeBundle = (name: keyof typeof recordsByBundle) => {
      const dataDir = path.join(bundleDirs[name], 'data')
      writeDatabase(dataDir, recordsByBundle[name])
    }
    const mergeInOrder = async (
      order: readonly (keyof typeof recordsByBundle)[]
    ) => {
      let currentDir = baseDir

      for (const [index, name] of order.entries()) {
        const dbStuff = DbStuff.create()
        const stageDir = path.join(
          rootDir,
          `stage-${order.join('')}-${index}`
        )
        const content = fs.readFileSync(
          path.join(bundleDirs[name], 'data', `${DbName.drop}.db`),
          'utf8'
        )
        const file = {
          dbName: DbName.drop,
          path: `data/${DbName.drop}.db`,
          size: Buffer.byteLength(content),
          sha256: createHash('sha256').update(content).digest('hex'),
          recordCount: recordsByBundle[name].length
        }

        fs.mkdirSync(stageDir)
        await callLoad(dbStuff, DbName.drop, currentDir)
        await dbStuff.beginSnapshot()
        try {
          const previews = await dbStuff.previewBackup(
            bundleDirs[name],
            [file]
          )
          await dbStuff.createMergeStage(
            bundleDirs[name],
            stageDir,
            [file],
            previews
          )
        } finally {
          dbStuff.endSnapshot()
        }
        currentDir = stageDir
      }

      const finalDbStuff = DbStuff.create()
      await callLoad(finalDbStuff, DbName.drop, currentDir)
      const records = await finalDbStuff.query({
        dbName: DbName.drop,
        find: {}
      })
      return {
        audit: finalDbStuff.auditLoadedDatabases()[0],
        recordIds: records
          .map((record) => record._id)
          .sort()
      }
    }

    try {
      writeDatabase(baseDir, [baseRecord])
      writeBundle('a')
      writeBundle('b')

      const aba = await mergeInOrder(['a', 'b', 'a'])
      const bab = await mergeInOrder(['b', 'a', 'b'])

      expect(aba).toEqual(bab)
      expect(aba.audit).toMatchObject({
        dbName: DbName.drop,
        recordCount: 4,
        semanticSha256: expect.stringMatching(/^[0-9a-f]{64}$/)
      })
      expect(aba.recordIds).toEqual([
        'merge-order-a',
        'merge-order-b',
        'merge-order-base',
        'merge-order-shared'
      ])
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true })
    }
  })

  it('rejects unsupported record identity schemas during preview', async () => {
    const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koubrowser-preview-identity-schema-current-'))
    const bundleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koubrowser-preview-identity-schema-bundle-'))
    const dbStuff = DbStuff.create()

    try {
      fs.mkdirSync(path.join(bundleDir, 'data'))
      await callLoad(dbStuff, DbName.drop, userDir)
      const content = `${JSON.stringify({
        _id: 'unsupported-identity',
        value: 'incoming',
        recordIdentity: {
          schemaVersion: 2,
          recordId: '44444444-4444-4444-8444-444444444444',
          index: 0
        }
      })}\n`
      fs.writeFileSync(path.join(bundleDir, 'data', 'drop.db'), content, 'utf8')

      await dbStuff.beginSnapshot()
      await expect(
        dbStuff.previewBackup(bundleDir, [{
          dbName: DbName.drop,
          path: 'data/drop.db',
          size: Buffer.byteLength(content),
          sha256: createHash('sha256').update(content).digest('hex'),
          recordCount: 1
        }])
      ).rejects.toThrow('Account record identity schema is not supported')
    } finally {
      dbStuff.endSnapshot()
      fs.rmSync(userDir, { recursive: true, force: true })
      fs.rmSync(bundleDir, { recursive: true, force: true })
    }
  })

  it('loads and verifies isolated restore-stage databases', async () => {
    const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koubrowser-stage-current-'))
    const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koubrowser-stage-candidate-'))
    const dbStuff = DbStuff.create()

    try {
      await callLoad(dbStuff, DbName.quest, userDir)
      const content = `${JSON.stringify({
        _id: 'staged-quest',
        value: { nested: true }
      })}\n`
      const filename = `${DbName.quest}.db`
      fs.writeFileSync(path.join(stageDir, filename), content, 'utf8')
      const file = {
        dbName: DbName.quest,
        filename,
        size: Buffer.byteLength(content),
        sha256: createHash('sha256').update(content).digest('hex'),
        recordCount: 1
      }

      await expect(
        dbStuff.validateRestoreStage(stageDir, [file])
      ).resolves.toEqual([DbName.quest])
      await expect(
        dbStuff.inspectAccountDirectory(stageDir, [DbName.quest])
      ).resolves.toEqual([file])

      const corruptedContent = `${content} `
      fs.writeFileSync(
        path.join(stageDir, filename),
        corruptedContent,
        'utf8'
      )
      await expect(
        dbStuff.validateRestoreStage(stageDir, [file])
      ).rejects.toThrow(/changed while being inspected|verification mismatch/)
      expect(
        fs.readFileSync(path.join(stageDir, filename), 'utf8')
      ).toBe(corruptedContent)
    } finally {
      fs.rmSync(userDir, { recursive: true, force: true })
      fs.rmSync(stageDir, { recursive: true, force: true })
    }
  })
});

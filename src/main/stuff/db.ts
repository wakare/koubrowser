import {
  DbName,
  type Query,
  type Insert,
  type Update,
  type Remove,
  type UpdateRes,
  type Operation
} from '@common/record'
import './nedb-compat'
import NeDB from 'nedb'
import path from 'node:path'
import type { DatabaseSnapshotInfo } from '@main/worker/msg'
import type { DatabaseAuditInfo } from '@main/worker/msg'
import type { DatabaseBackupPreviewFile } from '@main/worker/msg'
import type { RestoreStageDatabaseFile } from '@main/worker/msg'
import type { AccountBackupDatabasePreview } from '@common/account-backup'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import readline from 'node:readline'
import { isDeepStrictEqual } from 'node:util'
import os from 'node:os'
import * as NeDbModel from 'nedb/lib/model'
import { accountRecordIdentityKey } from '@main/account-record-identity'
import {
  AccountRecordMergeComparisonPolicyVersion,
  AccountRecordMergeConflictPolicyVersion,
  AccountRecordMergeConflictResolution,
  AccountRecordMergeConflictGroupOrder,
  accountRecordMergeComparableValue,
  accountRecordMergeConflictGroups
} from '@main/account-record-merge-policy'
import type {
  AccountBackupMergeConflictGroup,
  AccountBackupMergeConflictSummary
} from '@common/account-backup'
import {
  AccountQuestMergePolicyVersion,
  accountQuestMergeDecision,
  accountQuestRecordKey
} from '@main/account-quest-merge-policy'

interface NeDbSnapshotPersistence {
  persistCachedDatabase(callback: (err: Error | null) => void): void
}

interface NeDbSnapshotInternals {
  executor: {
    push(task: {
      this: NeDbSnapshotPersistence
      fn: NeDbSnapshotPersistence['persistCachedDatabase']
      arguments: [(err: Error | null) => void]
    }): void
  }
  persistence: NeDB.Persistence & NeDbSnapshotPersistence
}

function canonicalAuditJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Database audit cannot encode a non-finite number')
    }
    return JSON.stringify(value)
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString())
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) =>
      entry === undefined ? 'null' : canonicalAuditJson(entry)
    ).join(',')}]`
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) =>
        `${JSON.stringify(key)}:${canonicalAuditJson(record[key])}`
      )
    return `{${entries.join(',')}}`
  }
  throw new Error(`Database audit cannot encode ${typeof value}`)
}

function auditDatabaseRecords(
  dbName: DbName,
  records: readonly Record<string, unknown>[]
): DatabaseAuditInfo {
  const byId = new Map<string, Record<string, unknown>>()
  let oldestTimestamp = Number.POSITIVE_INFINITY
  let newestTimestamp = Number.NEGATIVE_INFINITY
  for (const record of records) {
    if (typeof record?._id !== 'string' || byId.has(record._id)) {
      throw new Error(`Database audit found an invalid record id: ${dbName}`)
    }
    byId.set(record._id, record)
    if (typeof record.date === 'string') {
      const timestamp = Date.parse(record.date)
      if (Number.isFinite(timestamp)) {
        oldestTimestamp = Math.min(oldestTimestamp, timestamp)
        newestTimestamp = Math.max(newestTimestamp, timestamp)
      }
    }
  }
  const hash = createHash('sha256')
  for (const [id, record] of [...byId.entries()].sort(
    ([left], [right]) => left.localeCompare(right)
  )) {
    hash.update(JSON.stringify(id))
    hash.update('\0')
    hash.update(canonicalAuditJson(record))
    hash.update('\n')
  }
  return {
    dbName,
    recordCount: records.length,
    oldestRecordAt:
      Number.isFinite(oldestTimestamp)
        ? new Date(oldestTimestamp).toISOString()
        : null,
    newestRecordAt:
      Number.isFinite(newestTimestamp)
        ? new Date(newestTimestamp).toISOString()
        : null,
    semanticSha256: hash.digest('hex')
  }
}

type LegacyFingerprintMode = 'exact-content-v1' | 'disabled'

const LegacyFingerprintModes = {
  [DbName.port]: 'exact-content-v1',
  [DbName.drop]: 'exact-content-v1',
  [DbName.battle]: 'exact-content-v1',
  [DbName.item]: 'exact-content-v1',
  [DbName.ship]: 'exact-content-v1',
  [DbName.remodel]: 'exact-content-v1',
  [DbName.mission]: 'exact-content-v1',
  [DbName.quest]: 'disabled',
  [DbName.clearitemget]: 'exact-content-v1'
} as const satisfies Record<DbName, LegacyFingerprintMode>

function legacyRecordFingerprint(
  record: Record<string, unknown>
): string {
  return createHash('sha256')
    .update(canonicalAuditJson(recordWithoutNeDbId(record)))
    .digest('hex')
}

function recordWithoutNeDbId(
  record: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== '_id')
  )
}

function semanticRecordSha256(record: Record<string, unknown>): string {
  return createHash('sha256')
    .update(canonicalAuditJson(record))
    .digest('hex')
}

function semanticDatabaseSha256(recordHashes: readonly string[]): string {
  return createHash('sha256')
    .update([...recordHashes].sort().join('\n'))
    .digest('hex')
}

function mergePlanDecisionSha256(
  dbName: DbName,
  currentStateSha256: string,
  incomingStateSha256: string,
  decisions: readonly string[]
): string {
  return createHash('sha256')
    .update(canonicalAuditJson({
      schemaVersion: 1,
      comparisonPolicyVersion:
        AccountRecordMergeComparisonPolicyVersion,
      conflictPolicyVersion:
        AccountRecordMergeConflictPolicyVersion,
      conflictResolution:
        AccountRecordMergeConflictResolution,
      dbName,
      currentStateSha256,
      incomingStateSha256,
      decisions: [...decisions].sort()
    }))
    .digest('hex')
}

async function writeNeDbRecords(
  filePath: string,
  records: readonly Record<string, unknown>[]
): Promise<void> {
  const orderedRecords = [...records].sort((left, right) => {
    if (typeof left._id !== 'string' || typeof right._id !== 'string') {
      throw new Error('Database merge stage record id is invalid')
    }
    return left._id < right._id ? -1 : left._id > right._id ? 1 : 0
  })
  const handle = await fs.promises.open(filePath, 'wx', 0o600)
  const batch: string[] = []
  let batchBytes = 0

  const flush = async (): Promise<void> => {
    if (batch.length === 0) {
      return
    }
    const buffer = Buffer.from(`${batch.join('\n')}\n`, 'utf8')
    let offset = 0
    while (offset < buffer.length) {
      const { bytesWritten } = await handle.write(
        buffer,
        offset,
        buffer.length - offset,
        null
      )
      if (bytesWritten <= 0) {
        throw new Error('Database merge stage write made no progress')
      }
      offset += bytesWritten
    }
    batch.length = 0
    batchBytes = 0
  }

  try {
    for (const record of orderedRecords) {
      const serialized = NeDbModel.serialize(record)
      batch.push(serialized)
      batchBytes += Buffer.byteLength(serialized) + 1
      if (batchBytes >= 1024 * 1024) {
        await flush()
      }
    }
    await flush()
    await handle.sync()
  } finally {
    await handle.close()
  }
}

/**
 * 
 */
export interface LoadResult {
  name: DbName
  err: Error | null | undefined

}

const NeDbLoadAttempts = 5
const NeDbLoadRetryDelayMs = 100

function isTransientNeDbRenameError(error: Error): boolean {
  const fileError = error as NodeJS.ErrnoException
  return (
    fileError.syscall === 'rename' &&
    (
      fileError.code === 'EPERM' ||
      fileError.code === 'EACCES' ||
      fileError.code === 'EBUSY'
    )
  )
}

/**
 * 
 */
export class DbStuff {
  private dbs: Map<DbName, NeDB> = new Map()
  private loading: Map<DbName, Promise<LoadResult>> = new Map()
  private autocompactionIntervals: Map<DbName, number> = new Map()
  private snapshotActive = false
  private uniqueCounter = 0

  /**
   * 
   * @param userDir 
   * @param dbs 
   * @returns 
   */
  static create(): DbStuff {
    return new DbStuff()
  }

  /**
   * 
   * @param userDir 
   * @param dbs 
   */
  load(
    userDir: string,
    dbs: DbName[],
    cb: (results: LoadResult[]) => void
  ): void {
    const loadDb = (name: DbName): Promise<LoadResult> => {
      const activeLoad = this.loading.get(name)
      if (activeLoad) {
        return activeLoad
      }

      const loadAttempt = (attempt: number): Promise<LoadResult> =>
        new Promise((resolve) => {
          const db = new NeDB({
            filename: path.join(userDir, name + '.db')
          })
          this.dbs.set(name, db)
          db.loadDatabase((err: Error | null) => {
            if (
              err &&
              attempt < NeDbLoadAttempts &&
              isTransientNeDbRenameError(err)
            ) {
              const delay =
                NeDbLoadRetryDelayMs * 2 ** (attempt - 1)
              console.warn(
                `[worker] retrying ${name} database load after ` +
                  `transient ${String(
                    (err as NodeJS.ErrnoException).code
                  )} rename failure (attempt ${attempt}/` +
                  `${NeDbLoadAttempts})`
              )
              setTimeout(() => {
                void loadAttempt(attempt + 1).then(resolve)
              }, delay)
              return
            }
            if (err) {
              console.error(`[worker] failed to load ${name}:`, err)
              // A later initialization request may retry a failure.
              this.dbs.delete(name)
              this.loading.delete(name)
            } else {
              console.log(`[worker] loaded DB: ${name}`)
            }
            resolve({ name, err })
          })
        })

      const loading = loadAttempt(1)
      this.loading.set(name, loading)
      return loading
    }

    const names = [...new Set(dbs)]
    void Promise.all(names.map(loadDb)).then(cb)
  }

  /**
   * 
   * @param dbName 
   * @param doc 
   * @returns 
   */
  insert(doc: Insert): Promise<any> {
    const db = this.dbs.get(doc.dbName)
    return new Promise((resolve, reject) => {
      if (! db) {
        return reject(new Error('DB not found: ' + doc.dbName))
      }
      db.insert(doc.record, (err: Error | null, newDoc: any) => {
        if (err) {
          return reject(err)
        } else {
          resolve(newDoc)
        }
      })
    })
  }
  
  /**
   * 
   * @param query
   * @returns 
   */
  query(query: Query): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const db = this.dbs.get(query.dbName)
      if (! db) {
        return reject(new Error('DB not found: ' + query.dbName))
      }

      const find = db.find(query.find ?? {}, query.projection as any)
      if (query.limit) {
        find.limit(query.limit)
      }
      if (query.sort) {
        find.sort(query.sort)
      }
      const counter = this.uniqueCounter++
      console.time('handle query ' + query.dbName + ' #' + counter)
      find.exec((err, docs: any[]): void => {
        console.timeEnd('handle query ' + query.dbName + ' #' + counter)
        if (err) {
          reject(err)
        } else {
          console.log('found docs:', query.dbName, 'count:', docs.length)
          resolve(docs)
        }
      })
    })
  }

  /**
   * 
   * @param query
   * @returns 
   */
  queryOne(query: Query): Promise<any> {
    const db = this.dbs.get(query.dbName)
    return new Promise((resolve, reject) => {
      if (! db) {
        return reject(new Error('DB not found: ' + query.dbName))
      }
      const counter = this.uniqueCounter++
      console.time('handle query one ' + query.dbName + ' #' + counter)
      //db.findOne(query.find_param ?? {}, query.projection as any, (err, doc: any): void => {
      db.findOne(query.find ?? {}, (err, doc: any): void => {
        console.timeEnd('handle query one ' + query.dbName + ' #' + counter)
        console.log('found docs:', query.dbName, 'ok:', !!doc)
        if (err) {
          reject(err)
        } else {
          resolve(doc)
        }
      })
    })
  }

  /**
   * 
   * @param update 
   * @returns 
   */
  update(update: Update): Promise<UpdateRes> {
    const db = this.dbs.get(update.dbName)
    return new Promise((resolve, reject) => {
      if (! db) {
        return reject(new Error('DB not found: ' + update.dbName))
      }

      db.update(update.query, update.updateQuery, update.options, (err, num, affectedDocs, upsert) => {
          if (err) {
            reject(err)
          } else {
            resolve({ num, affectedDocs, upsert })
          }
        }
      )
    })
  }

  /**
   * 
   * @param remove 
   * @returns 
   */
  remove(remove: Remove): Promise<number> {
    const db = this.dbs.get(remove.dbName)
    return new Promise((resolve, reject) => {
      if (! db) {
        return reject(new Error('DB not found: ' + remove.dbName))
      }

      db.remove(remove.remove_param, (err, numRemoved) => {
        if (err) {
          reject(err)
        } else {
          resolve(numRemoved)
        }
      })
    })
  }

  /**
   * Stop background compaction and enqueue one crash-safe rewrite after every
   * pending operation in each NeDB executor. The caller must keep new mutation
   * requests paused until endSnapshot is called.
   */
  async beginSnapshot(): Promise<DatabaseSnapshotInfo[]> {
    if (this.snapshotActive) {
      throw new Error('Database snapshot already active')
    }
    this.snapshotActive = true

    for (const db of this.dbs.values()) {
      db.persistence.stopAutocompaction()
    }

    const compacted = await Promise.allSettled(
      [...this.dbs.entries()].map(([dbName, db]) =>
        this.compactForSnapshot(dbName, db)
      )
    )
    const rejected = compacted.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    )
    if (rejected) {
      throw rejected.reason
    }
    return compacted.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : []
    )
  }

  /**
   * Restore the compaction schedules that were active before the snapshot.
   */
  endSnapshot(): void {
    if (!this.snapshotActive) {
      return
    }
    this.snapshotActive = false

    for (const [dbName, interval] of this.autocompactionIntervals) {
      this.dbs.get(dbName)?.persistence.setAutocompactionInterval(interval)
    }
  }

  auditLoadedDatabases(): DatabaseAuditInfo[] {
    const audits = [...this.dbs].map(([dbName, db]) =>
      auditDatabaseRecords(dbName, db.getAllData())
    )
    return audits.sort((left, right) =>
      left.dbName.localeCompare(right.dbName)
    )
  }

  async auditAccountDirectory(
    accountDirectory: string,
    dbNames: readonly DbName[]
  ): Promise<DatabaseAuditInfo[]> {
    const directoryStats = await fs.promises.lstat(accountDirectory)
    if (directoryStats.isSymbolicLink() || !directoryStats.isDirectory()) {
      throw new Error('Account audit path must be a real directory')
    }
    const realDirectory = await fs.promises.realpath(accountDirectory)
    const names = [...new Set(dbNames)]
    if (names.length !== dbNames.length) {
      throw new Error('Account database audit contains duplicate names')
    }
    const audits: DatabaseAuditInfo[] = []
    for (const dbName of names) {
      audits.push(
        await this.auditAccountDatabase(realDirectory, dbName)
      )
    }
    return audits.sort((left, right) =>
      left.dbName.localeCompare(right.dbName)
    )
  }

  private async auditAccountDatabase(
    accountDirectory: string,
    dbName: DbName
  ): Promise<DatabaseAuditInfo> {
    const filename = `${dbName}.db`
    const filePath = path.join(accountDirectory, filename)
    const stats = await fs.promises.lstat(filePath)
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(`Account database is not a regular file: ${dbName}`)
    }

    const temporaryDirectory = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'koubrowser-db-audit-')
    )
    const validationPath = path.join(temporaryDirectory, filename)
    try {
      await fs.promises.copyFile(
        filePath,
        validationPath,
        fs.constants.COPYFILE_EXCL
      )
      const staged = new NeDB({ filename: validationPath })
      await new Promise<void>((resolve, reject) => {
        staged.loadDatabase((error: Error | null) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })
      })
      const sourceHash = await this.hashAccountDatabaseFile(filePath)
      const validationHash =
        await this.hashAccountDatabaseFile(validationPath)
      if (
        sourceHash.size !== stats.size ||
        sourceHash.size !== validationHash.size ||
        sourceHash.sha256 !== validationHash.sha256
      ) {
        throw new Error(
          `Account database changed while being audited: ${dbName}`
        )
      }
      return auditDatabaseRecords(dbName, staged.getAllData())
    } finally {
      await fs.promises.rm(temporaryDirectory, {
        recursive: true,
        force: true
      })
    }
  }

  async previewBackup(
    bundleDirectory: string,
    files: readonly DatabaseBackupPreviewFile[]
  ): Promise<AccountBackupDatabasePreview[]> {
    if (!this.snapshotActive) {
      throw new Error('Database backup preview requires an active snapshot')
    }
    const directoryStats = await fs.promises.lstat(bundleDirectory)
    if (directoryStats.isSymbolicLink() || !directoryStats.isDirectory()) {
      throw new Error('Backup preview directory must be a real directory')
    }
    const realDirectory = await fs.promises.realpath(bundleDirectory)
    const expectedFiles = new Map<DbName, DatabaseBackupPreviewFile>()
    for (const file of files) {
      if (expectedFiles.has(file.dbName)) {
        throw new Error(`Duplicate backup preview database: ${file.dbName}`)
      }
      if (file.path !== `data/${file.dbName}.db`) {
        throw new Error(`Invalid backup preview path: ${file.dbName}`)
      }
      expectedFiles.set(file.dbName, file)
    }

    const previews: AccountBackupDatabasePreview[] = []
    for (const [dbName, db] of this.dbs) {
      const expected = expectedFiles.get(dbName)
      if (!expected) {
        throw new Error(`Missing backup preview database: ${dbName}`)
      }
      previews.push(
        await this.previewBackupDatabase(realDirectory, dbName, db, expected)
      )
    }
    return previews
  }

  async createMergeStage(
    bundleDirectory: string,
    stageDirectory: string,
    files: readonly DatabaseBackupPreviewFile[],
    expectedPreviews: readonly AccountBackupDatabasePreview[]
  ): Promise<RestoreStageDatabaseFile[]> {
    if (!this.snapshotActive) {
      throw new Error('Database merge stage requires an active snapshot')
    }
    const bundleStats = await fs.promises.lstat(bundleDirectory)
    if (bundleStats.isSymbolicLink() || !bundleStats.isDirectory()) {
      throw new Error('Database merge source must be a real directory')
    }
    const stageStats = await fs.promises.lstat(stageDirectory)
    if (stageStats.isSymbolicLink() || !stageStats.isDirectory()) {
      throw new Error('Database merge stage must be a real directory')
    }
    const realBundleDirectory = await fs.promises.realpath(bundleDirectory)
    const realStageDirectory = await fs.promises.realpath(stageDirectory)
    if (
      path.relative(realBundleDirectory, realStageDirectory) === '' ||
      (
        process.platform === 'win32' &&
        realBundleDirectory.toLocaleLowerCase('en-US') ===
          realStageDirectory.toLocaleLowerCase('en-US')
      )
    ) {
      throw new Error('Database merge source and stage must be different')
    }

    const expectedFiles = new Map<DbName, DatabaseBackupPreviewFile>()
    for (const file of files) {
      if (expectedFiles.has(file.dbName)) {
        throw new Error(`Duplicate database merge source: ${file.dbName}`)
      }
      if (file.path !== `data/${file.dbName}.db`) {
        throw new Error(`Invalid database merge source path: ${file.dbName}`)
      }
      expectedFiles.set(file.dbName, file)
    }
    const previewsByName = new Map<DbName, AccountBackupDatabasePreview>()
    for (const preview of expectedPreviews) {
      if (previewsByName.has(preview.dbName)) {
        throw new Error(`Duplicate expected database merge plan: ${preview.dbName}`)
      }
      previewsByName.set(preview.dbName, preview)
    }

    const staged: RestoreStageDatabaseFile[] = []
    for (const [dbName, db] of this.dbs) {
      const expectedFile = expectedFiles.get(dbName)
      const expectedPreview = previewsByName.get(dbName)
      if (!expectedFile || !expectedPreview) {
        throw new Error(`Missing expected database merge plan: ${dbName}`)
      }
      const safeRecords: Record<string, unknown>[] = []
      const actualPreview = await this.previewBackupDatabase(
        realBundleDirectory,
        dbName,
        db,
        expectedFile,
        safeRecords
      )
      if (!isDeepStrictEqual(actualPreview, expectedPreview)) {
        throw new Error(`Database merge plan expired: ${dbName}`)
      }

      const destination = path.join(
        realStageDirectory,
        `${dbName}.db`
      )
      const replacementIds = new Set<string>()
      for (const record of safeRecords) {
        if (
          typeof record._id !== 'string' ||
          replacementIds.has(record._id)
        ) {
          throw new Error(
            `Database merge stage has an invalid safe record: ${dbName}`
          )
        }
        replacementIds.add(record._id)
      }
      const currentRecords = db.getAllData()
      const currentIds = new Set(
        currentRecords.map((record) => record._id as string)
      )
      const stagedRecords = [
        ...currentRecords.filter(
          (record) => !replacementIds.has(record._id)
        ),
        ...safeRecords
      ]
      await writeNeDbRecords(
        destination,
        stagedRecords
      )
      const inspected = await this.inspectAccountDatabase(
        realStageDirectory,
        dbName
      )
      const addedRecords = [...replacementIds].filter(
        (id) => !currentIds.has(id)
      ).length
      if (
        inspected.recordCount !== currentRecords.length + addedRecords
      ) {
        throw new Error(`Database merge stage record count mismatch: ${dbName}`)
      }
      staged.push(inspected)
    }
    return staged.sort((left, right) =>
      left.dbName.localeCompare(right.dbName)
    )
  }

  async validateRestoreStage(
    accountDirectory: string,
    files: readonly RestoreStageDatabaseFile[]
  ): Promise<DbName[]> {
    const directoryStats = await fs.promises.lstat(accountDirectory)
    if (directoryStats.isSymbolicLink() || !directoryStats.isDirectory()) {
      throw new Error('Restore stage account path must be a real directory')
    }
    const realDirectory = await fs.promises.realpath(accountDirectory)
    const expectedFiles = new Map<DbName, RestoreStageDatabaseFile>()
    for (const file of files) {
      if (expectedFiles.has(file.dbName)) {
        throw new Error(`Duplicate restore stage database: ${file.dbName}`)
      }
      if (file.filename !== `${file.dbName}.db`) {
        throw new Error(`Invalid restore stage filename: ${file.dbName}`)
      }
      expectedFiles.set(file.dbName, file)
    }

    const validated: DbName[] = []
    for (const [dbName, expected] of expectedFiles) {
      const actual = await this.inspectAccountDatabase(realDirectory, dbName)
      if (
        actual.filename !== expected.filename ||
        actual.size !== expected.size ||
        actual.sha256 !== expected.sha256 ||
        actual.recordCount !== expected.recordCount
      ) {
        throw new Error(`Restore stage database verification mismatch: ${dbName}`)
      }
      validated.push(dbName)
    }
    return validated
  }

  async inspectAccountDirectory(
    accountDirectory: string,
    dbNames: readonly DbName[]
  ): Promise<RestoreStageDatabaseFile[]> {
    const directoryStats = await fs.promises.lstat(accountDirectory)
    if (directoryStats.isSymbolicLink() || !directoryStats.isDirectory()) {
      throw new Error('Account path must be a real directory')
    }
    const realDirectory = await fs.promises.realpath(accountDirectory)
    const names = [...new Set(dbNames)]
    if (names.length !== dbNames.length) {
      throw new Error('Account database inspection contains duplicate names')
    }
    const files: RestoreStageDatabaseFile[] = []
    for (const dbName of names) {
      files.push(await this.inspectAccountDatabase(realDirectory, dbName))
    }
    return files
  }

  private async inspectAccountDatabase(
    accountDirectory: string,
    dbName: DbName
  ): Promise<RestoreStageDatabaseFile> {
    const filename = `${dbName}.db`
    const filePath = path.join(accountDirectory, filename)
    const stats = await fs.promises.lstat(filePath)
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(`Account database is not a regular file: ${dbName}`)
    }

    const temporaryDirectory = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'koubrowser-db-validation-')
    )
    const validationPath = path.join(temporaryDirectory, filename)
    try {
      await fs.promises.copyFile(
        filePath,
        validationPath,
        fs.constants.COPYFILE_EXCL
      )
      const staged = new NeDB({ filename: validationPath })
      await new Promise<void>((resolve, reject) => {
        staged.loadDatabase((error: Error | null) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })
      })
      const ids = new Set<string>()
      for (const record of staged.getAllData()) {
        if (typeof record?._id !== 'string' || ids.has(record._id)) {
          throw new Error(`Restore stage database has an invalid record id: ${dbName}`)
        }
        ids.add(record._id)
      }
      const sourceHash = await this.hashAccountDatabaseFile(filePath)
      const validationHash = await this.hashAccountDatabaseFile(validationPath)
      if (
        sourceHash.size !== stats.size ||
        sourceHash.size !== validationHash.size ||
        sourceHash.sha256 !== validationHash.sha256
      ) {
        throw new Error(`Account database changed while being inspected: ${dbName}`)
      }
      return {
        dbName,
        filename,
        size: sourceHash.size,
        sha256: sourceHash.sha256,
        recordCount: ids.size
      }
    } finally {
      await fs.promises.rm(temporaryDirectory, {
        recursive: true,
        force: true
      })
    }
  }

  private async hashAccountDatabaseFile(
    filePath: string
  ): Promise<{ readonly size: number; readonly sha256: string }> {
    const hash = createHash('sha256')
    let size = 0
    for await (const chunk of fs.createReadStream(filePath)) {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += data.byteLength
      hash.update(data)
    }
    return { size, sha256: hash.digest('hex') }
  }

  private async previewBackupDatabase(
    bundleDirectory: string,
    dbName: DbName,
    db: NeDB,
    expected: DatabaseBackupPreviewFile,
    safeMergeRecords?: Record<string, unknown>[]
  ): Promise<AccountBackupDatabasePreview> {
    const filePath = path.join(bundleDirectory, 'data', `${dbName}.db`)
    const stats = await fs.promises.lstat(filePath)
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(`Backup preview database is not a regular file: ${dbName}`)
    }
    if (stats.size !== expected.size) {
      throw new Error(`Backup preview database size mismatch: ${dbName}`)
    }
    if (dbName === DbName.quest) {
      return this.previewQuestBackupDatabase(
        filePath,
        db,
        expected,
        safeMergeRecords
      )
    }

    const useLegacyFingerprints =
      LegacyFingerprintModes[dbName] === 'exact-content-v1'
    const currentRecords = new Map<string, Record<string, unknown>>()
    const currentIdentityRecords = new Map<
      string,
      { readonly id: string; readonly record: Record<string, unknown> }
    >()
    const currentIdentifiedIds = new Set<string>()
    for (const record of db.getAllData()) {
      if (typeof record?._id !== 'string' || currentRecords.has(record._id)) {
        throw new Error(`Current database has an invalid record id: ${dbName}`)
      }
      currentRecords.set(record._id, record)
      if (useLegacyFingerprints) {
        const identityKey = accountRecordIdentityKey(record)
        if (identityKey !== null) {
          if (currentIdentityRecords.has(identityKey)) {
            throw new Error(
              `Current database has a duplicate record identity: ${dbName}`
            )
          }
          currentIdentityRecords.set(identityKey, {
            id: record._id,
            record
          })
          currentIdentifiedIds.add(record._id)
        }
      }
    }
    const currentStateSha256 = auditDatabaseRecords(
      dbName,
      [...currentRecords.values()]
    ).semanticSha256

    const input = fs.createReadStream(filePath)
    const hash = createHash('sha256')
    let size = 0
    input.on('data', (chunk: string | Buffer) => {
      size += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.byteLength
      hash.update(chunk)
    })
    const lines = readline.createInterface({ input, crlfDelay: Infinity })
    const incomingIds = new Set<string>()
    let duplicate = 0
    let conflict = 0
    const matchedCurrentIds = new Set<string>()
    const incomingIdentityKeys = new Set<string>()
    const incomingLegacyFingerprints = new Map<string, number>()
    const incomingRecordHashes: string[] = []
    const mergePlanDecisions: string[] = []
    let safeAdd = 0
    let skip = 0
    let mergeConflict = 0
    let manualReview = 0
    const conflictReasonCounts =
      new Map<AccountBackupMergeConflictGroup, number>()
    const classifyConflict = (
      current: Record<string, unknown>,
      incoming: Record<string, unknown>,
      recordHash: string,
      mode: 'stable-identity' | 'legacy-exact'
    ): void => {
      const groups = accountRecordMergeConflictGroups(
        dbName,
        current,
        incoming,
        mode
      )
      if (groups.length === 0) {
        throw new Error(
          `Database merge conflict has no classified reason: ${dbName}`
        )
      }
      for (const group of groups) {
        conflictReasonCounts.set(
          group,
          (conflictReasonCounts.get(group) ?? 0) + 1
        )
      }
      mergePlanDecisions.push(
        `conflict:${mode}:${groups.join(',')}:${recordHash}`
      )
    }

    try {
      for await (const line of lines) {
        if (line.length === 0) {
          continue
        }
        const record = NeDbModel.deserialize(line)
        if (typeof record._id !== 'string') {
          if (typeof record.$$indexCreated === 'object') {
            continue
          }
          throw new Error(`Backup preview database has an invalid record: ${dbName}`)
        }
        if (incomingIds.has(record._id)) {
          throw new Error(`Backup preview database has a duplicate record id: ${dbName}`)
        }
        incomingIds.add(record._id)
        const recordHash = semanticRecordSha256(record)
        incomingRecordHashes.push(recordHash)

        const identityKey = useLegacyFingerprints
          ? accountRecordIdentityKey(record)
          : null
        if (identityKey !== null) {
          if (incomingIdentityKeys.has(identityKey)) {
            throw new Error(
              `Backup preview database has a duplicate record identity: ${dbName}`
            )
          }
          incomingIdentityKeys.add(identityKey)
        }
        if (!useLegacyFingerprints) {
          manualReview += 1
          mergePlanDecisions.push(`manual-review:${recordHash}`)
        }

        const current = currentRecords.get(record._id)
        if (current) {
          matchedCurrentIds.add(record._id)
          const currentIdentityKey = useLegacyFingerprints
            ? accountRecordIdentityKey(current)
            : null
          const sameStableRecord =
            identityKey !== null &&
            currentIdentityKey === identityKey
          if (
            isDeepStrictEqual(current, record) ||
            (
              sameStableRecord &&
              isDeepStrictEqual(
                accountRecordMergeComparableValue(dbName, current),
                accountRecordMergeComparableValue(dbName, record)
              )
            )
          ) {
            duplicate += 1
            if (useLegacyFingerprints) {
              skip += 1
              mergePlanDecisions.push(`skip:${recordHash}`)
            }
          } else {
            conflict += 1
            if (useLegacyFingerprints) {
              mergeConflict += 1
              classifyConflict(
                current,
                record,
                recordHash,
                sameStableRecord ? 'stable-identity' : 'legacy-exact'
              )
            }
          }
          continue
        }

        const identityMatch =
          identityKey === null
            ? undefined
            : currentIdentityRecords.get(identityKey)
        if (identityMatch) {
          if (matchedCurrentIds.has(identityMatch.id)) {
            throw new Error(
              `Backup preview database reuses a record identity: ${dbName}`
            )
          }
          matchedCurrentIds.add(identityMatch.id)
          if (
            isDeepStrictEqual(
              accountRecordMergeComparableValue(
                dbName,
                identityMatch.record
              ),
              accountRecordMergeComparableValue(dbName, record)
            )
          ) {
            duplicate += 1
            skip += 1
            mergePlanDecisions.push(`skip:${recordHash}`)
          } else {
            conflict += 1
            mergeConflict += 1
            classifyConflict(
              identityMatch.record,
              record,
              recordHash,
              'stable-identity'
            )
          }
        } else if (useLegacyFingerprints && identityKey === null) {
          manualReview += 1
          mergePlanDecisions.push(`manual-review:${recordHash}`)
          const fingerprint = legacyRecordFingerprint(record)
          incomingLegacyFingerprints.set(
            fingerprint,
            (incomingLegacyFingerprints.get(fingerprint) ?? 0) + 1
          )
        } else if (useLegacyFingerprints) {
          safeAdd += 1
          mergePlanDecisions.push(`safe-add:${recordHash}`)
          safeMergeRecords?.push(record)
        }
      }
    } finally {
      lines.close()
    }

    if (
      size !== expected.size ||
      hash.digest('hex') !== expected.sha256
    ) {
      throw new Error(`Backup preview database hash mismatch: ${dbName}`)
    }
    if (incomingIds.size !== expected.recordCount) {
      throw new Error(`Backup preview database record count mismatch: ${dbName}`)
    }

    let legacyDuplicate = 0
    if (useLegacyFingerprints) {
      const currentLegacyFingerprints = new Map<string, number>()
      for (const [id, record] of currentRecords) {
        if (matchedCurrentIds.has(id) || currentIdentifiedIds.has(id)) {
          continue
        }
        const fingerprint = legacyRecordFingerprint(record)
        currentLegacyFingerprints.set(
          fingerprint,
          (currentLegacyFingerprints.get(fingerprint) ?? 0) + 1
        )
      }
      for (const [fingerprint, incomingCount] of incomingLegacyFingerprints) {
        legacyDuplicate += Math.min(
          incomingCount,
          currentLegacyFingerprints.get(fingerprint) ?? 0
        )
      }
    }
    const add =
      incomingIds.size - duplicate - conflict - legacyDuplicate
    const currentOnly =
      currentRecords.size - duplicate - conflict - legacyDuplicate
    const incomingStateSha256 =
      semanticDatabaseSha256(incomingRecordHashes)
    const conflictReasons: AccountBackupMergeConflictSummary[] =
      AccountRecordMergeConflictGroupOrder.flatMap((group) => {
        const records = conflictReasonCounts.get(group)
        return records === undefined ? [] : [{ group, records }]
      })
    if (
      safeAdd + skip + mergeConflict + manualReview !== incomingIds.size ||
      (
        (mergeConflict === 0 && conflictReasons.length !== 0) ||
        (mergeConflict > 0 && conflictReasons.length === 0)
      )
    ) {
      throw new Error(
        `Database merge plan classification is incomplete: ${dbName}`
      )
    }

    return {
      dbName,
      incomingRecords: incomingIds.size,
      add,
      duplicate,
      legacyDuplicate,
      conflict,
      currentOnly,
      mergePlan: {
        schemaVersion: 1,
        comparisonPolicyVersion:
          AccountRecordMergeComparisonPolicyVersion,
        conflictPolicyVersion:
          AccountRecordMergeConflictPolicyVersion,
        conflictResolution:
          AccountRecordMergeConflictResolution,
        mode: 'append-only-v1',
        sourceSha256: expected.sha256,
        currentStateSha256,
        incomingStateSha256,
        decisionSha256: mergePlanDecisionSha256(
          dbName,
          currentStateSha256,
          incomingStateSha256,
          mergePlanDecisions
        ),
        safeAdd,
        skip,
        conflict: mergeConflict,
        conflictReasons,
        manualReview,
        currentOnly
      }
    }
  }

  private async previewQuestBackupDatabase(
    filePath: string,
    db: NeDB,
    expected: DatabaseBackupPreviewFile,
    safeMergeRecords?: Record<string, unknown>[]
  ): Promise<AccountBackupDatabasePreview> {
    const currentRecords = new Map<string, Record<string, unknown>>()
    const currentLogicalRecords = new Map<
      string,
      Record<string, unknown>
    >()
    for (const record of db.getAllData()) {
      if (typeof record?._id !== 'string' || currentRecords.has(record._id)) {
        throw new Error(
          `Current database has an invalid record id: ${DbName.quest}`
        )
      }
      currentRecords.set(record._id, record)
      const logicalKey = accountQuestRecordKey(record)
      if (logicalKey !== null) {
        if (currentLogicalRecords.has(logicalKey)) {
          throw new Error(
            'Current quest database has a duplicate logical record'
          )
        }
        currentLogicalRecords.set(logicalKey, record)
      }
    }
    const currentStateSha256 = auditDatabaseRecords(
      DbName.quest,
      [...currentRecords.values()]
    ).semanticSha256

    const input = fs.createReadStream(filePath)
    const hash = createHash('sha256')
    let size = 0
    input.on('data', (chunk: string | Buffer) => {
      size += typeof chunk === 'string'
        ? Buffer.byteLength(chunk)
        : chunk.byteLength
      hash.update(chunk)
    })
    const lines = readline.createInterface({ input, crlfDelay: Infinity })
    const incomingIds = new Set<string>()
    const incomingLogicalKeys = new Set<string>()
    const matchedCurrentIds = new Set<string>()
    const incomingRecordHashes: string[] = []
    const mergePlanDecisions = [
      `quest-policy-v${AccountQuestMergePolicyVersion}`
    ]
    let add = 0
    let duplicate = 0
    let conflict = 0
    let safeAdd = 0
    let skip = 0
    let manualReview = 0

    try {
      for await (const line of lines) {
        if (line.length === 0) {
          continue
        }
        const record = NeDbModel.deserialize(line)
        if (typeof record._id !== 'string') {
          if (typeof record.$$indexCreated === 'object') {
            continue
          }
          throw new Error(
            `Backup preview database has an invalid record: ${DbName.quest}`
          )
        }
        if (incomingIds.has(record._id)) {
          throw new Error(
            `Backup preview database has a duplicate record id: ${DbName.quest}`
          )
        }
        incomingIds.add(record._id)
        const recordHash = semanticRecordSha256(record)
        incomingRecordHashes.push(recordHash)

        const logicalKey = accountQuestRecordKey(record)
        if (logicalKey !== null) {
          if (incomingLogicalKeys.has(logicalKey)) {
            throw new Error(
              'Backup preview quest database has a duplicate logical record'
            )
          }
          incomingLogicalKeys.add(logicalKey)
        }
        const idMatch = currentRecords.get(record._id)
        const logicalMatch = logicalKey === null
          ? undefined
          : currentLogicalRecords.get(logicalKey)
        if (
          idMatch !== undefined &&
          logicalMatch !== undefined &&
          idMatch._id !== logicalMatch._id
        ) {
          throw new Error(
            'Backup preview quest record id and logical key disagree'
          )
        }
        const current = logicalMatch ?? idMatch
        if (current === undefined) {
          add += 1
          manualReview += 1
          mergePlanDecisions.push(
            `manual-review:no-current:${recordHash}`
          )
          continue
        }

        matchedCurrentIds.add(current._id as string)
        const decision = accountQuestMergeDecision(current, record)
        if (decision.kind === 'safe-merge') {
          if (
            decision.replacement === undefined ||
            decision.replacement._id !== current._id
          ) {
            throw new Error(
              'Quest merge policy returned an invalid replacement'
            )
          }
          conflict += 1
          safeAdd += 1
          safeMergeRecords?.push(decision.replacement)
          mergePlanDecisions.push(
            `safe-merge:${decision.reason}:` +
            `${semanticRecordSha256(decision.replacement)}:${recordHash}`
          )
        } else if (decision.kind === 'skip') {
          duplicate += 1
          skip += 1
          mergePlanDecisions.push(
            `skip:${decision.reason}:${recordHash}`
          )
        } else {
          conflict += 1
          manualReview += 1
          mergePlanDecisions.push(
            `manual-review:${decision.reason}:${recordHash}`
          )
        }
      }
    } finally {
      lines.close()
    }

    if (
      size !== expected.size ||
      hash.digest('hex') !== expected.sha256
    ) {
      throw new Error(
        `Backup preview database hash mismatch: ${DbName.quest}`
      )
    }
    if (incomingIds.size !== expected.recordCount) {
      throw new Error(
        `Backup preview database record count mismatch: ${DbName.quest}`
      )
    }
    if (
      add + duplicate + conflict !== incomingIds.size ||
      safeAdd + skip + manualReview !== incomingIds.size
    ) {
      throw new Error(
        `Database merge plan classification is incomplete: ${DbName.quest}`
      )
    }

    const incomingStateSha256 =
      semanticDatabaseSha256(incomingRecordHashes)
    const currentOnly = currentRecords.size - matchedCurrentIds.size
    return {
      dbName: DbName.quest,
      incomingRecords: incomingIds.size,
      add,
      duplicate,
      legacyDuplicate: 0,
      conflict,
      currentOnly,
      mergePlan: {
        schemaVersion: 1,
        comparisonPolicyVersion:
          AccountRecordMergeComparisonPolicyVersion,
        conflictPolicyVersion:
          AccountRecordMergeConflictPolicyVersion,
        conflictResolution:
          AccountRecordMergeConflictResolution,
        mode: 'quest-monotonic-v1',
        sourceSha256: expected.sha256,
        currentStateSha256,
        incomingStateSha256,
        decisionSha256: mergePlanDecisionSha256(
          DbName.quest,
          currentStateSha256,
          incomingStateSha256,
          mergePlanDecisions
        ),
        safeAdd,
        skip,
        conflict: 0,
        conflictReasons: [],
        manualReview,
        currentOnly
      }
    }
  }

  private compactForSnapshot(
    dbName: DbName,
    db: NeDB
  ): Promise<DatabaseSnapshotInfo> {
    const internals = db as NeDB & NeDbSnapshotInternals
    return new Promise((resolve, reject) => {
      const callback = (err: Error | null): void => {
        if (err) {
          reject(err)
          return
        }
        const records = db.getAllData()
        let oldestTimestamp = Number.POSITIVE_INFINITY
        let newestTimestamp = Number.NEGATIVE_INFINITY
        for (const record of records) {
          if (typeof record?.date !== 'string') {
            continue
          }
          const timestamp = Date.parse(record.date)
          if (Number.isFinite(timestamp)) {
            oldestTimestamp = Math.min(oldestTimestamp, timestamp)
            newestTimestamp = Math.max(newestTimestamp, timestamp)
          }
        }
        resolve({
          dbName,
          recordCount: records.length,
          oldestRecordAt:
            Number.isFinite(oldestTimestamp)
              ? new Date(oldestTimestamp).toISOString()
              : null,
          newestRecordAt:
            Number.isFinite(newestTimestamp)
              ? new Date(newestTimestamp).toISOString()
              : null
        })
      }

      try {
        // NeDB 1.8 exposes compaction only as an event-based public API. Queue
        // its persistence function directly so this barrier receives the
        // actual write error and completes after all earlier executor tasks.
        internals.executor.push({
          this: internals.persistence,
          fn: internals.persistence.persistCachedDatabase,
          arguments: [callback]
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 
   * @param operation 
   * @returns 
   */
  operation(operation: Operation): boolean {
    const db = this.dbs.get(operation.dbName)
    if (! db) {
      return false
    }

    if (operation.autocompactionInterval !== undefined) {
      if (operation.autocompactionInterval < 0) {
        db.persistence.stopAutocompaction()
        this.autocompactionIntervals.delete(operation.dbName)
      } else {
        db.persistence.setAutocompactionInterval(operation.autocompactionInterval)
        this.autocompactionIntervals.set(
          operation.dbName,
          operation.autocompactionInterval
        )
      }
    }
    return true
  }
}

export function createDbStuff(): DbStuff {
  return DbStuff.create()
}

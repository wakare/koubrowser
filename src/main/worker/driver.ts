// src/main/worker-driver.ts
import { Worker } from 'node:worker_threads'
import { join } from 'node:path'
import { 
  Types,
  type Req, 
  type Res, 
  type ReqMsg, 
  type ResMsg, 
  type ReqDbInit, 
  type ReqDbInsert, 
  type ReqDbQuery, 
  type ReqDbUpdate,
  type ReqDbRemove,
  type ReqShutdown, 
  type ResByType,
  type ReqDbQueryOne,
  type ReqDbOperation,
  type ReqDbSnapshotBegin,
  type ReqDbSnapshotEnd,
  type ReqDbAuditLoaded,
  type ReqDbAuditAccountDirectory,
  type ReqDbPreviewBackup,
  type ReqDbCreateMergeStage,
  type ReqDbValidateRestoreStage,
  type ReqDbInspectAccountDirectory,
  type DatabaseBackupPreviewFile,
  type RestoreStageDatabaseFile,
  type DatabaseSnapshotInfo,
  type DatabaseAuditInfo,
  type ResOf,
  ReqCalcPortChartData
} from './msg'
import { DbName, Insert, Query, Update, Remove, Operation, UpdateRes, PortChartData } from '@common/record'
import { AggregatedCellRank, AggregatedCellShipDrop } from '@common/calc_record'
import type { AccountBackupDatabasePreview } from '@common/account-backup'
  
/**
 * 
 */
export class WorkerDriver {
  private worker: Worker
  private seq = 0
  private terminalError: Error | null = null
  private pending = new Map<
    number,
    {
      readonly handleResponse: (res: ResMsg) => void
      readonly reject: (error: Error) => void
      readonly mutation: boolean
      dispatched: boolean
    }
  >()
  private mutationsPaused = false
  private deferredMutations: ReqMsg[] = []
  private inFlightMutations = new Set<number>()
  private exitCode: number | null = null
  private exitWaiters: Array<(code: number) => void> = []
  private mutationDrainWaiters: Array<{
    readonly resolve: () => void
    readonly reject: (error: Error) => void
  }> = []

  /**
   * 
   */
  constructor(appDir: string, activeDataDirectory: string | null = null) {

    // worker.js: builded js filename
    // config: electron.vite.config.ts
    const workerPath = join(appDir, 'worker.js')
    console.log('worker driver workerPath:', workerPath)
    this.worker = new Worker(workerPath, {
      workerData: { appDir, activeDataDirectory }
    })

    this.worker.on('message', (msg: ResMsg) => {
      const pendingCall = this.pending.get(msg.id)
      if (pendingCall) {
        this.pending.delete(msg.id)
        if (pendingCall.mutation && pendingCall.dispatched) {
          this.finishMutation(msg.id)
        }
        pendingCall.handleResponse(msg)
      }
    })
    this.worker.on('error', (error) => {
      console.error('[worker error]', error)
      this.markTerminated(
        error instanceof Error ? error : new Error(String(error))
      )
    })
    this.worker.on('exit', (code) => {
      console.log('[worker exit]', code)
      this.exitCode = code
      for (const resolve of this.exitWaiters) {
        resolve(code)
      }
      this.exitWaiters = []
      this.markTerminated(
        new Error(`Worker exited before completing pending requests (${code})`)
      )
    })
  }

  private markTerminated(error: Error): void {
    if (!this.terminalError) {
      this.terminalError = error
    }
    this.rejectPendingCalls(this.terminalError)
    this.rejectMutationDrainWaiters(this.terminalError)
  }

  private rejectPendingCalls(error: Error): void {
    for (const pendingCall of this.pending.values()) {
      pendingCall.reject(error)
    }
    this.pending.clear()
    this.deferredMutations = []
    this.inFlightMutations.clear()
  }

  private rejectMutationDrainWaiters(error: Error): void {
    for (const waiter of this.mutationDrainWaiters) {
      waiter.reject(error)
    }
    this.mutationDrainWaiters = []
  }

  private finishMutation(id: number): void {
    this.inFlightMutations.delete(id)
    if (this.inFlightMutations.size === 0) {
      for (const waiter of this.mutationDrainWaiters) {
        waiter.resolve()
      }
      this.mutationDrainWaiters = []
    }
  }

  private dispatch(msg: ReqMsg): void {
    const pendingCall = this.pending.get(msg.id)
    if (!pendingCall) {
      return
    }

    pendingCall.dispatched = true
    if (pendingCall.mutation) {
      this.inFlightMutations.add(msg.id)
    }

    try {
      this.worker.postMessage(msg)
    } catch (error) {
      this.pending.delete(msg.id)
      if (pendingCall.mutation) {
        this.finishMutation(msg.id)
      }
      pendingCall.reject(
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * 
   * @param req 
   * @returns 
   */
  private call<T extends Res, V>(
    req: Req,
    mapper: (res: T) => V,
    mutation = false
  ): Promise<V> {
    if (this.terminalError) {
      return Promise.reject(this.terminalError)
    }

    const id = ++this.seq
    const msg: ReqMsg = { id, req }
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        handleResponse: (msg: ResMsg) => {
          if (!msg.res.ok) {
            reject(new Error(msg.res.error));
          } else {
            try {
              resolve(mapper(msg.res as T))
            } catch (error) {
              reject(error)
            }
          }
        },
        reject,
        mutation,
        dispatched: false
      })
      if (mutation && this.mutationsPaused) {
        this.deferredMutations.push(msg)
      } else {
        this.dispatch(msg)
      }
    })
  }

  /**
   * Stop dispatching new DB mutations and wait for every mutation already sent
   * to this worker to finish.
   */
  pauseDatabaseMutations(): Promise<void> {
    if (this.terminalError) {
      return Promise.reject(this.terminalError)
    }
    if (this.mutationsPaused) {
      return Promise.reject(new Error('Database mutations already paused'))
    }

    this.mutationsPaused = true
    if (this.inFlightMutations.size === 0) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      this.mutationDrainWaiters.push({ resolve, reject })
    })
  }

  /**
   * Resume DB mutations in the same order in which callers submitted them.
   */
  resumeDatabaseMutations(): void {
    if (!this.mutationsPaused) {
      return
    }

    this.mutationsPaused = false
    const deferred = this.deferredMutations
    this.deferredMutations = []
    for (const msg of deferred) {
      this.dispatch(msg)
    }
  }

  /**
   * 
   */
  private waitForExit(): Promise<number> {
    if (this.exitCode !== null) {
      return Promise.resolve(this.exitCode)
    }
    return new Promise((resolve) => {
      this.exitWaiters.push(resolve)
    })
  }

  async shutdown(): Promise<boolean> {
    const req: ReqShutdown = { type: Types.shutdown }
    const acknowledged = await this.call<ResByType[typeof req.type], boolean>(
      req,
      (res) => res.ok
    )
    const code = await this.waitForExit()
    if (code !== 0) {
      throw new Error(`Worker shutdown failed with exit code ${code}`)
    }
    return acknowledged
  }

  /**
   * 
   * @param userDir 
   * @returns 
   */
  dbInit(userDir: string, dbs: DbName[]) {
    const req: ReqDbInit = { type: Types.dbInit, userDir, dbs }
    return this.call<ResByType[typeof req.type], boolean>(req, (res) => res.ok, true)
  }

  /**
   * 
   * @param doc 
   * @returns 
   */
  dbInsert<T>(doc: Insert) {
    const req: ReqDbInsert = { type: Types.dbInsert, doc }
    return this.call<ResOf<typeof req.type, T>, T>(req, (res) => res.inserted, true)
  }

  /**
   * 
   * @param query 
   * @returns 
   */
  dbQuery<T>(query: Query) {
    const req: ReqDbQuery = { type: Types.dbQuery, query }
    return this.call<ResOf<typeof req.type, T>, T[]>(req, (res) => res.docs)
  }

  /**
   * 
   * @param query 
   * @returns 
   */
  dbQueryOne<T>(query: Query) {
    const req: ReqDbQueryOne = { type: Types.dbQueryOne, query }
    return this.call<ResOf<typeof req.type, T>, T>(req, (res) => res.doc)
  }

  /**
   * 
   * @param query 
   * @returns 
   */
  dbUpdate<T>(update: Update) {
    const req: ReqDbUpdate = { type: Types.dbUpdate, update }
    return this.call<ResOf<typeof req.type, T>, UpdateRes<T>>(req, (res) => res.res, true)
  }

  /**
   * 
   * @param remove
   * @returns 
   */
  dbRemove(remove: Remove) {
    const req: ReqDbRemove = { type: Types.dbRemove, remove }
    return this.call<ResByType[typeof req.type], number>(req, (res) => res.num, true)
  }

  /**
   * 
   * @param operation 
   * @returns 
   */
  dbOperation(operation: Operation) {
    const req: ReqDbOperation = { type: Types.dbOperation, operation }
    return this.call<ResByType[typeof req.type], boolean>(req, (res) => res.ok, true)
  }

  beginDatabaseSnapshot(): Promise<DatabaseSnapshotInfo[]> {
    const req: ReqDbSnapshotBegin = { type: Types.dbSnapshotBegin }
    return this.call<ResByType[typeof req.type], DatabaseSnapshotInfo[]>(
      req,
      (res) => res.databases
    )
  }

  endDatabaseSnapshot(): Promise<boolean> {
    const req: ReqDbSnapshotEnd = { type: Types.dbSnapshotEnd }
    return this.call<ResByType[typeof req.type], boolean>(
      req,
      (res) => res.ok
    )
  }

  auditLoadedDatabases(): Promise<DatabaseAuditInfo[]> {
    const req: ReqDbAuditLoaded = { type: Types.dbAuditLoaded }
    return this.call<ResByType[typeof req.type], DatabaseAuditInfo[]>(
      req,
      (res) => res.databases
    )
  }

  auditAccountDirectory(
    accountDirectory: string,
    dbNames: DbName[]
  ): Promise<DatabaseAuditInfo[]> {
    const req: ReqDbAuditAccountDirectory = {
      type: Types.dbAuditAccountDirectory,
      accountDirectory,
      dbNames
    }
    return this.call<
      ResByType[typeof req.type],
      DatabaseAuditInfo[]
    >(req, (res) => res.databases)
  }

  previewDatabaseBackup(
    bundleDirectory: string,
    files: DatabaseBackupPreviewFile[]
  ): Promise<AccountBackupDatabasePreview[]> {
    const req: ReqDbPreviewBackup = {
      type: Types.dbPreviewBackup,
      bundleDirectory,
      files
    }
    return this.call<
      ResByType[typeof req.type],
      AccountBackupDatabasePreview[]
    >(req, (res) => res.databases)
  }

  createDatabaseMergeStage(
    bundleDirectory: string,
    stageDirectory: string,
    files: DatabaseBackupPreviewFile[],
    expectedPreviews: AccountBackupDatabasePreview[]
  ): Promise<RestoreStageDatabaseFile[]> {
    const req: ReqDbCreateMergeStage = {
      type: Types.dbCreateMergeStage,
      bundleDirectory,
      stageDirectory,
      files,
      expectedPreviews
    }
    return this.call<
      ResByType[typeof req.type],
      RestoreStageDatabaseFile[]
    >(req, (res) => res.files)
  }

  validateRestoreStage(
    accountDirectory: string,
    files: RestoreStageDatabaseFile[]
  ): Promise<DbName[]> {
    const req: ReqDbValidateRestoreStage = {
      type: Types.dbValidateRestoreStage,
      accountDirectory,
      files
    }
    return this.call<ResByType[typeof req.type], DbName[]>(
      req,
      (res) => res.databases
    )
  }

  inspectAccountDirectory(
    accountDirectory: string,
    dbNames: DbName[]
  ): Promise<RestoreStageDatabaseFile[]> {
    const req: ReqDbInspectAccountDirectory = {
      type: Types.dbInspectAccountDirectory,
      accountDirectory,
      dbNames
    }
    return this.call<
      ResByType[typeof req.type],
      RestoreStageDatabaseFile[]
    >(req, (res) => res.files)
  }

  /**
   * 
   * @returns 
   */
  calcPortChartData() {
    const req: ReqCalcPortChartData = { type: Types.calcPortChartData }
    return this.call<ResByType[typeof req.type], PortChartData>(req, (res) => res.data)
  }

  /**
   * 
   * @param area_id 
   * @param area_no 
   * @returns 
   */
  aggregateRankByArea(area_id: number, area_no: number) {
    const req = { type: Types.aggregateRankByArea, area_id, area_no }
    return this.call<ResByType[typeof req.type], AggregatedCellRank[]>(req, (res) => res.datas)
  }

  /**
   * 
   * @param ship_id
   * @returns 
   */
  aggregateShipDrop(ship_id: number, renderer_scope_id: number) {
    const req = {
      type: Types.aggregateShipDrop,
      ship_id,
      renderer_scope_id
    }
    return this.call<ResByType[typeof req.type], AggregatedCellShipDrop[]>(req, (res) => res.datas)
  }

  /**
   * 
   * @returns 
   */
  terminate() {
    return this.worker.terminate()
  }
}

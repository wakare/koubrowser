import type { PortChartData } from '@common/record'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const workerMock = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: any[]) => void>,
  postMessage: vi.fn(),
  terminate: vi.fn()
}))

vi.mock('node:worker_threads', () => ({
  Worker: class {
    constructor(_filename: string, _options: unknown) {}

    on(event: string, handler: (...args: any[]) => void) {
      workerMock.handlers[event] = handler
      return this
    }

    postMessage(message: unknown) {
      workerMock.postMessage(message)
    }

    terminate() {
      return workerMock.terminate()
    }
  }
}))

import { WorkerDriver } from '@main/worker/driver'

const chartData: PortChartData = {
  materials: [[], [], [], []],
  kits: [[], [], [], []]
}

describe('WorkerDriver', () => {
  beforeEach(() => {
    workerMock.handlers = {}
    workerMock.postMessage.mockReset()
    workerMock.terminate.mockReset()
  })

  it('resolves a normal worker response', async () => {
    const driver = new WorkerDriver('app')
    const result = driver.calcPortChartData()

    workerMock.handlers.message({
      id: 1,
      res: {
        ok: true,
        type: 'calc:portChartData',
        data: chartData
      }
    })

    await expect(result).resolves.toEqual(chartData)
  })

  it('includes the renderer scope in a ship-drop aggregation request', async () => {
    const driver = new WorkerDriver('app')
    const result = driver.aggregateShipDrop(594, 37)

    expect(workerMock.postMessage).toHaveBeenCalledWith({
      id: 1,
      req: {
        type: 'aggregate:shipDrop',
        ship_id: 594,
        renderer_scope_id: 37
      }
    })

    workerMock.handlers.message({
      id: 1,
      res: {
        ok: true,
        type: 'aggregate:shipDrop',
        datas: []
      }
    })
    await expect(result).resolves.toEqual([])
  })

  it('rejects every pending request when the worker reports an error', async () => {
    const driver = new WorkerDriver('app')
    const first = driver.calcPortChartData()
    const second = driver.calcPortChartData()

    workerMock.handlers.error(new Error('worker failed'))

    await expect(first).rejects.toThrow('worker failed')
    await expect(second).rejects.toThrow('worker failed')
  })

  it('rejects a pending request when the worker exits without replying', async () => {
    const driver = new WorkerDriver('app')
    const result = driver.calcPortChartData()

    workerMock.handlers.exit(1)

    await expect(result).rejects.toThrow('Worker exited before completing pending requests (1)')
  })

  it('rejects new requests immediately after the worker fails', async () => {
    const driver = new WorkerDriver('app')
    workerMock.handlers.error(new Error('worker failed'))
    workerMock.postMessage.mockClear()

    await expect(driver.calcPortChartData()).rejects.toThrow('worker failed')
    expect(workerMock.postMessage).not.toHaveBeenCalled()
  })

  it('preserves the original worker error when an exit follows it', async () => {
    const driver = new WorkerDriver('app')
    workerMock.handlers.error(new Error('original failure'))
    workerMock.handlers.exit(1)

    await expect(driver.calcPortChartData()).rejects.toThrow('original failure')
  })

  it('waits for the worker thread to exit after shutdown is acknowledged', async () => {
    const driver = new WorkerDriver('app')
    const result = driver.shutdown()
    let settled = false
    void result.finally(() => {
      settled = true
    })

    workerMock.handlers.message({
      id: 1,
      res: { ok: true, type: 'shutdown' }
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    workerMock.handlers.exit(0)

    await expect(result).resolves.toBe(true)
    expect(settled).toBe(true)
  })

  it('defers database mutations while a snapshot barrier is active', async () => {
    const driver = new WorkerDriver('app')
    await driver.pauseDatabaseMutations()

    const result = driver.dbOperation({
      dbName: 'quest',
      autocompactionInterval: -1
    })
    expect(workerMock.postMessage).not.toHaveBeenCalled()

    driver.resumeDatabaseMutations()
    expect(workerMock.postMessage).toHaveBeenCalledWith({
      id: 1,
      req: {
        type: 'db:operation',
        operation: {
          dbName: 'quest',
          autocompactionInterval: -1
        }
      }
    })

    workerMock.handlers.message({
      id: 1,
      res: { ok: true, type: 'db:operation' }
    })
    await expect(result).resolves.toBe(true)
  })

  it('waits for an already dispatched mutation before pausing', async () => {
    const driver = new WorkerDriver('app')
    const mutation = driver.dbOperation({
      dbName: 'quest',
      autocompactionInterval: 600000
    })
    const paused = driver.pauseDatabaseMutations()
    let pauseFinished = false
    void paused.then(() => {
      pauseFinished = true
    })

    await Promise.resolve()
    expect(pauseFinished).toBe(false)

    workerMock.handlers.message({
      id: 1,
      res: { ok: true, type: 'db:operation' }
    })
    await expect(mutation).resolves.toBe(true)
    await expect(paused).resolves.toBeUndefined()
    expect(pauseFinished).toBe(true)
  })

  it('allows snapshot control requests while mutations are paused', async () => {
    const driver = new WorkerDriver('app')
    await driver.pauseDatabaseMutations()

    const begin = driver.beginDatabaseSnapshot()
    expect(workerMock.postMessage).toHaveBeenLastCalledWith({
      id: 1,
      req: { type: 'db:snapshotBegin' }
    })
    workerMock.handlers.message({
      id: 1,
      res: {
        ok: true,
        type: 'db:snapshotBegin',
        databases: [{
          dbName: 'quest',
          recordCount: 12,
          oldestRecordAt: '2026-07-01T00:00:00.000Z',
          newestRecordAt: '2026-07-30T00:00:00.000Z'
        }]
      }
    })
    await expect(begin).resolves.toEqual([
      {
        dbName: 'quest',
        recordCount: 12,
        oldestRecordAt: '2026-07-01T00:00:00.000Z',
        newestRecordAt: '2026-07-30T00:00:00.000Z'
      }
    ])

    const previewFiles = [{
      dbName: 'quest' as const,
      path: 'data/quest.db',
      size: 123,
      sha256: 'a'.repeat(64),
      recordCount: 12
    }]
    const preview = driver.previewDatabaseBackup(
      'C:\\backup\\bundle',
      previewFiles
    )
    expect(workerMock.postMessage).toHaveBeenLastCalledWith({
      id: 2,
      req: {
        type: 'db:previewBackup',
        bundleDirectory: 'C:\\backup\\bundle',
        files: previewFiles
      }
    })
    workerMock.handlers.message({
      id: 2,
      res: {
        ok: true,
        type: 'db:previewBackup',
        databases: [{
          dbName: 'quest',
          incomingRecords: 12,
          add: 3,
          duplicate: 8,
          legacyDuplicate: 0,
          conflict: 1,
          currentOnly: 2,
          mergePlan: {
            schemaVersion: 1,
            comparisonPolicyVersion: 1,
            conflictPolicyVersion: 1,
            conflictResolution: 'preserve-current-v1',
            mode: 'quest-monotonic-v1',
            sourceSha256: 'a'.repeat(64),
            currentStateSha256: 'b'.repeat(64),
            incomingStateSha256: 'c'.repeat(64),
            decisionSha256: 'd'.repeat(64),
            safeAdd: 0,
            skip: 0,
            conflict: 0,
            conflictReasons: [],
            manualReview: 12,
            currentOnly: 2
          }
        }]
      }
    })
    await expect(preview).resolves.toEqual([{
      dbName: 'quest',
      incomingRecords: 12,
      add: 3,
      duplicate: 8,
      legacyDuplicate: 0,
      conflict: 1,
      currentOnly: 2,
      mergePlan: {
        schemaVersion: 1,
        comparisonPolicyVersion: 1,
        conflictPolicyVersion: 1,
        conflictResolution: 'preserve-current-v1',
        mode: 'quest-monotonic-v1',
        sourceSha256: 'a'.repeat(64),
        currentStateSha256: 'b'.repeat(64),
        incomingStateSha256: 'c'.repeat(64),
        decisionSha256: 'd'.repeat(64),
        safeAdd: 0,
        skip: 0,
        conflict: 0,
        conflictReasons: [],
        manualReview: 12,
        currentOnly: 2
      }
    }])

    const stageFiles = [{
      dbName: 'quest' as const,
      filename: 'quest.db',
      size: 123,
      sha256: 'a'.repeat(64),
      recordCount: 12
    }]
    const stageValidation = driver.validateRestoreStage(
      'C:\\app-data\\restore-staging\\bundle.partial\\account',
      stageFiles
    )
    expect(workerMock.postMessage).toHaveBeenLastCalledWith({
      id: 3,
      req: {
        type: 'db:validateRestoreStage',
        accountDirectory:
          'C:\\app-data\\restore-staging\\bundle.partial\\account',
        files: stageFiles
      }
    })
    workerMock.handlers.message({
      id: 3,
      res: {
        ok: true,
        type: 'db:validateRestoreStage',
        databases: ['quest']
      }
    })
    await expect(stageValidation).resolves.toEqual(['quest'])

    const inspection = driver.inspectAccountDirectory(
      'C:\\app-data\\store\\3_123',
      ['quest']
    )
    expect(workerMock.postMessage).toHaveBeenLastCalledWith({
      id: 4,
      req: {
        type: 'db:inspectAccountDirectory',
        accountDirectory: 'C:\\app-data\\store\\3_123',
        dbNames: ['quest']
      }
    })
    workerMock.handlers.message({
      id: 4,
      res: {
        ok: true,
        type: 'db:inspectAccountDirectory',
        files: stageFiles
      }
    })
    await expect(inspection).resolves.toEqual(stageFiles)

    const directoryAudit = driver.auditAccountDirectory(
      'C:\\app-data\\store\\3_123',
      ['quest']
    )
    expect(workerMock.postMessage).toHaveBeenLastCalledWith({
      id: 5,
      req: {
        type: 'db:auditAccountDirectory',
        accountDirectory: 'C:\\app-data\\store\\3_123',
        dbNames: ['quest']
      }
    })
    workerMock.handlers.message({
      id: 5,
      res: {
        ok: true,
        type: 'db:auditAccountDirectory',
        databases: [{
          dbName: 'quest',
          recordCount: 12,
          oldestRecordAt: '2026-07-01T00:00:00.000Z',
          newestRecordAt: '2026-07-30T00:00:00.000Z',
          semanticSha256: 'b'.repeat(64)
        }]
      }
    })
    await expect(directoryAudit).resolves.toEqual([
      expect.objectContaining({
        dbName: 'quest',
        semanticSha256: 'b'.repeat(64)
      })
    ])

    const audit = driver.auditLoadedDatabases()
    expect(workerMock.postMessage).toHaveBeenLastCalledWith({
      id: 6,
      req: { type: 'db:auditLoaded' }
    })
    workerMock.handlers.message({
      id: 6,
      res: {
        ok: true,
        type: 'db:auditLoaded',
        databases: [{
          dbName: 'quest',
          recordCount: 12,
          oldestRecordAt: '2026-07-01T00:00:00.000Z',
          newestRecordAt: '2026-07-30T00:00:00.000Z',
          semanticSha256: 'b'.repeat(64)
        }]
      }
    })
    await expect(audit).resolves.toEqual([
      expect.objectContaining({
        dbName: 'quest',
        semanticSha256: 'b'.repeat(64)
      })
    ])

    const end = driver.endDatabaseSnapshot()
    expect(workerMock.postMessage).toHaveBeenLastCalledWith({
      id: 7,
      req: { type: 'db:snapshotEnd' }
    })
    workerMock.handlers.message({
      id: 7,
      res: { ok: true, type: 'db:snapshotEnd' }
    })
    await expect(end).resolves.toBe(true)
    driver.resumeDatabaseMutations()
  })

  it('transports an isolated database merge-stage request', async () => {
    const driver = new WorkerDriver('app')
    const files = [{
      dbName: 'drop' as const,
      path: 'data/drop.db',
      size: 123,
      sha256: 'a'.repeat(64),
      recordCount: 2
    }]
    const expectedPreviews = [{
      dbName: 'drop' as const,
      incomingRecords: 2,
      add: 1,
      duplicate: 1,
      legacyDuplicate: 0,
      conflict: 0,
      currentOnly: 0,
      mergePlan: {
        schemaVersion: 1 as const,
        comparisonPolicyVersion: 1 as const,
        conflictPolicyVersion: 1 as const,
        conflictResolution: 'preserve-current-v1' as const,
        mode: 'append-only-v1' as const,
        sourceSha256: 'a'.repeat(64),
        currentStateSha256: 'b'.repeat(64),
        incomingStateSha256: 'c'.repeat(64),
        decisionSha256: 'd'.repeat(64),
        safeAdd: 1,
        skip: 1,
        conflict: 0,
        conflictReasons: [],
        manualReview: 0,
        currentOnly: 0
      }
    }]
    const result = driver.createDatabaseMergeStage(
      'C:\\backup\\bundle',
      'C:\\app-data\\merge-staging\\bundle.partial\\databases',
      files,
      expectedPreviews
    )
    expect(workerMock.postMessage).toHaveBeenLastCalledWith({
      id: 1,
      req: {
        type: 'db:createMergeStage',
        bundleDirectory: 'C:\\backup\\bundle',
        stageDirectory:
          'C:\\app-data\\merge-staging\\bundle.partial\\databases',
        files,
        expectedPreviews
      }
    })
    const stagedFiles = [{
      dbName: 'drop' as const,
      filename: 'drop.db',
      size: 456,
      sha256: 'e'.repeat(64),
      recordCount: 2
    }]
    workerMock.handlers.message({
      id: 1,
      res: {
        ok: true,
        type: 'db:createMergeStage',
        files: stagedFiles
      }
    })
    await expect(result).resolves.toEqual(stagedFiles)
  })

  it('rejects deferred mutations if the worker terminates', async () => {
    const driver = new WorkerDriver('app')
    await driver.pauseDatabaseMutations()
    const mutation = driver.dbOperation({
      dbName: 'quest',
      autocompactionInterval: -1
    })

    workerMock.handlers.error(new Error('snapshot worker failed'))

    await expect(mutation).rejects.toThrow('snapshot worker failed')
    expect(workerMock.postMessage).not.toHaveBeenCalled()
  })
})

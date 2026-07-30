import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const workerState = vi.hoisted(() => ({
  instances: [] as Array<{ index: number }>,
  events: [] as string[],
  beginFailureIndex: null as number | null,
  shutdownHangs: false
}))

vi.mock('@main/worker/driver', () => ({
  WorkerDriver: class {
    readonly index: number

    constructor() {
      this.index = workerState.instances.length
      workerState.instances.push(this)
    }

    pauseDatabaseMutations(): Promise<void> {
      workerState.events.push(`pause:${this.index}`)
      return Promise.resolve()
    }

    resumeDatabaseMutations(): void {
      workerState.events.push(`resume:${this.index}`)
    }

    beginDatabaseSnapshot() {
      workerState.events.push(`begin:${this.index}`)
      if (workerState.beginFailureIndex === this.index) {
        return Promise.reject(new Error(`begin failed:${this.index}`))
      }
      return Promise.resolve(
        this.index === 0
          ? [
              {
                dbName: 'battle',
                recordCount: 7,
                oldestRecordAt: '2026-07-01T00:00:00.000Z',
                newestRecordAt: '2026-07-20T00:00:00.000Z'
              }
            ]
          : [
              {
                dbName: 'quest',
                recordCount: 3,
                oldestRecordAt: '2026-07-02T00:00:00.000Z',
                newestRecordAt: '2026-07-21T00:00:00.000Z'
              }
            ]
      )
    }

    endDatabaseSnapshot(): Promise<boolean> {
      workerState.events.push(`end:${this.index}`)
      return Promise.resolve(true)
    }

    shutdown(): Promise<boolean> {
      workerState.events.push(`shutdown:${this.index}`)
      if (workerState.shutdownHangs) {
        return new Promise(() => undefined)
      }
      return Promise.resolve(true)
    }

    terminate(): Promise<number> {
      workerState.events.push(`terminate:${this.index}`)
      return Promise.resolve(0)
    }
  }
}))

import {
  shutdown,
  start,
  withDatabaseReadBarrier,
  withDatabaseSnapshotBarrier
} from '@main/stuff/wrokers'

describe('database snapshot worker coordination', () => {
  beforeEach(() => {
    workerState.instances = []
    workerState.events = []
    workerState.beginFailureIndex = null
    workerState.shutdownHangs = false
    start('app')
  })

  afterEach(async () => {
    vi.useRealTimers()
    await shutdown()
  })

  it('terminates workers that do not acknowledge shutdown before the deadline', async () => {
    vi.useFakeTimers()
    workerState.shutdownHangs = true

    const result = shutdown(50)
    await vi.advanceTimersByTimeAsync(50)

    await expect(result).resolves.toEqual([
      { worker: 'records', mode: 'terminated' },
      { worker: 'quest', mode: 'terminated' }
    ])
    expect(workerState.events).toEqual(['shutdown:0', 'shutdown:1', 'terminate:0', 'terminate:1'])
  })

  it('holds both workers until the snapshot callback completes', async () => {
    const result = await withDatabaseSnapshotBarrier(async (context) => {
      workerState.events.push('callback')
      expect(context.databases).toEqual([
        {
          dbName: 'battle',
          recordCount: 7,
          oldestRecordAt: '2026-07-01T00:00:00.000Z',
          newestRecordAt: '2026-07-20T00:00:00.000Z'
        },
        {
          dbName: 'quest',
          recordCount: 3,
          oldestRecordAt: '2026-07-02T00:00:00.000Z',
          newestRecordAt: '2026-07-21T00:00:00.000Z'
        }
      ])
      return 'snapshot-created'
    })

    expect(result).toBe('snapshot-created')
    expect(workerState.events).toEqual([
      'pause:0',
      'pause:1',
      'begin:0',
      'begin:1',
      'callback',
      'end:0',
      'end:1',
      'resume:0',
      'resume:1'
    ])
  })

  it('provides a read barrier without starting snapshot compaction', async () => {
    const result = await withDatabaseReadBarrier(async () => {
      workerState.events.push('audit')
      return 'audited'
    })

    expect(result).toBe('audited')
    expect(workerState.events).toEqual(['pause:0', 'pause:1', 'audit', 'resume:0', 'resume:1'])
  })

  it('releases both workers when snapshot generation fails', async () => {
    await expect(
      withDatabaseSnapshotBarrier(async () => {
        workerState.events.push('callback')
        throw new Error('copy failed')
      })
    ).rejects.toThrow('copy failed')

    expect(workerState.events.slice(-4)).toEqual(['end:0', 'end:1', 'resume:0', 'resume:1'])
  })

  it('waits for both workers and releases them when preparation fails', async () => {
    workerState.beginFailureIndex = 0

    await expect(
      withDatabaseSnapshotBarrier(async () => {
        throw new Error('callback must not run')
      })
    ).rejects.toThrow('begin failed:0')

    expect(workerState.events).toEqual([
      'pause:0',
      'pause:1',
      'begin:0',
      'begin:1',
      'end:0',
      'end:1',
      'resume:0',
      'resume:1'
    ])
  })
})

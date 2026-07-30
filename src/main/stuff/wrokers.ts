import { WorkerDriver } from "@main/worker/driver";
import type { DatabaseSnapshotInfo } from "@main/worker/msg";

export const WorkerShutdownTimeoutMs = 5_000

export interface WorkerShutdownResult {
  readonly worker: 'records' | 'quest'
  readonly mode: 'graceful' | 'terminated'
}

// singleton worker driver
let workerDriver: WorkerDriver | undefined = undefined

// singleton worker driver for quest
let workerDriverQuest: WorkerDriver | undefined = undefined

/**
 * 
 * @param appDir 
 */
export function start(appDir: string, activeDataDirectory: string | null = null) {

  // singleton worker driver
  workerDriver = new WorkerDriver(appDir, activeDataDirectory);

  // singleton worker driver for quest
  // クエストDB worker は他DB worker と分けて管理する
  // 他DBのサイズが大となる傾向があることから他DB読み込み時間の影響を避けるため
  workerDriverQuest = new WorkerDriver(appDir, activeDataDirectory);
}

/**
 * 
 * @returns 
 */
export function getWorkerDriver(): WorkerDriver {
  if (! workerDriver) {
    throw new Error('WorkerDriver not started')
  }
  return workerDriver;
}

/**
 * 
 * @returns 
 */
export function getWorkerDriverQuest(): WorkerDriver {
  if (! workerDriverQuest) {
    throw new Error('WorkerDriverQuest not started')
  }
  return workerDriverQuest;
}

export interface DatabaseSnapshotContext {
  readonly databases: DatabaseSnapshotInfo[]
}

/**
 * Hold new database mutations after all previously dispatched writes finish,
 * without compacting or otherwise rewriting the active NeDB files.
 */
export async function withDatabaseReadBarrier<T>(
  callback: () => Promise<T>
): Promise<T> {
  const drivers = [getWorkerDriver(), getWorkerDriverQuest()]
  try {
    const paused = await Promise.allSettled(
      drivers.map((driver) => driver.pauseDatabaseMutations())
    )
    const pauseError = rejectedReason(paused)
    if (pauseError) {
      throw pauseError
    }
    return await callback()
  } finally {
    for (const driver of drivers) {
      driver.resumeDatabaseMutations()
    }
  }
}

function rejectedReason(
  results: PromiseSettledResult<unknown>[]
): Error | null {
  const rejected = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  )
  if (!rejected) {
    return null
  }
  return rejected.reason instanceof Error
    ? rejected.reason
    : new Error(String(rejected.reason))
}

/**
 * Hold new mutations in both worker drivers, compact every loaded NeDB after
 * earlier writes finish, and keep the files stable while callback runs.
 */
export async function withDatabaseSnapshotBarrier<T>(
  callback: (context: DatabaseSnapshotContext) => Promise<T>
): Promise<T> {
  const drivers = [getWorkerDriver(), getWorkerDriverQuest()]
  let failed = false

  try {
    const paused = await Promise.allSettled(
      drivers.map((driver) => driver.pauseDatabaseMutations())
    )
    const pauseError = rejectedReason(paused)
    if (pauseError) {
      throw pauseError
    }

    const prepared = await Promise.allSettled(
      drivers.map((driver) => driver.beginDatabaseSnapshot())
    )
    const prepareError = rejectedReason(prepared)
    if (prepareError) {
      throw prepareError
    }

    const databases = prepared
      .flatMap((result) =>
        result.status === 'fulfilled' ? result.value : []
      )
      .sort((a, b) => a.dbName.localeCompare(b.dbName))

    return await callback({ databases })
  } catch (error) {
    failed = true
    throw error
  } finally {
    let cleanupError: Error | null = null
    try {
      const ended = await Promise.allSettled(
        drivers.map((driver) => driver.endDatabaseSnapshot())
      )
      cleanupError = rejectedReason(ended)
    } finally {
      for (const driver of drivers) {
        driver.resumeDatabaseMutations()
      }
    }

    if (!failed && cleanupError) {
      throw cleanupError
    }
  }
}

async function shutdownWorker(
  worker: WorkerShutdownResult['worker'],
  driver: WorkerDriver,
  timeoutMs: number
): Promise<WorkerShutdownResult> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<'timed-out'>((resolve) => {
    timeout = setTimeout(() => resolve('timed-out'), timeoutMs)
  })

  try {
    const outcome = await Promise.race([
      driver.shutdown().then(() => 'graceful' as const),
      timedOut
    ])
    if (outcome === 'timed-out') {
      await driver.terminate()
      return { worker, mode: 'terminated' }
    }
    return { worker, mode: 'graceful' }
  } catch (error) {
    await driver.terminate().catch(() => undefined)
    throw error
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

/**
 * Give both database workers a bounded chance to finish pending writes.
 * A stuck worker is terminated so it cannot keep the single-instance lock
 * alive after every application window has closed.
 */
export async function shutdown(
  timeoutMs: number = WorkerShutdownTimeoutMs
): Promise<WorkerShutdownResult[]> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('Worker shutdown timeout must be a positive finite number')
  }

  const drivers: Array<{
    readonly worker: WorkerShutdownResult['worker']
    readonly driver: WorkerDriver
  }> = []
  if (workerDriver) {
    drivers.push({ worker: 'records', driver: workerDriver })
    workerDriver = undefined
  }
  if (workerDriverQuest) {
    drivers.push({ worker: 'quest', driver: workerDriverQuest })
    workerDriverQuest = undefined
  }

  return Promise.all(
    drivers.map(({ worker, driver }) => shutdownWorker(worker, driver, timeoutMs))
  )
}


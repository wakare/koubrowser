import fs from 'node:fs'

type WriteFileCallback = (err: NodeJS.ErrnoException | null) => void

interface DeferredWrite {
  readonly filePath: string
  readonly data: string | NodeJS.ArrayBufferView
  readonly encoding: BufferEncoding
  readonly callback: WriteFileCallback
}

class AccountFileWriteCoordinator {
  private paused = false
  private inFlight = new Set<Promise<void>>()
  private deferred: DeferredWrite[] = []

  writeFile(
    filePath: string,
    data: string | NodeJS.ArrayBufferView,
    encoding: BufferEncoding,
    callback: WriteFileCallback
  ): void {
    const write = { filePath, data, encoding, callback }
    if (this.paused) {
      this.deferred.push(write)
      return
    }
    this.dispatch(write)
  }

  async pause(): Promise<void> {
    if (this.paused) {
      throw new Error('Account file writes already paused')
    }
    this.paused = true

    const settled = await Promise.allSettled([...this.inFlight])
    const rejected = settled.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    )
    if (rejected) {
      throw rejected.reason
    }
  }

  resume(): void {
    if (!this.paused) {
      return
    }

    this.paused = false
    const deferred = this.deferred
    this.deferred = []
    for (const write of deferred) {
      this.dispatch(write)
    }
  }

  private dispatch(write: DeferredWrite): void {
    const completion = new Promise<void>((resolve, reject) => {
      fs.writeFile(
        write.filePath,
        write.data,
        write.encoding,
        (err: NodeJS.ErrnoException | null) => {
          try {
            write.callback(err)
          } catch (callbackError) {
            reject(callbackError)
            return
          }
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        }
      )
    })
    this.inFlight.add(completion)
    void completion.then(
      () => this.inFlight.delete(completion),
      () => this.inFlight.delete(completion)
    )
  }
}

const coordinator = new AccountFileWriteCoordinator()

export function writeCoordinatedAccountFile(
  filePath: string,
  data: string | NodeJS.ArrayBufferView,
  encoding: BufferEncoding,
  callback: WriteFileCallback
): void {
  coordinator.writeFile(filePath, data, encoding, callback)
}

export function pauseAccountFileWrites(): Promise<void> {
  return coordinator.pause()
}

export function resumeAccountFileWrites(): void {
  coordinator.resume()
}

export async function withAccountFileWriteBarrier<T>(
  callback: () => Promise<T>
): Promise<T> {
  try {
    await pauseAccountFileWrites()
    return await callback()
  } finally {
    resumeAccountFileWrites()
  }
}

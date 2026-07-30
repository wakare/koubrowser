import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  pauseAccountFileWrites,
  resumeAccountFileWrites,
  writeCoordinatedAccountFile
} from '@main/account-file-writes'

describe('account file write coordination', () => {
  afterEach(() => {
    resumeAccountFileWrites()
    vi.restoreAllMocks()
  })

  it('defers a new write until the barrier is released', async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'koubrowser-file-write-')
    )
    const filePath = path.join(directory, 'account.json')

    try {
      await pauseAccountFileWrites()
      const completed = new Promise<void>((resolve, reject) => {
        writeCoordinatedAccountFile(
          filePath,
          '{"ok":true}',
          'utf8',
          (error) => error ? reject(error) : resolve()
        )
      })
      expect(fs.existsSync(filePath)).toBe(false)

      resumeAccountFileWrites()
      await completed
      expect(fs.readFileSync(filePath, 'utf8')).toBe('{"ok":true}')
    } finally {
      fs.rmSync(directory, { recursive: true, force: true })
    }
  })

  it('waits for an in-flight write to finish before entering the barrier', async () => {
    const pendingWrite: {
      complete?: (error: NodeJS.ErrnoException | null) => void
    } = {}
    vi.spyOn(fs, 'writeFile').mockImplementation(((
      _filePath: fs.PathOrFileDescriptor,
      _data: string | NodeJS.ArrayBufferView,
      _encoding: BufferEncoding,
      callback: (error: NodeJS.ErrnoException | null) => void
    ) => {
      pendingWrite.complete = callback
    }) as typeof fs.writeFile)

    writeCoordinatedAccountFile('account.json', '{}', 'utf8', () => {})
    const paused = pauseAccountFileWrites()
    let pausedFinished = false
    void paused.then(() => {
      pausedFinished = true
    })

    await Promise.resolve()
    expect(pausedFinished).toBe(false)
    pendingWrite.complete?.(null)
    await expect(paused).resolves.toBeUndefined()
    expect(pausedFinished).toBe(true)
  })

  it('reports an in-flight write failure to the barrier', async () => {
    const pendingWrite: {
      complete?: (error: NodeJS.ErrnoException | null) => void
    } = {}
    vi.spyOn(fs, 'writeFile').mockImplementation(((
      _filePath: fs.PathOrFileDescriptor,
      _data: string | NodeJS.ArrayBufferView,
      _encoding: BufferEncoding,
      callback: (error: NodeJS.ErrnoException | null) => void
    ) => {
      pendingWrite.complete = callback
    }) as typeof fs.writeFile)

    writeCoordinatedAccountFile('account.json', '{}', 'utf8', () => {})
    const paused = pauseAccountFileWrites()
    pendingWrite.complete?.(
      Object.assign(new Error('write failed'), { code: 'EIO' })
    )

    await expect(paused).rejects.toThrow('write failed')
  })
})

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { saveCaptureFile } from '@main/capture'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'koubrowser-capture-'))
  temporaryDirectories.push(directory)
  return directory
}

describe('saveCaptureFile', () => {
  it('returns the filename only after the image is saved', async () => {
    const directory = createTemporaryDirectory()
    const data = Buffer.from('png-data')

    const filename = await saveCaptureFile(directory, new Date(2026, 6, 29, 12, 34, 56), data)

    expect(filename).toBe('20260729-123456.png')
    expect(readFileSync(path.join(directory, filename))).toEqual(data)
  })

  it('does not overwrite captures taken during the same second', async () => {
    const directory = createTemporaryDirectory()
    const date = new Date(2026, 6, 29, 12, 34, 56)

    const first = await saveCaptureFile(directory, date, Buffer.from('first'))
    const second = await saveCaptureFile(directory, date, Buffer.from('second'))

    expect(first).toBe('20260729-123456.png')
    expect(second).toBe('20260729-123456-2.png')
    expect(readFileSync(path.join(directory, first), 'utf8')).toBe('first')
    expect(readFileSync(path.join(directory, second), 'utf8')).toBe('second')
  })
})

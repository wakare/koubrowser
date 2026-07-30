import { describe, expect, it, vi } from 'vitest'
import {
  isTrustedDataFolderRequest,
  openDataDirectory
} from '@main/data-folder'

describe('data folder access', () => {
  it('accepts only the main application top-level frame', () => {
    expect(isTrustedDataFolderRequest(10, true, 10)).toBe(true)
    expect(isTrustedDataFolderRequest(10, false, 10)).toBe(false)
    expect(isTrustedDataFolderRequest(11, true, 10)).toBe(false)
  })

  it('opens the resolved application data directory', async () => {
    const openPath = vi.fn().mockResolvedValue('')

    await expect(openDataDirectory('C:\\app-data', openPath)).resolves.toBeUndefined()

    expect(openPath).toHaveBeenCalledOnce()
    expect(openPath).toHaveBeenCalledWith('C:\\app-data')
  })

  it('turns an operating-system error into a rejected request', async () => {
    const openPath = vi.fn().mockResolvedValue('No application is associated')

    await expect(openDataDirectory('C:\\app-data', openPath)).rejects.toThrow(
      'Failed to open the data folder: No application is associated'
    )
  })
})

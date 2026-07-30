import { describe, expect, it, vi } from 'vitest'
import {
  showMainWindowWhenReady,
  shouldAutoShowMainWindow
} from '@main/window-startup'

describe('window startup visibility', () => {
  it('automatically shows a normal app window only after it is ready', () => {
    let readyListener: (() => void) | undefined
    const window = {
      once: vi.fn((_event: string, listener: () => void) => {
        readyListener = listener
      }),
      isDestroyed: vi.fn(() => false),
      show: vi.fn()
    }

    showMainWindowWhenReady(window, {})

    expect(window.once).toHaveBeenCalledWith('ready-to-show', expect.any(Function))
    expect(window.show).not.toHaveBeenCalled()

    readyListener?.()
    expect(window.show).toHaveBeenCalledOnce()
  })

  it('does not show a window that was destroyed before it became ready', () => {
    let readyListener: (() => void) | undefined
    const window = {
      once: vi.fn((_event: string, listener: () => void) => {
        readyListener = listener
      }),
      isDestroyed: vi.fn(() => true),
      show: vi.fn()
    }

    showMainWindowWhenReady(window, {})
    readyListener?.()

    expect(window.show).not.toHaveBeenCalled()
  })

  it('leaves smoke and layout fixture visibility under test control', () => {
    expect(shouldAutoShowMainWindow({ KOUBROWSER_SMOKE_IPC: '1' })).toBe(false)
    expect(shouldAutoShowMainWindow({ KOUBROWSER_LAYOUT_FIXTURE: '1' })).toBe(false)

    const window = {
      once: vi.fn(),
      isDestroyed: vi.fn(() => false),
      show: vi.fn()
    }
    showMainWindowWhenReady(window, { KOUBROWSER_SMOKE_IPC: '1' })

    expect(window.once).not.toHaveBeenCalled()
    expect(window.show).not.toHaveBeenCalled()
  })
})

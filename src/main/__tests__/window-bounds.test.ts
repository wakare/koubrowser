import { describe, expect, it, vi } from 'vitest'
import { setWindowBoundsIfChanged } from '@main/window-bounds'

describe('window bounds updates', () => {
  it('does not rewrite identical bounds and retrigger move handling', () => {
    const bounds = { x: 40, y: 30, width: 1200, height: 752 }
    const window = {
      getBounds: vi.fn(() => bounds),
      setBounds: vi.fn()
    }

    expect(setWindowBoundsIfChanged(window, { ...bounds })).toBe(false)
    expect(window.setBounds).not.toHaveBeenCalled()
  })

  it('applies a real bounds correction once', () => {
    const window = {
      getBounds: vi.fn(() => ({ x: -20, y: 30, width: 1200, height: 752 })),
      setBounds: vi.fn()
    }
    const fitted = { x: 0, y: 30, width: 1200, height: 752 }

    expect(setWindowBoundsIfChanged(window, fitted)).toBe(true)
    expect(window.setBounds).toHaveBeenCalledOnce()
    expect(window.setBounds).toHaveBeenCalledWith(fitted, false)
  })
})

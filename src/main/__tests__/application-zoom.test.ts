import { describe, expect, it, vi } from 'vitest'
import {
  isApplicationZoomShortcut,
  restoreApplicationZoom,
  type ApplicationZoomInput
} from '../application-zoom'

const input = (
  overrides: Partial<ApplicationZoomInput> = {}
): ApplicationZoomInput => ({
  type: 'keyDown',
  key: '0',
  code: 'Digit0',
  control: true,
  alt: false,
  meta: false,
  ...overrides
})

describe('application zoom policy', () => {
  it.each([
    input(),
    input({ key: '+', code: 'Equal' }),
    input({ key: '-', code: 'Minus' }),
    input({ key: '0', code: 'Numpad0' }),
    input({ key: '+', code: 'NumpadAdd' }),
    input({ key: '-', code: 'NumpadSubtract' }),
    input({ control: false, meta: true })
  ])('recognizes Chromium page-zoom shortcuts', (shortcut) => {
    expect(isApplicationZoomShortcut(shortcut)).toBe(true)
  })

  it.each([
    input({ type: 'keyUp' }),
    input({ control: false }),
    input({ alt: true }),
    input({ key: 'r', code: 'KeyR' }),
    input({ key: '1', code: 'Digit1' })
  ])('leaves unrelated input available to the page', (shortcut) => {
    expect(isApplicationZoomShortcut(shortcut)).toBe(false)
  })

  it('cancels the browser request and restores the application-owned factor', () => {
    const event = { preventDefault: vi.fn() }
    const contents = {
      getZoomFactor: vi.fn(() => 1),
      setZoomFactor: vi.fn()
    }

    restoreApplicationZoom(event, contents, 0.75)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(contents.setZoomFactor).toHaveBeenCalledWith(0.75)
  })

  it('does not rewrite an already correct factor', () => {
    const event = { preventDefault: vi.fn() }
    const contents = {
      getZoomFactor: vi.fn(() => 1),
      setZoomFactor: vi.fn()
    }

    restoreApplicationZoom(event, contents, Number.NaN)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(contents.setZoomFactor).not.toHaveBeenCalled()
  })
})

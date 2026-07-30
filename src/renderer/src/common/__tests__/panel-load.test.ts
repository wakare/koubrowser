import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PANEL_LOAD_TIMEOUT_MS,
  withPanelLoadTimeout
} from '../panel-load'

describe('withPanelLoadTimeout', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a result that settles before the timeout', async () => {
    await expect(
      withPanelLoadTimeout(Promise.resolve('ready'), 'timed out')
    ).resolves.toBe('ready')
  })

  it('rejects a stalled request after the shared panel timeout', async () => {
    vi.useFakeTimers()
    const result = withPanelLoadTimeout(
      new Promise<never>(() => {}),
      'panel request timed out'
    )
    const rejection = expect(result).rejects.toThrow('panel request timed out')

    await vi.advanceTimersByTimeAsync(PANEL_LOAD_TIMEOUT_MS)

    await rejection
  })
})

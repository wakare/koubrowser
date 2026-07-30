import { afterEach, describe, expect, it, vi } from 'vitest'
import { waitForAppShutdown } from '@main/shutdown'

describe('application shutdown deadline', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a completed task value before the deadline', async () => {
    await expect(waitForAppShutdown(Promise.resolve('done'), 50)).resolves.toEqual({
      status: 'completed',
      value: 'done'
    })
  })

  it('stops waiting for a cleanup task after the deadline', async () => {
    vi.useFakeTimers()
    const result = waitForAppShutdown(new Promise<never>(() => undefined), 50)

    await vi.advanceTimersByTimeAsync(50)

    await expect(result).resolves.toEqual({ status: 'timed-out' })
  })

  it('rejects an invalid deadline', async () => {
    await expect(waitForAppShutdown(Promise.resolve(), 0)).rejects.toThrow(
      'Application shutdown timeout must be a positive finite number'
    )
  })
})

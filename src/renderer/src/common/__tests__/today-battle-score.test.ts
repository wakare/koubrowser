import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiItemId } from '@common/kcs'
import { DbName, type PortRecordQuery } from '@common/record'
import { PANEL_LOAD_TIMEOUT_MS } from '../panel-load'
import {
  loadTodayStartExp,
  TodayExpLoadController
} from '../today-battle-score'

describe('loadTodayStartExp', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads the first experience record after the 02:00 daily boundary', async () => {
    const queryDb = vi.fn().mockResolvedValue([
      {
        date: '2026-07-26T02:00:00+09:00',
        [ApiItemId.teitoku_exp]: 123456
      }
    ])

    await expect(
      loadTodayStartExp(queryDb, 234567, new Date(2026, 6, 26, 14))
    ).resolves.toBe(123456)

    const query = queryDb.mock.calls[0][0] as PortRecordQuery
    expect(query.dbName).toBe(DbName.port)
    expect(query.limit).toBe(1)
    expect((query.find as any).date.$gte).toContain('2026-07-26T02:00:00')
  })

  it('uses the previous day boundary before 02:00', async () => {
    const queryDb = vi.fn().mockResolvedValue([])

    await loadTodayStartExp(queryDb, 234567, new Date(2026, 6, 26, 1, 30))

    const query = queryDb.mock.calls[0][0] as PortRecordQuery
    expect((query.find as any).date.$gte).toContain('2026-07-25T02:00:00')
  })

  it('falls back to current experience when no usable record exists', async () => {
    await expect(
      loadTodayStartExp(vi.fn().mockResolvedValue([]), 234567)
    ).resolves.toBe(234567)
    await expect(
      loadTodayStartExp(
        vi.fn().mockResolvedValue([{ date: '2026-07-26T02:00:00+09:00' }]),
        234567
      )
    ).resolves.toBe(234567)
  })

  it('propagates a database failure for the next port event to retry', async () => {
    await expect(
      loadTodayStartExp(
        vi.fn().mockRejectedValue(new Error('database unavailable')),
        234567
      )
    ).rejects.toThrow('database unavailable')
  })

  it('times out a stalled database request', async () => {
    vi.useFakeTimers()
    const result = loadTodayStartExp(
      vi.fn().mockReturnValue(new Promise(() => undefined)),
      234567
    )
    const rejection = expect(result).rejects.toThrow(
      'Today battle score request timed out'
    )

    await vi.advanceTimersByTimeAsync(PANEL_LOAD_TIMEOUT_MS)

    await rejection
  })
})

describe('TodayExpLoadController', () => {
  it('shares one request while a load is already in progress', async () => {
    let resolveQuery: (records: any[]) => void = () => undefined
    const queryDb = vi.fn().mockReturnValue(
      new Promise<any[]>((resolve) => {
        resolveQuery = resolve
      })
    )
    const onLoaded = vi.fn()
    const controller = new TodayExpLoadController({
      queryDb,
      currentExp: () => 234567,
      onLoaded
    })

    const first = controller.load()
    const second = controller.load()

    expect(queryDb).toHaveBeenCalledTimes(1)
    resolveQuery([
      {
        date: '2026-07-26T02:00:00+09:00',
        [ApiItemId.teitoku_exp]: 123456
      }
    ])
    await Promise.all([first, second])

    expect(onLoaded).toHaveBeenCalledOnce()
    expect(onLoaded).toHaveBeenCalledWith(123456)
  })

  it('allows a later load to retry after failure', async () => {
    const queryDb = vi.fn()
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce([
        {
          date: '2026-07-26T02:00:00+09:00',
          [ApiItemId.teitoku_exp]: 123456
        }
      ])
    const onLoaded = vi.fn()
    const onError = vi.fn()
    const controller = new TodayExpLoadController({
      queryDb,
      currentExp: () => 234567,
      onLoaded,
      onError
    })

    await controller.load()
    await controller.load()

    expect(queryDb).toHaveBeenCalledTimes(2)
    expect(onError).toHaveBeenCalledOnce()
    expect(onLoaded).toHaveBeenCalledWith(123456)
  })

  it('ignores a pending result after disposal', async () => {
    let resolveQuery: (records: any[]) => void = () => undefined
    const queryDb = vi.fn().mockReturnValue(
      new Promise<any[]>((resolve) => {
        resolveQuery = resolve
      })
    )
    const onLoaded = vi.fn()
    const controller = new TodayExpLoadController({
      queryDb,
      currentExp: () => 234567,
      onLoaded
    })

    const pending = controller.load()
    controller.dispose()
    resolveQuery([
      {
        date: '2026-07-26T02:00:00+09:00',
        [ApiItemId.teitoku_exp]: 123456
      }
    ])
    await pending

    expect(onLoaded).not.toHaveBeenCalled()
  })
})

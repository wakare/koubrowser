import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DropRecord } from '@common/record'
import type { DropData } from '@main/orval/generated/kc-intake'

const intakeMock = vi.hoisted(() => ({
  drop: vi.fn()
}))

vi.mock('@main/svdata', () => ({
  svdata: {
    serverId: 1,
    useitems: []
  }
}))

vi.mock('@main/orval/generated/kc-intake', () => ({
  drop: intakeMock.drop
}))

import { Intaker, toDropData } from '@main/stuff/intaker'

beforeEach(() => {
  intakeMock.drop.mockReset()
  Intaker.datas = []
  Intaker.intaking = []
  Intaker.counter = 0
  Intaker.isfailureState = false
  Intaker.onQuitPerformed = false
  Intaker.isEnabled = true
})

afterEach(() => {
  vi.useRealTimers()
})

describe('intake payload boundary', () => {
  it('does not expose the local account record identity', () => {
    const recordId = '11111111-1111-4111-8111-111111111111'
    const payload = toDropData({
      recordIdentity: {
        schemaVersion: 1,
        recordId,
        index: 0
      },
      mapId: 101,
      cellId: 1,
      enemyFormation: 1,
      mapLv: 0,
      shipId: -1,
      shipCounts: [],
      rank: 'S',
      enemyShips1: [],
      origin: 'koubrowser/test',
      itemId: -1,
      itemCount: 0,
      date: '2026-07-30T12:00:00+09:00'
    } as unknown as DropRecord)

    expect(payload).not.toHaveProperty('recordIdentity')
    expect(JSON.stringify(payload)).not.toContain(recordId)
  })

  it('finishes a successful shutdown upload without leaving its deadline timer active', async () => {
    vi.useFakeTimers()
    Intaker.datas = [{} as DropData]
    intakeMock.drop.mockResolvedValue({
      data: {},
      status: 204,
      headers: new Headers()
    })

    await expect(Intaker.doIntakeDropOnQuit({ timeoutMs: 50 })).resolves.toBe('sent')

    expect(intakeMock.drop).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels the recurring intake schedule during shutdown', async () => {
    vi.useFakeTimers()
    Intaker.setIntakeSchedule()
    expect(vi.getTimerCount()).toBe(1)

    await expect(Intaker.doIntakeDropOnQuit()).resolves.toBe('empty')

    expect(vi.getTimerCount()).toBe(0)
  })

  it('aborts a stalled shutdown upload at the deadline so the next launch is not locked out', async () => {
    vi.useFakeTimers()
    Intaker.datas = [{} as DropData]
    let requestSignal: AbortSignal | undefined
    intakeMock.drop.mockImplementation((_data: DropData[], options?: RequestInit) => {
      requestSignal = options?.signal ?? undefined
      return new Promise(() => undefined)
    })

    const shutdown = Intaker.doIntakeDropOnQuit({ timeoutMs: 50 })
    await vi.advanceTimersByTimeAsync(50)

    await expect(shutdown).resolves.toBe('timed-out')
    expect(requestSignal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})

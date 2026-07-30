import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BattleHistory from '../BattleHistory.vue'

const buttonStub = {
  emits: ['click'],
  template: '<button type="button" @click="$emit(\'click\')"><slot /></button>'
}

const tableStub = {
  template:
    '<div class="b-table"><div class="table-wrapper"><slot /></div></div>'
}

describe('BattleHistory loading state', () => {
  const queryDb = vi.fn()

  function mountBattleHistory() {
    return mount(BattleHistory, {
      global: {
        stubs: {
          BButton: buttonStub,
          BDatepicker: true,
          BField: {
            template: '<div><slot /></div>'
          },
          BSelect: {
            template: '<select><slot /></select>'
          },
          BTable: tableStub,
          BTableColumn: true,
          BattleHistoryArea: true,
          FixedCanvasViewport: {
            template: '<div><slot /></div>'
          },
          ReportsImage: true,
          ShipBanner: true,
          SlotItemForRecord: true
        }
      }
    })
  }

  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        queryDb
      }
    })
  })

  it('closes the loading overlay after empty queries complete', async () => {
    queryDb.mockResolvedValue([])

    const wrapper = mountBattleHistory()
    await flushPromises()

    expect(wrapper.find('.overlay-help').exists()).toBe(false)
    expect(wrapper.find('.is-initial').exists()).toBe(false)
  })

  it('turns a database failure into a retryable error', async () => {
    queryDb.mockRejectedValue(new Error('database unavailable'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mountBattleHistory()
    await flushPromises()

    expect(wrapper.get('.overlay-help.is-error').text()).toContain(
      '戦闘履歴を読み込めませんでした'
    )

    queryDb.mockResolvedValue([])
    await wrapper.get('.overlay-help.is-error button').trigger('click')
    await flushPromises()

    expect(queryDb).toHaveBeenCalledTimes(6)
    expect(wrapper.find('.overlay-help').exists()).toBe(false)
    consoleError.mockRestore()
  })

  it('times out a stalled query instead of searching forever', async () => {
    vi.useFakeTimers()
    queryDb.mockReturnValue(new Promise(() => {}))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mountBattleHistory()
    await vi.advanceTimersByTimeAsync(15_000)
    await flushPromises()

    expect(wrapper.find('.overlay-help.is-error').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('戦闘履歴検索中')
    consoleError.mockRestore()
  })

  it('ignores an older failed search after a newer search succeeds', async () => {
    let rejectFirst!: (reason?: unknown) => void
    let rejectSecond!: (reason?: unknown) => void
    const first = new Promise<never>((_resolve, reject) => {
      rejectFirst = reject
    })
    const second = new Promise<never>((_resolve, reject) => {
      rejectSecond = reject
    })
    queryDb
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)
      .mockResolvedValue([])
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mountBattleHistory()
    await wrapper.get('.input-button.search button').trigger('click')
    await flushPromises()
    expect(wrapper.find('.overlay-help').exists()).toBe(false)

    rejectFirst(new Error('stale query failed'))
    rejectSecond(new Error('stale query failed'))
    await flushPromises()

    expect(wrapper.find('.overlay-help.is-error').exists()).toBe(false)
    consoleError.mockRestore()
  })

  it('loads event area options from map ids present in battle history', async () => {
    queryDb.mockImplementation((query) => {
      if (query.projection?.mapId === 1) {
        return Promise.resolve([{ mapId: 611 }])
      }
      return Promise.resolve([])
    })

    const wrapper = mountBattleHistory()
    await flushPromises()

    const optionLabels = wrapper.findAll('option').map((option) => option.text())
    expect(optionLabels).toContain(
      '2025年秋イベント E1 ノルウェー沖/ナルヴィク沖'
    )
    expect(optionLabels.some((label) => label.includes('2026年夏イベント'))).toBe(
      false
    )
  })
})

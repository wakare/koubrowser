import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DropShipMapInfo } from '@renderer/common/drop-ship'

const mapInfoMocks = vi.hoisted(() => ({
  get: vi.fn(),
  findCellNos: vi.fn(() => [3])
}))

vi.mock('@renderer/common/mapinfo', () => ({
  mapInfoCache: mapInfoMocks
}))

import DropByShipArea from '../DropByShipArea.vue'

const tableStub = {
  template: '<table><slot /></table>'
}

const info: DropShipMapInfo = {
  area_id: 1,
  area_no: 1,
  map_lv: 0 as DropShipMapInfo['map_lv'],
  cell_no: 3,
  cell_label: 'A',
  is_boss: false,
  hilight_ship_id: 594
}

describe('DropByShipArea loading state', () => {
  const queryDb = vi.fn()

  function mountArea() {
    return mount(DropByShipArea, {
      props: { info },
      global: {
        stubs: {
          BTable: tableStub,
          BTableColumn: true,
          LocationImage: true,
          MapImg: true
        }
      }
    })
  }

  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    mapInfoMocks.get.mockResolvedValue({
      spots: [{ no: 3, x: 100, y: 120 }]
    })
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        queryDb
      }
    })
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the detail table after an empty query completes', async () => {
    queryDb.mockResolvedValue([])

    const wrapper = mountArea()
    await flushPromises()

    expect(wrapper.find('.drop-area-load-state').exists()).toBe(false)
    expect(wrapper.find('.spot-table').exists()).toBe(true)
  })

  it('turns a database failure into a retryable error', async () => {
    queryDb.mockRejectedValueOnce(new Error('database unavailable'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mountArea()
    await flushPromises()

    expect(wrapper.get('.drop-area-load-state.is-error').text()).toContain(
      'ドロップ詳細を読み込めませんでした'
    )

    queryDb.mockResolvedValue([])
    await wrapper.get('.drop-area-load-state.is-error button').trigger('click')
    await flushPromises()

    expect(queryDb).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.drop-area-load-state').exists()).toBe(false)
    consoleError.mockRestore()
  })

  it('times out stalled map information instead of staying blank', async () => {
    vi.useFakeTimers()
    mapInfoMocks.get.mockReturnValue(new Promise(() => {}))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mountArea()
    expect(wrapper.text()).toContain('ドロップ詳細を読み込み中')

    await vi.advanceTimersByTimeAsync(15_000)
    await flushPromises()

    expect(wrapper.find('.drop-area-load-state.is-error').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('ドロップ詳細を読み込み中')
    consoleError.mockRestore()
  })
})

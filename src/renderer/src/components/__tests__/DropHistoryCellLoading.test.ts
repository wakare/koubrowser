import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@renderer/common/mapinfo', () => ({
  mapInfoCache: {
    findCellNos: (_areaId: number, _areaNo: number, spotNo: number) => [
      spotNo
    ]
  }
}))

import DropHistoryCell from '../DropHistoryCell.vue'

const tableStub = {
  template:
    '<div class="b-table"><div class="table-wrapper"><slot name="empty" /></div></div>'
}

const spot = (no: number) => ({ no, x: 0, y: 0 }) as any

describe('DropHistoryCell loading state', () => {
  const queryDb = vi.fn()

  function mountCell() {
    return mount(DropHistoryCell, {
      props: {
        area_id: 1,
        area_no: 1,
        selected_spot: spot(1)
      },
      global: {
        stubs: {
          BCheckboxButton: true,
          BField: {
            template: '<div><slot /></div>'
          },
          BTable: tableStub,
          BTableColumn: true,
          ShipTypePie: true
        }
      }
    })
  }

  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        queryDb
      }
    })
  })

  it('turns a database failure into a retryable error', async () => {
    queryDb.mockRejectedValueOnce(new Error('database unavailable'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mountCell()
    await flushPromises()

    expect(wrapper.text()).toContain('履歴を読み込めませんでした')
    expect(wrapper.find('.drop-history-cell-retry').exists()).toBe(true)

    queryDb.mockResolvedValue([])
    await wrapper.get('.drop-history-cell-retry').trigger('click')
    await flushPromises()

    expect(queryDb).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.drop-history-cell-retry').exists()).toBe(false)
    consoleError.mockRestore()
  })

  it('times out a stalled query instead of fetching forever', async () => {
    vi.useFakeTimers()
    queryDb.mockReturnValue(new Promise(() => {}))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mountCell()

    await vi.advanceTimersByTimeAsync(15_000)
    await flushPromises()

    expect(wrapper.text()).toContain('履歴を読み込めませんでした')
    expect(wrapper.text()).not.toContain('履歴を取得中')
    consoleError.mockRestore()
  })

  it('ignores an older failed cell query on the same map', async () => {
    let rejectOlder!: (reason?: unknown) => void
    const older = new Promise<never>((_resolve, reject) => {
      rejectOlder = reject
    })
    queryDb
      .mockReturnValueOnce(older)
      .mockResolvedValueOnce([])
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mountCell()

    await wrapper.setProps({ selected_spot: spot(2) })
    await flushPromises()
    expect(wrapper.find('.drop-history-cell-retry').exists()).toBe(false)

    rejectOlder(new Error('stale query failed'))
    await flushPromises()

    expect(wrapper.find('.drop-history-cell-retry').exists()).toBe(false)
    consoleError.mockRestore()
  })
})

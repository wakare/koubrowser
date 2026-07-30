import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@renderer/store/panel_view_state', () => ({
  getDropByShipId: () => 0,
  saveDropByShipId: vi.fn()
}))

import DropByShip from '../DropByShip.vue'

const tableStub = {
  template:
    '<div class="b-table"><div class="table-wrapper"><slot name="empty" /></div></div>'
}

describe('DropByShip loading state', () => {
  const aggregateShipDrop = vi.fn()

  function mountDropByShip() {
    return mount(DropByShip, {
      global: {
        stubs: {
          BTable: tableStub,
          BTableColumn: true,
          DropByShipArea: true,
          DropByShipControl: true,
          FixedCanvasViewport: {
            template: '<div><slot /></div>'
          }
        }
      }
    })
  }

  async function selectShip(
    wrapper: ReturnType<typeof mountDropByShip>,
    shipId: number
  ): Promise<void> {
    wrapper.getComponent({ name: 'DropByShipControl' }).vm.$emit(
      'update:selected_ship_id',
      shipId
    )
    await wrapper.vm.$nextTick()
  }

  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        aggregateShipDrop
      }
    })
  })

  it('shows an explicit empty state after a successful empty query', async () => {
    aggregateShipDrop.mockResolvedValue([])
    const wrapper = mountDropByShip()

    await selectShip(wrapper, 594)
    await flushPromises()

    expect(wrapper.find('.overlay-help.is-error').exists()).toBe(false)
    expect(wrapper.get('.overlay-help').text()).toContain(
      '該当するドロップ履歴が見つかりません'
    )
  })

  it('turns an aggregation failure into a retryable error', async () => {
    aggregateShipDrop.mockRejectedValueOnce(new Error('worker unavailable'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mountDropByShip()

    await selectShip(wrapper, 594)
    await flushPromises()

    expect(wrapper.get('.overlay-help.is-error').text()).toContain(
      'ドロップ履歴を読み込めませんでした'
    )

    aggregateShipDrop.mockResolvedValue([])
    await wrapper.get('.overlay-help.is-error button').trigger('click')
    await flushPromises()

    expect(aggregateShipDrop).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.overlay-help.is-error').exists()).toBe(false)
    consoleError.mockRestore()
  })

  it('times out a stalled aggregation instead of loading forever', async () => {
    vi.useFakeTimers()
    aggregateShipDrop.mockReturnValue(new Promise(() => {}))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mountDropByShip()

    await selectShip(wrapper, 594)
    await vi.advanceTimersByTimeAsync(15_000)
    await flushPromises()

    expect(wrapper.find('.overlay-help.is-error').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('ドロップ履歴を取得中')
    consoleError.mockRestore()
  })

  it('ignores an older failed request after a newer selection succeeds', async () => {
    let rejectOlder!: (reason?: unknown) => void
    const older = new Promise<never>((_resolve, reject) => {
      rejectOlder = reject
    })
    aggregateShipDrop
      .mockReturnValueOnce(older)
      .mockResolvedValueOnce([])
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mountDropByShip()

    await selectShip(wrapper, 594)
    await selectShip(wrapper, 595)
    await flushPromises()
    expect(wrapper.find('.overlay-help.is-error').exists()).toBe(false)

    rejectOlder(new Error('stale request failed'))
    await flushPromises()

    expect(wrapper.find('.overlay-help.is-error').exists()).toBe(false)
    consoleError.mockRestore()
  })
})

import type { PortChartData } from '@common/record'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const chartSpies = vi.hoisted(() => ({
  drawMaterial: vi.fn(),
  drawKit: vi.fn()
}))

vi.mock('@renderer/store/svdata', async () => {
  const { reactive } = await import('vue')
  return {
    svdata: reactive({
      isShipDataOk: true
    })
  }
})

vi.mock('@renderer/components/chart/Material.vue', () => ({
  default: {
    name: 'ChartMaterial',
    setup(_props: unknown, { expose }: { expose: (exposed: Record<string, unknown>) => void }) {
      expose({ drawChart: chartSpies.drawMaterial })
      return {}
    },
    template: '<div class="material-chart-stub" />'
  }
}))

vi.mock('@renderer/components/chart/Kit.vue', () => ({
  default: {
    name: 'ChartKit',
    setup(_props: unknown, { expose }: { expose: (exposed: Record<string, unknown>) => void }) {
      expose({ drawChart: chartSpies.drawKit })
      return {}
    },
    template: '<div class="kit-chart-stub" />'
  }
}))

import ResourceChartPanel from '../assist/ResourceChartPanel.vue'
import { saveResourceChartViewState } from '@renderer/store/panel_view_state'
import { svdata } from '@renderer/store/svdata'

const chartData: PortChartData = {
  materials: [[[1, 100]], [[1, 200]], [[1, 300]], [[1, 400]]],
  kits: [[[1, 10]], [[1, 20]], [[1, 30]], [[1, 40]]]
}

const emptyChartData: PortChartData = {
  materials: [[], [], [], []],
  kits: [[], [], [], []]
}

const loadingStub = {
  props: ['modelValue'],
  template: '<div v-if="modelValue" class="loading-overlay" />'
}

function mountPanel() {
  return mount(ResourceChartPanel, {
    global: {
      stubs: {
        BLoading: loadingStub
      }
    }
  })
}

describe('ResourceChartPanel.vue', () => {
  const calcPortChartData = vi.fn<() => Promise<PortChartData>>()

  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    ;(svdata as unknown as { isShipDataOk: boolean }).isShipDataOk = true
    saveResourceChartViewState('material')
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        calcPortChartData
      }
    })
  })

  it('waits for GAME START before requesting account-scoped records', async () => {
    ;(svdata as unknown as { isShipDataOk: boolean }).isShipDataOk = false
    calcPortChartData.mockResolvedValue(chartData)

    const wrapper = mountPanel()
    await flushPromises()

    expect(calcPortChartData).not.toHaveBeenCalled()
    expect(wrapper.get('.resource-chart-waiting').text()).toContain('GAME START後')
    expect(wrapper.find('.loading-overlay').exists()).toBe(false)

    ;(svdata as unknown as { isShipDataOk: boolean }).isShipDataOk = true
    await flushPromises()

    expect(calcPortChartData).toHaveBeenCalledTimes(1)
    expect(chartSpies.drawMaterial).toHaveBeenCalledWith(chartData.materials)
    expect(wrapper.find('.resource-chart-waiting').exists()).toBe(false)
  })

  it('draws both charts and closes the explicit loading state', async () => {
    let resolveData: ((data: PortChartData) => void) | undefined
    calcPortChartData.mockReturnValue(
      new Promise<PortChartData>((resolve) => {
        resolveData = resolve
      })
    )

    const wrapper = mountPanel()
    expect(wrapper.find('.loading-overlay').exists()).toBe(true)

    resolveData?.(chartData)
    await flushPromises()

    expect(chartSpies.drawMaterial).toHaveBeenCalledWith(chartData.materials)
    expect(chartSpies.drawKit).toHaveBeenCalledWith(chartData.kits)
    expect(wrapper.find('.loading-overlay').exists()).toBe(false)
    expect(wrapper.find('.resource-chart-state').exists()).toBe(false)
  })

  it('shows a stable empty state instead of an endless spinner', async () => {
    calcPortChartData.mockResolvedValue(emptyChartData)

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.get('.resource-chart-empty').text()).toContain('表示する資源記録がありません')
    expect(wrapper.find('.loading-overlay').exists()).toBe(false)
    expect(chartSpies.drawMaterial).not.toHaveBeenCalled()
    expect(chartSpies.drawKit).not.toHaveBeenCalled()
  })

  it('shows an error and can retry a failed request', async () => {
    calcPortChartData
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce(chartData)

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.get('.resource-chart-error').text()).toContain('資源記録を読み込めませんでした')

    await wrapper.get('.resource-chart-error button').trigger('click')
    await flushPromises()

    expect(calcPortChartData).toHaveBeenCalledTimes(2)
    expect(chartSpies.drawMaterial).toHaveBeenCalledWith(chartData.materials)
    expect(chartSpies.drawKit).toHaveBeenCalledWith(chartData.kits)
    expect(wrapper.find('.resource-chart-error').exists()).toBe(false)
  })

  it('converts a stalled request into a retryable error', async () => {
    vi.useFakeTimers()
    calcPortChartData.mockReturnValue(new Promise<PortChartData>(() => {}))

    const wrapper = mountPanel()
    await vi.advanceTimersByTimeAsync(15_000)
    await flushPromises()

    expect(wrapper.find('.loading-overlay').exists()).toBe(false)
    expect(wrapper.find('.resource-chart-error').exists()).toBe(true)
  })

  it('restores the selected chart after its workspace page is remounted', async () => {
    calcPortChartData.mockResolvedValue(chartData)

    const first = mountPanel()
    await flushPromises()
    await first.findAll('.resource-chart-switcher button')[1].trigger('click')

    expect(
      first.findAll('.resource-chart-switcher button')[1].classes()
    ).toContain('is-active')

    first.unmount()
    const restored = mountPanel()
    await flushPromises()

    expect(
      restored.findAll('.resource-chart-switcher button')[1].classes()
    ).toContain('is-active')
  })
})

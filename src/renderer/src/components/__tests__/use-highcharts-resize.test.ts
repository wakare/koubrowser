import type Highcharts from 'highcharts'
import { createApp, defineComponent, h, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useHighchartsResize } from '../chart/use-highcharts-resize'

const resizeObservers: ResizeObserverMock[] = []

class ResizeObserverMock {
  readonly observe = vi.fn()
  readonly disconnect = vi.fn()

  constructor(readonly callback: ResizeObserverCallback) {
    resizeObservers.push(this)
  }
}

afterEach(() => {
  resizeObservers.length = 0
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('useHighchartsResize', () => {
  it('coalesces container resize events and disconnects on unmount', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    const reflow = vi.fn()
    const chart = { reflow } as unknown as Highcharts.Chart

    const component = defineComponent({
      setup() {
        const container = ref<HTMLElement | null>(null)
        useHighchartsResize(container, () => chart)
        return () => h('div', { ref: container })
      }
    })

    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(component)
    app.mount(host)

    expect(resizeObservers).toHaveLength(1)
    expect(resizeObservers[0].observe).toHaveBeenCalledOnce()

    resizeObservers[0].callback([], resizeObservers[0] as unknown as ResizeObserver)
    resizeObservers[0].callback([], resizeObservers[0] as unknown as ResizeObserver)
    await Promise.resolve()

    expect(reflow).toHaveBeenCalledOnce()

    app.unmount()
    expect(resizeObservers[0].disconnect).toHaveBeenCalledOnce()
  })
})

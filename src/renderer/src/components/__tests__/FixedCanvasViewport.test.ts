import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import FixedCanvasViewport from '../layout/FixedCanvasViewport.vue'

let resizeCallback: ResizeObserverCallback

class ResizeObserverMock {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback
  }

  observe = vi.fn()
  disconnect = vi.fn()
}

describe('FixedCanvasViewport.vue', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('updates rendered geometry across compact, baseline, and wide containers', async () => {
    let availableWidth = 480
    const wrapper = mount(FixedCanvasViewport, {
      props: {
        logicalWidth: 600,
        logicalHeight: 360
      },
      slots: {
        default: '<div class="logical-content">map</div>'
      }
    })
    const viewport = wrapper.get('.fixed-canvas-viewport')
    const content = wrapper.get('.fixed-canvas-content')

    Object.defineProperty(viewport.element, 'clientWidth', {
      configurable: true,
      get: () => availableWidth
    })
    await flushPromises()

    expect((viewport.element as HTMLElement).style.height).toBe('288px')
    expect((content.element as HTMLElement).style.transform).toBe('scale(0.8)')
    expect((content.element as HTMLElement).style.left).toBe('0px')

    availableWidth = 600
    resizeCallback([], {} as ResizeObserver)
    await nextTick()

    expect((viewport.element as HTMLElement).style.height).toBe('360px')
    expect((content.element as HTMLElement).style.transform).toBe('scale(1)')
    expect((content.element as HTMLElement).style.left).toBe('0px')

    availableWidth = 900
    resizeCallback([], {} as ResizeObserver)
    await nextTick()

    expect((viewport.element as HTMLElement).style.height).toBe('360px')
    expect((content.element as HTMLElement).style.transform).toBe('scale(1)')
    expect((content.element as HTMLElement).style.left).toBe('150px')
  })
})

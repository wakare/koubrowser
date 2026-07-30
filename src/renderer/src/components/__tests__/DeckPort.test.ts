import { shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DeckPort from '../DeckPort.vue'

const deckInfosMock = vi.hoisted(() => vi.fn<() => Array<Record<string, unknown>>>(() => []))

vi.mock('@renderer/store/svdata', () => ({
  svdata: {
    isShipDataOk: true,
    mapinfos: [],
    mstMapareaType: () => undefined
  }
}))

vi.mock('@renderer/store/mapinfo', () => ({
  mapInfo: {
    api_map_info: [{ api_gauge_type: 3 }]
  }
}))

vi.mock('@renderer/util', () => ({
  RUtil: {
    deckInfos: deckInfosMock
  }
}))

const mountDeckPort = () =>
  shallowMount(DeckPort, {
    global: {
      stubs: {
        FixedCanvasViewport: {
          name: 'FixedCanvasViewport',
          props: ['logicalWidth', 'logicalHeight'],
          template: '<div class="fixed-canvas-test-stub"><slot /></div>'
        },
        'b-tooltip': {
          template: '<div><slot name="content" /><slot /></div>'
        },
        'b-tabs': {
          template: '<div><slot /></div>'
        },
        'b-tab-item': {
          template: '<div><slot name="header" /><slot /></div>'
        }
      }
    }
  })

describe('DeckPort.vue', () => {
  beforeEach(() => {
    deckInfosMock.mockReturnValue([])
  })

  it('keeps both fixed-width information regions inside scalable canvases', () => {
    const wrapper = mountDeckPort()

    const viewports = wrapper.findAllComponents({ name: 'FixedCanvasViewport' })

    expect(wrapper.find('.deck-port-root').exists()).toBe(true)
    expect(viewports).toHaveLength(2)
    expect(viewports[0].props()).toMatchObject({
      logicalWidth: 600,
      logicalHeight: 333
    })
    expect(viewports[1].props()).toMatchObject({
      logicalWidth: 600,
      logicalHeight: 660
    })
  })

  it('expands the selected deck canvas so a seventh ship is not clipped', () => {
    deckInfosMock.mockReturnValue([
      {
        name: '第一艦隊',
        deck: {
          api_id: 1,
          api_ship: [1, 2, 3, 4, 5, 6, 7]
        },
        inMission: false,
        seiku: 0,
        yusou: 0,
        isLock: false
      }
    ])

    const wrapper = mountDeckPort()
    const deckViewport = wrapper.findAllComponents({
      name: 'FixedCanvasViewport'
    })[0]

    expect(deckViewport.props('logicalHeight')).toBe(413)
    expect(wrapper.get('.deck-tabs').attributes('style')).toContain('height: 413px')
  })

  it('renders the full striking-force transport value and A-rank estimate', () => {
    deckInfosMock.mockReturnValue([
      {
        name: '第一艦隊',
        deck: {
          api_id: 1,
          api_ship: [1, 2, 3, 4, 5, 6, 7]
        },
        inMission: false,
        seiku: 0,
        yusou: 139,
        isLock: false
      }
    ])

    const wrapper = mountDeckPort()

    expect(wrapper.text()).toContain('輸送')
    expect(wrapper.text()).toContain('139/97')
  })
})

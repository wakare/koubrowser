import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiQuestCategory } from '@common/kcs'
import type { QuestGuideRecommendation } from '@common/quest_guide'

vi.mock('@renderer/store/global_setting', () => ({
  translateApp: (key: string, options?: { params?: Record<string, unknown> }) =>
    options?.params ? `${key}:${JSON.stringify(options.params)}` : key
}))

function recommendation(
  questId: number,
  status: QuestGuideRecommendation['status'] = 'available'
): QuestGuideRecommendation {
  return {
    quest: {
      api_no: questId,
      api_title: `任務${questId}`,
      api_category: ApiQuestCategory.syutugeki
    },
    status,
    readiness: 'ready',
    knowledge: { conflicts: [] }
  } as unknown as QuestGuideRecommendation
}

describe('QuestStrategyRoute.vue', () => {
  beforeEach(() => {
    localStorage.clear()
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { openExternalUrl: vi.fn().mockResolvedValue(undefined) }
    })
  })

  afterEach(() => {
    localStorage.clear()
    Reflect.deleteProperty(window, 'api')
  })

  async function render(recommendations: QuestGuideRecommendation[]) {
    const { default: QuestStrategyRoute } = await import('../QuestStrategyRoute.vue')
    const wrapper = mount(QuestStrategyRoute, {
      props: {
        recommendations,
        availableMapKeys: new Set([
          '1-2',
          '1-3',
          '1-4',
          '1-5',
          '2-1',
          '2-2',
          '2-3',
          '2-5',
          '5-1',
          '5-3',
          '5-4',
          '6-4',
          '6-5',
          '4-1',
          '4-2',
          '4-3',
          '4-4',
          '4-5',
          '7-1',
          '7-2'
        ]),
        mapDataAvailable: true,
        activeQuestCount: 1,
        questCapacity: 5,
        now: new Date('2026-07-31T00:00:00.000Z')
      }
    })
    await flushPromises()
    return wrapper
  }

  it('opens on one actionable route while keeping selection and audit details collapsed', async () => {
    const wrapper = await render([
      recommendation(229),
      recommendation(264, 'active'),
      recommendation(845, 'active')
    ])

    expect(wrapper.get('.quest-strategy-hero').text()).toContain('"map":"4-2"')
    expect(wrapper.get('.quest-strategy-hero').text()).toContain('#264')
    expect(wrapper.get('.quest-strategy-hero').text()).toContain('#229')
    expect(wrapper.get('.quest-strategy-controls').attributes('open')).toBeUndefined()
    expect(wrapper.get('.quest-strategy-summary').attributes('open')).toBeUndefined()
    expect(wrapper.find('.quest-strategy-zero-ready').exists()).toBe(false)

    await wrapper.get('.quest-strategy-controls > summary').trigger('click')
    expect(wrapper.get('.quest-strategy-controls').attributes()).toHaveProperty('open')
    expect(wrapper.findAll('.quest-strategy-candidate').length).toBe(3)
  })

  it('discards an incompatible legacy selection and falls back to the coherent default', async () => {
    localStorage.setItem('questStrategyRouteSelection:v1', JSON.stringify([303, 830]))

    const wrapper = await render([recommendation(229), recommendation(264, 'active')])

    expect(wrapper.get('.quest-strategy-hero').text()).toContain('"map":"4-2"')
    expect(localStorage.getItem('questStrategyRouteSelection:v1')).toBeNull()
    expect(localStorage.getItem('questStrategyRouteSelection:v2')).toBeNull()
  })

  it('renders the complete five-map default bundle for compatible southwest tasks', async () => {
    const wrapper = await render([
      recommendation(226, 'active'),
      recommendation(284, 'active'),
      recommendation(894, 'active')
    ])

    expect(wrapper.get('.quest-strategy-hero').text()).toContain('"map":"2-1"')
    expect(wrapper.find('.quest-strategy-zero-ready').exists()).toBe(false)
    expect(wrapper.findAll('.quest-strategy-step')).toHaveLength(5)
    const routeText = wrapper.findAll('.quest-strategy-step').map((step) => step.text())
    for (const mapKey of ['1-3', '1-4', '2-1', '2-2', '2-3']) {
      expect(routeText.some((text) => text.includes(`"map":"${mapKey}"`))).toBe(true)
    }
    expect(wrapper.get('.quest-strategy-summary').text()).not.toContain('quest.strategy.uncovered')
  })

  it('renders the complete five-map western quarterly route', async () => {
    const wrapper = await render([recommendation(845, 'active')])

    expect(wrapper.findAll('.quest-strategy-step')).toHaveLength(5)
    const routeText = wrapper.findAll('.quest-strategy-step').map((step) => step.text())
    for (const mapKey of ['4-1', '4-2', '4-3', '4-4', '4-5']) {
      expect(routeText.some((text) => text.includes(`"map":"${mapKey}"`))).toBe(true)
    }
    expect(wrapper.get('.quest-strategy-summary').text()).not.toContain('quest.strategy.uncovered')
  })

  it('renders the ordered anchorage route with distinct 7-2 targets', async () => {
    const wrapper = await render([recommendation(893, 'active')])

    expect(wrapper.findAll('.quest-strategy-step')).toHaveLength(4)
    const routeText = wrapper.findAll('.quest-strategy-step').map((step) => step.text())
    expect(routeText.some((text) => text.includes('"map":"1-5"'))).toBe(true)
    expect(routeText.some((text) => text.includes('"map":"7-1"'))).toBe(true)
    expect(routeText.filter((text) => text.includes('"map":"7-2"'))).toHaveLength(2)
    expect(routeText.some((text) => text.includes('G'))).toBe(true)
    expect(routeText.some((text) => text.includes('M'))).toBe(true)
    expect(wrapper.get('.quest-strategy-summary').text()).not.toContain('quest.strategy.uncovered')
  })

  it('shows named ships explicitly for the reviewed Fifth Squadron route', async () => {
    const wrapper = await render([recommendation(249, 'active')])

    expect(wrapper.findAll('.quest-strategy-step')).toHaveLength(1)
    expect(wrapper.get('.quest-strategy-step').text()).toContain('妙高・那智・羽黒')
    expect(wrapper.get('.quest-strategy-step').text()).toContain('B-F-J-O')
  })

  it('shows the designated battleship classes and both reviewed 5-1 starts', async () => {
    const wrapper = await render([recommendation(259, 'active')])

    expect(wrapper.findAll('.quest-strategy-step')).toHaveLength(1)
    expect(wrapper.get('.quest-strategy-step').text()).toContain('大和型・長門型・伊勢型・扶桑型')
    expect(wrapper.get('.quest-strategy-step').text()).toContain('B-E-G-J / A-D-E-G-J')
  })

  it('shows both named-ship groups and night-battle route for quest 875', async () => {
    const wrapper = await render([recommendation(875, 'active')])

    expect(wrapper.findAll('.quest-strategy-step')).toHaveLength(1)
    expect(wrapper.get('.quest-strategy-step').text()).toContain('長波改二系')
    expect(wrapper.get('.quest-strategy-step').text()).toContain('高波改・沖波改・朝霜改系')
    expect(wrapper.get('.quest-strategy-step').text()).toContain('A-D-E-H-I-J-M-P')
  })

  it('renders all three ordered New Mikawa stages with the named-ship requirement', async () => {
    const wrapper = await render([recommendation(888, 'active')])

    expect(wrapper.findAll('.quest-strategy-step')).toHaveLength(3)
    const routeText = wrapper.findAll('.quest-strategy-step').map((step) => step.text())
    expect(routeText.some((text) => text.includes('B-C-F-J'))).toBe(true)
    expect(routeText.some((text) => text.includes('D-G-I-O-K-E-Q'))).toBe(true)
    expect(routeText.some((text) => text.includes('A-D-E-H-I-J-M-P'))).toBe(true)
    expect(routeText.every((text) => text.includes('鳥海・青葉・衣笠・加古・古鷹・天龍・夕張'))).toBe(
      true
    )
  })

  it('renders all four Sixth Squadron stages with flagship and Yura requirements', async () => {
    const wrapper = await render([recommendation(903, 'active')])

    expect(wrapper.findAll('.quest-strategy-step')).toHaveLength(4)
    const routeText = wrapper.findAll('.quest-strategy-step').map((step) => step.text())
    for (const mapKey of ['5-1', '5-4', '6-4', '6-5']) {
      expect(routeText.some((text) => text.includes(`"map":"${mapKey}"`))).toBe(true)
    }
    expect(routeText.every((text) => text.includes('夕張改二型を旗艦'))).toBe(true)
    expect(routeText.every((text) => text.includes('随伴 由良改二 1 隻'))).toBe(true)
    expect(wrapper.get('.quest-strategy-summary').text()).not.toContain(
      'quest.strategy.uncovered'
    )
  })

  it('persists an explicit reviewed-route choice only after manual interaction', async () => {
    const wrapper = await render([recommendation(229), recommendation(257, 'active')])
    await wrapper.get('.quest-strategy-controls > summary').trigger('click')
    const reviewed = wrapper
      .findAll('label.quest-strategy-candidate')
      .find((candidate) => candidate.text().includes('#229'))

    expect(reviewed).toBeDefined()
    await reviewed!.get('input').setValue(true)

    expect(JSON.parse(localStorage.getItem('questStrategyRouteSelection:v2') ?? 'null')).toEqual({
      schemaVersion: 2,
      mode: 'manual',
      questIds: [257, 229]
    })
  })
})

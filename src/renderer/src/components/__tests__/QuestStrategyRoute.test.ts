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
        availableMapKeys: new Set(['1-2', '1-3', '1-4', '1-5', '2-1', '2-2', '2-3', '4-2']),
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

  it('persists an explicit partial-route choice only after manual interaction', async () => {
    const wrapper = await render([recommendation(229), recommendation(845, 'active')])
    await wrapper.get('.quest-strategy-controls > summary').trigger('click')
    await wrapper.get('.quest-strategy-candidate-group > summary').trigger('click')
    const partial = wrapper
      .findAll('label.quest-strategy-candidate')
      .find((candidate) => candidate.text().includes('#845'))

    expect(partial).toBeDefined()
    await partial!.get('input').setValue(true)

    expect(JSON.parse(localStorage.getItem('questStrategyRouteSelection:v2') ?? 'null')).toEqual({
      schemaVersion: 2,
      mode: 'manual',
      questIds: [229, 845]
    })
  })
})

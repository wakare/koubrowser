import fs from 'node:fs'
import path from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { QuestGrowthFallbackInput } from '@common/quest_growth_evaluator'

vi.mock('@renderer/store/global_setting', () => ({
  translateApp: (key: string, options?: { params?: Record<string, unknown> }) =>
    options?.params ? `${key}:${JSON.stringify(options.params)}` : key
}))

const Inputs: QuestGrowthFallbackInput[] = [
  {
    observableId: 'resources.bands',
    freshness: 'fresh',
    totals: {
      fuel: 123456,
      ammunition: 234567,
      steel: 345678,
      bauxite: 456789,
      repairBuckets: 987
    },
    posture: 'unset'
  },
  {
    observableId: 'modernization.material-summary',
    freshness: 'fresh',
    visibleUnlockedShipCount: 9001
  }
]

describe('QuestGrowthCheck.vue', () => {
  it('shows non-empty priorities and a compact summary without concrete routes', async () => {
    const { default: QuestGrowthCheck } = await import('../QuestGrowthCheck.vue')
    const wrapper = mount(QuestGrowthCheck, { props: { inputs: Inputs } })

    expect(wrapper.get('.quest-growth-route-notice').text()).toBe('quest.growth.routePending')
    expect(wrapper.get('.quest-growth-counts').text()).toContain(
      'quest.growth.summary.missing:{"count":1}'
    )
    expect(wrapper.get('.quest-growth-counts').text()).toContain(
      'quest.growth.summary.manual:{"count":1}'
    )
    expect(wrapper.findAll('.quest-growth-priority li').length).toBeGreaterThan(0)
    expect(wrapper.get('.quest-growth-details').attributes('open')).toBeUndefined()
    expect(wrapper.findAll('.quest-growth-row')).toHaveLength(2)
    expect(wrapper.attributes('data-route-output')).toBe('prohibited')
    expect(wrapper.html()).not.toContain('routeId')
    expect(wrapper.html()).not.toContain('routeSteps')
    expect(wrapper.html()).not.toContain('mapKey')
  })

  it('does not render measured totals, counts, identifiers, or raw outcome codes', async () => {
    const { default: QuestGrowthCheck } = await import('../QuestGrowthCheck.vue')
    const wrapper = mount(QuestGrowthCheck, { props: { inputs: Inputs } })
    const html = wrapper.html()

    expect(html).not.toContain('123456')
    expect(html).not.toContain('234567')
    expect(html).not.toContain('9001')
    expect(html).not.toContain('SELECT_RESOURCE_POSTURE')
    expect(html).not.toContain('ROUTE_OUTPUT_PROHIBITED_IN_PURE_EVALUATOR')
  })

  it('has no persistence, external I/O, or route builder dependency', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src', 'renderer', 'src', 'components', 'QuestGrowthCheck.vue'),
      'utf8'
    )

    expect(source).not.toContain('localStorage')
    expect(source).not.toContain('sessionStorage')
    expect(source).not.toContain('fetch(')
    expect(source).not.toContain('XMLHttpRequest')
    expect(source).not.toContain('ipcRenderer')
    expect(source).not.toContain('openExternalUrl')
    expect(source).not.toContain('buildQuestStrategyRoutePlan')
  })
})

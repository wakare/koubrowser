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
  async function render(
    focus: 'unset' | 'resources' | 'asw' | 'eo' | 'breadth' = 'unset',
    inputs: QuestGrowthFallbackInput[] = Inputs
  ) {
    const { default: QuestGrowthCheck } = await import('../QuestGrowthCheck.vue')
    return mount(QuestGrowthCheck, {
      props: {
        inputs,
        resourcePosture: 'unset',
        focus,
        now: new Date('2026-08-02T02:07:16.639Z')
      }
    })
  }

  it('shows non-empty priorities and keeps reviewed routes closed by default', async () => {
    const wrapper = await render()

    expect(wrapper.get('.quest-growth-route-notice').text()).toBe('quest.growth.routeAvailable')
    expect(wrapper.get('.quest-growth-counts').text()).toContain(
      'quest.growth.summary.missing:{"count":1}'
    )
    expect(wrapper.get('.quest-growth-counts').text()).toContain(
      'quest.growth.summary.manual:{"count":1}'
    )
    expect(wrapper.findAll('.quest-growth-priority li').length).toBeGreaterThan(0)
    expect(wrapper.get('.quest-growth-details').attributes('open')).toBeUndefined()
    expect(wrapper.get('.quest-growth-reviewed-routes').attributes('open')).toBeUndefined()
    expect(wrapper.find('.quest-growth-reviewed-route').exists()).toBe(false)
    expect(wrapper.findAll('.quest-growth-row')).toHaveLength(2)
    expect(wrapper.attributes('data-route-output')).toBe('reviewed-opt-in')
    expect(wrapper.html()).not.toContain('routeId')
    expect(wrapper.html()).not.toContain('routeSteps')
    expect(wrapper.html()).not.toContain('mapKey')
  })

  it('does not render measured totals, counts, identifiers, or raw outcome codes', async () => {
    const wrapper = await render()
    const html = wrapper.html()

    expect(html).not.toContain('123456')
    expect(html).not.toContain('234567')
    expect(html).not.toContain('9001')
    expect(html).not.toContain('SELECT_RESOURCE_POSTURE')
    expect(html).not.toContain('ROUTE_OUTPUT_PROHIBITED_IN_PURE_EVALUATOR')
  })

  it('shows measured local facts only for the selected focus without a readiness verdict', async () => {
    const wrapper = await render('resources')

    expect(wrapper.get('.quest-growth-facts').attributes('data-focus')).toBe('resources')
    expect(wrapper.findAll('.quest-growth-facts dd').map((fact) => fact.text())).toEqual([
      '123,456',
      '234,567',
      '345,678',
      '456,789',
      '987'
    ])
    expect(wrapper.get('.quest-growth-facts').text()).toContain('quest.growth.facts.description')
    expect(wrapper.get('.quest-growth-facts').text()).not.toContain('route')
  })

  it('does not present zero counts when focused local facts are unavailable', async () => {
    const wrapper = await render('asw', [
      {
        observableId: 'ships.asw-capable-summary',
        freshness: 'unknown',
        sonarCount: 0,
        depthChargeCount: 0,
        targetSelected: true,
        reviewedTargetRule: false,
        intendedFleetConfirmed: false
      }
    ])

    expect(wrapper.findAll('.quest-growth-facts dd')).toHaveLength(1)
    expect(wrapper.get('.quest-growth-facts dd').text()).toBe('quest.growth.fact.state.unknown')
    expect(wrapper.get('.quest-growth-facts').text()).not.toContain('quest.growth.fact.sonarCount')
  })

  it('shows anonymous fleet breadth facts without claiming event readiness', async () => {
    const wrapper = await render('breadth', [
      {
        observableId: 'capability.breadth-summary',
        freshness: 'fresh',
        ownedShipCount: 120,
        shipTypeCount: 18,
        minimumLevel: 1,
        maximumLevel: 99,
        equipmentCategoryCount: 27,
        resourceTotalsAvailable: true,
        eventGoalSelected: false,
        categorySelected: true
      }
    ])

    expect(wrapper.findAll('.quest-growth-facts dd').map((fact) => fact.text())).toEqual([
      '120',
      '18',
      'quest.growth.fact.levelRangeValue:{"minimum":1,"maximum":99}',
      '27',
      'quest.growth.fact.state.available'
    ])
    expect(wrapper.get('.quest-growth-facts').text()).not.toContain('event-ready')
    expect(wrapper.attributes('data-route-output')).toBe('reviewed-opt-in')
  })

  it('shows only the reviewed resource route after explicit expansion', async () => {
    const wrapper = await render('resources')
    const details = wrapper.get('.quest-growth-reviewed-routes')

    ;(details.element as HTMLDetailsElement).open = true
    await details.trigger('toggle')

    expect(wrapper.findAll('.quest-growth-reviewed-route')).toHaveLength(1)
    expect(wrapper.get('.quest-growth-reviewed-route').text()).toContain(
      '遠征05「海上護衛任務」資源ループ（手動確認）'
    )
    expect(wrapper.get('.quest-growth-reviewed-route').text()).not.toContain(
      '1-5 3戦撤退・基礎対潜練習'
    )
    expect(wrapper.get('.quest-growth-route-badges').text()).toContain(
      'quest.growth.routes.manual'
    )
  })

  it('shows the reviewed monthly 1-5 EO route for the EO focus', async () => {
    const wrapper = await render('eo')
    const details = wrapper.get('.quest-growth-reviewed-routes')

    ;(details.element as HTMLDetailsElement).open = true
    await details.trigger('toggle')

    expect(wrapper.findAll('.quest-growth-reviewed-route')).toHaveLength(1)
    expect(wrapper.get('.quest-growth-reviewed-route').text()).toContain(
      '1-5 月度EO勲章ループ（手動確認）'
    )
    expect(wrapper.get('.quest-growth-reviewed-route').text()).toContain('A-D-F-G-J')
    expect(wrapper.get('.quest-growth-reviewed-route').text()).toContain(
      '月内に4回目の旗艦撃沈'
    )
  })

  it('hides an expired route and requests knowledge review', async () => {
    const wrapper = await render('asw')
    await wrapper.setProps({ now: new Date('2026-10-01T00:00:00.000Z') })
    const details = wrapper.get('.quest-growth-reviewed-routes')

    ;(details.element as HTMLDetailsElement).open = true
    await details.trigger('toggle')

    expect(wrapper.find('.quest-growth-reviewed-route').exists()).toBe(false)
    expect(wrapper.get('.quest-growth-route-empty').text()).toBe(
      'quest.growth.routes.reviewRequired'
    )
  })

  it('emits session-only resource posture and growth focus selections', async () => {
    const wrapper = await render()
    const selects = wrapper.findAll('.quest-growth-context select')

    await selects[0].setValue('conserve')
    await selects[1].setValue('asw')

    expect(wrapper.emitted('update:resourcePosture')).toEqual([['conserve']])
    expect(wrapper.emitted('update:focus')).toEqual([['asw']])
    expect(wrapper.get('.quest-growth-context small').text()).toBe(
      'quest.growth.context.sessionOnly'
    )
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
    expect(source).toContain('selectQuestGrowthRecommendedRoutes')
  })

  it('uses component width instead of viewport width for narrow route layout', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src', 'renderer', 'src', 'components', 'QuestGrowthCheck.vue'),
      'utf8'
    )

    expect(source).toContain('container-type: inline-size')
    expect(source).toContain('@container (max-width: 320px)')
    expect(source).toContain('.quest-growth-counts')
    expect(source).toContain('flex-wrap: wrap')
    expect(source).toContain('.quest-growth-route-columns')
    expect(source).toContain('grid-template-columns: minmax(0, 1fr)')
  })
})

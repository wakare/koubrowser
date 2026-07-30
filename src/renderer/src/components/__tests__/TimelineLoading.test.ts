import { flushPromises, shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TimelineResult } from '@common/channel'

const highchartsMocks = vi.hoisted(() => ({
  chart: vi.fn(() => ({
    destroy: vi.fn(),
    update: vi.fn()
  }))
}))

vi.mock('highcharts/highstock', () => ({
  default: {
    chart: highchartsMocks.chart
  }
}))

import Timeline from '../Timeline.vue'

const timelineData: TimelineResult = [
  {
    quest_max: 0,
    quests: null
  },
  []
]

describe('Timeline score loading state', () => {
  const queryDb = vi.fn()
  const getInheritScoreList = vi.fn()

  function mountTimeline() {
    return shallowMount(Timeline, {
      props: {
        show: true,
        data: timelineData
      }
    })
  }

  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    getInheritScoreList.mockResolvedValue({ inheritScores: [] })
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        getInheritScoreList,
        queryDb
      }
    })
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows an explicit empty state after a successful empty query', async () => {
    queryDb.mockResolvedValue([])

    const wrapper = mountTimeline()
    await flushPromises()

    expect(wrapper.text()).toContain('当月戦果データがありません')
    expect(wrapper.text()).not.toContain('当月戦果データを取得中')
    expect(wrapper.find('.daily-score-help.is-error').exists()).toBe(false)
  })

  it('turns a database failure into a retryable error', async () => {
    queryDb.mockRejectedValueOnce(new Error('database unavailable'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mountTimeline()
    await flushPromises()

    expect(wrapper.get('.daily-score-help.is-error').text()).toContain(
      '当月戦果データの取得に失敗しました'
    )

    queryDb.mockResolvedValue([])
    await wrapper.get('.daily-score-help.is-error button').trigger('click')
    await flushPromises()

    expect(queryDb).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('当月戦果データがありません')
    consoleError.mockRestore()
  })

  it('times out a stalled query instead of loading forever', async () => {
    vi.useFakeTimers()
    queryDb.mockReturnValue(new Promise(() => {}))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mountTimeline()
    await vi.advanceTimersByTimeAsync(15_000)
    await flushPromises()

    expect(wrapper.find('.daily-score-help.is-error').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('当月戦果データを取得中')
    consoleError.mockRestore()
  })

  it('ignores a failed request after a newer query succeeds', async () => {
    let rejectOlder!: (reason?: unknown) => void
    const older = new Promise<never>((_resolve, reject) => {
      rejectOlder = reject
    })
    queryDb
      .mockReturnValueOnce(older)
      .mockResolvedValueOnce([])
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mountTimeline()
    await wrapper.setProps({ show: false })
    await wrapper.setProps({ show: true })
    await flushPromises()
    expect(wrapper.text()).toContain('当月戦果データがありません')

    rejectOlder(new Error('stale request failed'))
    await flushPromises()

    expect(wrapper.find('.daily-score-help.is-error').exists()).toBe(false)
    consoleError.mockRestore()
  })
})

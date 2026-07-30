import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BattleScore from '../BattleScore.vue'

describe('BattleScore loading state', () => {
  const queryDb = vi.fn()
  const getInheritScoreList = vi.fn()
  const buefyStubs = {
    BButton: true,
    BCarousel: true,
    BCarouselItem: true,
    BCheckbox: true,
    BDatepicker: true,
    BDropdown: true,
    BDropdownItem: true,
    BIcon: true,
    BMessage: true
  }

  function mountBattleScore() {
    return mount(BattleScore, {
      global: {
        stubs: buefyStubs
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
  })

  it('keeps the chart container mounted while initial data is loading', async () => {
    queryDb.mockReturnValue(new Promise(() => {}))

    const wrapper = mountBattleScore()

    expect(wrapper.find('.battlescore-load-state').exists()).toBe(true)
    expect(wrapper.find('.chart-content').exists()).toBe(true)
  })

  it('closes the loading layer after empty queries complete', async () => {
    queryDb.mockResolvedValue([])

    const wrapper = mountBattleScore()
    await flushPromises()

    expect(wrapper.find('.battlescore-load-state').exists()).toBe(false)
    expect(wrapper.find('.chart-content').exists()).toBe(true)
  })

  it('keeps compact icon controls accessible when their text is visually hidden', async () => {
    queryDb.mockResolvedValue([])

    const wrapper = mountBattleScore()
    await flushPromises()

    const inheritedButton = wrapper.get('.input-inherit-score-button b-button-stub')
    const forecastButton = wrapper.get('.forecast-score-button b-button-stub')
    expect(inheritedButton.attributes('aria-label')).toBe('引継ぎ戦果')
    expect(inheritedButton.attributes('title')).toBe('引継ぎ戦果')
    expect(forecastButton.attributes('aria-label')).toBe('戦果予測')
    expect(forecastButton.attributes('title')).toBe('戦果予測')
  })

  it('turns an initial database failure into a retryable error', async () => {
    queryDb
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockReturnValueOnce(new Promise(() => {}))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mountBattleScore()
    await flushPromises()

    expect(wrapper.get('.overlay-help.is-error').text()).toContain('戦果情報を読み込めませんでした')

    await wrapper.get('.overlay-help.is-error button').trigger('click')

    expect(queryDb).toHaveBeenCalledTimes(2)
    expect(wrapper.get('.overlay-help').text()).toContain('戦果情報を読み込み中')

    consoleError.mockRestore()
  })

  it('times out a stalled initial query instead of loading forever', async () => {
    vi.useFakeTimers()
    queryDb.mockReturnValue(new Promise(() => {}))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mountBattleScore()
    await vi.advanceTimersByTimeAsync(15_000)
    await flushPromises()

    expect(wrapper.find('.overlay-help.is-error').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('戦果情報を読み込み中')

    consoleError.mockRestore()
  })
})

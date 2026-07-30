import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LayoutHpGaugeFixture from '../LayoutHpGaugeFixture.vue'

describe('LayoutHpGaugeFixture.vue', () => {
  it('covers seven ships and every damage state with real HP meters', () => {
    const wrapper = mount(LayoutHpGaugeFixture)
    const ships = wrapper.findAll('[data-fixture-ship-index]')
    const meters = wrapper.findAll('[role="meter"]')

    expect(ships).toHaveLength(7)
    expect(meters).toHaveLength(7)
    expect(ships.map((ship) => ship.attributes('data-fixture-ship-index'))).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7'
    ])
    expect(meters.map((meter) => meter.attributes('aria-valuetext'))).toEqual([
      'HP 40/40（健全）',
      'HP 31/40（健全）',
      'HP 30/40（小破）',
      'HP 20/40（中破）',
      'HP 10/40（大破）',
      'HP 5/40（大破）',
      'HP 1/40（大破）'
    ])
    expect(wrapper.findAll('.is-normal')).toHaveLength(2)
    expect(wrapper.findAll('.is-syouha')).toHaveLength(1)
    expect(wrapper.findAll('.is-tyuuha')).toHaveLength(1)
    expect(wrapper.findAll('.is-taiha')).toHaveLength(3)
  })
})

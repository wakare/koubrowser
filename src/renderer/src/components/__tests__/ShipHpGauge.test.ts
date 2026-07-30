import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ShipHpGauge from '../ShipHpGauge.vue'

describe('ShipHpGauge.vue', () => {
  it('exposes exact HP and damage state without relying on color alone', async () => {
    const wrapper = mount(ShipHpGauge, {
      props: {
        nowHp: 10,
        maxHp: 40,
        shipName: 'テスト艦'
      }
    })

    expect(wrapper.classes()).toContain('is-taiha')
    expect(wrapper.attributes()).toMatchObject({
      role: 'meter',
      'aria-valuemin': '0',
      'aria-valuemax': '40',
      'aria-valuenow': '10',
      'aria-valuetext': 'HP 10/40（大破）',
      'aria-label': 'テスト艦 HP 10/40（大破）',
      title: 'HP 10/40（大破）'
    })
    expect(wrapper.get('.ship-hp-gauge-fill').attributes('style')).toContain(
      'width: 25%'
    )

    await wrapper.setProps({ nowHp: 31 })

    expect(wrapper.classes()).toContain('is-normal')
    expect(wrapper.attributes('aria-valuetext')).toBe('HP 31/40（健全）')
    expect(wrapper.get('.ship-hp-gauge-fill').attributes('style')).toContain(
      'width: 77.5%'
    )
  })
})

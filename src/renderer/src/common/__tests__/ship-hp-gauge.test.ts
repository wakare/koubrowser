import { describe, expect, it } from 'vitest'
import { shipHpGauge } from '@renderer/common/ship-hp-gauge'

describe('shipHpGauge', () => {
  it.each([
    [40, 40, 'normal', '健全', 100],
    [31, 40, 'normal', '健全', 77.5],
    [30, 40, 'syouha', '小破', 75],
    [20, 40, 'tyuuha', '中破', 50],
    [10, 40, 'taiha', '大破', 25]
  ] as const)(
    'maps HP %i/%i to %s',
    (nowHp, maxHp, state, label, percent) => {
      expect(shipHpGauge(nowHp, maxHp)).toEqual({
        nowHp,
        maxHp,
        percent,
        state,
        stateLabel: label,
        valueText: `HP ${nowHp}/${maxHp}（${label}）`
      })
    }
  )

  it('clamps invalid values before exposing meter attributes', () => {
    expect(shipHpGauge(-4, 0)).toEqual({
      nowHp: 0,
      maxHp: 1,
      percent: 0,
      state: 'taiha',
      stateLabel: '大破',
      valueText: 'HP 0/1（大破）'
    })
    expect(shipHpGauge(60, 40).percent).toBe(100)
  })
})

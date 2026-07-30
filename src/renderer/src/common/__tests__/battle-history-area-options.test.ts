import { describe, expect, it } from 'vitest'
import { buildBattleHistoryAreaOptions } from '../battle-history-area-options'

describe('buildBattleHistoryAreaOptions', () => {
  it('includes only event areas represented in battle history', () => {
    const options = buildBattleHistoryAreaOptions([611, 613, 611])
    const eventOptions = options.filter((option) => option.value >= 410)

    expect(eventOptions.map((option) => option.value)).toEqual([
      611,
      612,
      613,
      614,
      615
    ])
    expect(eventOptions[0].label).toBe(
      '2025年秋イベント E1 ノルウェー沖/ナルヴィク沖'
    )
    expect(eventOptions.some((option) => option.value === 621)).toBe(false)
  })

  it('uses runtime master data for a future event area', () => {
    const options = buildBattleHistoryAreaOptions(
      [631],
      [
        {
          api_maparea_id: 63,
          api_no: 1,
          api_name: '将来イベント第一海域'
        },
        {
          api_maparea_id: 63,
          api_no: 2,
          api_name: '将来イベント第二海域'
        }
      ]
    )

    expect(options.filter((option) => option.value >= 410)).toEqual([
      { value: 631, label: '63 E1 将来イベント第一海域' },
      { value: 632, label: '63 E2 将来イベント第二海域' }
    ])
  })

  it('keeps a recorded unknown map selectable without master data', () => {
    const options = buildBattleHistoryAreaOptions([641])

    expect(options.at(-1)).toEqual({
      value: 641,
      label: '64 E1 Unknown Area'
    })
  })
})

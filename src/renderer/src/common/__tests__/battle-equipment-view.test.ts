import { InternalPseudoLocale, createAppTranslator } from '@common/localization'
import { describe, expect, it } from 'vitest'
import {
  formatCombinedMapLineOfSightValues,
  formatMapLineOfSightValues,
  getBattleAirSearchText,
  getBattleAirStateLongText,
  getBattleAirStateText,
  getBattleFormationText,
  getBattleFormationShortText,
  getBattleScoreWeekdayText,
  getBattleSlotitemRangeText,
  getBattleSlotitemRareText,
  getBattleTacticsText
} from '../battle-equipment-view'

const translate = createAppTranslator(() => 'ja-JP')

describe('battle and equipment view localization', () => {
  it('resolves stable battle values without using Japanese display text as a key', () => {
    expect(getBattleAirSearchText(2, translate)).toBe('大成功')
    expect(getBattleAirStateText(1, translate)).toBe('確保')
    expect(getBattleAirStateLongText(1, translate)).toBe('制空権確保')
    expect(getBattleFormationShortText(14, translate)).toBe('第四')
    expect(getBattleFormationText(14, translate)).toBe('第四戦闘隊形')
    expect(getBattleTacticsText(3, translate)).toBe('T字有利')
  })

  it('resolves stable equipment and calendar values', () => {
    expect(getBattleSlotitemRangeText(5, translate)).toBe('超長+')
    expect(getBattleSlotitemRareText(6, translate)).toBe('SSホロ+')
    expect(getBattleScoreWeekdayText(0, translate)).toBe('日')
  })

  it('keeps unknown display indices empty', () => {
    expect(getBattleAirSearchText(undefined, translate)).toBe('')
    expect(getBattleAirStateText(99, translate)).toBe('')
    expect(getBattleAirStateLongText(99, translate)).toBe('')
    expect(getBattleFormationShortText(99, translate)).toBe('')
    expect(getBattleFormationText(99, translate)).toBe('')
    expect(getBattleTacticsText(99, translate)).toBe('')
    expect(getBattleSlotitemRangeText(99, translate)).toBe('')
    expect(getBattleSlotitemRareText(99, translate)).toBe('')
    expect(getBattleScoreWeekdayText(99, translate)).toBe('')
  })

  it('routes computed labels through the internal pseudo locale', () => {
    const pseudoTranslate = createAppTranslator(() => InternalPseudoLocale)

    expect(getBattleFormationShortText(1, pseudoTranslate)).toMatch(/^［.+］$/u)
    expect(getBattleSlotitemRareText(0, pseudoTranslate)).toMatch(/^［.+］$/u)
    expect(getBattleScoreWeekdayText(6, pseudoTranslate)).toMatch(/^［.+］$/u)
  })

  it('formats single and combined fleet map line-of-sight values after summing', () => {
    expect(formatMapLineOfSightValues([25.9, 37.1, -4.8, 0])).toBe(
      '25/37/-4/0'
    )
    expect(
      formatCombinedMapLineOfSightValues(
        [10.8, 20.2, 30.9, 40.1],
        [5.7, 6.9, 7.2, 8.8]
      )
    ).toBe('16/27/38/48')
  })
})

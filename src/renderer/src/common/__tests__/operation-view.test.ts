import { InternalPseudoLocale, createAppTranslator } from '@common/localization'
import { FACutin, SenseiTaisenType, YCutin, YSCutin } from '@common/kcs'
import { MissionResult } from '@common/mission'
import { describe, expect, it } from 'vitest'
import {
  escapeHtmlText,
  getOperationDeckName,
  getOperationFACutInText,
  getOperationMissionResultText,
  getOperationNightAirCutInText,
  getOperationNightCutInText,
  getOperationRangeText,
  getOperationSenseiTaisenText,
  getOperationSpeedText
} from '../operation-view'

const translate = createAppTranslator(() => 'ja-JP')

describe('operation view localization', () => {
  it('resolves stable operation enums without using display text as a key', () => {
    expect(getOperationDeckName(0, translate)).toBe('第一艦隊')
    expect(getOperationSpeedText(2, translate)).toBe('高速')
    expect(getOperationRangeText(5, translate)).toBe('超長+')
    expect(getOperationSenseiTaisenText(SenseiTaisenType.auto, translate)).toBe(
      '自動対潜'
    )
    expect(getOperationFACutInText(FACutin.SYU_TEK, translate)).toBe('主徹')
    expect(
      getOperationNightCutInText(YCutin.KUTIKU_SYU_GYO_DEN3, false, translate)
    ).toBe('主魚電(1.7)')
    expect(
      getOperationNightAirCutInText(YSCutin.SEN1_YAKANKOKU2, true, translate)
    ).toBe('戦他他')
    expect(
      getOperationMissionResultText(MissionResult.succeeded2, translate)
    ).toBe('大成功')
  })

  it('keeps unknown optional display indices empty', () => {
    expect(getOperationDeckName(99, translate)).toBe('')
    expect(getOperationSpeedText(99, translate)).toBe('')
    expect(getOperationRangeText(99, translate)).toBe('')
  })

  it('routes operation labels through the internal pseudo locale', () => {
    const pseudoTranslate = createAppTranslator(() => InternalPseudoLocale)

    expect(getOperationDeckName(0, pseudoTranslate)).toMatch(/^［.+］$/u)
    expect(getOperationMissionResultText(MissionResult.failed, pseudoTranslate)).toMatch(
      /^［.+］$/u
    )
  })

  it('escapes translated or game-owned text before inserting it into HTML', () => {
    expect(escapeHtmlText(`<艦 name="A&B">'`)).toBe(
      '&lt;艦 name=&quot;A&amp;B&quot;&gt;&#39;'
    )
  })
})

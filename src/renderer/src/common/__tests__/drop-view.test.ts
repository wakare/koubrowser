import { AggregateShipType } from '@common/calc_record'
import { InternalPseudoLocale, createAppTranslator } from '@common/localization'
import { ApiShipBacks } from '@common/kcs'
import { describe, expect, it } from 'vitest'
import {
  getDropShipRarityText,
  getDropShipTypeText
} from '../drop-view'

const translate = createAppTranslator(() => 'ja-JP')

describe('drop view localization', () => {
  it('resolves aggregate ship types from stable numeric values', () => {
    expect(getDropShipTypeText(AggregateShipType.nodrop, translate)).toBe(
      'ドロップなし'
    )
    expect(getDropShipTypeText(AggregateShipType.senkan, translate)).toBe(
      '戦艦級'
    )
    expect(getDropShipTypeText(AggregateShipType.hojo, translate)).toBe('補助')
  })

  it('groups stable ship rarity values into display labels', () => {
    expect(getDropShipRarityText(ApiShipBacks.none, translate)).toBe('-')
    expect(getDropShipRarityText(ApiShipBacks.common3, translate)).toBe(
      'コモン'
    )
    expect(getDropShipRarityText(ApiShipBacks.rare2, translate)).toBe('レア')
    expect(getDropShipRarityText(ApiShipBacks.unique3, translate)).toBe(
      'ユニーク'
    )
  })

  it('routes computed drop labels through the internal pseudo locale', () => {
    const pseudoTranslate = createAppTranslator(() => InternalPseudoLocale)

    expect(
      getDropShipTypeText(AggregateShipType.kutikukan, pseudoTranslate)
    ).toMatch(/^［.+］$/u)
    expect(
      getDropShipRarityText(ApiShipBacks.rare1, pseudoTranslate)
    ).toMatch(/^［.+］$/u)
  })
})

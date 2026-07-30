import type { AppMessageKey, AppTranslator } from '@common/localization'
import { AggregateShipType } from '@common/calc_record'
import { ApiShipBacks } from '@common/kcs'

type StaticDropKey = Extract<AppMessageKey, `drop.${string}`>

const translateStatic = (
  translate: AppTranslator,
  key: StaticDropKey
): string => (translate as (messageKey: AppMessageKey) => string)(key)

const shipTypeKeys = {
  [AggregateShipType.nodrop]: 'drop.shipType.noDrop',
  [AggregateShipType.unknown]: 'drop.shipType.unknown',
  [AggregateShipType.senkan]: 'drop.shipType.battleship',
  [AggregateShipType.kubo]: 'drop.shipType.carrier',
  [AggregateShipType.jyujyun]: 'drop.shipType.heavyCruiser',
  [AggregateShipType.keijyun]: 'drop.shipType.lightCruiser',
  [AggregateShipType.kutikukan]: 'drop.shipType.destroyer',
  [AggregateShipType.kaiboukan]: 'drop.shipType.escort',
  [AggregateShipType.sensuikan]: 'drop.shipType.submarine',
  [AggregateShipType.hojo]: 'drop.shipType.auxiliary'
} as const satisfies Record<AggregateShipType, StaticDropKey>

export function getDropShipTypeText(
  type: AggregateShipType,
  translate: AppTranslator
): string {
  return translateStatic(translate, shipTypeKeys[type])
}

export function getDropShipRarityText(
  rarity: ApiShipBacks,
  translate: AppTranslator
): string {
  if (rarity === ApiShipBacks.none) {
    return translateStatic(translate, 'drop.shipRarity.none')
  }
  if (rarity <= ApiShipBacks.common3) {
    return translateStatic(translate, 'drop.shipRarity.common')
  }
  if (rarity <= ApiShipBacks.rare2) {
    return translateStatic(translate, 'drop.shipRarity.rare')
  }
  return translateStatic(translate, 'drop.shipRarity.unique')
}

import type { AppMessageKey, AppTranslator } from '@common/localization'
import type {
  AACutin,
  FACutin,
  SenseiTaisenType,
  YCutin,
  YSCutin
} from '@common/kcs'
import { MissionResult, type MissionResult as MissionResultValue } from '@common/mission'
export { escapeHtmlText } from './localized-html'

type StaticOperationKey = Extract<AppMessageKey, `operation.${string}`>

const translateStatic = (translate: AppTranslator, key: StaticOperationKey): string =>
  (translate as (messageKey: AppMessageKey) => string)(key)

const deckNameKeys = [
  'operation.deck.deckName.1',
  'operation.deck.deckName.2',
  'operation.deck.deckName.3',
  'operation.deck.deckName.4'
] as const satisfies readonly StaticOperationKey[]

const speedKeys = [
  undefined,
  'operation.deck.speed.1',
  'operation.deck.speed.2',
  'operation.deck.speed.3',
  'operation.deck.speed.4'
] as const

const rangeKeys = [
  undefined,
  'operation.deck.range.1',
  'operation.deck.range.2',
  'operation.deck.range.3',
  'operation.deck.range.4',
  'operation.deck.range.5'
] as const

const senseiTaisenKeys = [
  'operation.deck.senseiTaisen.0',
  'operation.deck.senseiTaisen.1'
] as const satisfies readonly StaticOperationKey[]

const faCutInKeys = [
  'operation.deck.cutIn.fa.0',
  'operation.deck.cutIn.fa.1',
  'operation.deck.cutIn.fa.2',
  'operation.deck.cutIn.fa.3',
  'operation.deck.cutIn.fa.4',
  'operation.deck.cutIn.fa.5',
  'operation.deck.cutIn.fa.6'
] as const satisfies readonly StaticOperationKey[]

const aaCutInKeys = [
  'operation.deck.cutIn.aa.0',
  'operation.deck.cutIn.aa.1',
  'operation.deck.cutIn.aa.2'
] as const satisfies readonly StaticOperationKey[]

const nightCutInKeys = {
  0: ['operation.deck.cutIn.night.0.long', 'operation.deck.cutIn.night.0.short'],
  1: ['operation.deck.cutIn.night.1.long', 'operation.deck.cutIn.night.1.short'],
  2: ['operation.deck.cutIn.night.2.long', 'operation.deck.cutIn.night.2.short'],
  3: ['operation.deck.cutIn.night.3.long', 'operation.deck.cutIn.night.3.short'],
  4: ['operation.deck.cutIn.night.4.long', 'operation.deck.cutIn.night.4.short'],
  20: ['operation.deck.cutIn.night.20.long', 'operation.deck.cutIn.night.20.short'],
  21: ['operation.deck.cutIn.night.21.long', 'operation.deck.cutIn.night.21.short'],
  22: ['operation.deck.cutIn.night.22.long', 'operation.deck.cutIn.night.22.short'],
  23: ['operation.deck.cutIn.night.23.long', 'operation.deck.cutIn.night.23.short'],
  24: ['operation.deck.cutIn.night.24.long', 'operation.deck.cutIn.night.24.short'],
  25: ['operation.deck.cutIn.night.25.long', 'operation.deck.cutIn.night.25.short'],
  30: ['operation.deck.cutIn.night.30.long', 'operation.deck.cutIn.night.30.short'],
  31: ['operation.deck.cutIn.night.31.long', 'operation.deck.cutIn.night.31.short'],
  32: ['operation.deck.cutIn.night.32.long', 'operation.deck.cutIn.night.32.short'],
  33: ['operation.deck.cutIn.night.33.long', 'operation.deck.cutIn.night.33.short'],
  34: ['operation.deck.cutIn.night.34.long', 'operation.deck.cutIn.night.34.short'],
  35: ['operation.deck.cutIn.night.35.long', 'operation.deck.cutIn.night.35.short'],
  40: ['operation.deck.cutIn.night.40.long', 'operation.deck.cutIn.night.40.short'],
  41: ['operation.deck.cutIn.night.41.long', 'operation.deck.cutIn.night.41.short'],
  50: ['operation.deck.cutIn.night.50.long', 'operation.deck.cutIn.night.50.short'],
  51: ['operation.deck.cutIn.night.51.long', 'operation.deck.cutIn.night.51.short'],
  52: ['operation.deck.cutIn.night.52.long', 'operation.deck.cutIn.night.52.short'],
  53: ['operation.deck.cutIn.night.53.long', 'operation.deck.cutIn.night.53.short'],
  100: ['operation.deck.cutIn.night.100.long', 'operation.deck.cutIn.night.100.short'],
  101: ['operation.deck.cutIn.night.101.long', 'operation.deck.cutIn.night.101.short']
} as const satisfies Record<YCutin, readonly [StaticOperationKey, StaticOperationKey]>

const nightAirCutInKeys = {
  0: ['operation.deck.cutIn.nightAir.0.long', 'operation.deck.cutIn.nightAir.0.short'],
  1: ['operation.deck.cutIn.nightAir.1.long', 'operation.deck.cutIn.nightAir.1.short'],
  2: ['operation.deck.cutIn.nightAir.2.long', 'operation.deck.cutIn.nightAir.2.short'],
  3: ['operation.deck.cutIn.nightAir.3.long', 'operation.deck.cutIn.nightAir.3.short'],
  4: ['operation.deck.cutIn.nightAir.4.long', 'operation.deck.cutIn.nightAir.4.short'],
  5: ['operation.deck.cutIn.nightAir.5.long', 'operation.deck.cutIn.nightAir.5.short'],
  6: ['operation.deck.cutIn.nightAir.6.long', 'operation.deck.cutIn.nightAir.6.short'],
  7: ['operation.deck.cutIn.nightAir.7.long', 'operation.deck.cutIn.nightAir.7.short'],
  8: ['operation.deck.cutIn.nightAir.8.long', 'operation.deck.cutIn.nightAir.8.short']
} as const satisfies Record<YSCutin, readonly [StaticOperationKey, StaticOperationKey]>

export function getOperationDeckName(index: number, translate: AppTranslator): string {
  const key = deckNameKeys[index]
  return key ? translateStatic(translate, key) : ''
}

export function getOperationSpeedText(speed: number, translate: AppTranslator): string {
  const key = speedKeys[speed]
  return key ? translateStatic(translate, key) : ''
}

export function getOperationRangeText(range: number, translate: AppTranslator): string {
  const key = rangeKeys[range]
  return key ? translateStatic(translate, key) : ''
}

export function getOperationSenseiTaisenText(
  type: SenseiTaisenType,
  translate: AppTranslator
): string {
  const key = senseiTaisenKeys[type]
  return key ? translateStatic(translate, key) : ''
}

export function getOperationFACutInText(type: FACutin, translate: AppTranslator): string {
  const key = faCutInKeys[type]
  return key ? translateStatic(translate, key) : ''
}

export function getOperationAACutInText(type: AACutin, translate: AppTranslator): string {
  const key = aaCutInKeys[type]
  return key ? translateStatic(translate, key) : ''
}

export function getOperationNightCutInText(
  type: YCutin,
  short: boolean,
  translate: AppTranslator
): string {
  const keys = nightCutInKeys[type]
  return translateStatic(translate, keys[short ? 1 : 0])
}

export function getOperationNightAirCutInText(
  type: YSCutin,
  short: boolean,
  translate: AppTranslator
): string {
  const keys = nightAirCutInKeys[type]
  return translateStatic(translate, keys[short ? 1 : 0])
}

export function getOperationMissionResultText(
  result: MissionResultValue,
  translate: AppTranslator
): string {
  switch (result) {
    case MissionResult.failed:
      return translateStatic(translate, 'operation.mission.result.failed')
    case MissionResult.succeeded:
      return translateStatic(translate, 'operation.mission.result.succeeded')
    case MissionResult.succeeded2:
      return translateStatic(translate, 'operation.mission.result.succeeded2')
    default:
      return ''
  }
}

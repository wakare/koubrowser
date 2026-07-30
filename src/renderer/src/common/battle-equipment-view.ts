import type { AppMessageKey, AppTranslator } from '@common/localization'

type StaticBattleEquipmentKey = Extract<
  AppMessageKey,
  `battleEquipment.${string}`
>

const translateStatic = (
  translate: AppTranslator,
  key: StaticBattleEquipmentKey
): string => (translate as (messageKey: AppMessageKey) => string)(key)

const airSearchKeys = [
  'battleEquipment.battle.airSearch.0',
  'battleEquipment.battle.airSearch.1',
  'battleEquipment.battle.airSearch.2'
] as const satisfies readonly StaticBattleEquipmentKey[]

const airStateKeys = [
  'battleEquipment.battle.airState.0',
  'battleEquipment.battle.airState.1',
  'battleEquipment.battle.airState.2',
  'battleEquipment.battle.airState.3',
  'battleEquipment.battle.airState.4'
] as const satisfies readonly StaticBattleEquipmentKey[]

const airStateLongKeys = [
  'battleEquipment.battle.airStateLong.0',
  'battleEquipment.battle.airStateLong.1',
  'battleEquipment.battle.airStateLong.2',
  'battleEquipment.battle.airStateLong.3',
  'battleEquipment.battle.airStateLong.4'
] as const satisfies readonly StaticBattleEquipmentKey[]

const formationKeys: Readonly<Record<number, StaticBattleEquipmentKey>> = {
  1: 'battleEquipment.battle.formation.1',
  2: 'battleEquipment.battle.formation.2',
  3: 'battleEquipment.battle.formation.3',
  4: 'battleEquipment.battle.formation.4',
  5: 'battleEquipment.battle.formation.5',
  6: 'battleEquipment.battle.formation.6',
  11: 'battleEquipment.battle.formation.11',
  12: 'battleEquipment.battle.formation.12',
  13: 'battleEquipment.battle.formation.13',
  14: 'battleEquipment.battle.formation.14'
}

const formationLongKeys: Readonly<Record<number, StaticBattleEquipmentKey>> = {
  1: 'battleEquipment.battle.formationLong.1',
  2: 'battleEquipment.battle.formationLong.2',
  3: 'battleEquipment.battle.formationLong.3',
  4: 'battleEquipment.battle.formationLong.4',
  5: 'battleEquipment.battle.formationLong.5',
  6: 'battleEquipment.battle.formationLong.6',
  11: 'battleEquipment.battle.formationLong.11',
  12: 'battleEquipment.battle.formationLong.12',
  13: 'battleEquipment.battle.formationLong.13',
  14: 'battleEquipment.battle.formationLong.14'
}

const tacticsKeys = [
  undefined,
  'battleEquipment.battle.tactics.1',
  'battleEquipment.battle.tactics.2',
  'battleEquipment.battle.tactics.3',
  'battleEquipment.battle.tactics.4'
] as const

const rangeKeys = [
  undefined,
  'battleEquipment.slotitem.range.1',
  'battleEquipment.slotitem.range.2',
  'battleEquipment.slotitem.range.3',
  'battleEquipment.slotitem.range.4',
  'battleEquipment.slotitem.range.5'
] as const

const rareKeys = [
  'battleEquipment.slotitem.rare.0',
  'battleEquipment.slotitem.rare.1',
  'battleEquipment.slotitem.rare.2',
  'battleEquipment.slotitem.rare.3',
  'battleEquipment.slotitem.rare.4',
  'battleEquipment.slotitem.rare.5',
  'battleEquipment.slotitem.rare.6',
  'battleEquipment.slotitem.rare.7'
] as const satisfies readonly StaticBattleEquipmentKey[]

const weekdayKeys = [
  'battleEquipment.score.weekday.0',
  'battleEquipment.score.weekday.1',
  'battleEquipment.score.weekday.2',
  'battleEquipment.score.weekday.3',
  'battleEquipment.score.weekday.4',
  'battleEquipment.score.weekday.5',
  'battleEquipment.score.weekday.6'
] as const satisfies readonly StaticBattleEquipmentKey[]

export function getBattleAirSearchText(
  result: number | undefined,
  translate: AppTranslator
): string {
  const key = result === undefined ? undefined : airSearchKeys[result]
  return key ? translateStatic(translate, key) : ''
}

export function getBattleAirStateText(
  state: number,
  translate: AppTranslator
): string {
  const key = airStateKeys[state]
  return key ? translateStatic(translate, key) : ''
}

export function getBattleAirStateLongText(
  state: number,
  translate: AppTranslator
): string {
  const key = airStateLongKeys[state]
  return key ? translateStatic(translate, key) : ''
}

export function getBattleFormationShortText(
  formation: number,
  translate: AppTranslator
): string {
  const key = formationKeys[formation]
  return key ? translateStatic(translate, key) : ''
}

export function getBattleFormationText(
  formation: number,
  translate: AppTranslator
): string {
  const key = formationLongKeys[formation]
  return key ? translateStatic(translate, key) : ''
}

export function getBattleTacticsText(
  tactics: number | undefined,
  translate: AppTranslator
): string {
  const key = tactics === undefined ? undefined : tacticsKeys[tactics]
  return key ? translateStatic(translate, key) : ''
}

export function getBattleSlotitemRangeText(
  range: number,
  translate: AppTranslator
): string {
  const key = rangeKeys[range]
  return key ? translateStatic(translate, key) : ''
}

export function getBattleSlotitemRareText(
  rare: number,
  translate: AppTranslator
): string {
  const key = rareKeys[rare]
  return key ? translateStatic(translate, key) : ''
}

export function getBattleScoreWeekdayText(
  weekday: number,
  translate: AppTranslator
): string {
  const key = weekdayKeys[weekday]
  return key ? translateStatic(translate, key) : ''
}

export function formatMapLineOfSightValues(
  values: readonly number[]
): string {
  return values.map((value) => Math.trunc(value)).join('/')
}

export function formatCombinedMapLineOfSightValues(
  mainValues: readonly number[],
  escortValues: readonly number[]
): string {
  return formatMapLineOfSightValues(
    mainValues.map(
      (value, index) => value + (escortValues[index] ?? 0)
    )
  )
}

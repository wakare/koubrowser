import {
  getQuestFleetCondition,
  getQuestStuff,
  listQuestStuffIds,
  QuestKey,
  QuestType,
  type BattleRank,
  type QuestFleetCondition,
  type QuestFleetRule,
  type QuestMapOrCell,
  type QuestType as QuestTypeValue
} from '@common/kcquest'

export type QuestStrategyInventoryCadence = 'daily' | 'weekly' | 'monthly' | 'quarterly'

export type QuestStrategyInventoryClassification =
  | 'lossless-v1'
  | 'multi-stage'
  | 'opaque-constraint'
  | 'conflicted'
  | 'missing-structured-fact'
  | 'missing-cadence-fact'
  | 'out-of-scope'

export type QuestStrategyInventoryReason =
  | 'LOSSLESS_V1'
  | 'INSUFFICIENT_CADENCE_FACT'
  | 'NOT_RECURRING_CADENCE'
  | 'NOT_STRUCTURED_SORTIE_OBJECTIVE'
  | 'MISSING_MAP_DEFINITION'
  | 'INVALID_MAP_DEFINITION'
  | 'EVENT_OR_LIMITED_MAP'
  | 'MULTI_STAGE_OBJECTIVE'
  | 'GAUGE_CLEAR_REQUIRES_MULTI_SORTIE_STATE'
  | 'V1_RESULT_CANNOT_EXPRESS_MAP_START'
  | 'OPAQUE_DECK_MATCHER'
  | 'FLEET_CONSTRAINT_NOT_REPRESENTABLE_IN_V1'

export interface QuestStrategyInventoryObjectiveTarget {
  mapKey: string
  result: 'arrival' | 'victory' | 'A' | 'S'
  targetCells: number[]
}

export interface QuestStrategyInventoryObjectiveStage {
  requiredCount: number
  targets: QuestStrategyInventoryObjectiveTarget[]
}

export interface QuestStrategyInventoryEntry {
  questId: number
  cadence: QuestStrategyInventoryCadence | undefined
  questType: QuestTypeValue
  denominatorEligible: boolean
  classification: QuestStrategyInventoryClassification
  reasonCodes: QuestStrategyInventoryReason[]
  objectiveStages: QuestStrategyInventoryObjectiveStage[]
  fleetConstraint: 'none' | 'v1-lossless' | 'opaque'
}

export interface QuestStrategyInventorySummary {
  registeredQuestCount: number
  recurringQuestCount: number
  cadenceUnknownCount: number
  cadenceCatalogComplete: boolean
  primaryDenominatorCount: number
  classificationCounts: Record<QuestStrategyInventoryClassification, number>
  losslessV1Count: number
  unsupportedV1MultiStageCount: number
  v1LosslessCoverageBasisPoints: number | undefined
  unsupportedV1MultiStageBasisPoints: number | undefined
}

interface QuestStuffView {
  questType: QuestTypeValue
  key: string
  max: readonly number[]
  maps?: unknown
  area_id?: unknown
  area_no?: unknown
  isDeckMatch?: unknown
}

export interface QuestStrategyCadenceCatalog {
  complete: boolean
  entries: ReadonlyMap<number, QuestStrategyInventoryCadence>
}

const SortieQuestTypes = new Set<QuestTypeValue>([
  QuestType.mapStart,
  QuestType.mapStartDeck,
  QuestType.battleMap,
  QuestType.battleMapDeck,
  QuestType.mapGoal,
  QuestType.gaugeClear
])

const ClassificationOrder: readonly QuestStrategyInventoryClassification[] = [
  'lossless-v1',
  'multi-stage',
  'opaque-constraint',
  'conflicted',
  'missing-structured-fact',
  'missing-cadence-fact',
  'out-of-scope'
]

function cadenceOf(key: string): QuestStrategyInventoryCadence | undefined {
  switch (key) {
    case QuestKey.daily:
    case QuestKey.weekly:
    case QuestKey.monthly:
    case QuestKey.quarterly:
      return key
    default:
      return undefined
  }
}

function resultOf(rank: BattleRank): QuestStrategyInventoryObjectiveTarget['result'] {
  if (rank === '') {
    return 'arrival'
  }
  if (rank === 'B' || rank === 'C') {
    return 'victory'
  }
  return rank
}

function isQuestMap(value: unknown): value is QuestMapOrCell {
  return (
    Array.isArray(value) &&
    (value.length === 3 || value.length === 4) &&
    Number.isInteger(value[0]) &&
    Number.isInteger(value[1]) &&
    typeof value[2] === 'string' &&
    ['', 'C', 'B', 'A', 'S'].includes(value[2]) &&
    (value.length === 3 ||
      value[3] === undefined ||
      (Array.isArray(value[3]) && value[3].every((cell) => Number.isInteger(cell) && cell > 0)))
  )
}

function mapsOf(stuff: QuestStuffView): QuestMapOrCell[] | undefined {
  if (Array.isArray(stuff.maps)) {
    if (!stuff.maps.every(isQuestMap)) {
      return undefined
    }
    return stuff.maps.map((map) => [
      map[0],
      map[1],
      map[2],
      ...(map.length === 4 ? [map[3] ? [...map[3]] : undefined] : [])
    ]) as QuestMapOrCell[]
  }
  if (Number.isInteger(stuff.area_id) && Number.isInteger(stuff.area_no)) {
    return [[stuff.area_id as number, stuff.area_no as number, '']]
  }
  return []
}

function objectiveStagesOf(
  stuff: QuestStuffView,
  maps: readonly QuestMapOrCell[]
): QuestStrategyInventoryObjectiveStage[] | undefined {
  const targets = maps.map((map) => ({
    mapKey: `${map[0]}-${map[1]}`,
    result: resultOf(map[2]),
    targetCells: map.length === 4 && Array.isArray(map[3]) ? [...map[3]].sort((a, b) => a - b) : []
  }))
  if (stuff.max.length === 1) {
    const requiredCount = stuff.max[0]
    if (!Number.isInteger(requiredCount) || requiredCount <= 0) {
      return undefined
    }
    return [{ requiredCount, targets }]
  }
  if (stuff.max.length !== maps.length) {
    return undefined
  }
  const stages: QuestStrategyInventoryObjectiveStage[] = []
  for (let index = 0; index < targets.length; index += 1) {
    const requiredCount = stuff.max[index]
    if (!Number.isInteger(requiredCount) || requiredCount <= 0) {
      return undefined
    }
    stages.push({
      requiredCount,
      targets: [targets[index]]
    })
  }
  return stages
}

function shipCountRuleIsV1Lossless(rule: Extract<QuestFleetRule, { kind: 'ship-count' }>): boolean {
  return (
    (rule.min === undefined || Number.isInteger(rule.min)) &&
    (rule.exact === undefined || Number.isInteger(rule.exact)) &&
    (rule.maximum === undefined || Number.isInteger(rule.maximum))
  )
}

function shipTypeRuleIsV1Lossless(
  rule: Extract<QuestFleetRule, { kind: 'ship-type-count' }>
): boolean {
  return (
    rule.min !== undefined &&
    rule.exact === undefined &&
    rule.maximum === undefined &&
    rule.minimumLevel === undefined &&
    rule.excludePositions === undefined
  )
}

export function questFleetConditionIsV1Lossless(condition: Readonly<QuestFleetCondition>): boolean {
  return condition.rules.every((rule) => {
    switch (rule.kind) {
      case 'ship-count':
        return shipCountRuleIsV1Lossless(rule)
      case 'ship-type-count':
        return shipTypeRuleIsV1Lossless(rule)
      default:
        return false
    }
  })
}

function fleetConstraintOf(
  stuff: QuestStuffView,
  condition: Readonly<QuestFleetCondition> | undefined
): QuestStrategyInventoryEntry['fleetConstraint'] {
  if (typeof stuff.isDeckMatch !== 'function') {
    return 'none'
  }
  if (!condition) {
    return 'opaque'
  }
  return questFleetConditionIsV1Lossless(condition) ? 'v1-lossless' : 'opaque'
}

export function classifyQuestStrategyInventoryEntry(
  questId: number,
  cadenceCatalog?: QuestStrategyCadenceCatalog
): QuestStrategyInventoryEntry {
  const stuff = getQuestStuff(questId) as QuestStuffView | undefined
  if (!stuff) {
    throw new Error(`quest ${questId} is not registered`)
  }
  const cadence = cadenceCatalog?.entries.get(questId) ?? cadenceOf(stuff.key)
  const fleetConstraint = fleetConstraintOf(stuff, getQuestFleetCondition(questId))
  const base = {
    questId,
    cadence,
    questType: stuff.questType,
    objectiveStages: [] as QuestStrategyInventoryObjectiveStage[],
    fleetConstraint
  }
  if (!cadence && stuff.key === QuestKey.infer && cadenceCatalog?.complete !== true) {
    return {
      ...base,
      denominatorEligible: false,
      classification: 'missing-cadence-fact',
      reasonCodes: ['INSUFFICIENT_CADENCE_FACT']
    }
  }
  if (!cadence) {
    return {
      ...base,
      denominatorEligible: false,
      classification: 'out-of-scope',
      reasonCodes: ['NOT_RECURRING_CADENCE']
    }
  }
  if (!SortieQuestTypes.has(stuff.questType)) {
    return {
      ...base,
      denominatorEligible: false,
      classification: 'out-of-scope',
      reasonCodes: ['NOT_STRUCTURED_SORTIE_OBJECTIVE']
    }
  }
  const maps = mapsOf(stuff)
  if (maps === undefined) {
    return {
      ...base,
      denominatorEligible: false,
      classification: 'missing-structured-fact',
      reasonCodes: ['INVALID_MAP_DEFINITION']
    }
  }
  if (maps.length === 0) {
    return {
      ...base,
      denominatorEligible: false,
      classification: 'missing-structured-fact',
      reasonCodes: ['MISSING_MAP_DEFINITION']
    }
  }
  if (maps.some((map) => map[0] > 10)) {
    return {
      ...base,
      denominatorEligible: false,
      classification: 'out-of-scope',
      reasonCodes: ['EVENT_OR_LIMITED_MAP']
    }
  }
  const objectiveStages = objectiveStagesOf(stuff, maps)
  if (!objectiveStages) {
    return {
      ...base,
      denominatorEligible: true,
      classification: 'missing-structured-fact',
      reasonCodes: ['INVALID_MAP_DEFINITION']
    }
  }
  const eligibleBase = {
    ...base,
    denominatorEligible: true,
    objectiveStages
  }
  if (stuff.questType === QuestType.gaugeClear) {
    return {
      ...eligibleBase,
      classification: 'multi-stage',
      reasonCodes: ['GAUGE_CLEAR_REQUIRES_MULTI_SORTIE_STATE']
    }
  }
  if (objectiveStages.length > 1) {
    return {
      ...eligibleBase,
      classification: 'multi-stage',
      reasonCodes: ['MULTI_STAGE_OBJECTIVE']
    }
  }
  if (stuff.questType === QuestType.mapStart || stuff.questType === QuestType.mapStartDeck) {
    return {
      ...eligibleBase,
      classification: 'opaque-constraint',
      reasonCodes: ['V1_RESULT_CANNOT_EXPRESS_MAP_START']
    }
  }
  if (fleetConstraint === 'opaque') {
    return {
      ...eligibleBase,
      classification: 'opaque-constraint',
      reasonCodes: [
        getQuestFleetCondition(questId)
          ? 'FLEET_CONSTRAINT_NOT_REPRESENTABLE_IN_V1'
          : 'OPAQUE_DECK_MATCHER'
      ]
    }
  }
  return {
    ...eligibleBase,
    classification: 'lossless-v1',
    reasonCodes: ['LOSSLESS_V1']
  }
}

export function buildQuestStrategyInventory(
  cadenceCatalog?: QuestStrategyCadenceCatalog
): QuestStrategyInventoryEntry[] {
  return listQuestStuffIds().map((questId) =>
    classifyQuestStrategyInventoryEntry(questId, cadenceCatalog)
  )
}

function basisPoints(numerator: number, denominator: number): number | undefined {
  return denominator === 0 ? undefined : Math.floor((numerator * 10_000) / denominator)
}

export function summarizeQuestStrategyInventory(
  entries: readonly QuestStrategyInventoryEntry[],
  cadenceCatalogComplete = false
): QuestStrategyInventorySummary {
  const classificationCounts = Object.fromEntries(
    ClassificationOrder.map((classification) => [classification, 0])
  ) as Record<QuestStrategyInventoryClassification, number>
  for (const entry of entries) {
    classificationCounts[entry.classification] += 1
  }
  const recurringQuestCount = entries.filter((entry) => entry.cadence !== undefined).length
  const cadenceUnknownCount = entries.filter(
    (entry) => entry.classification === 'missing-cadence-fact'
  ).length
  const primaryEntries = entries.filter((entry) => entry.denominatorEligible)
  const losslessV1Count = primaryEntries.filter(
    (entry) => entry.classification === 'lossless-v1'
  ).length
  const unsupportedV1MultiStageCount = primaryEntries.filter(
    (entry) => entry.classification === 'multi-stage'
  ).length
  return {
    registeredQuestCount: entries.length,
    recurringQuestCount,
    cadenceUnknownCount,
    cadenceCatalogComplete,
    primaryDenominatorCount: primaryEntries.length,
    classificationCounts,
    losslessV1Count,
    unsupportedV1MultiStageCount,
    v1LosslessCoverageBasisPoints: basisPoints(losslessV1Count, primaryEntries.length),
    unsupportedV1MultiStageBasisPoints: basisPoints(
      unsupportedV1MultiStageCount,
      primaryEntries.length
    )
  }
}

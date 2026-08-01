import {
  ApiMaterialId,
  KcsUtil,
  ShipHpState,
  SlotitemType,
  type ApiQuestList,
  type SvData
} from '@common/kcs'
import type {
  QuestGrowthFallbackInput,
  QuestGrowthResourceTotals
} from '@common/quest_growth_evaluator'
import { listCuratedQuestKnowledge } from '@common/quest_knowledge'
import { eoRates } from './battle-score'

export interface QuestGrowthLocalContext {
  resourcePosture?: 'conserve' | 'balanced' | 'spend'
  aswTargetSelected?: boolean
  aswReviewedTargetRule?: boolean
  intendedFleetConfirmed?: boolean
  surfaceTargetSelected?: boolean
  surfaceRouteVariantSelected?: boolean
  surfaceReviewedTargetRule?: boolean
  surfaceVersionedFormulaAvailable?: boolean
  eoTargetSelected?: boolean
  eoTimeConstraint?: 'pass' | 'blocked' | 'unknown'
  eventGoalSelected?: boolean
  evergreenCategorySelected?: boolean
}

export interface QuestGrowthLocalSnapshot {
  schemaVersion: 1
  source: 'renderer-readonly-state'
  inputs: readonly QuestGrowthFallbackInput[]
  privacy: {
    containsAccountIdentifier: false
    containsShipIdentifier: false
    containsEquipmentInstanceIdentifier: false
    containsRawPayload: false
  }
}

const AswSonarTypes = new Set<SlotitemType>([SlotitemType.Sonar, SlotitemType.LargeSonar])
const AswDepthChargeTypes = new Set<SlotitemType>([SlotitemType.DepthCharge])
const AirEquipmentTypes = new Set<SlotitemType>([
  SlotitemType.Fighter,
  SlotitemType.DiveBomber,
  SlotitemType.TorpedoBomber,
  SlotitemType.SeaplaneBomber,
  SlotitemType.SeaplaneFighter,
  SlotitemType.LandAttackAircraft,
  SlotitemType.LandFighter,
  SlotitemType.JetFighter,
  SlotitemType.JetFighterBomber
])
const LosEquipmentTypes = new Set<SlotitemType>([
  SlotitemType.RecAircraft,
  SlotitemType.RecSeaplane,
  SlotitemType.SmallRadar,
  SlotitemType.LargeRadar,
  SlotitemType.LargeFlyingBoat,
  SlotitemType.LandRecAircraft
])
const MainResourceIds = [
  ApiMaterialId.FUAL,
  ApiMaterialId.AMMO,
  ApiMaterialId.STEEL,
  ApiMaterialId.BUXITE,
  ApiMaterialId.FAST_REPAIR
] as const
const EoMapIds = new Set(eoRates.map((eo) => eo.mapId))

function countEquipmentByType(svdata: SvData, types: ReadonlySet<SlotitemType>): number {
  let count = 0
  for (const item of svdata.slotitems) {
    const master = svdata.mstSlotitem(item.api_slotitem_id)
    if (master && types.has(KcsUtil.slotitemType(master))) count += 1
  }
  return count
}

function resourceTotals(svdata: SvData): QuestGrowthResourceTotals | null {
  if (!MainResourceIds.every((id) => svdata.material(id) !== undefined)) return null
  return {
    fuel: svdata.material(ApiMaterialId.FUAL)!.api_value,
    ammunition: svdata.material(ApiMaterialId.AMMO)!.api_value,
    steel: svdata.material(ApiMaterialId.STEEL)!.api_value,
    bauxite: svdata.material(ApiMaterialId.BUXITE)!.api_value,
    repairBuckets: svdata.material(ApiMaterialId.FAST_REPAIR)!.api_value
  }
}

function visibleCuratedQuestCount(questList: ApiQuestList | null): number {
  if (!questList) return 0
  const curatedIds = new Set<number>()
  for (const knowledge of listCuratedQuestKnowledge()) {
    curatedIds.add(knowledge.questId)
    for (const group of knowledge.prerequisiteGroups) {
      for (const quest of group.quests) curatedIds.add(quest.questId)
    }
  }
  return questList.api_list.filter((quest) => curatedIds.has(quest.api_no)).length
}

function fleetState(svdata: SvData): {
  damage: 'clear' | 'blocked' | 'unknown'
  supply: 'clear' | 'blocked' | 'unknown'
  repair: 'clear' | 'unknown'
} {
  if (
    !svdata.svdataRaw.shipDataOk ||
    !svdata.svdataRaw.mstDataOk ||
    svdata.deckPorts.length === 0
  ) {
    return { damage: 'unknown', supply: 'unknown', repair: 'unknown' }
  }

  let damage: 'clear' | 'blocked' | 'unknown' = 'clear'
  let supply: 'clear' | 'blocked' | 'unknown' = 'clear'
  const deckShipIds = new Set(
    svdata.deckPorts.flatMap((deck) => deck.api_ship).filter((shipId) => shipId > 0)
  )
  for (const shipId of deckShipIds) {
    const ship = svdata.ship(shipId)
    const master = ship ? svdata.mstShip(ship.api_ship_id) : undefined
    if (!ship || !master) {
      if (damage !== 'blocked') damage = 'unknown'
      if (supply !== 'blocked') supply = 'unknown'
      continue
    }
    if (KcsUtil.shipHpState(ship) === ShipHpState.taiha) damage = 'blocked'
    if (ship.api_fuel < master.api_fuel_max || ship.api_bull < master.api_bull_max) {
      supply = 'blocked'
    }
  }

  return {
    damage,
    supply,
    repair: svdata.ndocks.length > 0 ? 'clear' : 'unknown'
  }
}

function evaluatorInputs(
  svdata: SvData,
  context: QuestGrowthLocalContext
): QuestGrowthFallbackInput[] {
  const shipFactsAvailable = svdata.svdataRaw.shipDataOk && svdata.svdataRaw.mstDataOk
  const equipmentFactsAvailable = svdata.svdataRaw.mstDataOk && svdata.svdataRaw.slotitemDataOk
  const resources = resourceTotals(svdata)
  const resourcesAvailable = resources !== null
  const safety = fleetState(svdata)
  const safetyFresh =
    safety.damage !== 'unknown' && safety.supply !== 'unknown' && safety.repair !== 'unknown'
  const questList = svdata.questlist
  const mapFactsAvailable = svdata.mapinfos.length > 0
  const breadthFactsAvailable = shipFactsAvailable && equipmentFactsAvailable && resourcesAvailable
  const unlockedEoCount = mapFactsAvailable
    ? svdata.mapinfos.filter((map) => EoMapIds.has(map.api_id)).length
    : 0

  return [
    {
      observableId: 'modernization.material-summary',
      freshness: shipFactsAvailable ? 'fresh' : 'unknown',
      visibleUnlockedShipCount: shipFactsAvailable
        ? svdata.ships.filter((ship) => ship.api_locked === 0).length
        : 0
    },
    {
      observableId: 'fleet.safety-state',
      freshness: safetyFresh ? 'fresh' : 'unknown',
      damage: safety.damage,
      supply: safety.supply,
      repair: safety.repair
    },
    {
      observableId: 'quest.visible-chain',
      freshness: questList ? 'fresh' : 'unknown',
      visibleUnlockQuestCount: visibleCuratedQuestCount(questList),
      viewCoverage: questList ? 'live-all-tabs' : 'unknown',
      graphCoverage: 'reviewed-partial'
    },
    {
      observableId: 'resources.bands',
      freshness: resourcesAvailable ? 'fresh' : 'unknown',
      totals: resources,
      posture: context.resourcePosture ?? 'unset'
    },
    {
      observableId: 'ships.asw-capable-summary',
      freshness: shipFactsAvailable && equipmentFactsAvailable ? 'fresh' : 'unknown',
      sonarCount: equipmentFactsAvailable ? countEquipmentByType(svdata, AswSonarTypes) : 0,
      depthChargeCount: equipmentFactsAvailable
        ? countEquipmentByType(svdata, AswDepthChargeTypes)
        : 0,
      targetSelected: context.aswTargetSelected ?? false,
      reviewedTargetRule: context.aswReviewedTargetRule ?? false,
      intendedFleetConfirmed: context.intendedFleetConfirmed ?? false
    },
    {
      observableId: 'capability.surface-air-los-gaps',
      freshness: shipFactsAvailable && equipmentFactsAvailable ? 'fresh' : 'unknown',
      airEquipmentCount: equipmentFactsAvailable
        ? countEquipmentByType(svdata, AirEquipmentTypes)
        : 0,
      losEquipmentCount: equipmentFactsAvailable
        ? countEquipmentByType(svdata, LosEquipmentTypes)
        : 0,
      targetSelected: context.surfaceTargetSelected ?? false,
      routeVariantSelected: context.surfaceRouteVariantSelected ?? false,
      reviewedTargetRule: context.surfaceReviewedTargetRule ?? false,
      versionedFormulaAvailable: context.surfaceVersionedFormulaAvailable ?? false
    },
    {
      observableId: 'maps.eo-affordability',
      freshness: mapFactsAvailable ? 'fresh' : 'unknown',
      unlockedEoCount,
      targetSelected: context.eoTargetSelected ?? false,
      reviewedRouteKnowledge: false,
      safety:
        safety.damage === 'blocked' || safety.supply === 'blocked'
          ? 'blocked'
          : safetyFresh
            ? 'pass'
            : 'unknown',
      resources: 'unknown',
      capability: 'unknown',
      time: context.eoTimeConstraint ?? 'unknown'
    },
    {
      observableId: 'capability.breadth-summary',
      freshness: breadthFactsAvailable ? 'fresh' : 'unknown',
      eventGoalSelected: context.eventGoalSelected ?? false,
      categorySelected: context.evergreenCategorySelected ?? false
    },
    {
      observableId: 'practice.available-count',
      freshness: 'unavailable'
    },
    {
      observableId: 'event.overlay-status',
      freshness: 'unavailable',
      overlayStatus: 'unavailable'
    }
  ]
}

/**
 * Projects existing renderer state into anonymous evaluator inputs. It does not
 * retain object identities, perform I/O, or infer route knowledge.
 */
export function buildQuestGrowthLocalSnapshot(
  svdata: SvData,
  context: QuestGrowthLocalContext = {}
): QuestGrowthLocalSnapshot {
  return {
    schemaVersion: 1,
    source: 'renderer-readonly-state',
    inputs: evaluatorInputs(svdata, context),
    privacy: {
      containsAccountIdentifier: false,
      containsShipIdentifier: false,
      containsEquipmentInstanceIdentifier: false,
      containsRawPayload: false
    }
  }
}

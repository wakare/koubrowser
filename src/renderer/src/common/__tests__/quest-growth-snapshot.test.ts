import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ApiMaterialId,
  ApiNDockState,
  SlotitemType,
  SvData,
  createSvDataRaw,
  type ApiDeckPort,
  type ApiMapInfo,
  type ApiMaterial,
  type ApiNDock,
  type ApiQuest,
  type ApiShip,
  type ApiSlotitem,
  type MstShip,
  type MstSlotitem
} from '@common/kcs'
import {
  evaluateQuestGrowthFallback,
  type QuestGrowthFallbackInput
} from '@common/quest_growth_evaluator'
import {
  buildQuestGrowthLocalSnapshot,
  questGrowthContextFromSelection
} from '@renderer/common/quest-growth-snapshot'

function ship(
  instanceId: number,
  masterId: number,
  options: { hp?: number; fuel?: number; ammo?: number; locked?: number } = {}
): ApiShip {
  return {
    api_id: instanceId,
    api_ship_id: masterId,
    api_nowhp: options.hp ?? 40,
    api_maxhp: 40,
    api_fuel: options.fuel ?? 20,
    api_bull: options.ammo ?? 20,
    api_locked: options.locked ?? 1
  } as ApiShip
}

function masterShip(masterId: number): MstShip {
  return {
    api_id: masterId,
    api_name: `SECRET_SHIP_${masterId}`,
    api_fuel_max: 20,
    api_bull_max: 20
  } as MstShip
}

function equipment(instanceId: number, masterId: number): ApiSlotitem {
  return { api_id: instanceId, api_slotitem_id: masterId } as ApiSlotitem
}

function masterEquipment(masterId: number, type: SlotitemType): MstSlotitem {
  return {
    api_id: masterId,
    api_name: `SECRET_EQUIPMENT_${masterId}`,
    api_type: [0, 0, type, 0, 0]
  } as unknown as MstSlotitem
}

function populatedSvData(): { svdata: SvData; raw: ReturnType<typeof createSvDataRaw> } {
  const raw = createSvDataRaw()
  raw.mstDataOk = true
  raw.shipDataOk = true
  raw.slotitemDataOk = true
  raw.apiData.api_ship.push(
    ship(9001, 101, { locked: 0 }),
    ship(9002, 102, { hp: 10, fuel: 10, locked: 1 })
  )
  raw.apiData.api_mst_ship.push(masterShip(101), masterShip(102))
  raw.apiData.api_deck_port.push({
    api_id: 1,
    api_ship: [9001, 9002, 9999, -1, -1, -1]
  } as ApiDeckPort)
  raw.apiData.api_ndock.push({ api_id: 1, api_state: ApiNDockState.empty } as ApiNDock)
  raw.apiData.api_material.push(
    ...[
      ApiMaterialId.FUAL,
      ApiMaterialId.AMMO,
      ApiMaterialId.STEEL,
      ApiMaterialId.BUXITE,
      ApiMaterialId.FAST_REPAIR
    ].map((id) => ({ api_member_id: 123456, api_id: id, api_value: 10000 + id }) as ApiMaterial)
  )
  raw.apiData.api_slot_item.push(
    equipment(7001, 201),
    equipment(7002, 202),
    equipment(7003, 203),
    equipment(7004, 204)
  )
  raw.apiData.api_mst_slotitem.push(
    masterEquipment(201, SlotitemType.Sonar),
    masterEquipment(202, SlotitemType.DepthCharge),
    masterEquipment(203, SlotitemType.Fighter),
    masterEquipment(204, SlotitemType.SmallRadar)
  )
  raw.apiData.api_mapinfo.push(
    { api_id: 11 } as ApiMapInfo,
    { api_id: 15 } as ApiMapInfo,
    { api_id: 25 } as ApiMapInfo
  )
  Object.assign(raw.apiData, {
    api_questlist: {
      api_count: 1,
      api_completed_kind: 0,
      api_list: [{ api_no: 201 } as ApiQuest],
      api_exec_count: 0,
      api_exec_type: 0
    }
  })
  return { svdata: new SvData(raw), raw }
}

function input<ObservableId extends QuestGrowthFallbackInput['observableId']>(
  inputs: readonly QuestGrowthFallbackInput[],
  observableId: ObservableId
): Extract<QuestGrowthFallbackInput, { observableId: ObservableId }> {
  return inputs.find((candidate) => candidate.observableId === observableId) as Extract<
    QuestGrowthFallbackInput,
    { observableId: ObservableId }
  >
}

describe('quest growth local snapshot adapter', () => {
  it('projects loaded SvData into anonymous aggregate evaluator inputs', () => {
    const { svdata, raw } = populatedSvData()
    const before = structuredClone(raw)
    const snapshot = buildQuestGrowthLocalSnapshot(svdata, {
      resourcePosture: 'conserve',
      eventGoalSelected: true,
      evergreenCategorySelected: true
    })

    expect(snapshot.schemaVersion).toBe(1)
    expect(snapshot.source).toBe('renderer-readonly-state')
    expect(snapshot.inputs).toHaveLength(10)
    expect(snapshot.privacy).toEqual({
      containsAccountIdentifier: false,
      containsShipIdentifier: false,
      containsEquipmentInstanceIdentifier: false,
      containsRawPayload: false
    })
    expect(input(snapshot.inputs, 'modernization.material-summary')).toMatchObject({
      freshness: 'fresh',
      visibleUnlockedShipCount: 1
    })
    expect(input(snapshot.inputs, 'fleet.safety-state')).toMatchObject({
      freshness: 'fresh',
      damage: 'blocked',
      supply: 'blocked',
      repair: 'clear'
    })
    expect(input(snapshot.inputs, 'quest.visible-chain')).toMatchObject({
      freshness: 'fresh',
      visibleUnlockQuestCount: 1,
      viewCoverage: 'live-all-tabs',
      graphCoverage: 'reviewed-partial'
    })
    expect(input(snapshot.inputs, 'resources.bands')).toMatchObject({
      freshness: 'fresh',
      totals: {
        fuel: 10001,
        ammunition: 10002,
        steel: 10003,
        bauxite: 10004,
        repairBuckets: 10006
      },
      posture: 'conserve'
    })
    expect(input(snapshot.inputs, 'ships.asw-capable-summary')).toMatchObject({
      freshness: 'fresh',
      sonarCount: 1,
      depthChargeCount: 1
    })
    expect(input(snapshot.inputs, 'capability.surface-air-los-gaps')).toMatchObject({
      freshness: 'fresh',
      airEquipmentCount: 1,
      losEquipmentCount: 1
    })
    expect(input(snapshot.inputs, 'maps.eo-affordability')).toMatchObject({
      freshness: 'fresh',
      unlockedEoCount: 2,
      reviewedRouteKnowledge: false,
      safety: 'blocked',
      resources: 'unknown',
      capability: 'unknown'
    })
    expect(input(snapshot.inputs, 'practice.available-count').freshness).toBe('unavailable')
    expect(input(snapshot.inputs, 'event.overlay-status')).toMatchObject({
      freshness: 'unavailable',
      overlayStatus: 'unavailable'
    })
    expect(raw).toEqual(before)

    const serialized = JSON.stringify(snapshot)
    expect(serialized).not.toContain('123456')
    expect(serialized).not.toContain('9001')
    expect(serialized).not.toContain('9999')
    expect(serialized).not.toContain('7001')
    expect(serialized).not.toContain('SECRET_SHIP')
    expect(serialized).not.toContain('SECRET_EQUIPMENT')
    expect(serialized).not.toContain('api_')
  })

  it('fails closed when local state has not loaded', () => {
    const snapshot = buildQuestGrowthLocalSnapshot(new SvData(createSvDataRaw()))

    for (const candidate of snapshot.inputs) {
      const outcome = evaluateQuestGrowthFallback(candidate)
      expect(outcome.blockers).toContain('ROUTE_OUTPUT_PROHIBITED_IN_PURE_EVALUATOR')
      expect(Object.keys(outcome)).not.toContain('routeId')
      expect(Object.keys(outcome)).not.toContain('routeSteps')
      if (outcome.kind === 'manual-check') expect(outcome.checks.length).toBeGreaterThan(0)
      else expect(outcome.steps.length).toBeGreaterThan(0)
    }

    expect(input(snapshot.inputs, 'fleet.safety-state').freshness).toBe('unknown')
    expect(input(snapshot.inputs, 'resources.bands')).toMatchObject({
      freshness: 'unknown',
      totals: null,
      posture: 'unset'
    })
    expect(input(snapshot.inputs, 'maps.eo-affordability')).toMatchObject({
      freshness: 'unknown',
      unlockedEoCount: 0,
      reviewedRouteKnowledge: false
    })
  })

  it('cannot be configured to enable route knowledge and has no I/O dependency', () => {
    const { svdata } = populatedSvData()
    const snapshot = buildQuestGrowthLocalSnapshot(svdata, {
      reviewedRouteKnowledge: true
    } as never)
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src', 'renderer', 'src', 'common', 'quest-growth-snapshot.ts'),
      'utf8'
    )

    expect(input(snapshot.inputs, 'maps.eo-affordability').reviewedRouteKnowledge).toBe(false)
    expect(source).not.toContain('queryDb')
    expect(source).not.toContain('fetch(')
    expect(source).not.toContain('localStorage')
    expect(source).not.toContain('ipcRenderer')
    expect(source).not.toContain('XMLHttpRequest')
    expect(source).not.toContain('@renderer/store')
    expect(source).not.toMatch(/from ['"]vue['"]/)
  })

  it('maps session-only user choices without granting reviewed knowledge', () => {
    expect(questGrowthContextFromSelection({ resourcePosture: 'conserve', focus: 'asw' })).toEqual({
      resourcePosture: 'conserve',
      aswTargetSelected: true,
      surfaceTargetSelected: false,
      eoTargetSelected: false,
      eventGoalSelected: false,
      evergreenCategorySelected: false
    })
    expect(questGrowthContextFromSelection({ resourcePosture: 'unset', focus: 'event' })).toEqual({
      resourcePosture: undefined,
      aswTargetSelected: false,
      surfaceTargetSelected: false,
      eoTargetSelected: false,
      eventGoalSelected: true,
      evergreenCategorySelected: false
    })
    expect(
      JSON.stringify(questGrowthContextFromSelection({ resourcePosture: 'spend', focus: 'eo' }))
    ).not.toContain('reviewedRouteKnowledge')
  })
})

import { areaNames, getEventPeriodName } from '@common/area_name'
import { KcsUtil } from '@common/kcs'
import { recordMapIdToIdNo, toRecordMapId } from '@common/record'

export interface BattleHistoryAreaOption {
  value: number
  label: string
}

export interface BattleHistoryRuntimeArea {
  readonly api_maparea_id: number
  readonly api_no: number
  readonly api_name: string
}

interface BattleHistoryArea {
  readonly areaId: number
  readonly areaNo: number
  readonly areaName: string
}

function eventAreaLabel(area: BattleHistoryArea): string {
  const periodName = getEventPeriodName(area.areaId)
  const prefix = periodName ?? `${area.areaId}`
  return `${prefix} E${area.areaNo} ${area.areaName}`
}

export function buildBattleHistoryAreaOptions(
  recordedMapIds: Iterable<number>,
  runtimeAreas: readonly BattleHistoryRuntimeArea[] = []
): BattleHistoryAreaOption[] {
  const normalOptions = areaNames
    .filter((area) => !KcsUtil.isEventAreaId(area.areaId))
    .map((area) => ({
      value: toRecordMapId(area.areaId, area.areaNo),
      label: `${area.areaId} - ${area.areaNo} ${area.areaName}`
    }))

  const eventAreaIds = new Set<number>()
  const recordedEventMapIds = new Set<number>()
  for (const mapId of recordedMapIds) {
    if (!Number.isInteger(mapId) || mapId < 0) {
      continue
    }
    const { areaId } = recordMapIdToIdNo(mapId)
    if (KcsUtil.isEventAreaId(areaId)) {
      eventAreaIds.add(areaId)
      recordedEventMapIds.add(mapId)
    }
  }

  const eventAreas = new Map<number, BattleHistoryArea>()
  for (const area of areaNames) {
    if (eventAreaIds.has(area.areaId)) {
      eventAreas.set(toRecordMapId(area.areaId, area.areaNo), area)
    }
  }
  for (const area of runtimeAreas) {
    if (!eventAreaIds.has(area.api_maparea_id)) {
      continue
    }
    const mapId = toRecordMapId(area.api_maparea_id, area.api_no)
    if (!eventAreas.has(mapId)) {
      eventAreas.set(mapId, {
        areaId: area.api_maparea_id,
        areaNo: area.api_no,
        areaName: area.api_name
      })
    }
  }
  for (const mapId of recordedEventMapIds) {
    if (eventAreas.has(mapId)) {
      continue
    }
    const { areaId, areaNo } = recordMapIdToIdNo(mapId)
    eventAreas.set(mapId, {
      areaId,
      areaNo,
      areaName: 'Unknown Area'
    })
  }

  const eventOptions = [...eventAreas.entries()]
    .sort(([left], [right]) => left - right)
    .map(([value, area]) => ({
      value,
      label: eventAreaLabel(area)
    }))

  return [...normalOptions, ...eventOptions]
}

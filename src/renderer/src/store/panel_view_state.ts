import {
  getWorkspacePageDefinitions,
  type AssistPanelWorkspaceArea,
  type AssistPanelWorkspacePageId
} from '@renderer/common/assist-panel'
import {
  getLocalStoragePrefixKey,
  LocalStorageKeyName
} from '@renderer/store/storage_key'

export type ShipListFilterName =
  | 'senkan'
  | 'kubo'
  | 'jyujyun'
  | 'keijyun'
  | 'kutikukan'
  | 'kaiboukan'
  | 'sensuikan'
  | 'hojo'

export interface ShipListViewState {
  filters: ShipListFilterName[]
  keyword: string
}

export interface SlotitemListViewState {
  filterKeys: number[]
  nameFilter: string
}

export interface BattleHistoryViewState {
  mapId: number | null
  limit: number
  startDate: string | null
  endDate: string | null
}

export type MissionAreaFilterName =
  | 'area1'
  | 'area2'
  | 'area3'
  | 'area4'
  | 'area5'
  | 'area6'

export interface MissionCheckViewState {
  areaFilters: MissionAreaFilterName[]
  showMonthly: boolean
}

export type ResourceChartViewName = 'material' | 'kit'

export interface DropByMapViewState {
  worldIndex: number
  eventAreaId: number
  mapIndices: Record<string, number>
}

export const BattleHistoryLimitOptions = [
  1, 10, 20, 40, 80, 100, 200, 400, 800, 1000, 2000, 3000, 4000
] as const

export interface PanelViewState {
  version: 1
  activeWorkspacePages: Partial<
    Record<AssistPanelWorkspaceArea, AssistPanelWorkspacePageId>
  >
  shipList: ShipListViewState
  slotitemList: SlotitemListViewState
  battleHistory: BattleHistoryViewState
  deckPort: {
    deckIndex: number
  }
  missionCheck: MissionCheckViewState
  resourceChart: {
    activeView: ResourceChartViewName
  }
  dropByMap: DropByMapViewState
  dropByShip: {
    shipId: number
  }
}

const ShipListFilterNames: readonly ShipListFilterName[] = [
  'senkan',
  'kubo',
  'jyujyun',
  'keijyun',
  'kutikukan',
  'kaiboukan',
  'sensuikan',
  'hojo'
]

const KnownWorkspacePageIds = new Set(
  (['primary', 'secondary', 'assist'] as const).flatMap((area) =>
    getWorkspacePageDefinitions(area).map((page) => page.id)
  )
)

const MissionAreaFilterNames: readonly MissionAreaFilterName[] = [
  'area1',
  'area2',
  'area3',
  'area4',
  'area5',
  'area6'
]

const defaultPanelViewState = (): PanelViewState => ({
  version: 1,
  activeWorkspacePages: {},
  shipList: {
    filters: [],
    keyword: ''
  },
  slotitemList: {
    filterKeys: [],
    nameFilter: ''
  },
  battleHistory: {
    mapId: null,
    limit: 40,
    startDate: null,
    endDate: null
  },
  deckPort: {
    deckIndex: 0
  },
  missionCheck: {
    areaFilters: [],
    showMonthly: true
  },
  resourceChart: {
    activeView: 'material'
  },
  dropByMap: {
    worldIndex: 0,
    eventAreaId: 0,
    mapIndices: {}
  },
  dropByShip: {
    shipId: 0
  }
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.slice(0, 200) : ''

const normalizeDateText = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? value
    : null
}

export function normalizePanelViewState(value: unknown): PanelViewState {
  const result = defaultPanelViewState()
  if (!isRecord(value) || value.version !== 1) {
    return result
  }

  if (isRecord(value.activeWorkspacePages)) {
    for (const area of ['primary', 'secondary', 'assist'] as const) {
      const pageId = value.activeWorkspacePages[area]
      if (
        typeof pageId === 'string' &&
        pageId.length > 0 &&
        pageId.length <= 100 &&
        (KnownWorkspacePageIds.has(pageId) || pageId.startsWith('user-'))
      ) {
        result.activeWorkspacePages[area] = pageId
      }
    }
  }

  if (isRecord(value.shipList)) {
    if (Array.isArray(value.shipList.filters)) {
      result.shipList.filters = [
        ...new Set(
          value.shipList.filters.filter(
            (filter): filter is ShipListFilterName =>
              typeof filter === 'string' &&
              ShipListFilterNames.includes(filter as ShipListFilterName)
          )
        )
      ]
    }
    result.shipList.keyword = normalizeText(value.shipList.keyword)
  }

  if (isRecord(value.slotitemList)) {
    if (Array.isArray(value.slotitemList.filterKeys)) {
      result.slotitemList.filterKeys = [
        ...new Set(
          value.slotitemList.filterKeys.filter(
            (key): key is number =>
              typeof key === 'number' &&
              Number.isSafeInteger(key) &&
              key > 0
          )
        )
      ].slice(0, 100)
    }
    result.slotitemList.nameFilter = normalizeText(
      value.slotitemList.nameFilter
    )
  }

  if (isRecord(value.battleHistory)) {
    const mapId = value.battleHistory.mapId
    result.battleHistory.mapId =
      typeof mapId === 'number' &&
      Number.isSafeInteger(mapId) &&
      mapId > 0
        ? mapId
        : null
    const limit = value.battleHistory.limit
    if (
      typeof limit === 'number' &&
      BattleHistoryLimitOptions.includes(
        limit as (typeof BattleHistoryLimitOptions)[number]
      )
    ) {
      result.battleHistory.limit = limit
    }
    result.battleHistory.startDate = normalizeDateText(
      value.battleHistory.startDate
    )
    result.battleHistory.endDate = normalizeDateText(
      value.battleHistory.endDate
    )
  }

  if (isRecord(value.deckPort)) {
    const deckIndex = value.deckPort.deckIndex
    if (
      typeof deckIndex === 'number' &&
      Number.isSafeInteger(deckIndex) &&
      deckIndex >= 0 &&
      deckIndex <= 3
    ) {
      result.deckPort.deckIndex = deckIndex
    }
  }

  if (isRecord(value.missionCheck)) {
    if (Array.isArray(value.missionCheck.areaFilters)) {
      result.missionCheck.areaFilters = [
        ...new Set(
          value.missionCheck.areaFilters.filter(
            (filter): filter is MissionAreaFilterName =>
              typeof filter === 'string' &&
              MissionAreaFilterNames.includes(
                filter as MissionAreaFilterName
              )
          )
        )
      ]
    }
    if (typeof value.missionCheck.showMonthly === 'boolean') {
      result.missionCheck.showMonthly = value.missionCheck.showMonthly
    }
  }

  if (
    isRecord(value.resourceChart) &&
    (value.resourceChart.activeView === 'material' ||
      value.resourceChart.activeView === 'kit')
  ) {
    result.resourceChart.activeView = value.resourceChart.activeView
  }

  if (isRecord(value.dropByMap)) {
    const worldIndex = value.dropByMap.worldIndex
    if (
      typeof worldIndex === 'number' &&
      Number.isSafeInteger(worldIndex) &&
      worldIndex >= 0 &&
      worldIndex <= 7
    ) {
      result.dropByMap.worldIndex = worldIndex
    }
    const eventAreaId = value.dropByMap.eventAreaId
    if (
      typeof eventAreaId === 'number' &&
      Number.isSafeInteger(eventAreaId) &&
      eventAreaId >= 0
    ) {
      result.dropByMap.eventAreaId = eventAreaId
    }
    if (isRecord(value.dropByMap.mapIndices)) {
      Object.entries(value.dropByMap.mapIndices)
        .slice(0, 100)
        .forEach(([areaId, mapIndex]) => {
          if (
            /^\d+$/.test(areaId) &&
            typeof mapIndex === 'number' &&
            Number.isSafeInteger(mapIndex) &&
            mapIndex >= 0 &&
            mapIndex <= 20
          ) {
            result.dropByMap.mapIndices[areaId] = mapIndex
          }
        })
    }
  }

  if (isRecord(value.dropByShip)) {
    const shipId = value.dropByShip.shipId
    if (
      typeof shipId === 'number' &&
      Number.isSafeInteger(shipId) &&
      shipId >= 0
    ) {
      result.dropByShip.shipId = shipId
    }
  }

  return result
}

const LocalStorageKey = getLocalStoragePrefixKey(
  LocalStorageKeyName.prefix.panelViewStatePrefix
)

function load(): PanelViewState {
  const json = localStorage.getItem(LocalStorageKey)
  if (!json) {
    return defaultPanelViewState()
  }
  try {
    return normalizePanelViewState(JSON.parse(json))
  } catch {
    return defaultPanelViewState()
  }
}

const panelViewState = load()
let saveRequested = false

function delaySave(): void {
  if (saveRequested) {
    return
  }
  saveRequested = true
  setTimeout(() => {
    saveRequested = false
    localStorage.setItem(LocalStorageKey, JSON.stringify(panelViewState))
  }, 0)
}

export function getActiveWorkspacePage(
  area: AssistPanelWorkspaceArea,
  availablePageIds: readonly AssistPanelWorkspacePageId[]
): AssistPanelWorkspacePageId | undefined {
  const pageId = panelViewState.activeWorkspacePages[area]
  return pageId && availablePageIds.includes(pageId) ? pageId : undefined
}

export function saveActiveWorkspacePage(
  area: AssistPanelWorkspaceArea,
  pageId: AssistPanelWorkspacePageId
): void {
  panelViewState.activeWorkspacePages[area] = pageId
  delaySave()
}

export function getShipListViewState(): ShipListViewState {
  return {
    filters: [...panelViewState.shipList.filters],
    keyword: panelViewState.shipList.keyword
  }
}

export function saveShipListViewState(state: ShipListViewState): void {
  panelViewState.shipList = normalizePanelViewState({
    version: 1,
    shipList: state
  }).shipList
  delaySave()
}

export function getSlotitemListViewState(): SlotitemListViewState {
  return {
    filterKeys: [...panelViewState.slotitemList.filterKeys],
    nameFilter: panelViewState.slotitemList.nameFilter
  }
}

export function saveSlotitemListViewState(
  state: SlotitemListViewState
): void {
  panelViewState.slotitemList = normalizePanelViewState({
    version: 1,
    slotitemList: state
  }).slotitemList
  delaySave()
}

export function getBattleHistoryViewState(): BattleHistoryViewState {
  return { ...panelViewState.battleHistory }
}

export function saveBattleHistoryViewState(
  state: BattleHistoryViewState
): void {
  panelViewState.battleHistory = normalizePanelViewState({
    version: 1,
    battleHistory: state
  }).battleHistory
  delaySave()
}

export function getDeckPortViewState(): PanelViewState['deckPort'] {
  return { ...panelViewState.deckPort }
}

export function saveDeckPortViewState(
  state: PanelViewState['deckPort']
): void {
  panelViewState.deckPort = normalizePanelViewState({
    version: 1,
    deckPort: state
  }).deckPort
  delaySave()
}

export function getMissionCheckViewState(): MissionCheckViewState {
  return {
    areaFilters: [...panelViewState.missionCheck.areaFilters],
    showMonthly: panelViewState.missionCheck.showMonthly
  }
}

export function saveMissionCheckViewState(
  state: MissionCheckViewState
): void {
  panelViewState.missionCheck = normalizePanelViewState({
    version: 1,
    missionCheck: state
  }).missionCheck
  delaySave()
}

export function getResourceChartViewState(): ResourceChartViewName {
  return panelViewState.resourceChart.activeView
}

export function saveResourceChartViewState(
  activeView: ResourceChartViewName
): void {
  panelViewState.resourceChart.activeView = activeView
  delaySave()
}

export function getDropByMapViewState(): DropByMapViewState {
  return {
    worldIndex: panelViewState.dropByMap.worldIndex,
    eventAreaId: panelViewState.dropByMap.eventAreaId,
    mapIndices: { ...panelViewState.dropByMap.mapIndices }
  }
}

export function saveDropByMapWorldState(
  worldIndex: number,
  eventAreaId: number
): void {
  const normalized = normalizePanelViewState({
    version: 1,
    dropByMap: {
      ...panelViewState.dropByMap,
      worldIndex,
      eventAreaId
    }
  }).dropByMap
  panelViewState.dropByMap.worldIndex = normalized.worldIndex
  panelViewState.dropByMap.eventAreaId = normalized.eventAreaId
  delaySave()
}

export function saveDropByMapAreaIndex(
  areaId: number,
  mapIndex: number
): void {
  const normalized = normalizePanelViewState({
    version: 1,
    dropByMap: {
      ...panelViewState.dropByMap,
      mapIndices: {
        ...panelViewState.dropByMap.mapIndices,
        [areaId]: mapIndex
      }
    }
  }).dropByMap
  panelViewState.dropByMap.mapIndices = normalized.mapIndices
  delaySave()
}

export function getDropByShipId(): number {
  return panelViewState.dropByShip.shipId
}

export function saveDropByShipId(shipId: number): void {
  panelViewState.dropByShip = normalizePanelViewState({
    version: 1,
    dropByShip: { shipId }
  }).dropByShip
  delaySave()
}

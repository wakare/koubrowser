import { EnvRenderer } from '@renderer/common/env-renderer'
import { ref } from 'vue'
import { getLocalStoragePrefixKey, LocalStorageKeyName } from '@renderer/store/storage_key';
import {
  getAssistPanelDefinitions,
  type AssistPanelName
} from '@renderer/common/assist-panel'

/////////////////////////////////////////////////////////////////////////////////////
// デバッグログ
const DEBUG = 0;

const debug = (...args: any[]) => {
  if (DEBUG) console.debug("[ui-state]", ...args);
};

/////////////////////////////////////////////////////////////////////////////////////
// 
export type AssistTabName = AssistPanelName

export type BattleTabName =
  | 'score'
  | 'history'

export type ShipItemsTabName =
  | 'shiplist'
  | 'slotitemlist'
  | 'itemlist'

export type DropByShipTabName =
  | 'senkan'
  | 'kubo'
  | 'jyujyun'
  | 'keijyun'
  | 'kutikukan'
  | 'kaiboukan'
  | 'sensuikan'
  | 'hojo'

const BattleTabNames: readonly BattleTabName[] = ['score', 'history']
const ShipItemsTabNames: readonly ShipItemsTabName[] = [
  'shiplist',
  'slotitemlist',
  'itemlist'
]
const DropByShipTabNames: readonly DropByShipTabName[] = [
  'senkan',
  'kubo',
  'jyujyun',
  'keijyun',
  'kutikukan',
  'kaiboukan',
  'sensuikan',
  'hojo'
]

/////////////////////////////////////////////////////////////////////////////////////
// UI state
export interface UIState {
  tabName : AssistTabName

  // battletab
  battletab: {
    tabName: BattleTabName
  }

  // shipitems
  shipitems: {
    tabName: ShipItemsTabName
  }

  // dropbyship
  dropbyship: {
    tabName: DropByShipTabName
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isTabName = <T extends string>(
  value: unknown,
  names: readonly T[]
): value is T => typeof value === 'string' && names.includes(value as T)

const defaultUIState = (): UIState => {
  return {
    tabName: 'deckport',
    battletab: {
      tabName: 'score'
    },
    shipitems: {
      tabName: 'shiplist'
    },
    dropbyship: {
      tabName: 'senkan'
    }
  }
}

export function normalizeUIState(
  value: unknown,
  restoreOuterTab: boolean
): UIState {
  const result = defaultUIState()
  if (!isRecord(value)) {
    return result
  }

  const assistTabNames = getAssistPanelDefinitions(restoreOuterTab).map(
    (panel) => panel.name
  )
  if (
    restoreOuterTab &&
    isTabName(value.tabName, assistTabNames)
  ) {
    result.tabName = value.tabName
  }

  if (
    isRecord(value.battletab) &&
    isTabName(value.battletab.tabName, BattleTabNames)
  ) {
    result.battletab.tabName = value.battletab.tabName
  }
  if (
    isRecord(value.shipitems) &&
    isTabName(value.shipitems.tabName, ShipItemsTabNames)
  ) {
    result.shipitems.tabName = value.shipitems.tabName
  }
  if (
    isRecord(value.dropbyship) &&
    isTabName(value.dropbyship.tabName, DropByShipTabNames)
  ) {
    result.dropbyship.tabName = value.dropbyship.tabName
  }

  return result
}

const LocalStorageKey = ((): string => 
  getLocalStoragePrefixKey(LocalStorageKeyName.prefix.uiStatePrefix)
)();

function load(): UIState {
  debug('loading state')

  const def = defaultUIState()
  const json = localStorage.getItem(LocalStorageKey)
  if (! json) {
    return def
  }
  try {
    const obj = JSON.parse(json)
    debug('loaded ui state:', obj)
    const normalized = normalizeUIState(obj, EnvRenderer.isAssist)
    debug('normalized ui state:', normalized)
    return normalized
  } catch {
  }
  return def
}
const uiState = load()

let delaySaveRequested = false;
function delaySave() {
  if (! delaySaveRequested) {
    delaySaveRequested = true
    setTimeout(() => {
      delaySaveRequested = false
      localStorage.setItem(LocalStorageKey, JSON.stringify(uiState))
      debug('saved (delayed):', uiState)
    }, 0)
  }
}

/////////////////////////////////////////////////////////////////////////////////////
// assist component
export namespace AssistUIState {

  export const tabOrder: AssistTabName[] = (() => {
    return getAssistPanelDefinitions(EnvRenderer.isAssist).map((panel) => panel.name)
  })()

  export const tabIndex = ref(getTabIndex(uiState.tabName))
  export const tabRequest = ref<AssistTabName | null>(null)

  export function requestTab(tabName: AssistTabName): void {
    tabRequest.value = tabName
  }

  function getTabIndex(tabName: string): number {
    const index = tabOrder.findIndex((el) => el === tabName)
    debug('getting tab index for tab name:', tabName, 'tab order:', tabOrder, 'index:', index)
    return index >= 0 ? index : 0
  }

  export const isTabVisibleByName = (tabName: AssistTabName): boolean => {
    const index = tabOrder.indexOf(tabName)
    return tabIndex.value === index
  }

  export function getTabName(index: number): AssistTabName | undefined {
    return tabOrder[index]
  }

  export function saveTabName(tabName: AssistTabName): void {
    uiState.tabName = tabName
    if (EnvRenderer.isAssist) {
      delaySave()
    }
  }
}

/////////////////////////////////////////////////////////////////////////////////////
// battletab component
export namespace BattleTabUIState {

  export const tabOrder: BattleTabName[] = (() => {
    return [...BattleTabNames]
  })()

  export const tabIndex = ref(getTabIndex(uiState.battletab.tabName))

  function getTabIndex(tabName: string): number {
    const index = tabOrder.findIndex((el) => el === tabName)
    debug('getting tab index for tab name:', tabName, 'tab order:', tabOrder, 'index:', index)
    return index >= 0 ? index : 0
  }

  export const isTabVisibleByName = (tabName: BattleTabName): boolean => {
    const index = tabOrder.indexOf(tabName)
    return tabIndex.value === index
  }

  export function getTabName(index: number): BattleTabName | undefined {
    return tabOrder[index]
  }

  export function saveTabName(tabName: BattleTabName): void {
    uiState.battletab.tabName = tabName
    delaySave()
  }
}

/////////////////////////////////////////////////////////////////////////////////////
// shipitems component
export namespace ShipItemsTabUIState {

  export const tabOrder: ShipItemsTabName[] = (() => {
    return [...ShipItemsTabNames]
  })()

  export const tabIndex = ref(getTabIndex(uiState.shipitems.tabName))

  function getTabIndex(tabName: string): number {
    const index = tabOrder.findIndex((el) => el === tabName)
    debug('getting tab index for tab name:', tabName, 'tab order:', tabOrder, 'index:', index)
    return index >= 0 ? index : 0
  }

  export const isTabVisibleByName = (tabName: ShipItemsTabName): boolean => {
    const index = tabOrder.indexOf(tabName)
    return tabIndex.value === index
  }

  export function getTabName(index: number): ShipItemsTabName | undefined {
    return tabOrder[index]
  }

  export function saveTabName(tabName: ShipItemsTabName): void {
    uiState.shipitems.tabName = tabName
    delaySave()
  }
}

/////////////////////////////////////////////////////////////////////////////////////
// dropbyship component
export namespace DropByShipTabUIState {

  export const tabOrder: DropByShipTabName[] = (() => {
    return [...DropByShipTabNames]
  })()

  export const tabIndex = ref(getTabIndex(uiState.dropbyship.tabName))

  function getTabIndex(tabName: string): number {
    const index = tabOrder.findIndex((el) => el === tabName)
    debug('getting tab index for tab name:', tabName, 'tab order:', tabOrder, 'index:', index)
    return index >= 0 ? index : 0
  }

  export const isTabVisibleByName = (tabName: DropByShipTabName): boolean => {
    const index = tabOrder.indexOf(tabName)
    return tabIndex.value === index
  }

  export function getTabName(index: number): DropByShipTabName | undefined {
    return tabOrder[index]
  }

  export function saveTabName(tabName: DropByShipTabName): void {
    uiState.dropbyship.tabName = tabName
    delaySave()
  }
}

import {
  ApiDeckPortId,
  ApiGaugeType,
  ApiRange,
  ApiShipCategory,
  ApiShipBacks,
  ApiShipType,
  BattleType,
  CombinedFlag,
  MissionState,
  SlotitemImgType,
  SlotitemType,
  SvData,
  type ApiDeckPort,
  type ApiMapInfoList,
  type ApiShip,
  type ApiSlotitem,
  type MstShip,
  type MstSlotitem,
  type SvData as SvDataInstance
} from '@common/kcs'
import { Api } from '@common/kcsapi'
import { svdata } from '@main/svdata'
import type { KcApp } from '@main/kcbrowser'
import {
  isAccountRestoreFixtureEnabled,
  isLayoutFixtureEnabled
} from '@main/layout-fixture-env'

type LayoutFixtureApp = Pick<KcApp, 'postResToRenderer'>
type LayoutFixtureBattleApp = Pick<KcApp, 'postReqToRenderer' | 'postResToRenderer'>
type LayoutFixtureData = Pick<SvDataInstance, 'basic' | 'setServerId' | 'update'>
type LayoutFixtureAccountData = Pick<SvDataInstance, 'basic' | 'setServerId'>
export type LayoutFixtureCapacityBoundaryMode = 'full' | 'overflow'

export const AccountRestoreFixtureIdentity = Object.freeze({
  serverId: 3,
  memberId: '12345678'
})

function applyFixtureIdentity(data: LayoutFixtureAccountData): void {
  data.setServerId(AccountRestoreFixtureIdentity.serverId)
  Object.assign(data.basic, {
    api_member_id: AccountRestoreFixtureIdentity.memberId
  })
}

export const LayoutFixtureCapacity = Object.freeze({
  shipCount: 7,
  shipCapacity: 12,
  apiSlotitemCount: 19,
  slotitemCount: 18,
  apiSlotitemCapacity: 20,
  slotitemCapacity: 23
})

export const LayoutFixtureCapacityBoundary = Object.freeze({
  shipCapacity: LayoutFixtureCapacity.shipCapacity,
  slotitemCapacity: LayoutFixtureCapacity.slotitemCapacity,
  fullShipCount: LayoutFixtureCapacity.shipCapacity,
  fullSlotitemCount: LayoutFixtureCapacity.slotitemCapacity,
  overflowShipCount: LayoutFixtureCapacity.shipCapacity + 1,
  overflowSlotitemCount: LayoutFixtureCapacity.slotitemCapacity + 1
})

export const LayoutFixtureTransport = Object.freeze({
  firstSixValue: 123,
  seventhShipValue: 16,
  fullValue: 139,
  aRankValue: 97
})

export const LayoutFixtureBattleResult = Object.freeze({
  mainShipId: 1,
  mainHp: 9,
  escortShipId: 9,
  escortHp: 8,
  battleType: BattleType.combined_each_water
})

const TransportShipSlotIds = Object.freeze([
  Object.freeze([1, 2]),
  Object.freeze([3, 4]),
  Object.freeze([5, 6]),
  Object.freeze([7, 8]),
  Object.freeze([9, 10]),
  Object.freeze([11, 12]),
  Object.freeze([13, 14, 15])
])

const TransportSlotitemMasterIds = Object.freeze([
  68,
  68,
  68,
  68,
  68,
  68,
  68,
  68,
  68,
  68,
  68,
  75,
  68,
  167,
  145,
  1,
  1,
  1,
  1
])

function createFixtureMstShip(): MstShip {
  return {
    api_id: 1,
    api_sort_id: 1,
    api_sortno: 1,
    api_name: 'スモーク駆逐艦',
    api_yomi: 'すもーく',
    api_stype: ApiShipType.kutikukan,
    api_ctype: ApiShipCategory.ayanami,
    api_soku: 10,
    api_slot_num: 3,
    api_afterlv: 0,
    api_aftershipid: '',
    api_taik: [1, 1],
    api_souk: [0, 0],
    api_houg: [0, 0],
    api_raig: [0, 0],
    api_tyku: [0, 0],
    api_luck: [0, 0],
    api_leng: ApiRange.invalid,
    api_maxeq: [0, 0, 0],
    api_buildtime: 0,
    api_broken: [0, 0, 0, 0],
    api_powup: [0, 0, 0, 0],
    api_backs: ApiShipBacks.none,
    api_getmes: '',
    api_afterfuel: 0,
    api_afterbull: 0,
    api_fuel_max: 1,
    api_bull_max: 1,
    api_voicef: 0
  }
}

function createFixtureMstSlotitem(id: number): MstSlotitem {
  const names = new Map<number, string>([
    [1, 'スモーク装備'],
    [68, '大発動艇'],
    [75, 'ドラム缶(輸送用)'],
    [145, '戦闘糧食'],
    [167, '特二式内火艇']
  ])
  return {
    api_id: id,
    api_sortno: id,
    api_name: names.get(id) ?? `スモーク装備 ${id}`,
    api_type: [0, 0, SlotitemType.SmallMainGun, SlotitemImgType.syuhou_syou, 0],
    api_taik: 0,
    api_souk: 0,
    api_houg: 0,
    api_raig: 0,
    api_soku: 0,
    api_baku: 0,
    api_tyku: 0,
    api_tais: 0,
    api_atap: 0,
    api_houm: 0,
    api_raim: 0,
    api_houk: 0,
    api_raik: 0,
    api_bakk: 0,
    api_saku: 0,
    api_sakb: 0,
    api_luck: 0,
    api_leng: ApiRange.invalid,
    api_rare: 0,
    api_broken: [0, 0, 0, 0],
    api_usebull: '0',
    api_version: 0
  }
}

function createFixtureShip(id: number, slotIds: readonly number[]): ApiShip {
  return {
    api_id: id,
    api_sortno: id,
    api_ship_id: 1,
    api_lv: 1,
    api_exp: [0, 0, 0],
    api_nowhp: 1,
    api_maxhp: 1,
    api_soku: 0,
    api_leng: ApiRange.invalid,
    api_slot: [...slotIds],
    api_onslot: slotIds.map(() => 0),
    api_slot_ex: 0,
    api_kyouka: [0, 0, 0, 0, 0, 0, 0],
    api_backs: ApiShipBacks.none,
    api_fuel: 0,
    api_bull: 0,
    api_slotnum: slotIds.length,
    api_ndock_time: 0,
    api_ndock_item: [0, 0],
    api_srate: 0,
    api_cond: 49,
    api_karyoku: [0, 0],
    api_raisou: [0, 0],
    api_taiku: [0, 0],
    api_soukou: [0, 0],
    api_kaihi: [0, 0],
    api_taisen: [0, 0],
    api_sakuteki: [0, 0],
    api_lucky: [0, 0],
    api_locked: 0,
    api_locked_equip: 0
  }
}

function createFixtureSlotitem(id: number, masterId: number): ApiSlotitem {
  return {
    api_id: id,
    api_slotitem_id: masterId,
    api_locked: 0,
    api_level: 0,
    api_alv: 0
  }
}

function createFixtureDeck(): ApiDeckPort {
  return {
    api_member_id: Number(AccountRestoreFixtureIdentity.memberId),
    api_id: ApiDeckPortId.deck1st,
    api_name: '遊撃部隊',
    api_name_id: '',
    api_mission: [MissionState.no, 0, 0, 0],
    api_flagship: '0',
    api_ship: Array.from(
      { length: LayoutFixtureCapacity.shipCount },
      (_value, index) => index + 1
    )
  }
}

function createFixtureMapInfo(): ApiMapInfoList {
  return {
    api_map_info: [
      {
        api_id: 4701,
        api_cleared: 0,
        api_gauge_type: ApiGaugeType.yusou,
        api_gauge_num: 1,
        api_defeat_count: 0,
        api_required_defeat_count: 500
      }
    ],
    api_air_base: [],
    api_air_base_expanded_info: []
  }
}

function fixtureApiData(api: Api): object {
  switch (api) {
    case Api.START2_GET_DATA:
      return {
        api_mst_ship: [createFixtureMstShip()],
        api_mst_slotitem: [1, 68, 75, 145, 167].map(createFixtureMstSlotitem)
      }
    case Api.GET_MEMBER_BASIC:
      return {
        api_max_chara: LayoutFixtureCapacity.shipCapacity,
        api_max_slotitem: LayoutFixtureCapacity.apiSlotitemCapacity
      }
    case Api.PORT_PORT:
      return {
        api_ship: Array.from(
          { length: LayoutFixtureCapacity.shipCount },
          (_value, index) =>
            createFixtureShip(index + 1, TransportShipSlotIds[index])
        ),
        api_deck_port: [createFixtureDeck()]
      }
    case Api.GET_MEMBER_REQUIRE_INFO:
      return {
        api_slot_item: Array.from(
          { length: LayoutFixtureCapacity.apiSlotitemCount },
          (_value, index) =>
            createFixtureSlotitem(index + 1, TransportSlotitemMasterIds[index])
        )
      }
    case Api.GET_MEMBER_MAPINFO:
      return createFixtureMapInfo()
    default:
      return {}
  }
}

export function layoutFixtureResponse(api: Api): string {
  return layoutFixtureDataResponse(fixtureApiData(api))
}

function layoutFixtureDataResponse(apiData: object): string {
  return `${SvData.header}${JSON.stringify({
    api_result: 1,
    api_result_msg: 'OK',
    api_data: apiData
  })}`
}

export const LayoutFixtureApis = Object.freeze([
  Api.START2_GET_DATA,
  Api.GET_MEMBER_BASIC,
  Api.PORT_PORT,
  Api.GET_MEMBER_REQUIRE_INFO,
  Api.GET_MEMBER_MAPINFO
])

export function applyAccountRestoreFixtureIdentity(
  data: LayoutFixtureAccountData = svdata,
  environment: NodeJS.ProcessEnv = process.env
): boolean {
  if (!isAccountRestoreFixtureEnabled(environment)) {
    return false
  }
  applyFixtureIdentity(data)
  return true
}

export function applyLayoutFixture(
  app: LayoutFixtureApp,
  data: LayoutFixtureData = svdata,
  environment: NodeJS.ProcessEnv = process.env
): boolean {
  if (!isLayoutFixtureEnabled(environment)) {
    return false
  }

  applyFixtureIdentity(data)

  for (const api of LayoutFixtureApis) {
    const response = layoutFixtureResponse(api)
    data.update(api, response)
    app.postResToRenderer(api, response)
  }
  return true
}

export function exerciseLayoutCapacityBoundaryFixture(
  app: LayoutFixtureApp,
  mode: LayoutFixtureCapacityBoundaryMode,
  data: SvDataInstance = svdata,
  environment: NodeJS.ProcessEnv = process.env
): {
  readonly mode: LayoutFixtureCapacityBoundaryMode
  readonly shipCount: number
  readonly shipCapacity: number
  readonly slotitemCount: number
  readonly slotitemCapacity: number
} {
  if (!isLayoutFixtureEnabled(environment)) {
    throw new Error('capacity-boundary fixture is available only in the layout smoke profile')
  }

  const shipCount =
    mode === 'full'
      ? LayoutFixtureCapacityBoundary.fullShipCount
      : LayoutFixtureCapacityBoundary.overflowShipCount
  const slotitemCount =
    mode === 'full'
      ? LayoutFixtureCapacityBoundary.fullSlotitemCount
      : LayoutFixtureCapacityBoundary.overflowSlotitemCount
  const publishResponse = (api: Api, apiData: object): void => {
    const response = layoutFixtureDataResponse(apiData)
    data.update(api, response)
    app.postResToRenderer(api, response)
  }

  publishResponse(Api.GET_MEMBER_BASIC, {
    api_max_chara: LayoutFixtureCapacityBoundary.shipCapacity,
    api_max_slotitem: LayoutFixtureCapacity.apiSlotitemCapacity
  })
  publishResponse(Api.PORT_PORT, {
    api_ship: Array.from({ length: shipCount }, (_value, index) =>
      createFixtureShip(index + 1, [])
    ),
    api_deck_port: [
      {
        ...createFixtureDeck(),
        api_ship: Array.from(
          { length: Math.min(shipCount, 7) },
          (_value, index) => index + 1
        )
      }
    ]
  })
  publishResponse(Api.GET_MEMBER_REQUIRE_INFO, {
    api_slot_item: Array.from({ length: slotitemCount }, (_value, index) =>
      createFixtureSlotitem(index + 1, 1)
    )
  })

  const actual = {
    mode,
    shipCount: data.ships.length,
    shipCapacity: data.basic.api_max_chara,
    slotitemCount: data.slotitemCountForTitle,
    slotitemCapacity: data.basic.api_max_slotitem + 3
  }
  if (
    actual.shipCount !== shipCount ||
    actual.shipCapacity !== LayoutFixtureCapacityBoundary.shipCapacity ||
    actual.slotitemCount !== slotitemCount ||
    actual.slotitemCapacity !== LayoutFixtureCapacityBoundary.slotitemCapacity
  ) {
    throw new Error(
      `capacity-boundary fixture did not reach the expected state: ${JSON.stringify(actual)}`
    )
  }
  return actual
}

function createBattleFixtureDeck(
  id: ApiDeckPortId,
  shipIds: readonly number[]
): ApiDeckPort {
  return {
    ...createFixtureDeck(),
    api_id: id,
    api_name: id === ApiDeckPortId.deck1st ? 'スモーク主力艦隊' : 'スモーク護衛艦隊',
    api_ship: [...shipIds]
  }
}

function createBattleFixtureShip(id: number): ApiShip {
  return {
    ...createFixtureShip(id, []),
    api_nowhp: 40,
    api_maxhp: 40
  }
}

export function exerciseLayoutBattleResultFixture(
  app: LayoutFixtureBattleApp,
  data: SvDataInstance = svdata,
  environment: NodeJS.ProcessEnv = process.env
): typeof LayoutFixtureBattleResult {
  if (!isLayoutFixtureEnabled(environment)) {
    throw new Error('battle-result fixture is available only in the layout smoke profile')
  }

  const publishResponse = (api: Api, apiData: object): void => {
    const response = layoutFixtureDataResponse(apiData)
    data.update(api, response)
    app.postResToRenderer(api, response)
  }
  const publishRequest = (api: Api, query: string): void => {
    data.setReq(api, query)
    app.postReqToRenderer(api, query)
  }

  publishResponse(Api.PORT_PORT, {
    api_ship: Array.from({ length: LayoutFixtureBattleResult.escortShipId }, (_value, index) =>
      createBattleFixtureShip(index + 1)
    ),
    api_deck_port: [
      createBattleFixtureDeck(ApiDeckPortId.deck1st, [1, 2, 3, 4, 5, 6]),
      createBattleFixtureDeck(ApiDeckPortId.deck2st, [7, 8, 9])
    ],
    api_combined_flag: CombinedFlag.suijyou
  })

  publishRequest(
    Api.REQ_MAP_START,
    'api_maparea_id=47&api_mapinfo_no=1&api_deck_id=1'
  )
  publishResponse(Api.REQ_MAP_START, {
    api_maparea_id: 47,
    api_mapinfo_no: 1,
    api_no: 1,
    api_event_id: 4,
    api_event_kind: 1,
    api_cell_data: [],
    api_from_no: 0
  })

  publishResponse(Api.REQ_COMBINED_BATTLE_EACH_BATTLE_WATER, {
    api_f_nowhps: [40, 40, 40, 40, 40, 40],
    api_f_nowhps_combined: [40, 40, 40],
    api_kouku: {
      api_stage3: { api_fdam: [31.9, 0, 0, 0, 0, 0] },
      api_stage3_combined: { api_fdam: [0, 0, 0] }
    },
    api_hougeki1: {
      api_at_eflag: [1],
      api_df_list: [[8]],
      api_damage: [[27.4]]
    }
  })
  publishResponse(Api.REQ_COMBINED_BATTLE_MIDNIGHT_BATTLE, {
    api_f_nowhps: [9, 40, 40, 40, 40, 40],
    api_f_nowhps_combined: [40, 40, 13],
    api_hougeki: {
      api_at_eflag: [1],
      api_df_list: [[8]],
      api_damage: [[5.6]]
    }
  })
  publishResponse(Api.REQ_COMBINED_BATTLE_BATTLERESULT, {
    api_win_rank: 'A'
  })

  const actual = {
    mainShipId: LayoutFixtureBattleResult.mainShipId,
    mainHp: data.ship(LayoutFixtureBattleResult.mainShipId)?.api_nowhp,
    escortShipId: LayoutFixtureBattleResult.escortShipId,
    escortHp: data.ship(LayoutFixtureBattleResult.escortShipId)?.api_nowhp,
    battleType: data.lastBattle?.battleType
  }
  if (
    actual.mainHp !== LayoutFixtureBattleResult.mainHp ||
    actual.escortHp !== LayoutFixtureBattleResult.escortHp ||
    actual.battleType !== LayoutFixtureBattleResult.battleType
  ) {
    throw new Error(`battle-result fixture did not reach the expected state: ${JSON.stringify(actual)}`)
  }
  return LayoutFixtureBattleResult
}

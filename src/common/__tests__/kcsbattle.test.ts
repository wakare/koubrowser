import { describe, expect, it } from 'vitest'
import {
  ApiBattleResult,
  ApiCallback,
  ApiDeckPort,
  ApiMapStart,
  ApiShip,
  BattleType,
  CombinedFlag,
  createSvDataRaw,
  PrvBattleInfo,
  SvData
} from '@common/kcs'
import { Api, getApi } from '@common/kcsapi'
import { calcFriendlyHps } from '@common/kcsbattle'

const battleInfo = (
  midday: Record<string, unknown> | null,
  midnight: Record<string, unknown> | null = null
): PrvBattleInfo =>
  ({
    battleType: BattleType.midday,
    midday,
    midnight,
    result: null
  }) as unknown as PrvBattleInfo

const ship = (id: number, hp: number, maxHp = hp): ApiShip =>
  ({
    api_id: id,
    api_nowhp: hp,
    api_maxhp: maxHp
  }) as ApiShip

const deck = (id: 1 | 2, shipIds: number[]): ApiDeckPort =>
  ({
    api_id: id,
    api_ship: shipIds
  }) as ApiDeckPort

const map = (): ApiMapStart =>
  ({
    api_maparea_id: 1,
    api_mapinfo_no: 1,
    api_no: 1,
    api_event_id: 4,
    api_event_kind: 1,
    api_cell_data: [],
    api_from_no: 0
  }) as unknown as ApiMapStart

const result = (): ApiBattleResult =>
  ({
    api_win_rank: 'A'
  }) as ApiBattleResult

const apiResponse = (apiData: unknown): string =>
  JSON.stringify({
    api_result: 1,
    api_result_msg: '成功',
    api_data: apiData
  })

describe('calcFriendlyHps', () => {
  it('applies observed air, shelling, and torpedo damage to a normal fleet', () => {
    const info = battleInfo({
      api_f_nowhps: [30, 25, -1],
      api_kouku: {
        api_stage3: { api_fdam: [4.8, 0, 0] }
      },
      api_kouku2: {
        api_stage3: { api_fdam: [0, 2.9, 0] }
      },
      api_opening_atack: {
        api_erai: [1, -1],
        api_eydam: [6.9, 0]
      },
      api_hougeki1: {
        api_at_eflag: [1, 0, 1],
        api_df_list: [[0], [0], [0, 0]],
        api_damage: [[5.7], [99], [2.2, 3.8]]
      }
    })

    expect(calcFriendlyHps(info)).toEqual({
      main: [16, 17, undefined],
      escort: []
    })
  })

  it('maps combined-fleet air, shelling, and multi-target torpedo damage', () => {
    const info = battleInfo({
      api_f_nowhps: [40, 40, 40, 40, 40, 40],
      api_f_nowhps_combined: [30, 30, 30, 30, 30, 30],
      api_kouku: {
        api_stage3: { api_fdam: [1, 0, 0, 0, 0, 0] },
        api_stage3_combined: { api_fdam: [2, 0, 0, 0, 0, 0] }
      },
      api_hougeki1: {
        api_at_eflag: [1, 1],
        api_df_list: [[6], [11]],
        api_damage: [[8.9], [5.1]]
      },
      api_raigeki: {
        api_erai_list_items: [[7, 8], 9],
        api_eydam_list_items: [[4.9, 6.2], 3.9]
      }
    })

    expect(calcFriendlyHps(info)).toEqual({
      main: [39, 40, 40, 40, 40, 40],
      escort: [20, 26, 24, 27, 30, 25]
    })
  })

  it('keeps seventh-ship positions in the main fleet and includes night damage', () => {
    const info = battleInfo(
      {
        api_f_nowhps: [20, 20, 20, 20, 20, 20, 20],
        api_hougeki1: {
          api_at_eflag: [1],
          api_df_list: [[6]],
          api_damage: [[7.9]]
        }
      },
      {
        api_f_nowhps: [20, 20, 20, 20, 20, 20, 13],
        api_hougeki: {
          api_at_eflag: [1],
          api_df_list: [[6]],
          api_damage: [[4.1]]
        }
      }
    )

    expect(calcFriendlyHps(info).main).toEqual([20, 20, 20, 20, 20, 20, 9])
  })
})

describe('battle API endpoint routing', () => {
  it.each([
    [Api.REQ_SORTIE_NIGHT_TO_DAY, '/kcsapi/api_req_sortie/night_to_day'],
    [
      Api.REQ_COMBINED_BATTLE_EACH_BATTLE_WATER,
      '/kcsapi/api_req_combined_battle/each_battle_water'
    ],
    [
      Api.REQ_COMBINED_BATTLE_BATTLE_WATER,
      '/kcsapi/api_req_combined_battle/battle_water'
    ],
    [
      Api.REQ_COMBINED_BATTLE_MIDNIGHT_BATTLE,
      '/kcsapi/api_req_combined_battle/midnight_battle'
    ],
    [
      Api.REQ_COMBINED_BATTLE_SP_MIDNIGHT,
      '/kcsapi/api_req_combined_battle/sp_midnight'
    ],
    [
      Api.REQ_COMBINED_BATTLE_NIGHT_TO_DAY,
      '/kcsapi/api_req_combined_battle/night_to_day'
    ],
    [
      Api.REQ_COMBINED_BATTLE_EC_NIGHT_TO_DAY,
      '/kcsapi/api_req_combined_battle/ec_night_to_day'
    ],
    [
      Api.REQ_COMBINED_BATTLE_AIRBATTLE,
      '/kcsapi/api_req_combined_battle/airbattle'
    ]
  ])('recognizes %s without falling through to a shorter prefix', (expected, path) => {
    expect(getApi(`https://example.invalid${path}`)).toBe(expected)
  })
})

describe('battle-result fleet HP update', () => {
  it('updates the sortie deck before the normal battle-result callback', () => {
    const raw = createSvDataRaw()
    const sortieMap = map()
    const sortieShip = ship(101, 30)
    const info = battleInfo({
      api_f_nowhps: [30],
      api_hougeki1: {
        api_at_eflag: [1],
        api_df_list: [[0]],
        api_damage: [[11.8]]
      }
    })
    Object.assign(info, {
      map: sortieMap,
      cell_no: sortieMap.api_no,
      isBoss: false
    })
    raw.apiData.api_ship.push(sortieShip)
    raw.apiData.api_deck_port.push(deck(1, [sortieShip.api_id]))
    raw.apiData.api_req_map.push(sortieMap)
    raw.apiData.prv_battle_infos.push(info)
    raw.apiData.prv_battle_map_info = {
      maparea_id: 1,
      mapinfo_no: 1,
      mapLv: 0,
      deck_id: 1,
      uuid: 'test',
      start: true,
      escape_indexs: [],
      tow_indexs: []
    }

    const svdata = new SvData(raw)
    let callbackHp: number | undefined
    const callbackId = ApiCallback.set([
      Api.REQ_SORTIE_BATTLERESULT,
      () => {
        callbackHp = svdata.ship(sortieShip.api_id)?.api_nowhp
      }
    ])
    try {
      svdata.update(Api.REQ_SORTIE_BATTLERESULT, apiResponse(result()))
    } finally {
      ApiCallback.unset(callbackId)
    }

    expect(svdata.ship(sortieShip.api_id)?.api_nowhp).toBe(19)
    expect(callbackHp).toBe(19)
  })

  it('updates both player decks for a combined battle result', () => {
    const raw = createSvDataRaw()
    const sortieMap = map()
    const mainShip = ship(201, 40)
    const escortShip = ship(202, 30)
    const info = battleInfo({
      api_f_nowhps: [40],
      api_f_nowhps_combined: [30],
      api_kouku: {
        api_stage3: { api_fdam: [3.2] },
        api_stage3_combined: { api_fdam: [7.9] }
      }
    })
    Object.assign(info, {
      map: sortieMap,
      cell_no: sortieMap.api_no,
      isBoss: false
    })
    Object.assign(raw.apiData, { api_combined_flag: CombinedFlag.kidou })
    raw.apiData.api_ship.push(mainShip, escortShip)
    raw.apiData.api_deck_port.push(deck(1, [mainShip.api_id]), deck(2, [escortShip.api_id]))
    raw.apiData.api_req_map.push(sortieMap)
    raw.apiData.prv_battle_infos.push(info)
    raw.apiData.prv_battle_map_info = {
      maparea_id: 1,
      mapinfo_no: 1,
      mapLv: 0,
      deck_id: 1,
      uuid: 'test',
      start: true,
      escape_indexs: [],
      tow_indexs: []
    }

    const svdata = new SvData(raw)
    svdata.update(Api.REQ_COMBINED_BATTLE_BATTLERESULT, apiResponse(result()))

    expect(svdata.ship(mainShip.api_id)?.api_nowhp).toBe(37)
    expect(svdata.ship(escortShip.api_id)?.api_nowhp).toBe(23)
  })

  it('captures water-combined and combined-midnight endpoints before battle result', () => {
    const raw = createSvDataRaw()
    const sortieMap = map()
    const mainShip = ship(301, 40)
    const escortFlagship = ship(302, 30)
    const escortShip = ship(303, 30)
    Object.assign(raw.apiData, { api_combined_flag: CombinedFlag.suijyou })
    raw.apiData.api_ship.push(mainShip, escortFlagship, escortShip)
    raw.apiData.api_deck_port.push(
      deck(1, [mainShip.api_id]),
      deck(2, [escortFlagship.api_id, escortShip.api_id])
    )

    const svdata = new SvData(raw)
    svdata.setReq(
      Api.REQ_MAP_START,
      'api_maparea_id=1&api_mapinfo_no=1&api_deck_id=1'
    )
    svdata.update(Api.REQ_MAP_START, apiResponse(sortieMap))
    svdata.update(
      Api.REQ_COMBINED_BATTLE_EACH_BATTLE_WATER,
      apiResponse({
        api_f_nowhps: [40],
        api_f_nowhps_combined: [30, 30],
        api_hougeki1: {
          api_at_eflag: [1, 1],
          api_df_list: [[0], [7]],
          api_damage: [[5.9], [11.2]]
        }
      })
    )
    svdata.update(
      Api.REQ_COMBINED_BATTLE_MIDNIGHT_BATTLE,
      apiResponse({
        api_f_nowhps: [35],
        api_f_nowhps_combined: [30, 19],
        api_hougeki: {
          api_at_eflag: [1],
          api_df_list: [[7]],
          api_damage: [[9.8]]
        }
      })
    )
    svdata.update(Api.REQ_COMBINED_BATTLE_BATTLERESULT, apiResponse(result()))

    expect(svdata.ship(mainShip.api_id)?.api_nowhp).toBe(35)
    expect(svdata.ship(escortFlagship.api_id)?.api_nowhp).toBe(30)
    expect(svdata.ship(escortShip.api_id)?.api_nowhp).toBe(10)
    expect(svdata.lastBattle?.battleType).toBe(BattleType.combined_each_water)
    expect(svdata.lastBattle?.midnight).not.toBeNull()
  })
})

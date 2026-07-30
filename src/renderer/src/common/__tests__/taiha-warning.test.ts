import { describe, expect, it } from 'vitest'
import { ApiDeckPort, ApiShip, CombinedFlag, createSvDataRaw, SvData } from '@common/kcs'
import { hasTaihaSortieShip, taihaWarningTitle } from '@renderer/common/taiha-warning'

const ship = (id: number, hp: number, maxHp = 40): ApiShip =>
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

const sortieData = (
  mainShips: ApiShip[],
  escortShips: ApiShip[] = [],
  escapeIndexes: number[] = []
): SvData => {
  const raw = createSvDataRaw()
  raw.apiData.api_ship.push(...mainShips, ...escortShips)
  raw.apiData.api_deck_port.push(
    deck(
      1,
      mainShips.map((value) => value.api_id)
    )
  )
  if (escortShips.length > 0) {
    raw.apiData.api_deck_port.push(
      deck(
        2,
        escortShips.map((value) => value.api_id)
      )
    )
    Object.assign(raw.apiData, { api_combined_flag: CombinedFlag.kidou })
  }
  raw.apiData.prv_in_map = true
  raw.apiData.prv_battle_map_info = {
    maparea_id: 1,
    mapinfo_no: 1,
    mapLv: 0,
    deck_id: 1,
    uuid: 'test',
    start: true,
    escape_indexs: escapeIndexes,
    tow_indexs: []
  }
  return new SvData(raw)
}

describe('hasTaihaSortieShip', () => {
  it('detects a heavily damaged ship in the active fleet', () => {
    expect(hasTaihaSortieShip(sortieData([ship(1, 40), ship(2, 10)]))).toBe(true)
  })

  it('ignores escaped ships', () => {
    expect(hasTaihaSortieShip(sortieData([ship(1, 10)], [ship(2, 40)], [1]))).toBe(false)
  })

  it('ignores the escort flagship but checks the remaining escort ships', () => {
    const noWarning = sortieData([ship(1, 40)], [ship(2, 10), ship(3, 40)])
    const warning = sortieData([ship(1, 40)], [ship(2, 10), ship(3, 10)])

    expect(hasTaihaSortieShip(noWarning)).toBe(false)
    expect(hasTaihaSortieShip(warning)).toBe(true)
  })
})

describe('taihaWarningTitle', () => {
  it('distinguishes a battle-result warning from an advanced-fleet warning', () => {
    expect(taihaWarningTitle('battle-result')).toBe('！大破艦があります！')
    expect(taihaWarningTitle('advanced')).toBe('！大破進撃です！')
    expect(taihaWarningTitle('none')).toBe('')
  })
})

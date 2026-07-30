import { describe, expect, it, vi } from 'vitest'
import {
  type ApiDeckPort,
  type ApiShip,
  type ApiSlotitem,
  type MstSlotitem,
  SlotitemType,
  SvData,
  createSvDataRaw
} from '@common/kcs'

const createShip = (
  id: number,
  lineOfSight: number,
  slots: number[],
  extraSlot = 0
): ApiShip =>
  ({
    api_id: id,
    api_sakuteki: [lineOfSight, lineOfSight],
    api_slot: slots,
    api_slot_ex: extraSlot
  }) as ApiShip

const createSlotitem = (
  id: number,
  mstId: number,
  level = 0
): ApiSlotitem => ({
  api_id: id,
  api_slotitem_id: mstId,
  api_level: level
})

const createMstSlotitem = (
  id: number,
  type: number,
  lineOfSight: number
): MstSlotitem =>
  ({
    api_id: id,
    api_type: [0, 0, type, 0, 0],
    api_saku: lineOfSight
  }) as unknown as MstSlotitem

describe('fleet map line-of-sight calculation', () => {
  it('calculates several coefficients with one equipment traversal', () => {
    const raw = createSvDataRaw()
    Object.assign(raw.apiData.api_basic, { api_level: 10 })
    raw.apiData.api_ship.push(
      createShip(1, 33, [101], 103),
      createShip(2, 20, [102])
    )
    raw.apiData.api_slot_item.push(
      createSlotitem(101, 201),
      createSlotitem(102, 202, 4),
      createSlotitem(103, 203)
    )
    raw.apiData.api_mst_slotitem.push(
      createMstSlotitem(201, SlotitemType.RecSeaplane, 5),
      createMstSlotitem(202, SlotitemType.SmallRadar, 4),
      createMstSlotitem(203, SlotitemType.TorpedoBomber, 3)
    )
    const deck = {
      api_id: 1,
      api_ship: [1, 2, -1, -1, -1, -1]
    } as ApiDeckPort
    const svdata = new SvData(raw)
    const slotitemMapLos = vi.spyOn(svdata, 'slotitemMapLos')

    const values = svdata.deckMapLosValues(deck, [1, 2, 3, 4])

    expect(values).toHaveLength(4)
    expect(values[0]).toBeCloseTo(25.3, 10)
    expect(values[1]).toBeCloseTo(37.6, 10)
    expect(values[2]).toBeCloseTo(49.9, 10)
    expect(values[3]).toBeCloseTo(62.2, 10)
    expect(slotitemMapLos).toHaveBeenCalledTimes(3)
    expect(svdata.deckMapLos(deck, 3)).toBe(values[2])
  })

  it('returns an empty result without reading equipment when no coefficients are requested', () => {
    const raw = createSvDataRaw()
    raw.apiData.api_ship.push(createShip(1, 10, [101]))
    const svdata = new SvData(raw)
    const slotitemMapLos = vi.spyOn(svdata, 'slotitemMapLos')

    expect(svdata.deckMapLosValues({ api_ship: [1] } as ApiDeckPort, [])).toEqual([])
    expect(slotitemMapLos).not.toHaveBeenCalled()
  })
})

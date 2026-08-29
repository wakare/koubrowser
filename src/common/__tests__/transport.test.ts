import { describe, expect, it, vi } from 'vitest'
import {
  ApiDeckPort,
  ApiShip,
  ApiShipType,
  ApiSlotitem,
  MstShip,
  MstSlotitem,
  SvData
} from '@common/kcs'

describe('transport point calculation', () => {
  it('includes the seventh ship in a striking-force fleet', () => {
    const seventhShipId = 700
    const seventhShip = {
      api_ship_id: seventhShipId,
      api_slot: [701, 702, 703]
    } as ApiShip
    const slotitems = new Map<number, ApiSlotitem>([
      [701, { api_slotitem_id: 68 } as ApiSlotitem],
      [702, { api_slotitem_id: 167 } as ApiSlotitem],
      [703, { api_slotitem_id: 145 } as ApiSlotitem]
    ])
    const mstSlotitems = new Map<number, MstSlotitem>([
      [68, { api_id: 68 } as MstSlotitem],
      [167, { api_id: 167 } as MstSlotitem],
      [145, { api_id: 145 } as MstSlotitem]
    ])
    const data = Object.create(SvData.prototype) as SvData
    vi.spyOn(data, 'inMap', 'get').mockReturnValue(false)
    const ship = vi
      .spyOn(data, 'ship')
      .mockImplementation((id) => (id === seventhShipId ? seventhShip : undefined))
    vi.spyOn(data, 'slotitem').mockImplementation((id) => slotitems.get(id))
    vi.spyOn(data, 'mstSlotitem').mockImplementation((id) => mstSlotitems.get(id))
    vi.spyOn(data, 'mstShip').mockImplementation(
      (id) =>
        (id === seventhShipId
          ? {
              api_id: seventhShipId,
              api_stype: ApiShipType.kutikukan
            }
          : undefined) as MstShip | undefined
    )
    const deck = {
      api_ship: [101, 102, 103, 104, 105, 106, seventhShipId]
    } as ApiDeckPort

    expect(data.deckYusou(deck)).toBe(16)
    expect(ship).toHaveBeenCalledTimes(7)
    expect(ship).toHaveBeenLastCalledWith(seventhShipId)
  })
})

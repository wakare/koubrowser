import { expect, describe, it } from 'vitest'
import { MissionId, MissionStuff } from '@common/mission'
import {
  ApiDeckPort,
  ApiShip,
  ApiSlotitem,
  MstShip,
  MstSlotitem,
  ShipInfo,
  SlotitemType,
  SvData
} from '@common/kcs'

// type guard to convince TypeScript a value is non-null/non-undefined
function assertDefined<T>(v: T): asserts v is NonNullable<T> {
  if (v === undefined || v === null) throw new Error('Value is undefined or null')
}

describe('MissionDetail tests', () => {
  it('check isCombat true/false', () => {
    const combatIds: MissionId[] = [
      MissionId.IdA5,
      MissionId.IdA6,
      MissionId.IdB4,
      MissionId.IdB5,
      MissionId.IdB6,
      MissionId.Id43,
      MissionId.Id46,
      MissionId.IdD2,
      MissionId.IdD3,
      MissionId.IdE1,
      MissionId.IdE2
    ]
    const notCombatIds: MissionId[] = Object.entries(MissionId)
      .filter(([_, id]) => !combatIds.includes(id))
      .map(([_, id]) => id)
    combatIds.forEach((id) => {
      try {
        const detail = MissionStuff.getDetailById(id)
        assertDefined(detail)
        expect(detail.isCombat).toBe(true)
      } catch (e) {
        console.log(`MissionId ${id} check failed`)
        throw e
      }
    })
    notCombatIds.forEach((id) => {
      try {
        const detail = MissionStuff.getDetailById(id)
        assertDefined(detail)
        expect(detail.isCombat).toBe(false)
      } catch (e) {
        console.log(`MissionId ${id} check failed`)
        throw e
      }
    })
  })
})

describe('mission expedition bonus calculation', () => {
  const tokudaihatuSlot = (id: number): ShipInfo['slots'][number] => ({
    api: {
      api_id: id,
      api_slotitem_id: 193,
      api_level: 0
    } as ApiSlotitem,
    mst: {
      api_id: 193,
      api_type: [0, 0, SlotitemType.LandingCraft, 0, 0]
    } as unknown as MstSlotitem
  })

  const deckInfoWithTokudaihatu = (count: number) => {
    const shipInfo = {
      api: {
        api_id: 1,
        api_lv: 99,
        api_cond: 49,
        api_karyoku: [0],
        api_raisou: [0],
        api_taiku: [0],
        api_taisen: [0],
        api_sakuteki: [0]
      } as ApiShip,
      mst: {
        api_id: 1
      } as MstShip,
      slots: Array.from({ length: count }, (_, index) => tokudaihatuSlot(index + 1))
    } as ShipInfo
    const svdata = {
      shipInfos: () => [shipInfo]
    } as unknown as SvData
    const deck = {
      api_ship: [shipInfo.api.api_id]
    } as ApiDeckPort

    return MissionStuff.toDeckInfo(svdata, deck)
  }

  it('handles three special Daihatsu without a standard Daihatsu', () => {
    expect(deckInfoWithTokudaihatu(3).daihatuBonus).toBe(20)
  })

  it('handles four special Daihatsu without a standard Daihatsu', () => {
    expect(deckInfoWithTokudaihatu(4).daihatuBonus).toBe(25.4)
  })
})

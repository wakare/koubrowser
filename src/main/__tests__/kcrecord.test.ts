import { describe, it, expect, vi } from 'vitest'

// electron.app をダミーに置き換え
const dmyVerison = '0.0.0.0-test' 
vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn(() => dmyVerison),
    // 必要なら他のメソッドも追加
    // getPath: vi.fn((name: string) => '/tmp'),
  }
}))

import { RecordUtil } from '@main/kcrecord'
import fs from 'fs'
import path from 'path'
import * as kcs from '@common/kcs'
import { accountRecordIdentityKey } from '@main/account-record-identity'

function readApiReqMapNext(): kcs.ApiMapNext {
  const p = path.resolve(__dirname, 'testdata', 'api_req_map-next.json')
  const raw = fs.readFileSync(p, 'utf8')
  const parsed = JSON.parse(raw) as kcs.ApiDataRoot
  return parsed.api_data as kcs.ApiMapNext
}

export function createDummySvdata(): kcs.SvData {
  return new kcs.SvData(kcs.createSvDataRaw())
}

describe('toAreaItemGetInfos', () => {

  it('returns a record-like object for sample input', () => {

    // const svdata = createDummySvdata();

    // // prototype の getter をスパイして返り値を固定
    // const deckMock = {
    //   api_member_id: 1,
    //   api_id: 1,
    //   api_name: 'mock-deck',
    //   api_name_id: '',
    //   api_mission: [0, 0, 0, 0],
    //   api_flagship: '',
    //   api_ship: [1, 2, 3]
    // }
    // const spy = vi.spyOn(kcs.SvData.prototype, 'battleDeck', 'get').mockReturnValue(deckMock as any)
    // vi.spyOn(record, 'toShipsInfo').mockReturnValueOnce([])
        
    const map = readApiReqMapNext()
    const ret = RecordUtil.toAreaItemGetInfos(map)
    expect(ret).toBeDefined()
    expect(ret?.length).toBe(2)
    const record0 = ret?.[0]
    expect(record0).toBeDefined()
    expect(record0?.itemId).toBe(map.api_itemget_eo_result?.api_id)
    expect(record0?.itemCount).toBe(1)
    expect(record0?.eoRate).toBe(map.api_get_eo_rate)
    const record1 = ret?.[1]
    expect(record1).toBeDefined()
    expect(record1?.itemId).toBe(kcs.ApiItemId.fual)
    expect(record1?.itemCount).toBe(map.api_itemget_eo_comment?.api_getcount)
    expect(record1?.eoRate).toBeUndefined()
  })
})

describe('RecordUtil account record identities', () => {
  it('assigns one batch id and a stable index to each development result', () => {
    const dummySvdata = {
      deckSecretary: () => ({ api_ship_id: 123 }),
      basic: { api_level: 120 }
    } as unknown as kcs.SvData
    const records = RecordUtil.toItemRecord(dummySvdata, {
      api_get_items: [
        { api_id: 1, api_slotitem_id: 10 },
        { api_id: -1, api_slotitem_id: -1 }
      ],
      items: [10, 20, 30, 40]
    } as unknown as kcs.ApiCreateItemWithParam)

    expect(records).toHaveLength(2)
    expect(records?.[0].recordIdentity?.recordId).toBe(
      records?.[1].recordIdentity?.recordId
    )
    expect(records?.map((record) => record.recordIdentity?.index)).toEqual([
      0,
      1
    ])
    expect(
      records?.map((record) =>
        accountRecordIdentityKey(record as unknown as Record<string, unknown>)
      )
    ).toEqual([
      expect.stringMatching(/^1:[0-9a-f-]{36}:0$/u),
      expect.stringMatching(/^1:[0-9a-f-]{36}:1$/u)
    ])
  })

  it('assigns different identities to separate reward records', () => {
    const argument = {
      api_quest_id: 123,
      api_material: [1, 2, 3, 4],
      api_bounus: []
    } as unknown as kcs.ApiClearItemGetWithParam
    const first = RecordUtil.toClearItemGetRecord(argument)
    const second = RecordUtil.toClearItemGetRecord(argument)

    expect(first.recordIdentity).toBeDefined()
    expect(second.recordIdentity).toBeDefined()
    expect(first.recordIdentity?.recordId).not.toBe(
      second.recordIdentity?.recordId
    )
  })
})

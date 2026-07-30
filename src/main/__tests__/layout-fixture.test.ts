import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createSvDataRaw, SvData } from '@common/kcs'
import { Api } from '@common/kcsapi'
import {
  applyLayoutFixture,
  exerciseLayoutBattleResultFixture,
  exerciseLayoutCapacityBoundaryFixture,
  LayoutFixtureApis,
  LayoutFixtureBattleResult,
  LayoutFixtureCapacity,
  LayoutFixtureCapacityBoundary,
  LayoutFixtureTransport
} from '../layout-fixture'
import {
  isLayoutFixtureEnabled,
  isAccountRestoreFixtureEnabled,
  isDataUpdateConfigurationOverrideEnabled,
  isDataUpdateDownloadFixtureEnabled,
  isPseudoLocaleFixtureEnabled,
  layoutFixtureUserDataPath,
  AccountRestoreFixtureEnvironmentVariable,
  DataUpdateConfigurationOverrideEnvironmentVariable,
  DataUpdateDownloadFixtureEnvironmentVariable,
  LayoutFixtureEnvironmentVariable,
  LayoutFixtureUserDataEnvironmentVariable,
  PseudoLocaleEnvironmentVariable
} from '../layout-fixture-env'

describe('layout fixture', () => {
  it('requires an explicit environment value', () => {
    expect(isLayoutFixtureEnabled({})).toBe(false)
    expect(isLayoutFixtureEnabled({ [LayoutFixtureEnvironmentVariable]: '0' })).toBe(false)
    expect(isLayoutFixtureEnabled({ [LayoutFixtureEnvironmentVariable]: 'true' })).toBe(false)
    expect(isLayoutFixtureEnabled({ [LayoutFixtureEnvironmentVariable]: '1' })).toBe(true)
  })

  it('enables the pseudo locale only inside an explicit layout fixture', () => {
    expect(isPseudoLocaleFixtureEnabled({})).toBe(false)
    expect(
      isPseudoLocaleFixtureEnabled({
        [PseudoLocaleEnvironmentVariable]: '1'
      })
    ).toBe(false)
    expect(
      isPseudoLocaleFixtureEnabled({
        [LayoutFixtureEnvironmentVariable]: '1',
        [PseudoLocaleEnvironmentVariable]: '0'
      })
    ).toBe(false)
    expect(
      isPseudoLocaleFixtureEnabled({
        [LayoutFixtureEnvironmentVariable]: '1',
        [PseudoLocaleEnvironmentVariable]: '1'
      })
    ).toBe(true)
  })

  it('enables the account restore fixture only inside the layout fixture', () => {
    expect(isAccountRestoreFixtureEnabled({})).toBe(false)
    expect(
      isAccountRestoreFixtureEnabled({
        [AccountRestoreFixtureEnvironmentVariable]: '1'
      })
    ).toBe(false)
    expect(
      isAccountRestoreFixtureEnabled({
        [LayoutFixtureEnvironmentVariable]: '1',
        [AccountRestoreFixtureEnvironmentVariable]: '1'
      })
    ).toBe(true)
  })

  it('allows localhost data downloads only inside the IPC-gated layout fixture', () => {
    const completeEnvironment = {
      [LayoutFixtureEnvironmentVariable]: '1',
      [DataUpdateDownloadFixtureEnvironmentVariable]: '1',
      KOUBROWSER_SMOKE_IPC: '1'
    }

    expect(isDataUpdateDownloadFixtureEnabled(completeEnvironment)).toBe(true)
    expect(
      isDataUpdateDownloadFixtureEnabled({
        ...completeEnvironment,
        [LayoutFixtureEnvironmentVariable]: '0'
      })
    ).toBe(false)
    expect(
      isDataUpdateDownloadFixtureEnabled({
        ...completeEnvironment,
        KOUBROWSER_SMOKE_IPC: '0'
      })
    ).toBe(false)
    expect(
      isDataUpdateDownloadFixtureEnabled({
        ...completeEnvironment,
        [DataUpdateDownloadFixtureEnvironmentVariable]: '0'
      })
    ).toBe(false)
  })

  it('allows data update environment overrides only inside the IPC-gated layout fixture', () => {
    const completeEnvironment = {
      [LayoutFixtureEnvironmentVariable]: '1',
      [DataUpdateConfigurationOverrideEnvironmentVariable]: '1',
      KOUBROWSER_SMOKE_IPC: '1',
      KOUBROWSER_SMOKE_IPC_TOKEN: 'test-token'
    }

    expect(isDataUpdateConfigurationOverrideEnabled(completeEnvironment, true)).toBe(true)
    expect(
      isDataUpdateConfigurationOverrideEnabled(
        {
          ...completeEnvironment,
          [LayoutFixtureEnvironmentVariable]: '0'
        },
        true
      )
    ).toBe(false)
    expect(
      isDataUpdateConfigurationOverrideEnabled(
        {
          ...completeEnvironment,
          KOUBROWSER_SMOKE_IPC: '0'
        },
        true
      )
    ).toBe(false)
    expect(
      isDataUpdateConfigurationOverrideEnabled(
        {
          ...completeEnvironment,
          [DataUpdateConfigurationOverrideEnvironmentVariable]: '0'
        },
        true
      )
    ).toBe(false)
    expect(
      isDataUpdateConfigurationOverrideEnabled(
        {
          ...completeEnvironment,
          KOUBROWSER_SMOKE_IPC_TOKEN: ''
        },
        true
      )
    ).toBe(false)
    expect(isDataUpdateConfigurationOverrideEnabled(completeEnvironment, false)).toBe(false)
  })

  it('accepts only an explicit smoke directory directly below the temporary root', () => {
    const temporaryDirectory = path.join(path.parse(process.cwd()).root, 'temporary-fixture-root')
    const validPath = path.join(temporaryDirectory, 'koubrowser-layout-smoke-abc123')

    expect(
      layoutFixtureUserDataPath(
        {
          [LayoutFixtureEnvironmentVariable]: '1',
          [LayoutFixtureUserDataEnvironmentVariable]: validPath
        },
        temporaryDirectory
      )
    ).toBe(validPath)
    expect(
      layoutFixtureUserDataPath(
        {
          [LayoutFixtureEnvironmentVariable]: '0',
          [LayoutFixtureUserDataEnvironmentVariable]: validPath
        },
        temporaryDirectory
      )
    ).toBeNull()
    expect(() =>
      layoutFixtureUserDataPath(
        {
          [LayoutFixtureEnvironmentVariable]: '1',
          [LayoutFixtureUserDataEnvironmentVariable]: path.join(
            temporaryDirectory,
            'ordinary-app-data'
          )
        },
        temporaryDirectory
      )
    ).toThrow('invalid layout fixture user-data directory')
    expect(() =>
      layoutFixtureUserDataPath(
        {
          [LayoutFixtureEnvironmentVariable]: '1',
          [LayoutFixtureUserDataEnvironmentVariable]: path.join(
            temporaryDirectory,
            'koubrowser-layout-smoke-parent',
            'nested'
          )
        },
        temporaryDirectory
      )
    ).toThrow('invalid layout fixture user-data directory')
  })

  it('does not inject data unless explicitly enabled', () => {
    const app = { postResToRenderer: vi.fn() }
    const data = {
      basic: { api_member_id: '' },
      setServerId: vi.fn(),
      update: vi.fn()
    }

    expect(applyLayoutFixture(app, data as never, {})).toBe(false)
    expect(data.update).not.toHaveBeenCalled()
    expect(app.postResToRenderer).not.toHaveBeenCalled()
  })

  it('injects only the local readiness APIs', () => {
    const app = { postResToRenderer: vi.fn() }
    const data = {
      basic: { api_member_id: '' },
      setServerId: vi.fn(),
      update: vi.fn()
    }

    expect(
      applyLayoutFixture(app, data as never, {
        [LayoutFixtureEnvironmentVariable]: '1'
      })
    ).toBe(true)
    expect(LayoutFixtureApis).toEqual([
      Api.START2_GET_DATA,
      Api.GET_MEMBER_BASIC,
      Api.PORT_PORT,
      Api.GET_MEMBER_REQUIRE_INFO,
      Api.GET_MEMBER_MAPINFO
    ])
    expect(data.update).toHaveBeenCalledTimes(LayoutFixtureApis.length)
    expect(app.postResToRenderer).toHaveBeenCalledTimes(LayoutFixtureApis.length)
    expect(data.setServerId).toHaveBeenCalledWith(3)
    expect(data.basic.api_member_id).toBe('12345678')

    const responseFor = (api: Api): Record<string, unknown> => {
      const call = data.update.mock.calls.find(([calledApi]) => calledApi === api)
      expect(call).toBeDefined()
      return JSON.parse((call![1] as string).slice(SvData.header.length)).api_data
    }
    expect(responseFor(Api.START2_GET_DATA)).toMatchObject({
      api_mst_ship: [{ api_id: 1, api_stype: 2 }],
      api_mst_slotitem: expect.arrayContaining([
        expect.objectContaining({ api_id: 68 }),
        expect.objectContaining({ api_id: 75 }),
        expect.objectContaining({ api_id: 145 }),
        expect.objectContaining({ api_id: 167 })
      ])
    })
    expect(responseFor(Api.GET_MEMBER_BASIC)).toMatchObject({
      api_max_chara: LayoutFixtureCapacity.shipCapacity,
      api_max_slotitem: LayoutFixtureCapacity.apiSlotitemCapacity
    })
    expect(responseFor(Api.PORT_PORT)).toMatchObject({
      api_ship: expect.any(Array),
      api_deck_port: [
        expect.objectContaining({
          api_ship: [1, 2, 3, 4, 5, 6, 7]
        })
      ]
    })
    expect(responseFor(Api.PORT_PORT).api_ship).toHaveLength(LayoutFixtureCapacity.shipCount)
    expect(responseFor(Api.GET_MEMBER_REQUIRE_INFO).api_slot_item).toHaveLength(
      LayoutFixtureCapacity.apiSlotitemCount
    )
    expect(responseFor(Api.GET_MEMBER_MAPINFO)).toMatchObject({
      api_map_info: [
        expect.objectContaining({
          api_id: 4701,
          api_gauge_type: 3
        })
      ]
    })
  })

  it('hydrates deterministic near-limit capacity data through the production parser', () => {
    const data = new SvData(createSvDataRaw())

    expect(
      applyLayoutFixture({ postResToRenderer: vi.fn() }, data, {
        [LayoutFixtureEnvironmentVariable]: '1'
      })
    ).toBe(true)
    expect(data.basic.api_max_chara).toBe(LayoutFixtureCapacity.shipCapacity)
    expect(data.ships).toHaveLength(LayoutFixtureCapacity.shipCount)
    expect(data.basic.api_max_slotitem + 3).toBe(LayoutFixtureCapacity.slotitemCapacity)
    expect(data.slotitemCountForTitle).toBe(LayoutFixtureCapacity.slotitemCount)
    expect(data.deckPorts).toHaveLength(1)
    const transportDeck = data.deckPorts[0]
    expect(data.deckYusou(transportDeck)).toBe(LayoutFixtureTransport.fullValue)
    expect(
      data.deckYusou({
        ...transportDeck,
        api_ship: transportDeck.api_ship.slice(0, 6)
      })
    ).toBe(LayoutFixtureTransport.firstSixValue)
    expect(data.shipYusou(data.ship(7))).toBe(LayoutFixtureTransport.seventhShipValue)
    expect(Math.floor(data.deckYusou(transportDeck) * 0.7)).toBe(LayoutFixtureTransport.aRankValue)
    expect(data.mapinfos).toEqual([
      expect.objectContaining({
        api_id: 4701,
        api_gauge_type: 3
      })
    ])
    expect(data.isMstDataOk).toBe(true)
    expect(data.isShipDataOk).toBe(true)
    expect(data.isSlotitemDataOk).toBe(true)
  })

  it.each([
    {
      mode: 'full' as const,
      shipCount: LayoutFixtureCapacityBoundary.fullShipCount,
      slotitemCount: LayoutFixtureCapacityBoundary.fullSlotitemCount
    },
    {
      mode: 'overflow' as const,
      shipCount: LayoutFixtureCapacityBoundary.overflowShipCount,
      slotitemCount: LayoutFixtureCapacityBoundary.overflowSlotitemCount
    }
  ])(
    'replays $mode ship and equipment capacity through the production parser',
    ({ mode, shipCount, slotitemCount }) => {
      const app = { postResToRenderer: vi.fn() }
      const data = new SvData(createSvDataRaw())

      expect(applyLayoutFixture(app, data, { [LayoutFixtureEnvironmentVariable]: '1' })).toBe(true)
      app.postResToRenderer.mockClear()

      expect(
        exerciseLayoutCapacityBoundaryFixture(app, mode, data, {
          [LayoutFixtureEnvironmentVariable]: '1'
        })
      ).toEqual({
        mode,
        shipCount,
        shipCapacity: LayoutFixtureCapacityBoundary.shipCapacity,
        slotitemCount,
        slotitemCapacity: LayoutFixtureCapacityBoundary.slotitemCapacity
      })
      expect(app.postResToRenderer.mock.calls.map(([api]) => api)).toEqual([
        Api.GET_MEMBER_BASIC,
        Api.PORT_PORT,
        Api.GET_MEMBER_REQUIRE_INFO
      ])
    }
  )

  it('rejects the capacity-boundary replay outside the explicit layout fixture', () => {
    expect(() =>
      exerciseLayoutCapacityBoundaryFixture(
        { postResToRenderer: vi.fn() },
        'full',
        new SvData(createSvDataRaw()),
        {}
      )
    ).toThrow('only in the layout smoke profile')
  })

  it('replays combined day and night responses through the production parser', () => {
    const app = {
      postReqToRenderer: vi.fn(),
      postResToRenderer: vi.fn()
    }
    const data = new SvData(createSvDataRaw())

    expect(applyLayoutFixture(app, data, { [LayoutFixtureEnvironmentVariable]: '1' })).toBe(true)
    expect(
      exerciseLayoutBattleResultFixture(app, data, { [LayoutFixtureEnvironmentVariable]: '1' })
    ).toEqual(LayoutFixtureBattleResult)
    expect(data.ship(LayoutFixtureBattleResult.mainShipId)?.api_nowhp).toBe(
      LayoutFixtureBattleResult.mainHp
    )
    expect(data.ship(LayoutFixtureBattleResult.escortShipId)?.api_nowhp).toBe(
      LayoutFixtureBattleResult.escortHp
    )
    expect(data.lastBattle?.battleType).toBe(LayoutFixtureBattleResult.battleType)
    expect(app.postReqToRenderer).toHaveBeenCalledWith(
      Api.REQ_MAP_START,
      'api_maparea_id=47&api_mapinfo_no=1&api_deck_id=1'
    )
    expect(app.postResToRenderer.mock.calls.map(([api]) => api)).toEqual(
      expect.arrayContaining([
        Api.REQ_COMBINED_BATTLE_EACH_BATTLE_WATER,
        Api.REQ_COMBINED_BATTLE_MIDNIGHT_BATTLE,
        Api.REQ_COMBINED_BATTLE_BATTLERESULT
      ])
    )
  })

  it('rejects the battle-result replay outside the explicit layout fixture', () => {
    expect(() =>
      exerciseLayoutBattleResultFixture(
        {
          postReqToRenderer: vi.fn(),
          postResToRenderer: vi.fn()
        },
        new SvData(createSvDataRaw()),
        {}
      )
    ).toThrow('only in the layout smoke profile')
  })

  it('uses the same deterministic local account for restore smoke', () => {
    const app = { postResToRenderer: vi.fn() }
    const data = {
      basic: { api_member_id: '' },
      setServerId: vi.fn(),
      update: vi.fn()
    }

    expect(
      applyLayoutFixture(app, data as never, {
        [LayoutFixtureEnvironmentVariable]: '1',
        [AccountRestoreFixtureEnvironmentVariable]: '1'
      })
    ).toBe(true)
    expect(data.setServerId).toHaveBeenCalledWith(3)
    expect(data.basic.api_member_id).toBe('12345678')
  })
})

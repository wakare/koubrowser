import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@renderer/common/env-renderer', () => ({
  EnvRenderer: {
    isAssist: false
  }
}))

describe('panel view state', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('normalizes malformed and stale persisted values', async () => {
    const { normalizePanelViewState } = await import(
      '@renderer/store/panel_view_state'
    )

    expect(
      normalizePanelViewState({
        version: 1,
        activeWorkspacePages: {
          secondary: 'removed-page'
        },
        shipList: {
          filters: ['senkan', 'senkan', 'removed-filter'],
          keyword: 42
        },
        slotitemList: {
          filterKeys: [10, 10, -1, 1.5, '20'],
          nameFilter: '零式'
        },
        battleHistory: {
          mapId: -1,
          limit: 999,
          startDate: '2026-02-30',
          endDate: 'not-a-date'
        },
        deckPort: {
          deckIndex: 9
        },
        missionCheck: {
          areaFilters: ['area1', 'area1', 'removed-area'],
          showMonthly: 'yes'
        },
        resourceChart: {
          activeView: 'removed-view'
        },
        dropByMap: {
          worldIndex: 8,
          eventAreaId: -1,
          mapIndices: {
            1: 2,
            invalid: 3,
            2: 99
          }
        },
        dropByShip: {
          shipId: -1
        }
      })
    ).toEqual({
      version: 1,
      activeWorkspacePages: {},
      shipList: {
        filters: ['senkan'],
        keyword: ''
      },
      slotitemList: {
        filterKeys: [10],
        nameFilter: '零式'
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
        areaFilters: ['area1'],
        showMonthly: true
      },
      resourceChart: {
        activeView: 'material'
      },
      dropByMap: {
        worldIndex: 0,
        eventAreaId: 0,
        mapIndices: {
          1: 2
        }
      },
      dropByShip: {
        shipId: 0
      }
    })
  })

  it('restores a valid workspace page and ignores unavailable pages', async () => {
    localStorage.setItem(
      'panelViewState:main',
      JSON.stringify({
        version: 1,
        activeWorkspacePages: {
          secondary: 'secondary-records'
        },
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
        }
      })
    )

    const { getActiveWorkspacePage } = await import(
      '@renderer/store/panel_view_state'
    )

    expect(
      getActiveWorkspacePage('secondary', [
        'secondary-operations',
        'secondary-records'
      ])
    ).toBe('secondary-records')
    expect(
      getActiveWorkspacePage('secondary', ['secondary-operations'])
    ).toBeUndefined()
  })

  it('persists ship and equipment filters to the scoped main key', async () => {
    const {
      saveActiveWorkspacePage,
      saveBattleHistoryViewState,
      saveDeckPortViewState,
      saveDropByMapAreaIndex,
      saveDropByMapWorldState,
      saveDropByShipId,
      saveMissionCheckViewState,
      saveResourceChartViewState,
      saveShipListViewState,
      saveSlotitemListViewState
    } = await import('@renderer/store/panel_view_state')

    saveActiveWorkspacePage('secondary', 'secondary-records')
    saveShipListViewState({
      filters: ['kubo', 'sensuikan'],
      keyword: '艦載機'
    })
    saveSlotitemListViewState({
      filterKeys: [90, 110],
      nameFilter: '零式'
    })
    saveBattleHistoryViewState({
      mapId: 61,
      limit: 100,
      startDate: '2026-07-01',
      endDate: '2026-07-26'
    })
    saveDeckPortViewState({ deckIndex: 2 })
    saveMissionCheckViewState({
      areaFilters: ['area1', 'area6'],
      showMonthly: false
    })
    saveResourceChartViewState('kit')
    saveDropByMapWorldState(6, 0)
    saveDropByMapAreaIndex(6, 4)
    saveDropByShipId(594)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(
      JSON.parse(localStorage.getItem('panelViewState:main') ?? '{}')
    ).toMatchObject({
      version: 1,
      activeWorkspacePages: {
        secondary: 'secondary-records'
      },
      shipList: {
        filters: ['kubo', 'sensuikan'],
        keyword: '艦載機'
      },
      slotitemList: {
        filterKeys: [90, 110],
        nameFilter: '零式'
      },
      battleHistory: {
        mapId: 61,
        limit: 100,
        startDate: '2026-07-01',
        endDate: '2026-07-26'
      },
      deckPort: {
        deckIndex: 2
      },
      missionCheck: {
        areaFilters: ['area1', 'area6'],
        showMonthly: false
      },
      resourceChart: {
        activeView: 'kit'
      },
      dropByMap: {
        worldIndex: 6,
        eventAreaId: 0,
        mapIndices: {
          6: 4
        }
      },
      dropByShip: {
        shipId: 594
      }
    })
  })
})

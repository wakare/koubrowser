import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@renderer/common/env-renderer', () => ({
  EnvRenderer: {
    isAssist: false
  }
}))

describe('main workspace UI state', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('restores internal tabs without restoring the classic outer tab', async () => {
    localStorage.setItem(
      'uiState:main',
      JSON.stringify({
        tabName: 'shipitems',
        battletab: { tabName: 'history' },
        shipitems: { tabName: 'slotitemlist' },
        dropbyship: { tabName: 'hojo' }
      })
    )

    const {
      AssistUIState,
      BattleTabUIState,
      DropByShipTabUIState,
      ShipItemsTabUIState
    } = await import('@renderer/store/ui_state')

    expect(AssistUIState.getTabName(AssistUIState.tabIndex.value)).toBe('deckport')
    expect(BattleTabUIState.getTabName(BattleTabUIState.tabIndex.value)).toBe('history')
    expect(ShipItemsTabUIState.getTabName(ShipItemsTabUIState.tabIndex.value)).toBe(
      'slotitemlist'
    )
    expect(DropByShipTabUIState.getTabName(DropByShipTabUIState.tabIndex.value)).toBe(
      'hojo'
    )
  })

  it('preserves defaults for malformed legacy nested state', async () => {
    localStorage.setItem(
      'uiState:main',
      JSON.stringify({
        battletab: null,
        shipitems: { tabName: 'removed-tab' },
        dropbyship: {}
      })
    )

    const {
      BattleTabUIState,
      DropByShipTabUIState,
      ShipItemsTabUIState
    } = await import('@renderer/store/ui_state')

    expect(BattleTabUIState.getTabName(BattleTabUIState.tabIndex.value)).toBe('score')
    expect(ShipItemsTabUIState.getTabName(ShipItemsTabUIState.tabIndex.value)).toBe(
      'shiplist'
    )
    expect(DropByShipTabUIState.getTabName(DropByShipTabUIState.tabIndex.value)).toBe(
      'senkan'
    )
  })

  it('saves internal tabs to the main-window storage key', async () => {
    const { BattleTabUIState } = await import('@renderer/store/ui_state')

    BattleTabUIState.saveTabName('history')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(JSON.parse(localStorage.getItem('uiState:main') ?? '{}')).toMatchObject({
      tabName: 'deckport',
      battletab: { tabName: 'history' }
    })
  })
})

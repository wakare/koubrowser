import { describe, expect, it } from 'vitest'
import {
  BASE_DECK_PORT_LOGICAL_HEIGHT,
  deckPortLogicalHeight
} from '@renderer/common/deck-port-layout'

describe('deckPortLogicalHeight', () => {
  it('keeps the established six-ship canvas height', () => {
    expect(deckPortLogicalHeight([1, 2, 3, 4, 5, 6])).toBe(BASE_DECK_PORT_LOGICAL_HEIGHT)
  })

  it('adds room for the seventh banner and status row', () => {
    expect(deckPortLogicalHeight([1, 2, 3, 4, 5, 6, 7])).toBe(413)
  })

  it('ignores empty API deck slots', () => {
    expect(deckPortLogicalHeight([1, 2, 3, 4, 5, 6, -1])).toBe(BASE_DECK_PORT_LOGICAL_HEIGHT)
  })
})

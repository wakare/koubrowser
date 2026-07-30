import { describe, expect, it } from 'vitest'

import { GameSetting } from '../setting'

describe('GameSetting assist preference', () => {
  it('keeps the requested inline preference while display restrictions disable it', () => {
    const setting = new GameSetting()

    setting.setAssistInGame(true)
    setting.setAssistRestricted(true)

    expect(setting.assistInGame).toBe(true)
    expect(setting.isAssistInGame).toBe(false)

    setting.setAssistRestricted(false)

    expect(setting.assistInGame).toBe(true)
    expect(setting.isAssistInGame).toBe(true)
  })
})

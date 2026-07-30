import { afterEach, describe, expect, it } from 'vitest'
import {
  acknowledgeTaihaProtection,
  isTaihaInputProtectionActive,
  setTaihaWarning,
  taihaProtectionState
} from '@renderer/store/taiha_protection'

afterEach(() => {
  setTaihaWarning('none')
})

describe('taiha input protection state', () => {
  it('blocks input after a taiha battle result until it is acknowledged', () => {
    setTaihaWarning('battle-result')

    expect(isTaihaInputProtectionActive()).toBe(true)
    expect(taihaProtectionState.acknowledged).toBe(false)

    acknowledgeTaihaProtection()

    expect(isTaihaInputProtectionActive()).toBe(false)
    expect(taihaProtectionState.acknowledged).toBe(true)
  })

  it('resets acknowledgement for every new battle result', () => {
    setTaihaWarning('battle-result')
    acknowledgeTaihaProtection()
    setTaihaWarning('battle-result')

    expect(isTaihaInputProtectionActive()).toBe(true)
  })

  it('does not block input for port, sortie start, or advanced warnings', () => {
    for (const warning of ['none', 'advanced'] as const) {
      setTaihaWarning(warning)
      acknowledgeTaihaProtection()

      expect(isTaihaInputProtectionActive()).toBe(false)
      expect(taihaProtectionState.acknowledged).toBe(false)
    }
  })
})

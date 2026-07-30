import { describe, expect, it } from 'vitest'
import {
  defaultOptionSetting,
  normalizeRecordingTarget
} from '@common/option'

describe('recording target option', () => {
  it('preserves whole-window recording for existing installations', () => {
    expect(defaultOptionSetting().recordingTarget).toBe('window')
  })

  it('accepts only the explicit game target', () => {
    expect(normalizeRecordingTarget('game')).toBe('game')
    expect(normalizeRecordingTarget('window')).toBe('window')
    expect(normalizeRecordingTarget('screen')).toBe('window')
    expect(normalizeRecordingTarget(undefined)).toBe('window')
  })
})

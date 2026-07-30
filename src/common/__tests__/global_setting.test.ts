import { describe, expect, it } from 'vitest'
import {
  defaultGlobalSetting,
  normalizeGlobalSetting,
  normalizeTitlebarColor,
  TitlebarColors
} from '@common/global_setting'
import { AppLocales } from '@common/localization'

describe('global setting normalization', () => {
  it('uses the standard green titlebar for new and legacy settings', () => {
    expect(defaultGlobalSetting().titlebarColor).toBe('green')
    expect(normalizeGlobalSetting({
      checkUpdateOnStartup: false,
      checkBetaUpdate: true,
      enableIntake: false
    })).toEqual({
      locale: 'ja-JP',
      checkUpdateOnStartup: false,
      checkBetaUpdate: true,
      enableIntake: false,
      titlebarColor: 'green'
    })
  })

  it('normalizes legacy, supported, and unknown locales', () => {
    expect(defaultGlobalSetting().locale).toBe('ja-JP')
    for (const locale of AppLocales) {
      expect(normalizeGlobalSetting({ locale }).locale).toBe(locale)
    }
    expect(normalizeGlobalSetting({ locale: 'en-XA' }).locale).toBe('ja-JP')
    expect(normalizeGlobalSetting({ locale: 'unknown' }).locale).toBe('ja-JP')
  })

  it('accepts every supported titlebar color', () => {
    for (const color of TitlebarColors) {
      expect(normalizeTitlebarColor(color)).toBe(color)
      expect(normalizeGlobalSetting({ titlebarColor: color }).titlebarColor).toBe(color)
    }
  })

  it('repairs invalid colors and malformed boolean values', () => {
    expect(normalizeTitlebarColor('transparent')).toBe('green')
    expect(normalizeGlobalSetting({
      checkUpdateOnStartup: 'yes',
      checkBetaUpdate: null,
      enableIntake: 1,
      titlebarColor: 'url(file:///private)'
    })).toEqual(defaultGlobalSetting())
  })
})

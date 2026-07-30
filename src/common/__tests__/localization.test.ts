import { describe, expect, it } from 'vitest'
import {
  AppLocales,
  createAppTranslator,
  formatAppDateTime,
  formatAppNumber,
  formatAppRelativeTime,
  formatLocalizedMessage,
  InternalPseudoLocale,
  JapaneseMessages,
  normalizeAppLocale,
  pseudoLocalizeTemplate,
  selectAppPluralCategory,
  type LocalizationLocale,
  translateAppMessage
} from '@common/localization'

if (false) {
  // @ts-expect-error messages with placeholders require their parameter object
  translateAppMessage('file.saved')
  // @ts-expect-error placeholder-free messages do not accept parameters
  translateAppMessage('common.retry', { params: { unused: 'value' } })
  // @ts-expect-error every named placeholder is required
  translateAppMessage('file.saved', { params: {} })

  const translate = createAppTranslator(() => 'ja-JP')
  // @ts-expect-error bound translators still require every named placeholder
  translate('capture.screenshotSaved')
  // @ts-expect-error bound translators reject unrelated parameters
  translate('common.close', { params: { unused: 'value' } })
  translate('option.network.proxy.pacProtocols', {
    // @ts-expect-error every protocol placeholder is required
    params: { supported: 'http' }
  })
}

describe('localization foundation', () => {
  it('keeps Japanese as the only user-selectable baseline locale', () => {
    expect(AppLocales).toEqual(['ja-JP'])
    expect(normalizeAppLocale('ja-JP')).toBe('ja-JP')
    expect(normalizeAppLocale(InternalPseudoLocale)).toBe('ja-JP')
    expect(normalizeAppLocale('unknown')).toBe('ja-JP')
    expect(normalizeAppLocale(null)).toBe('ja-JP')
  })

  it('formats named parameters and rejects incomplete or unexpected input', () => {
    expect(
      formatLocalizedMessage('{count} 件を {name} に保存', {
        count: 3,
        name: '履歴'
      })
    ).toBe('3 件を 履歴 に保存')
    expect(() => formatLocalizedMessage('{name}', {})).toThrow(
      'missing=name; unexpected=; invalid='
    )
    expect(() => formatLocalizedMessage('完了', { name: 'unused' })).toThrow(
      'missing=; unexpected=name; invalid='
    )
    expect(() =>
      formatLocalizedMessage('{count}', {
        count: Number.NaN
      })
    ).toThrow('missing=; unexpected=; invalid=count')
  })

  it('preserves placeholders while expanding visible pseudo-locale text', () => {
    const template = JapaneseMessages['file.saved']
    const pseudo = pseudoLocalizeTemplate(template)

    expect(pseudo).toContain('{fileName}')
    expect(pseudo).toMatch(/^［.*］$/u)
    expect(pseudo.length).toBeGreaterThan(template.length)
    expect(
      translateAppMessage('file.saved', {
        locale: InternalPseudoLocale,
        params: { fileName: 'capture.png' }
      })
    ).toContain('capture.png')
  })

  it('returns the Japanese baseline for ordinary application messages', () => {
    expect(translateAppMessage('common.retry')).toBe('再試行')
    expect(
      translateAppMessage('file.saved', {
        params: { fileName: 'capture.png' }
      })
    ).toBe('capture.png を保存しました')
  })

  it('localizes common status shells without changing game-owned names or technical details', () => {
    expect(
      translateAppMessage('status.dropShip.loadingForShip', {
        params: { shipName: '雪風改二' }
      })
    ).toBe('「雪風改二」のドロップ履歴を取得中です...')
    expect(
      translateAppMessage('status.assistPanel.phase', {
        params: { phase: 'render function' }
      })
    ).toBe('処理: render function')

    const pseudo = translateAppMessage('status.dropShip.loadingForShip', {
      locale: InternalPseudoLocale,
      params: { shipName: '雪風改二' }
    })
    expect(pseudo).toContain('雪風改二')
    expect(pseudo.match(/雪風改二/gu)).toHaveLength(1)
    expect(pseudo).toMatch(/^［.*］$/u)
  })

  it('binds a translator to the latest locale supplied by its owner', () => {
    let locale: LocalizationLocale = 'ja-JP'
    const translate = createAppTranslator(() => locale)

    expect(translate('common.close')).toBe('閉じる')
    expect(
      translate('capture.screenshotSaved', {
        params: { fileName: 'capture.png' }
      })
    ).toBe('保存しました: capture.png')
    expect(
      translate('option.network.proxy.pacProtocols', {
        params: {
          supported: 'http, https, data',
          unsupported: 'file'
        }
      })
    ).toBe(
      'サポートプロトコル: http, https, data 未サポートプロトコル: file'
    )

    locale = InternalPseudoLocale
    const pseudo = translate('common.close')
    expect(pseudo).toMatch(/^［.*］$/u)
    expect(pseudo.length).toBeGreaterThan('閉じる'.length)
  })

  it('formats locale-aware values through Intl and rejects invalid values', () => {
    expect(formatAppNumber(1234567)).toBe('1,234,567')
    expect(
      formatAppDateTime(new Date('2026-07-29T12:34:00Z'), 'ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'UTC'
      })
    ).toBe('2026/07/29')
    expect(formatAppRelativeTime(-1, 'day', 'ja-JP', { numeric: 'auto' })).toBe(
      '昨日'
    )
    expect(selectAppPluralCategory(2)).toBe('other')
    expect(() => formatAppNumber(Number.NaN)).toThrow(
      'localized number must be a finite number'
    )
    expect(() => formatAppDateTime(new Date('invalid'))).toThrow(
      'localized date must be a finite number'
    )
  })
})

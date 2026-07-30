import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  createAppTranslator,
  InternalPseudoLocale
} from '@common/localization'
import type { UpdateStateSnapshot } from '@common/type'
import { resolveUpdateViewText } from '@renderer/common/update-view'

const translate = createAppTranslator(() => 'ja-JP')

function state(
  status: UpdateStateSnapshot['status'],
  overrides: Partial<UpdateStateSnapshot> = {}
): UpdateStateSnapshot {
  return {
    status,
    availableVersion: '',
    errorMessage: '',
    downloadPercent: null,
    ...overrides
  }
}

describe('update view localization', () => {
  it('keeps Japanese UI literals out of the update state module', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'src/renderer/src/stuff/update.ts'),
      'utf8'
    )
    const sourceWithoutComments = source.replace(/\/\/.*$/gmu, '')

    expect(sourceWithoutComments).not.toMatch(/[ぁ-んァ-ヶ一-龠]/u)
  })

  it.each([
    ['idle', '更新をチェック', '', ''],
    ['checking', '更新をチェック', '更新をチェック中...', ''],
    ['latest', '更新をチェック', '最新バージョンを使用中です。', ''],
    ['updating', '更新をチェック', '更新をダウンロード中...', ''],
    [
      'ready',
      '再起動',
      '更新の準備が整いました。再起動すると更新が適用されます。',
      'または、アプリケーション終了時に更新が適用されます。'
    ],
    ['error', '更新をチェック', '更新チェックでエラーが発生しました。', '']
  ] as const)(
    'formats the %s state',
    (status, buttonText, stateText, stateSubText) => {
      expect(resolveUpdateViewText(state(status), translate, 'ja-JP')).toEqual({
        buttonText,
        stateText,
        stateSubText
      })
    }
  )

  it('formats version, progress, and error details with named parameters', () => {
    expect(
      resolveUpdateViewText(
        state('available', { availableVersion: '1.2.3' }),
        translate,
        'ja-JP'
      )
    ).toEqual({
      buttonText: '更新をダウンロード',
      stateText: '更新が見つかりました。バージョン 1.2.3 が利用可能です。',
      stateSubText: ''
    })
    expect(
      resolveUpdateViewText(
        state('updating', { downloadPercent: 42.5 }),
        translate,
        'ja-JP'
      ).stateText
    ).toBe('更新をダウンロード中... 42.5%')
    expect(
      resolveUpdateViewText(
        state('error', { errorMessage: 'ERR_NETWORK' }),
        translate,
        'ja-JP'
      ).stateText
    ).toBe('更新チェックエラー (ERR_NETWORK)')
  })

  it('preserves dynamic values in the internal pseudo locale', () => {
    const pseudoTranslate = createAppTranslator(() => InternalPseudoLocale)
    const view = resolveUpdateViewText(
      state('available', { availableVersion: '1.2.3' }),
      pseudoTranslate,
      InternalPseudoLocale
    )

    expect(view.buttonText).toMatch(/^［.*］$/u)
    expect(view.stateText).toContain('1.2.3')
    expect(view.stateText).toMatch(/^［.*］$/u)
  })
})

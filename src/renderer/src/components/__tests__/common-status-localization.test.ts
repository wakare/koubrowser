import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const statusComponents = [
  'BattleHistory.vue',
  'BattleScore.vue',
  'DropByShip.vue',
  'DropByShipArea.vue',
  'DropHistoryCell.vue',
  'Invalid.vue',
  'MissionCheck.vue',
  'ShipList.vue',
  'SlotitemList.vue',
  'Timeline.vue',
  'TitleBar.vue',
  'assist/AssistPanelHost.vue',
  'assist/AssistWorkspace.vue',
  'assist/ResourceChartPanel.vue',
  'chart/Kit.vue',
  'chart/Material.vue'
] as const

const highchartsComponents = [
  'BattleScore.vue',
  'chart/Kit.vue',
  'chart/Material.vue'
] as const

const migratedLiterals = [
  'このページに表示するパネルはありません。',
  '出撃履歴がありません。',
  '当月戦果データがありません。',
  '当月戦果データの取得に失敗しました。',
  '当月戦果データを取得中...',
  '戦果情報を読み込めませんでした。',
  '戦果情報を読み込み中...',
  '戦闘履歴を読み込めませんでした',
  '戦闘履歴検索中...',
  '表示するデータがありません。',
  '表示する資源記録がありません。',
  '表示する装備種別を選択してください',
  '表示処理でエラーが発生しました。',
  '該当するドロップ履歴が見つかりません',
  '該当する履歴が見つかりません',
  '該当する艦船が見つかりません',
  '該当する装備が見つかりません',
  '該当する遠征が見つかりません。',
  '資源記録を読み込めませんでした。',
  '資源記録を読み込み中',
  'ドロップ詳細を読み込めませんでした',
  'ドロップ詳細を読み込み中...',
  'ドロップ履歴を読み込めませんでした',
  'ドロップ履歴を取得中です...',
  '履歴を読み込めませんでした',
  '履歴を取得中です...'
] as const

describe('common status localization coverage', () => {
  it('keeps migrated status literals out of production components', () => {
    const sources = statusComponents
      .map((component) =>
        readFileSync(
          resolve(process.cwd(), 'src/renderer/src/components', component),
          'utf8'
        )
      )
      .join('\n')

    migratedLiterals.forEach((literal) => {
      expect(sources).not.toContain(literal)
    })
  })

  it('keeps Highcharts no-data labels reactive to locale changes', () => {
    highchartsComponents.forEach((component) => {
      const source = readFileSync(
        resolve(process.cwd(), 'src/renderer/src/components', component),
        'utf8'
      )
      expect(source).toContain('globalSetting.locale')
      expect(source).toContain("translateApp('common.noData')")
    })
  })
})

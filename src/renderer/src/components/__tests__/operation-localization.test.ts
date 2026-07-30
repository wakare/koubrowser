import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const operationComponents = [
  'DeckPort.vue',
  'Deck.vue',
  'ShipTooltip.vue',
  'MissionCheck.vue',
  'MissionStateDetail.vue',
  'MissionBadge.vue',
  'assist/ResourceChartPanel.vue',
  'chart/Kit.vue',
  'chart/Material.vue'
] as const

const migratedApplicationLiterals = [
  '対空CIなし',
  '固定:',
  '夜戦突撃',
  '特殊砲撃',
  '先制雷撃',
  '艦隊に制空戦装備なし',
  '次のレベルまで',
  '絞り込み条件',
  'クリア済非表示',
  '常に表示する',
  '獲得資材',
  '成功/大成功',
  '遠征中',
  '旗艦艦種:',
  'ドラム缶搭載隻数:',
  '資源記録の表示',
  '資材チャート:',
  '資源チャート:'
] as const

describe('operation panel localization coverage', () => {
  it('keeps migrated application literals out of production operation components', () => {
    const sources = operationComponents
      .map((component) =>
        readFileSync(
          resolve(process.cwd(), 'src/renderer/src/components', component),
          'utf8'
        )
      )
      .join('\n')

    migratedApplicationLiterals.forEach((literal) => {
      expect(sources).not.toContain(literal)
    })
  })

  it('keeps canonical game area names as untranslated source data', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/renderer/src/components/MissionCheck.vue'),
      'utf8'
    )

    expect(source).toContain('鎮守府海域')
    expect(source).toContain('南西諸島海域')
    expect(source).toContain('南方海域')
  })

  it('renders an explicit empty state when mission filters match no rows', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/renderer/src/components/MissionCheck.vue'),
      'utf8'
    )

    expect(source).toContain('<template #empty>')
    expect(source).toContain('{{emptyText}}')
  })

  it('updates Highcharts-owned range labels when locale changes', () => {
    ;['chart/Kit.vue', 'chart/Material.vue'].forEach((component) => {
      const source = readFileSync(
        resolve(process.cwd(), 'src/renderer/src/components', component),
        'utf8'
      )

      expect(source).toContain('globalSetting.locale')
      expect(source).toContain('rangeSelectorButtons()')
      expect(source).toContain("translateApp('operation.resource.range.day')")
    })
  })
})

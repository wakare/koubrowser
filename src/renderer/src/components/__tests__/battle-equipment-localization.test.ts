import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const componentNames = [
  'BattleTab.vue',
  'BattleScore.vue',
  'BattleHistory.vue',
  'BattleHistoryArea.vue',
  'ShipItems.vue',
  'ShipList.vue',
  'SlotitemList.vue',
  'ItemList.vue'
] as const

const readComponent = (name: (typeof componentNames)[number]): string =>
  readFileSync(
    resolve(process.cwd(), 'src/renderer/src/components', name),
    'utf8'
  )

describe('battle and equipment panel localization coverage', () => {
  it('routes every business panel with app-owned text through the runtime translator', () => {
    componentNames
      .filter((name) => name !== 'ItemList.vue')
      .forEach((name) => {
        expect(readComponent(name)).toContain('translateApp')
      })
  })

  it('removes direct application labels from tabs and visible controls', () => {
    const tabSource = readComponent('BattleTab.vue') + readComponent('ShipItems.vue')
    const historySource = readComponent('BattleHistory.vue')
    const shipSource = readComponent('ShipList.vue')
    const slotitemSource = readComponent('SlotitemList.vue')

    expect(tabSource).not.toMatch(/\blabel="(?:戦果|戦闘履歴|艦船一覧|装備一覧|アイテム一覧)"/u)
    expect(historySource).not.toContain('placeholder="開始日"')
    expect(historySource).not.toContain('>セル状況表示<')
    expect(shipSource).not.toContain('placeholder="艦名・装備を入力"')
    expect(slotitemSource).not.toContain('placeholder="装備名で絞り込み"')
    expect(slotitemSource).not.toContain('>全チェック<')
  })

  it('preserves game-owned names and values while escaping HTML tooltip content', () => {
    const scoreSource = readComponent('BattleScore.vue')
    const historySource = readComponent('BattleHistory.vue')
    const areaSource = readComponent('BattleHistoryArea.vue')
    const shipSource = readComponent('ShipList.vue')
    const slotitemSource = readComponent('SlotitemList.vue')

    expect(historySource).toContain('getAreaName')
    expect(areaSource).toContain('bs.record.enemyDeckName')
    expect(shipSource).toContain('props.row.mst.api_name')
    expect(slotitemSource).toContain('props.row.mst.api_name')
    expect(scoreSource).toContain('escapeHtmlText(questName)')
    expect(scoreSource).toContain('escapeHtmlText(name)')
    expect(slotitemSource).toContain('escapeHtmlText(stuff.displayName())')
  })

  it('rebuilds Highcharts-owned labels when locale changes', () => {
    const scoreSource = readComponent('BattleScore.vue')

    expect(scoreSource).toContain('globalSetting.locale')
    expect(scoreSource).toContain('void applyPeriod(false)')
    expect(scoreSource).toContain(
      "translateApp('battleEquipment.score.series.total')"
    )
  })
})

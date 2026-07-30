import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const componentNames = [
  'DropWorld.vue',
  'DropAreas.vue',
  'DropArea.vue',
  'DropHistoryCell.vue',
  'DropByShip.vue',
  'DropByShipArea.vue',
  'DropByShipControl.vue',
  'chart/ShipTypePie.vue',
  'chart/RankPie.vue'
] as const

const readComponent = (name: (typeof componentNames)[number]): string =>
  readFileSync(
    resolve(process.cwd(), 'src/renderer/src/components', name),
    'utf8'
  )

describe('drop panel localization coverage', () => {
  it('routes every drop component with app-owned text through the translator', () => {
    componentNames
      .filter((name) => !['DropAreas.vue', 'DropArea.vue'].includes(name))
      .forEach((name) => {
        expect(readComponent(name)).toContain('translateApp')
      })
  })

  it('removes direct application labels from visible controls and tables', () => {
    const sources = [
      'DropHistoryCell.vue',
      'DropByShip.vue',
      'DropByShipArea.vue',
      'DropByShipControl.vue'
    ]
      .map((name) => readComponent(name as (typeof componentNames)[number]))
      .join('\n')

    expect(sources).not.toContain('>レア度<')
    expect(sources).not.toContain('>ドロップ数<')
    expect(sources).not.toContain('>勝利ランク<')
    expect(sources).not.toContain("name: '戦艦級'")
    expect(sources).not.toContain("'ドロップ無し'")
  })

  it('preserves game-owned ship, event, and area names', () => {
    const worldSource = readComponent('DropWorld.vue')
    const byShipSource = readComponent('DropByShip.vue')
    const controlSource = readComponent('DropByShipControl.vue')

    expect(worldSource).toContain('鎮守府海域')
    expect(worldSource).toContain('item.periodName')
    expect(byShipSource).toContain('getAreaName')
    expect(controlSource).toContain('ship.mst.api_name')
  })

  it('updates Highcharts labels on locale changes and escapes HTML content', () => {
    ;(['chart/ShipTypePie.vue', 'chart/RankPie.vue'] as const).forEach((name) => {
      const source = readComponent(name)

      expect(source).toContain('globalSetting.locale')
      expect(source).toContain("translateApp('drop.common.ratio')")
      expect(source).toContain('escapeHtmlText(name)')
    })
  })
})

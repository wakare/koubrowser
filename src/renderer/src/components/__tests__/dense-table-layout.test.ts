import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const readSource = (relativePath: string): string =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')

const containerRule = (
  stylesheet: string,
  name: string,
  nextName: string
): string => {
  const start = stylesheet.indexOf(`@container ${name}`)
  const end = stylesheet.indexOf(`@container ${nextName}`, start)
  return stylesheet.slice(start, end)
}

describe('dense table responsive layout', () => {
  it('pins row identity columns without removing the remaining data columns', () => {
    const stylesheet = readSource('../../assets/assist.scss')
    const shipRule = containerRule(stylesheet, 'ship-list', 'slotitem-list')
    const slotitemRule = containerRule(
      stylesheet,
      'slotitem-list',
      'mission-list'
    )
    const missionRule = containerRule(
      stylesheet,
      'mission-list',
      'battle-history'
    )
    const missionComponent = readSource('../MissionCheck.vue')

    expect(shipRule).toContain('td.ship-name')
    expect(shipRule).toContain('position: sticky')
    expect(slotitemRule).toContain('td.slotitem-name')
    expect(slotitemRule).toContain('position: sticky')
    expect(missionRule).toContain('td.name')
    expect(missionRule).toContain('position: sticky')
    expect(missionComponent).toContain(
      'header-class="name" cell-class="name"'
    )
  })

  it('wraps filter controls inside their narrow panel instead of clipping them', () => {
    const stylesheet = readSource('../../assets/assist.scss')
    const battleHistory = readSource('../BattleHistory.vue')
    const shipList = readSource('../ShipList.vue')
    const missionCheck = readSource('../MissionCheck.vue')

    expect(battleHistory).toContain(
      '<b-field class="inputs" grouped group-multiline>'
    )
    expect(shipList).toContain(
      '<b-field class="inputs" grouped group-multiline position="is-centered">'
    )
    expect(missionCheck).toContain(
      '<b-field class="inputs" grouped group-multiline position="is-centered">'
    )
    expect(stylesheet).toContain(
      'grid-template-columns: minmax(0, 1fr);'
    )
    expect(stylesheet).toContain(
      '.inputs > .field-body > .field'
    )
  })

  it('folds mission filters before they can push pagination outside a compact panel', () => {
    const stylesheet = readSource('../../assets/assist.scss')
    const missionCheck = readSource('../MissionCheck.vue')

    expect(missionCheck).toContain('class="mission-filter-toggle"')
    expect(missionCheck).toContain(
      "translateApp('operation.mission.filter.back')"
    )
    expect(missionCheck).toContain(
      "translateApp('operation.mission.filter.conditions')"
    )
    expect(stylesheet).toMatch(
      /@container mission-list \(max-width: 360px\)[\s\S]*?\.mission-filter-toggle \{[\s\S]*?display: block/
    )
    expect(stylesheet).toMatch(
      /:has\(\.filter-content\.is-expanded\)[\s\S]*?\.mission-state \{[\s\S]*?display: none/
    )
  })

  it('shrinks quest cards to the compact task panel without horizontal scrolling', () => {
    const stylesheet = readSource('../../assets/assist.scss')

    expect(stylesheet).toMatch(
      /\.quest-guide \{[\s\S]*?overflow-x: hidden[\s\S]*?overflow-y: auto/
    )
    expect(stylesheet).toMatch(
      /\.quest-guide-list \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)[\s\S]*?min-width: 0/
    )
    expect(stylesheet).toMatch(
      /\.quest-guide-card \{[\s\S]*?min-width: 0/
    )
  })
})

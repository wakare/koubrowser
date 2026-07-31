import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('quest strategy route UI wiring', () => {
  const questGuide = source('src/renderer/src/components/QuestGuide.vue')
  const strategyRoute = source('src/renderer/src/components/QuestStrategyRoute.vue')

  it('connects anonymous local aggregates to the read-only route component', () => {
    expect(questGuide).toContain('import QuestStrategyRoute from')
    expect(questGuide).toContain('<QuestStrategyRoute')
    expect(questGuide).toContain(':available-map-keys="availableMapKeys"')
    expect(questGuide).toContain(':ship-type-counts="strategyShipTypeCounts"')
    expect(questGuide).toContain(':equipment-type-counts="strategyEquipmentTypeCounts"')
    expect(strategyRoute).toContain('buildQuestStrategyLocalSnapshot({')
    expect(strategyRoute).toContain('buildQuestStrategyRoutePlanV2({')
    expect(strategyRoute).toContain('questStrategyKnowledge.value.recipes')
    expect(questGuide).toContain('v-if="showStrategyRoute"')
    expect(questGuide).toContain('StrategyRouteVisibleStorageKey')
    expect(questGuide).toContain('svdata.mstShips.length === 0 || svdata.ships.length === 0')
    expect(questGuide).toContain(
      'svdata.mstSlotitems.length === 0 || svdata.slotitems.length === 0'
    )
  })

  it('uses localization for app-owned UI and opens only reviewed evidence externally', () => {
    expect(strategyRoute).toContain("translateApp('quest.strategy.title')")
    expect(strategyRoute).toContain('window.api.openExternalUrl(url)')
    expect(strategyRoute).not.toMatch(/fetch\(|XMLHttpRequest|axios|ipcRenderer/)
  })

  it('shows auditable scores, confirmation items, alternatives, and local recipe overrides', () => {
    expect(strategyRoute).toContain("translateApp('quest.strategy.score.title')")
    expect(strategyRoute).toContain("translateApp('quest.strategy.confirmations')")
    expect(strategyRoute).toContain('plan.alternatives')
    expect(strategyRoute).toContain('plan.executionSummary')
    expect(strategyRoute).toContain('HiddenRecipeStorageKey')
    expect(strategyRoute).toContain('@click="hideRecipe(step.recipeId)"')
  })

  it('shows stage-aware partial coverage and an honest fallback for uncovered tasks', () => {
    expect(strategyRoute).toContain('step.stageContributions')
    expect(strategyRoute).toContain('plan.questCoverage')
    expect(strategyRoute).toContain("translateApp('quest.strategy.fallback.title')")
    expect(strategyRoute).toContain("translateApp('quest.strategy.stageRemaining')")
  })
})

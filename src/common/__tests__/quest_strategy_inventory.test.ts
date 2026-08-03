import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildQuestStrategyInventory,
  classifyQuestStrategyInventoryEntry,
  summarizeQuestStrategyInventory,
  type QuestStrategyCadenceCatalog,
  type QuestStrategyInventoryCadence
} from '@common/quest_strategy_inventory'

interface CadenceCatalogFile {
  complete: boolean
  entries: {
    questId: number
    cadence: QuestStrategyInventoryCadence
    sourceCode: string
  }[]
}

function loadCadenceCatalog(): QuestStrategyCadenceCatalog {
  const file = JSON.parse(
    fs.readFileSync(
      path.resolve(process.cwd(), 'knowledge', 'quest-strategy', 'cadence-catalog.json'),
      'utf8'
    )
  ) as CadenceCatalogFile
  return {
    complete: file.complete,
    entries: new Map(file.entries.map((entry) => [entry.questId, entry.cadence]))
  }
}

describe('quest strategy coverage inventory', () => {
  it('does not treat an inferred cadence as non-recurring without a complete catalog', () => {
    const entry = classifyQuestStrategyInventoryEntry(229)

    expect(entry.classification).toBe('missing-cadence-fact')
    expect(entry.denominatorEligible).toBe(false)
    expect(entry.reasonCodes).toEqual(['INSUFFICIENT_CADENCE_FACT'])
  })

  it('distinguishes alternative maps from required multi-stage objectives', () => {
    const catalog = loadCadenceCatalog()
    const weeklyAlternative = classifyQuestStrategyInventoryEntry(229, catalog)
    const quarterlyStages = classifyQuestStrategyInventoryEntry(845, catalog)

    expect(weeklyAlternative.classification).toBe('lossless-v1')
    expect(weeklyAlternative.objectiveStages).toHaveLength(1)
    expect(weeklyAlternative.objectiveStages[0]).toMatchObject({
      requiredCount: 12,
      targets: [
        { mapKey: '4-1', result: 'victory' },
        { mapKey: '4-2', result: 'victory' },
        { mapKey: '4-3', result: 'victory' },
        { mapKey: '4-4', result: 'victory' },
        { mapKey: '4-5', result: 'victory' }
      ]
    })
    expect(quarterlyStages.classification).toBe('multi-stage')
    expect(quarterlyStages.objectiveStages.map((stage) => stage.targets[0].mapKey)).toEqual([
      '4-1',
      '4-2',
      '4-3',
      '4-4',
      '4-5'
    ])
  })

  it('freezes the reviewed recurring normal-sortie denominator and v1 gate result', () => {
    const catalog = loadCadenceCatalog()
    const entries = buildQuestStrategyInventory(catalog)
    const summary = summarizeQuestStrategyInventory(entries, catalog.complete)

    expect(summary.cadenceCatalogComplete).toBe(true)
    expect(summary.cadenceUnknownCount).toBe(0)
    expect(summary.primaryDenominatorCount).toBe(27)
    expect(summary.losslessV1Count).toBe(12)
    expect(summary.unsupportedV1MultiStageCount).toBe(10)
    expect(summary.v1LosslessCoverageBasisPoints).toBe(4444)
    expect(summary.unsupportedV1MultiStageBasisPoints).toBe(3703)
  })

  it('records the adopted stage-aware runtime without erasing the v1 trigger evidence', () => {
    const report = JSON.parse(
      fs.readFileSync(
        path.resolve(
          process.cwd(),
          'knowledge',
          'quest-strategy',
          'generated',
          'v1-lossless-report.json'
        ),
        'utf8'
      )
    ) as { runtimeV2Decision: string; runtimeV2Reasons: string[] }

    expect(report.runtimeV2Decision).toBe('RUNTIME_V2_ADOPTED')
    expect(report.runtimeV2Reasons).toEqual([
      'LOSSLESS_COVERAGE_BELOW_THRESHOLD',
      'UNSUPPORTED_MULTI_STAGE_ABOVE_THRESHOLD'
    ])
  })

  it('keeps cadence entries unique and free of task titles', () => {
    const raw = fs.readFileSync(
      path.resolve(process.cwd(), 'knowledge', 'quest-strategy', 'cadence-catalog.json'),
      'utf8'
    )
    const file = JSON.parse(raw) as CadenceCatalogFile

    expect(file.entries).toHaveLength(39)
    expect(new Set(file.entries.map((entry) => entry.questId)).size).toBe(file.entries.length)
    expect(new Set(file.entries.map((entry) => entry.sourceCode)).size).toBe(file.entries.length)
    for (const entry of file.entries) {
      expect(entry).not.toHaveProperty('title')
    }
  })
})

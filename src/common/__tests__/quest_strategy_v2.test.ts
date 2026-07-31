import { describe, expect, it } from 'vitest'
import { BundledQuestStrategyKnowledge } from '@common/quest_strategy_knowledge'
import {
  auditQuestStrategyRecipeObjective,
  buildQuestStrategyRoutePlanV2,
  questStrategyCoverageStatus
} from '@common/quest_strategy_v2'

const GeneratedAt = '2026-07-31T00:00:00.000Z'

function build(selectedQuestIds: number[], conflictedQuestIds: number[] = []) {
  return buildQuestStrategyRoutePlanV2({
    knowledgeVersion: BundledQuestStrategyKnowledge.version,
    generatedAt: GeneratedAt,
    recipes: BundledQuestStrategyKnowledge.recipes,
    snapshot: {
      schemaVersion: 1,
      capturedAt: GeneratedAt,
      selectedQuestIds,
      quests: selectedQuestIds.map((questId) => ({
        questId,
        state: 'active',
        deadlineUrgency: 'normal',
        readiness: 'ready',
        prerequisiteState: 'ready'
      })),
      mapAvailability: {
        '1-4': 'available',
        '1-5': 'available',
        '4-2': 'available'
      },
      questCapacity: {
        active: selectedQuestIds.length,
        maximum: 10
      }
    },
    preferences: {
      preset: 'balanced',
      maximumRoutes: 5
    },
    conflictedQuestIds
  })
}

describe('quest strategy runtime v2 stage coverage', () => {
  it('accepts an alternative-map objective as complete on one matching map', () => {
    const recipe = BundledQuestStrategyKnowledge.recipes.find(
      (item) => item.id === 'normal-4-2-western-periodic'
    )!
    const audit = auditQuestStrategyRecipeObjective(recipe, 229)

    expect(audit.complete).toBe(true)
    expect(audit.contributions.map((item) => item.stageIndex)).toEqual([0])
    expect(audit.coverageStatus).toBe('route-ready')
  })

  it('keeps a single-map fragment of a multi-stage quest partial', () => {
    const recipe = BundledQuestStrategyKnowledge.recipes.find(
      (item) => item.id === 'normal-4-2-western-periodic'
    )!
    const audit = auditQuestStrategyRecipeObjective(recipe, 845)

    expect(audit.complete).toBe(false)
    expect(audit.requiredStageCount).toBe(5)
    expect(audit.contributions.map((item) => item.stageIndex)).toEqual([1])
    expect(audit.coverageStatus).toBe('unsupported-v1-multi-stage')
  })

  it('does not promote an opaque fleet constraint to complete coverage', () => {
    expect(questStrategyCoverageStatus(257, BundledQuestStrategyKnowledge.recipes)).toBe(
      'route-unreviewed'
    )
  })

  it('reports complete, partial and remaining stages separately in a plan', () => {
    const plan = build([229, 264, 845])
    const quarterly = plan.questCoverage.find((coverage) => coverage.questId === 845)!

    expect(plan.schemaVersion).toBe(2)
    expect(plan.coveredQuestIds).toEqual([229, 264])
    expect(plan.partialQuestIds).toEqual([845])
    expect(plan.uncoveredQuestIds).toEqual([845])
    expect(quarterly.contributedStageIndexes).toEqual([1])
    expect(quarterly.remainingStageIndexes).toEqual([0, 2, 3, 4])
    expect(plan.steps[0].partialQuestIds).toEqual([845])
  })

  it('returns a knowledge-insufficient fallback instead of an empty candidate result', () => {
    const plan = build([999])

    expect(plan.steps).toEqual([])
    expect(plan.coveredQuestIds).toEqual([])
    expect(plan.questCoverage).toMatchObject([
      {
        questId: 999,
        coverageStatus: 'knowledge-insufficient',
        complete: false,
        partial: false
      }
    ])
  })

  it('downgrades a route contribution when the selected quest has a hard conflict', () => {
    const plan = build([229], [229])

    expect(plan.coveredQuestIds).toEqual([])
    expect(plan.partialQuestIds).toEqual([229])
    expect(plan.questCoverage[0]).toMatchObject({
      coverageStatus: 'conflicted',
      complete: false,
      partial: true,
      contributedStageIndexes: []
    })
  })
})

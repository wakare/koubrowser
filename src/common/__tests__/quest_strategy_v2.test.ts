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
        '2-1': 'available',
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
    expect(
      questStrategyCoverageStatus(257, BundledQuestStrategyKnowledge.recipes, GeneratedAt)
    ).toBe('route-unreviewed')
  })

  it('keeps draft, expired and withdrawn knowledge out of route-ready capability', () => {
    const approved = BundledQuestStrategyKnowledge.recipes.find(
      (item) => item.id === 'normal-4-2-western-periodic'
    )!

    expect(questStrategyCoverageStatus(229, [{ ...approved, status: 'draft' }], GeneratedAt)).toBe(
      'route-unreviewed'
    )
    expect(
      questStrategyCoverageStatus(229, [{ ...approved, status: 'withdrawn' }], GeneratedAt)
    ).toBe('withdrawn')
    expect(
      questStrategyCoverageStatus(
        229,
        [{ ...approved, validity: { ...approved.validity, endsAt: GeneratedAt } }],
        GeneratedAt
      )
    ).toBe('route-unreviewed')
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

  it('completes the daily 2-X objective while retaining exact 2-1 stage progress', () => {
    const plan = build([226, 280, 284, 894])
    const coverage = new Map(plan.questCoverage.map((item) => [item.questId, item]))

    expect(plan.steps.map((step) => step.recipeId)).toEqual(['normal-2-1-southwest-periodic'])
    expect(plan.coveredQuestIds).toEqual([226])
    expect(plan.partialQuestIds).toEqual([280, 284, 894])
    expect(coverage.get(226)).toMatchObject({
      complete: true,
      contributedStageIndexes: [0],
      remainingStageIndexes: []
    })
    expect(coverage.get(280)).toMatchObject({
      complete: false,
      contributedStageIndexes: [3],
      remainingStageIndexes: [0, 1, 2]
    })
    expect(coverage.get(284)).toMatchObject({
      complete: false,
      contributedStageIndexes: [1],
      remainingStageIndexes: [0, 2, 3]
    })
    expect(coverage.get(894)).toMatchObject({
      complete: false,
      contributedStageIndexes: [2],
      remainingStageIndexes: [0, 1, 3, 4]
    })
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

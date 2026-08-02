import { describe, expect, it } from 'vitest'
import { ApiShipType } from '@common/kcs'
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
        '1-2': 'available',
        '1-3': 'available',
        '1-4': 'available',
        '1-5': 'available',
        '1-6': 'available',
        '2-1': 'available',
        '2-2': 'available',
        '2-3': 'available',
        '2-4': 'available',
        '2-5': 'available',
        '3-1': 'available',
        '3-2': 'available',
        '3-3': 'available',
        '4-1': 'available',
        '4-2': 'available',
        '4-3': 'available',
        '4-4': 'available',
        '4-5': 'available',
        '5-2': 'available',
        '5-5': 'available',
        '6-1': 'available',
        '6-2': 'available',
        '6-3': 'available',
        '6-4': 'available',
        '6-5': 'available',
        '7-1': 'available',
        '7-2': 'available'
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

  it('promotes the reviewed 1-4 fleet constraint only when every canonical rule is represented', () => {
    const recipe = BundledQuestStrategyKnowledge.recipes.find(
      (item) => item.id === 'normal-1-4-light-fleet-periodic'
    )!

    expect(
      questStrategyCoverageStatus(257, BundledQuestStrategyKnowledge.recipes, GeneratedAt)
    ).toBe('route-ready')
    expect(
      auditQuestStrategyRecipeObjective(
        { ...recipe, fleet: { ...recipe.fleet, flagshipTypeIds: undefined } },
        257
      ).coverageStatus
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

  it('assembles all five western stages into one complete quarterly plan', () => {
    const plan = build([229, 264, 845])
    const quarterly = plan.questCoverage.find((coverage) => coverage.questId === 845)!

    expect(plan.schemaVersion).toBe(2)
    expect(plan.coveredQuestIds).toEqual([229, 264, 845])
    expect(plan.partialQuestIds).toEqual([])
    expect(plan.uncoveredQuestIds).toEqual([])
    expect(quarterly.contributedStageIndexes).toEqual([0, 1, 2, 3, 4])
    expect(quarterly.remainingStageIndexes).toEqual([])
    expect(plan.steps.map((step) => step.mapKey).sort()).toEqual([
      '4-1',
      '4-2',
      '4-3',
      '4-4',
      '4-5'
    ])
    expect(plan.steps.every((step) => !step.partialQuestIds.includes(845))).toBe(true)
  })

  it('assembles the northern, western and coral weeklies into one ordered plan', () => {
    const plan = build([241, 242, 243])

    expect(plan.coveredQuestIds).toEqual([241, 242, 243])
    expect(plan.partialQuestIds).toEqual([])
    expect(plan.uncoveredQuestIds).toEqual([])
    expect(plan.steps.map((step) => step.recipeId)).toEqual([
      'normal-3-3-northern-weekly',
      'normal-4-4-western-quarterly',
      'normal-5-2-coral-weekly'
    ])
  })

  it('uses the reviewed fixed 2-4 route to complete the quarterly encounter', () => {
    const plan = build([822])

    expect(plan.coveredQuestIds).toEqual([822])
    expect(plan.partialQuestIds).toEqual([])
    expect(plan.uncoveredQuestIds).toEqual([])
    expect(plan.steps.map((step) => step.recipeId)).toEqual(['normal-2-4-okinoshima-periodic'])
  })

  it('requires every machine-readable fleet rule for the monthly 2-5 counterattack', () => {
    const recipe = BundledQuestStrategyKnowledge.recipes.find(
      (item) => item.id === 'normal-2-5-surface-counterattack-monthly'
    )!

    expect(auditQuestStrategyRecipeObjective(recipe, 266)).toMatchObject({
      complete: true,
      coverageStatus: 'route-ready',
      contributions: [{ stageIndex: 0, mapKey: '2-5', machineConstraintComplete: true }]
    })
    expect(
      auditQuestStrategyRecipeObjective(
        { ...recipe, fleet: { ...recipe.fleet, flagshipTypeIds: undefined } },
        266
      ).coverageStatus
    ).toBe('route-unreviewed')
    expect(
      auditQuestStrategyRecipeObjective(
        {
          ...recipe,
          fleet: {
            ...recipe.fleet,
            shipTypeConstraints: recipe.fleet.shipTypeConstraints.map((constraint) =>
              constraint.shipTypeIds.includes(ApiShipType.jyuujyun)
                ? { ...constraint, shipTypeIds: [ApiShipType.koujyun] }
                : constraint
            )
          }
        },
        266
      ).coverageStatus
    ).toBe('route-unreviewed')

    const plan = build([266])
    expect(plan.coveredQuestIds).toEqual([266])
    expect(plan.partialQuestIds).toEqual([])
    expect(plan.uncoveredQuestIds).toEqual([])
    expect(plan.steps.map((step) => step.recipeId)).toEqual([
      'normal-2-5-surface-counterattack-monthly'
    ])
  })

  it('requires the exact named-ship set for the monthly Fifth Squadron route', () => {
    const recipe = BundledQuestStrategyKnowledge.recipes.find(
      (item) => item.id === 'normal-2-5-fifth-squadron-monthly'
    )!

    expect(auditQuestStrategyRecipeObjective(recipe, 249)).toMatchObject({
      complete: true,
      coverageStatus: 'route-ready',
      contributions: [{ stageIndex: 0, mapKey: '2-5', machineConstraintComplete: true }]
    })
    expect(
      auditQuestStrategyRecipeObjective(
        { ...recipe, fleet: { ...recipe.fleet, specificShipConstraints: undefined } },
        249
      ).coverageStatus
    ).toBe('route-unreviewed')
    expect(
      auditQuestStrategyRecipeObjective(
        {
          ...recipe,
          fleet: {
            ...recipe.fleet,
            specificShipConstraints: [
              {
                baseShipIds: [62, 63],
                minimum: 2,
                maximum: 2,
                label: '不完全な第五戦隊'
              }
            ]
          }
        },
        249
      ).coverageStatus
    ).toBe('route-unreviewed')

    const plan = build([249])
    expect(plan.coveredQuestIds).toEqual([249])
    expect(plan.steps.map((step) => step.recipeId)).toEqual([
      'normal-2-5-fifth-squadron-monthly'
    ])
  })

  it('requires three reviewed battleships from the designated classes for quest 259', () => {
    const recipe = BundledQuestStrategyKnowledge.recipes.find(
      (item) => item.id === 'normal-5-1-surface-striking-monthly'
    )!

    expect(recipe.fleet.specificShipConstraints).toEqual([
      {
        baseShipIds: [131, 143, 80, 81, 77, 87, 26, 27],
        minimum: 3,
        maximum: 3,
        label: '大和型・長門型・伊勢型・扶桑型から 3 隻（改装段階は問わない）'
      }
    ])
    expect(auditQuestStrategyRecipeObjective(recipe, 259)).toMatchObject({
      complete: true,
      coverageStatus: 'route-ready',
      contributions: [{ stageIndex: 0, mapKey: '5-1', machineConstraintComplete: true }]
    })
    expect(
      auditQuestStrategyRecipeObjective(
        { ...recipe, fleet: { ...recipe.fleet, specificShipConstraints: undefined } },
        259
      ).coverageStatus
    ).toBe('route-unreviewed')

    const plan = build([259])
    expect(plan.coveredQuestIds).toEqual([259])
    expect(plan.steps.map((step) => step.recipeId)).toEqual([
      'normal-5-1-surface-striking-monthly'
    ])
  })

  it('requires both reviewed named-ship groups for the 31st Destroyer route', () => {
    const recipe = BundledQuestStrategyKnowledge.recipes.find(
      (item) => item.id === 'normal-5-4-31st-destroyer-quarterly'
    )!

    expect(recipe.fleet.specificShipConstraints).toMatchObject([
      { baseShipIds: [543], minimum: 1 },
      { baseShipIds: [345, 359, 344], minimum: 1 }
    ])
    expect(auditQuestStrategyRecipeObjective(recipe, 875)).toMatchObject({
      complete: true,
      coverageStatus: 'route-ready',
      contributions: [{ stageIndex: 0, mapKey: '5-4', machineConstraintComplete: true }]
    })
    expect(
      auditQuestStrategyRecipeObjective(
        {
          ...recipe,
          fleet: {
            ...recipe.fleet,
            specificShipConstraints: recipe.fleet.specificShipConstraints?.slice(0, 1)
          }
        },
        875
      ).coverageStatus
    ).toBe('route-unreviewed')

    const plan = build([875])
    expect(plan.coveredQuestIds).toEqual([875])
    expect(plan.steps.map((step) => step.recipeId)).toEqual([
      'normal-5-4-31st-destroyer-quarterly'
    ])
  })

  it('uses the reviewed 1-6 transport route to complete the quarterly arrival task', () => {
    const plan = build([861])

    expect(plan.coveredQuestIds).toEqual([861])
    expect(plan.partialQuestIds).toEqual([])
    expect(plan.uncoveredQuestIds).toEqual([])
    expect(plan.steps.map((step) => step.recipeId)).toEqual(['normal-1-6-transport-quarterly'])
  })

  it('uses the reviewed 6-3 route to complete the quarterly aerial reconnaissance task', () => {
    const plan = build([862])

    expect(plan.coveredQuestIds).toEqual([862])
    expect(plan.partialQuestIds).toEqual([])
    expect(plan.uncoveredQuestIds).toEqual([])
    expect(plan.steps.map((step) => step.recipeId)).toEqual(['normal-6-3-aerial-recon-quarterly'])
  })

  it('uses the reviewed 6-1 route to complete the monthly submarine task', () => {
    const plan = build([256])

    expect(plan.coveredQuestIds).toEqual([256])
    expect(plan.partialQuestIds).toEqual([])
    expect(plan.uncoveredQuestIds).toEqual([])
    expect(plan.steps.map((step) => step.recipeId)).toEqual(['normal-6-1-submarine-monthly'])
  })

  it('assembles all four Z operation front-stage maps into one complete quarterly plan', () => {
    const plan = build([854])
    const quarterly = plan.questCoverage.find((coverage) => coverage.questId === 854)!

    expect(plan.coveredQuestIds).toEqual([854])
    expect(plan.partialQuestIds).toEqual([])
    expect(plan.uncoveredQuestIds).toEqual([])
    expect(quarterly.contributedStageIndexes).toEqual([0, 1, 2, 3])
    expect(quarterly.remainingStageIndexes).toEqual([])
    expect(plan.steps.map((step) => step.mapKey).sort()).toEqual(['2-4', '6-1', '6-3', '6-4'])
  })

  it('assembles all four Z operation later-stage maps into one complete quarterly plan', () => {
    const plan = build([872])
    const quarterly = plan.questCoverage.find((coverage) => coverage.questId === 872)!

    expect(plan.coveredQuestIds).toEqual([872])
    expect(plan.partialQuestIds).toEqual([])
    expect(plan.uncoveredQuestIds).toEqual([])
    expect(quarterly.contributedStageIndexes).toEqual([0, 1, 2, 3])
    expect(quarterly.remainingStageIndexes).toEqual([])
    expect(plan.steps.map((step) => step.mapKey).sort()).toEqual(['5-5', '6-2', '6-5', '7-2'])
    expect(plan.steps.find((step) => step.mapKey === '7-2')?.targetNodes).toEqual(['M'])
  })

  it('assembles all three northern patrol stages and shares 3-3 with the weekly', () => {
    const plan = build([241, 873])
    const quarterly = plan.questCoverage.find((coverage) => coverage.questId === 873)!

    expect(plan.coveredQuestIds).toEqual([241, 873])
    expect(plan.partialQuestIds).toEqual([])
    expect(plan.uncoveredQuestIds).toEqual([])
    expect(quarterly.contributedStageIndexes).toEqual([0, 1, 2])
    expect(quarterly.remainingStageIndexes).toEqual([])
    expect(plan.steps.map((step) => step.recipeId)).toEqual([
      'normal-3-3-northern-weekly',
      'normal-3-1-northern-quarterly',
      'normal-3-2-northern-quarterly'
    ])
    expect(plan.steps[0].coveredQuestIds).toEqual([241, 873])
  })

  it('binds the two 7-2 targets to distinct cells and completes task 893', () => {
    const firstGauge = BundledQuestStrategyKnowledge.recipes.find(
      (item) => item.id === 'normal-7-2-g-anchorage-quarterly'
    )!
    const secondGauge = BundledQuestStrategyKnowledge.recipes.find(
      (item) => item.id === 'normal-7-2-m-anchorage-quarterly'
    )!

    expect(auditQuestStrategyRecipeObjective(firstGauge, 893).contributions).toMatchObject([
      { stageIndex: 2, mapKey: '7-2' }
    ])
    expect(auditQuestStrategyRecipeObjective(secondGauge, 893).contributions).toMatchObject([
      { stageIndex: 3, mapKey: '7-2' }
    ])

    const plan = build([893])
    expect(plan.coveredQuestIds).toEqual([893])
    expect(plan.partialQuestIds).toEqual([])
    expect(plan.steps.map((step) => [step.mapKey, step.targetNodes[0]])).toEqual([
      ['1-5', 'J'],
      ['7-1', 'K'],
      ['7-2', 'G'],
      ['7-2', 'M']
    ])
    expect(plan.questCoverage[0]).toMatchObject({
      complete: true,
      contributedStageIndexes: [0, 1, 2, 3],
      remainingStageIndexes: []
    })
  })

  it('uses five shared stages to complete the widest task set without hiding the 1-2 remainder', () => {
    const plan = build([226, 280, 284, 894])
    const coverage = new Map(plan.questCoverage.map((item) => [item.questId, item]))

    expect(plan.steps.map((step) => step.recipeId)).toEqual([
      'normal-2-1-southwest-periodic',
      'normal-1-4-carrier-periodic',
      'normal-1-3-carrier-logistics-periodic',
      'normal-2-2-carrier-southwest-periodic',
      'normal-2-3-carrier-southwest-periodic'
    ])
    expect(plan.coveredQuestIds).toEqual([226, 284, 894])
    expect(plan.partialQuestIds).toEqual([280])
    expect(coverage.get(226)).toMatchObject({
      complete: true,
      contributedStageIndexes: [0],
      remainingStageIndexes: []
    })
    expect(coverage.get(280)).toMatchObject({
      complete: false,
      contributedStageIndexes: [1, 2, 3],
      remainingStageIndexes: [0]
    })
    expect(coverage.get(284)).toMatchObject({
      complete: true,
      contributedStageIndexes: [0, 1, 2, 3],
      remainingStageIndexes: []
    })
    expect(coverage.get(894)).toMatchObject({
      complete: true,
      contributedStageIndexes: [0, 1, 2, 3, 4],
      remainingStageIndexes: []
    })
  })

  it('builds the complete four-map route for task 280', () => {
    const plan = build([280])

    expect(plan.steps.map((step) => step.mapKey)).toEqual(['1-2', '1-3', '1-4', '2-1'])
    expect(plan.coveredQuestIds).toEqual([280])
    expect(plan.questCoverage[0]).toMatchObject({
      complete: true,
      contributedStageIndexes: [0, 1, 2, 3],
      remainingStageIndexes: []
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

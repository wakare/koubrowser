import { describe, expect, it } from 'vitest'
import {
  buildQuestStrategyRoutePlan,
  normalizeQuestStrategyRecipes,
  normalizeStrategyLocalSnapshot,
  QuestStrategyValidationError,
  type QuestStrategyRecipe,
  type StrategyLocalSnapshot,
  type StrategyQuestSnapshot
} from '@common/quest_strategy'
import { BundledQuestStrategyKnowledge } from '@common/quest_strategy_knowledge'

const GeneratedAt = '2026-07-31T00:00:00.000Z'

function quest(
  questId: number,
  overrides: Partial<StrategyQuestSnapshot> = {}
): StrategyQuestSnapshot {
  return {
    questId,
    state: 'active',
    deadlineUrgency: 'normal',
    readiness: 'ready',
    prerequisiteState: 'ready',
    ...overrides
  }
}

function recipe(
  id: string,
  questIds: number[] = [101],
  overrides: Partial<QuestStrategyRecipe> = {}
): QuestStrategyRecipe {
  return {
    schemaVersion: 1,
    id,
    revision: 1,
    title: `攻略 ${id}`,
    status: 'approved',
    questIds,
    mapKey: '1-1',
    routeLabels: ['A', 'B'],
    targetNodes: ['B'],
    fleet: {
      minimumShips: 1,
      maximumShips: 6,
      shipTypeConstraints: []
    },
    equipmentTypeConstraints: [],
    formations: [{ formationId: 1, label: '単縦陣' }],
    actions: ['対象地点へ出撃する'],
    cost: 'low',
    risk: 'low',
    evidence: [
      {
        sourceId: 'fixture',
        sourceLabel: 'テスト用審査資料',
        url: 'https://example.com/strategy',
        reviewedAt: '2026-07-01T00:00:00.000Z',
        validUntil: '2027-07-01T00:00:00.000Z',
        confidence: 'verified',
        summary: 'テスト用の合成根拠'
      }
    ],
    validity: {
      reviewBy: '2027-01-01T00:00:00.000Z'
    },
    ...overrides
  }
}

function snapshot(
  selectedQuestIds: number[] = [101],
  overrides: Partial<StrategyLocalSnapshot> = {}
): StrategyLocalSnapshot {
  return {
    schemaVersion: 1,
    capturedAt: GeneratedAt,
    selectedQuestIds,
    quests: selectedQuestIds.map((questId) => quest(questId)),
    mapAvailability: { '1-1': 'available' },
    shipTypeCounts: {},
    equipmentTypeCounts: {},
    questCapacity: {
      active: selectedQuestIds.length,
      maximum: 5
    },
    ...overrides
  }
}

function build(
  recipes: readonly QuestStrategyRecipe[],
  localSnapshot: StrategyLocalSnapshot,
  preset: 'balanced' | 'deadline' | 'resource-saving' | 'risk-averse' = 'balanced'
) {
  return buildQuestStrategyRoutePlan({
    knowledgeVersion: 'fixture-1',
    generatedAt: GeneratedAt,
    recipes,
    snapshot: localSnapshot,
    preferences: {
      preset,
      maximumRoutes: 5
    }
  })
}

describe('quest strategy validation', () => {
  it('keeps the production bundle empty until sources are reviewed', () => {
    expect(BundledQuestStrategyKnowledge).toEqual({
      schemaVersion: 1,
      version: '2026-07-31.0',
      recipes: []
    })
  })

  it('normalizes reviewed recipes and rejects unknown fields', () => {
    const normalized = normalizeQuestStrategyRecipes([recipe('normal')])
    expect(normalized[0].id).toBe('normal')

    const unsafe = {
      ...recipe('unsafe'),
      successRate: 0.99
    }
    expect(() => normalizeQuestStrategyRecipes([unsafe])).toThrow(
      new QuestStrategyValidationError('recipes[0].successRate', 'unknown field')
    )
  })

  it('requires bounded validity for event-only knowledge', () => {
    const eventRecipe = recipe('event', [101], {
      validity: {
        eventOnly: true,
        startsAt: '2026-07-01T00:00:00.000Z'
      }
    })
    expect(() => normalizeQuestStrategyRecipes([eventRecipe])).toThrow(
      'event-only knowledge requires startsAt and endsAt'
    )
  })

  it('rejects identifying or undeclared fields from local snapshots', () => {
    const localSnapshot = {
      ...snapshot(),
      admiralName: 'private'
    }
    expect(() => normalizeStrategyLocalSnapshot(localSnapshot)).toThrow(
      new QuestStrategyValidationError('snapshot.admiralName', 'unknown field')
    )
  })
})

describe('buildQuestStrategyRoutePlan', () => {
  it('selects a co-completion route and is deterministic across recipe order', () => {
    const combined = recipe('combined', [101, 102])
    const single = recipe('single', [101])
    const localSnapshot = snapshot([101, 102])

    const first = build([single, combined], localSnapshot)
    const second = build([combined, single], localSnapshot)

    expect(first.steps.map((step) => step.recipeId)).toEqual(['combined'])
    expect(first.coveredQuestIds).toEqual([101, 102])
    expect(first.uncoveredQuestIds).toEqual([])
    expect(first.inputFingerprint).toBe(second.inputFingerprint)
    expect(first.steps).toEqual(second.steps)
  })

  it('keeps missing local facts unknown instead of treating them as false', () => {
    const uncertain = recipe('uncertain', [101], {
      fleet: {
        minimumShips: 2,
        maximumShips: 6,
        shipTypeConstraints: [
          {
            shipTypeIds: [2],
            minimum: 1,
            label: '駆逐艦 1 隻以上'
          }
        ]
      },
      equipmentTypeConstraints: [
        {
          equipmentTypeIds: [1],
          minimum: 1,
          label: '主砲 1 個以上'
        }
      ]
    })
    const localSnapshot = snapshot([101], {
      mapAvailability: {},
      shipTypeCounts: undefined,
      equipmentTypeCounts: undefined,
      questCapacity: undefined,
      quests: [quest(101, { prerequisiteState: 'unknown' })]
    })

    const plan = build([uncertain], localSnapshot)

    expect(plan.steps).toHaveLength(1)
    expect(
      plan.steps[0].checks.filter((check) => check.state === 'unknown').map((check) => check.code)
    ).toEqual([
      'prerequisite-ready',
      'map-available',
      'fleet-ready',
      'equipment-ready',
      'quest-slot-capacity'
    ])
    expect(plan.blocked).toEqual([])
    expect(plan.steps[0].score.unknownInputPenalty).toBe(-40)
  })

  it('excludes expired knowledge even when it would otherwise score highest', () => {
    const expired = recipe('expired', [101, 102], {
      validity: {
        eventOnly: true,
        startsAt: '2026-06-01T00:00:00.000Z',
        endsAt: '2026-07-01T00:00:00.000Z'
      }
    })
    const current = recipe('current', [101])

    const plan = build([expired, current], snapshot([101, 102]))

    expect(plan.steps.map((step) => step.recipeId)).toEqual(['current'])
    expect(plan.blocked).toContainEqual({
      recipeId: 'expired',
      title: '攻略 expired',
      reasons: ['攻略知識の有効期間が終了しています']
    })
    expect(plan.uncoveredQuestIds).toEqual([102])
  })

  it('blocks routes with unavailable maps, insufficient inventory, or no quest slots', () => {
    const constrained = recipe('constrained', [101], {
      fleet: {
        minimumShips: 2,
        maximumShips: 6,
        shipTypeConstraints: [
          {
            shipTypeIds: [2],
            minimum: 2,
            label: '駆逐艦 2 隻以上'
          }
        ]
      },
      equipmentTypeConstraints: [
        {
          equipmentTypeIds: [1],
          minimum: 2,
          label: '主砲 2 個以上'
        }
      ]
    })
    const localSnapshot = snapshot([101], {
      quests: [quest(101, { state: 'available' })],
      mapAvailability: { '1-1': 'unavailable' },
      shipTypeCounts: { '2': 1 },
      equipmentTypeCounts: { '1': 1 },
      questCapacity: { active: 5, maximum: 5 }
    })

    const plan = build([constrained], localSnapshot)

    expect(plan.steps).toEqual([])
    expect(plan.blocked[0].reasons).toEqual([
      '海域 1-1 は未開放です',
      '艦種条件「駆逐艦 2 隻以上」を満たせません',
      '装備条件「主砲 2 個以上」を満たせません',
      '必要な任務枠 1 件に対して空きは 0 件です'
    ])
  })

  it('keeps any-prerequisite branches as separate alternatives', () => {
    const optionA = recipe('option-a', [101], {
      prerequisiteAlternative: {
        groupId: 'unlock-101',
        optionId: 'a',
        requiredQuestIds: [11]
      }
    })
    const optionB = recipe('option-b', [101], {
      prerequisiteAlternative: {
        groupId: 'unlock-101',
        optionId: 'b',
        requiredQuestIds: [12]
      }
    })

    const plan = build([optionB, optionA], snapshot())

    expect(plan.steps.map((step) => step.recipeId)).toEqual(['option-a'])
    expect(plan.alternatives.map((step) => step.recipeId)).toEqual(['option-b'])
    expect(plan.steps[0].prerequisiteAlternative?.optionId).toBe('a')
    expect(plan.alternatives[0].prerequisiteAlternative?.optionId).toBe('b')
  })

  it('applies resource and risk presets without changing tie-break rules', () => {
    const resourceHeavy = recipe('safe', [101], {
      cost: 'high',
      risk: 'low'
    })
    const risky = recipe('cheap', [101], {
      cost: 'low',
      risk: 'high'
    })

    expect(build([resourceHeavy, risky], snapshot(), 'resource-saving').steps[0].recipeId).toBe(
      'cheap'
    )
    expect(build([resourceHeavy, risky], snapshot(), 'risk-averse').steps[0].recipeId).toBe('safe')
  })

  it('penalizes stale reviewed knowledge while retaining its audit warning', () => {
    const stale = recipe('stale', [101], {
      validity: {
        reviewBy: '2026-07-01T00:00:00.000Z'
      }
    })

    const plan = build([stale], snapshot())

    expect(plan.steps[0].score.staleEvidencePenalty).toBe(-12)
    expect(plan.steps[0].warnings).toContain('攻略知識の再確認期限を過ぎています')
    expect(plan.warnings).toContain('攻略知識の再確認期限を過ぎています')
  })

  it('retains expired evidence for audit when another source is still valid', () => {
    const mixedEvidence = recipe('mixed-evidence', [101], {
      evidence: [
        ...recipe('evidence-source').evidence,
        {
          sourceId: 'expired-fixture',
          sourceLabel: '失効したテスト資料',
          url: 'https://example.com/expired-strategy',
          reviewedAt: '2025-01-01T00:00:00.000Z',
          validUntil: '2026-01-01T00:00:00.000Z',
          confidence: 'supported',
          summary: '監査表示だけに残る失効済み根拠'
        }
      ]
    })

    const plan = build([mixedEvidence], snapshot())

    expect(plan.steps).toHaveLength(1)
    expect(plan.steps[0].evidence).toHaveLength(2)
    expect(plan.steps[0].score.staleEvidencePenalty).toBe(-12)
    expect(plan.steps[0].warnings).toContain('1 件の根拠が失効しています')
  })
})

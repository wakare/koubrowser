import { describe, expect, it } from 'vitest'
import { ApiQuestCategory } from '@common/kcs'
import type { QuestGuideRecommendation } from '@common/quest_guide'
import { BundledQuestStrategyKnowledge } from '@common/quest_strategy_knowledge'
import {
  buildQuestStrategyLocalSnapshot,
  listQuestStrategyCandidates,
  listQuestStrategyDefaultBundles,
  migrateLegacyQuestStrategySelection,
  normalizeQuestStrategySelection,
  normalizeQuestStrategyVisibility,
  normalizeStoredQuestStrategySelectionV2,
  questStrategyEligibilityFingerprint,
  QuestStrategyFeatureDefaultEnabled
} from '../quest-strategy-view'

const GeneratedAt = '2026-07-31T00:00:00.000Z'
const recipes = BundledQuestStrategyKnowledge.recipes

function recommendation(
  questId: number,
  status: QuestGuideRecommendation['status'],
  overrides: Partial<QuestGuideRecommendation> = {}
): QuestGuideRecommendation {
  return {
    quest: {
      api_no: questId,
      api_title: `任務${questId}`,
      api_category: ApiQuestCategory.syutugeki
    },
    status,
    readiness: 'ready',
    knowledge: { conflicts: [] },
    ...overrides
  } as QuestGuideRecommendation
}

describe('quest strategy renderer adapter', () => {
  it('keeps the feature gated by default while preserving explicit local opt-in', () => {
    expect(QuestStrategyFeatureDefaultEnabled).toBe(false)
    expect(normalizeQuestStrategyVisibility(null)).toBe(false)
    expect(normalizeQuestStrategyVisibility('false')).toBe(false)
    expect(normalizeQuestStrategyVisibility('true')).toBe(true)
  })

  it('keeps non-sortie tasks out and orders candidates by planner capability', () => {
    const result = listQuestStrategyCandidates(
      recipes,
      [
        recommendation(303, 'active', {
          quest: {
            api_no: 303,
            api_title: '「演習」で練度向上！',
            api_category: ApiQuestCategory.ensyu
          } as QuestGuideRecommendation['quest']
        }),
        recommendation(999, 'active'),
        recommendation(845, 'active'),
        recommendation(229, 'available'),
        recommendation(264, 'claim')
      ],
      GeneratedAt
    )

    expect(result.map((candidate) => candidate.questId)).toEqual([845, 229, 999])
    expect(result.map((candidate) => candidate.group)).toEqual([
      'route-ready',
      'route-ready',
      'diagnostic'
    ])
    expect(result.map((candidate) => candidate.autoSelectable)).toEqual([true, true, false])
    expect(result.map((candidate) => candidate.selectable)).toEqual([true, true, false])
  })

  it('derives one coherent route-ready bundle instead of filling five active tasks', () => {
    const input = [
      recommendation(845, 'active'),
      recommendation(229, 'available'),
      recommendation(264, 'active'),
      recommendation(261, 'available')
    ]
    const candidates = listQuestStrategyCandidates(recipes, input, GeneratedAt)

    expect(listQuestStrategyDefaultBundles(recipes, candidates, GeneratedAt)[0]).toEqual({
      recipeIds: [
        'normal-4-1-western-quarterly',
        'normal-4-2-western-periodic',
        'normal-4-3-western-quarterly',
        'normal-4-4-western-quarterly',
        'normal-4-5-western-quarterly'
      ],
      questIds: [264, 845, 229]
    })
    expect(
      listQuestStrategyDefaultBundles(
        [...recipes].reverse(),
        listQuestStrategyCandidates(recipes, [...input].reverse(), GeneratedAt),
        GeneratedAt
      )
    ).toEqual(listQuestStrategyDefaultBundles(recipes, candidates, GeneratedAt))
  })

  it('invalidates mixed legacy storage and normalizes explicit v2 manual selections', () => {
    const candidates = listQuestStrategyCandidates(
      recipes,
      [
        recommendation(229, 'available'),
        recommendation(845, 'active'),
        recommendation(830, 'active'),
        recommendation(303, 'active', {
          quest: {
            api_no: 303,
            api_title: '「演習」で練度向上！',
            api_category: ApiQuestCategory.ensyu
          } as QuestGuideRecommendation['quest']
        })
      ],
      GeneratedAt
    )
    const bundles = listQuestStrategyDefaultBundles(recipes, candidates, GeneratedAt)

    expect(migrateLegacyQuestStrategySelection([303, 830], candidates, bundles)).toBeUndefined()
    expect(migrateLegacyQuestStrategySelection([229, 845], candidates, bundles)).toEqual({
      schemaVersion: 2,
      mode: 'manual',
      questIds: [229, 845]
    })
    expect(
      normalizeStoredQuestStrategySelectionV2(
        { schemaVersion: 2, mode: 'manual', questIds: [229, 845, 830] },
        candidates
      )
    ).toEqual({ schemaVersion: 2, mode: 'manual', questIds: [229, 845] })
    expect(normalizeStoredQuestStrategySelectionV2('{broken', candidates)).toBeUndefined()
    expect(
      normalizeStoredQuestStrategySelectionV2(
        { schemaVersion: 1, mode: 'manual', questIds: [229] },
        candidates
      )
    ).toBeUndefined()
  })

  it('changes the eligibility fingerprint when recipes are hidden or eligibility changes', () => {
    const baseCandidates = listQuestStrategyCandidates(
      recipes,
      [recommendation(229, 'available')],
      GeneratedAt
    )
    const base = questStrategyEligibilityFingerprint(
      BundledQuestStrategyKnowledge.version,
      [],
      recipes,
      baseCandidates
    )

    expect(
      questStrategyEligibilityFingerprint(
        BundledQuestStrategyKnowledge.version,
        ['normal-4-2-western-periodic'],
        recipes.filter((recipe) => recipe.id !== 'normal-4-2-western-periodic'),
        listQuestStrategyCandidates(
          recipes.filter((recipe) => recipe.id !== 'normal-4-2-western-periodic'),
          [recommendation(229, 'available')],
          GeneratedAt
        )
      )
    ).not.toBe(base)
    expect(
      questStrategyEligibilityFingerprint(
        BundledQuestStrategyKnowledge.version,
        [],
        recipes,
        listQuestStrategyCandidates(recipes, [recommendation(229, 'active')], GeneratedAt)
      )
    ).not.toBe(base)
  })

  it('keeps the reviewed actionability baseline explicit', () => {
    const reviewedQuestIds = [...new Set(recipes.flatMap((recipe) => recipe.questIds))]
    const result = listQuestStrategyCandidates(
      recipes,
      reviewedQuestIds.map((questId) => recommendation(questId, 'available')),
      GeneratedAt
    )

    expect(
      result.filter((candidate) => candidate.group === 'route-ready').map((item) => item.questId)
    ).toEqual([
      226, 229, 241, 242, 243, 257, 261, 264, 265, 280, 284, 822, 845, 861, 862, 873, 893, 894
    ])
    expect(
      result.filter((candidate) => candidate.group === 'partial').map((item) => item.questId)
    ).toEqual([])
  })

  it('builds a five-route default bundle for the two compatible southwest multi-stage tasks', () => {
    const candidates = listQuestStrategyCandidates(
      recipes,
      [recommendation(226, 'active'), recommendation(284, 'active'), recommendation(894, 'active')],
      GeneratedAt
    )

    expect(listQuestStrategyDefaultBundles(recipes, candidates, GeneratedAt)[0]).toEqual({
      recipeIds: [
        'normal-1-3-carrier-logistics-periodic',
        'normal-1-4-carrier-periodic',
        'normal-2-1-southwest-periodic',
        'normal-2-2-carrier-southwest-periodic',
        'normal-2-3-carrier-southwest-periodic'
      ],
      questIds: [226, 284, 894]
    })
  })

  it('keeps expired recipes in diagnostics instead of exposing them as manual partial routes', () => {
    const result = listQuestStrategyCandidates(
      recipes,
      [recommendation(229, 'available')],
      '2027-08-01T00:00:00.000Z'
    )

    expect(result[0]).toMatchObject({
      questId: 229,
      coverageStatus: 'route-unreviewed',
      group: 'diagnostic',
      selectable: false,
      autoSelectable: false
    })
  })

  it('normalizes persisted selections against candidates and the selection limit', () => {
    expect(
      normalizeQuestStrategySelection([103, 101, 101, 999, '102', 102], new Set([101, 102, 103]), 2)
    ).toEqual([103, 101])
    expect(normalizeQuestStrategySelection('101', new Set([101]))).toEqual([])
  })

  it('builds an anonymous aggregate snapshot with explicit unknown map state', () => {
    const snapshot = buildQuestStrategyLocalSnapshot({
      capturedAt: GeneratedAt,
      selectedQuestIds: [229, 261],
      recommendations: [
        recommendation(229, 'active', {
          cadenceDeadline: {
            resetsAt: '2026-08-01T00:00:00.000Z',
            hoursRemaining: 24,
            text: 'reset',
            urgency: 'soon'
          }
        }),
        recommendation(261, 'available', { readiness: 'needs-preparation' })
      ],
      recipes,
      availableMapKeys: new Set(['1-5']),
      mapDataAvailable: false,
      shipTypeCounts: { '2': 12 },
      equipmentTypeCounts: { '14': 8 },
      activeQuestCount: 4,
      questCapacity: 5
    })

    expect(snapshot.quests).toEqual([
      {
        questId: 229,
        state: 'active',
        deadlineUrgency: 'soon',
        readiness: 'ready',
        prerequisiteState: 'ready'
      },
      {
        questId: 261,
        state: 'available',
        deadlineUrgency: 'normal',
        readiness: 'needs-preparation',
        prerequisiteState: 'ready'
      }
    ])
    expect(snapshot.mapAvailability).toEqual({
      '1-2': 'unknown',
      '1-3': 'unknown',
      '1-4': 'unknown',
      '1-5': 'unknown',
      '1-6': 'unknown',
      '2-1': 'unknown',
      '2-2': 'unknown',
      '2-3': 'unknown',
      '2-4': 'unknown',
      '3-1': 'unknown',
      '3-2': 'unknown',
      '3-3': 'unknown',
      '4-1': 'unknown',
      '4-2': 'unknown',
      '4-3': 'unknown',
      '4-4': 'unknown',
      '4-5': 'unknown',
      '5-2': 'unknown',
      '6-3': 'unknown',
      '7-1': 'unknown',
      '7-2': 'unknown'
    })
    expect(snapshot.questCapacity).toEqual({ active: 4, maximum: 5 })
    expect(JSON.stringify(snapshot)).not.toMatch(/name|shipId|instanceId/i)
  })
})

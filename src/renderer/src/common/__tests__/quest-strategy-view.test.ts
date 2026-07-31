import { describe, expect, it } from 'vitest'
import type { QuestGuideRecommendation } from '@common/quest_guide'
import type { QuestStrategyRecipe } from '@common/quest_strategy'
import {
  buildQuestStrategyLocalSnapshot,
  listQuestStrategyCandidates,
  normalizeQuestStrategySelection,
  normalizeQuestStrategyVisibility,
  QuestStrategyFeatureDefaultEnabled
} from '../quest-strategy-view'

function recommendation(
  questId: number,
  status: QuestGuideRecommendation['status'],
  overrides: Partial<QuestGuideRecommendation> = {}
): QuestGuideRecommendation {
  return {
    quest: {
      api_no: questId,
      api_title: `任務${questId}`
    },
    status,
    readiness: 'ready',
    ...overrides
  } as QuestGuideRecommendation
}

const recipes = [
  {
    questIds: [101, 102],
    mapKey: '1-5'
  },
  {
    questIds: [103],
    mapKey: '4-2'
  }
] as QuestStrategyRecipe[]

describe('quest strategy renderer adapter', () => {
  it('enables the accepted feature by default while preserving an explicit opt-out', () => {
    expect(QuestStrategyFeatureDefaultEnabled).toBe(true)
    expect(normalizeQuestStrategyVisibility(null)).toBe(true)
    expect(normalizeQuestStrategyVisibility('false')).toBe(false)
    expect(normalizeQuestStrategyVisibility('true')).toBe(true)
  })

  it('lists every visible non-claim quest in source order with honest coverage', () => {
    const result = listQuestStrategyCandidates(recipes, [
      recommendation(999, 'active'),
      recommendation(102, 'active'),
      recommendation(101, 'available'),
      recommendation(103, 'claim')
    ])

    expect(result).toEqual([
      {
        questId: 999,
        title: '任務999',
        active: true,
        readiness: 'ready',
        coverageStatus: 'knowledge-insufficient'
      },
      {
        questId: 102,
        title: '任務102',
        active: true,
        readiness: 'ready',
        coverageStatus: 'knowledge-insufficient'
      },
      {
        questId: 101,
        title: '任務101',
        active: false,
        readiness: 'ready',
        coverageStatus: 'knowledge-insufficient'
      }
    ])
  })

  it('normalizes persisted selections against candidates and the selection limit', () => {
    expect(
      normalizeQuestStrategySelection([103, 101, 101, 999, '102', 102], new Set([101, 102, 103]), 2)
    ).toEqual([103, 101])
    expect(normalizeQuestStrategySelection('101', new Set([101]))).toEqual([])
  })

  it('builds an anonymous aggregate snapshot with explicit unknown map state', () => {
    const snapshot = buildQuestStrategyLocalSnapshot({
      capturedAt: '2026-07-31T00:00:00.000Z',
      selectedQuestIds: [101, 103],
      recommendations: [
        recommendation(101, 'active', {
          cadenceDeadline: {
            resetsAt: '2026-08-01T00:00:00.000Z',
            hoursRemaining: 24,
            text: 'reset',
            urgency: 'soon'
          }
        }),
        recommendation(103, 'available', {
          readiness: 'needs-preparation'
        })
      ],
      recipes,
      availableMapKeys: new Set(['1-5']),
      mapDataAvailable: false,
      shipTypeCounts: { '2': 12 },
      equipmentTypeCounts: { '14': 8 },
      activeQuestCount: 4,
      questCapacity: 5
    })

    expect(snapshot).toEqual({
      schemaVersion: 1,
      capturedAt: '2026-07-31T00:00:00.000Z',
      selectedQuestIds: [101, 103],
      quests: [
        {
          questId: 101,
          state: 'active',
          deadlineUrgency: 'soon',
          readiness: 'ready',
          prerequisiteState: 'ready'
        },
        {
          questId: 103,
          state: 'available',
          deadlineUrgency: 'normal',
          readiness: 'needs-preparation',
          prerequisiteState: 'ready'
        }
      ],
      mapAvailability: {
        '1-5': 'unknown',
        '4-2': 'unknown'
      },
      shipTypeCounts: { '2': 12 },
      equipmentTypeCounts: { '14': 8 },
      questCapacity: {
        active: 4,
        maximum: 5
      }
    })
    expect(JSON.stringify(snapshot)).not.toMatch(/name|shipId|instanceId/i)
  })
})

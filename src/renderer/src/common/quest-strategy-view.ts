import type { QuestGuideRecommendation } from '@common/quest_guide'
import {
  normalizeStrategyLocalSnapshot,
  type QuestStrategyRecipe,
  type StrategyDeadlineUrgency,
  type StrategyLocalSnapshot,
  type StrategyMapAvailability,
  type StrategyQuestSnapshot
} from '@common/quest_strategy'

export const QuestStrategyMaximumSelection = 5

export interface QuestStrategyCandidate {
  questId: number
  title: string
  active: boolean
  readiness: QuestGuideRecommendation['readiness']
}

export interface QuestStrategySnapshotInput {
  capturedAt: string
  selectedQuestIds: readonly number[]
  recommendations: readonly QuestGuideRecommendation[]
  recipes: readonly QuestStrategyRecipe[]
  availableMapKeys: ReadonlySet<string>
  mapDataAvailable: boolean
  shipTypeCounts?: Readonly<Record<string, number>>
  equipmentTypeCounts?: Readonly<Record<string, number>>
  activeQuestCount: number
  questCapacity?: number
}

function deadlineValue(value: StrategyDeadlineUrgency): number {
  switch (value) {
    case 'expired':
      return 3
    case 'urgent':
      return 2
    case 'soon':
      return 1
    default:
      return 0
  }
}

function deadlineUrgency(recommendation: QuestGuideRecommendation): StrategyDeadlineUrgency {
  const deadlines = [
    recommendation.cadenceDeadline?.urgency,
    recommendation.limitedDeadline?.urgency
  ].filter((value): value is StrategyDeadlineUrgency => value !== undefined)
  return deadlines.sort((a, b) => deadlineValue(b) - deadlineValue(a))[0] ?? 'normal'
}

function questSnapshot(
  questId: number,
  recommendation: QuestGuideRecommendation | undefined
): StrategyQuestSnapshot {
  return {
    questId,
    state:
      recommendation?.status === 'active'
        ? 'active'
        : recommendation?.status === 'available'
          ? 'available'
          : recommendation?.status === 'claim'
            ? 'completed'
            : 'unknown',
    deadlineUrgency: recommendation ? deadlineUrgency(recommendation) : 'normal',
    readiness: recommendation?.readiness ?? 'unknown',
    prerequisiteState: recommendation ? 'ready' : 'unknown'
  }
}

export function listQuestStrategyCandidates(
  recipes: readonly QuestStrategyRecipe[],
  recommendations: readonly QuestGuideRecommendation[]
): QuestStrategyCandidate[] {
  const supportedQuestIds = new Set(recipes.flatMap((recipe) => recipe.questIds))
  return recommendations
    .filter(
      (recommendation) =>
        recommendation.status !== 'claim' && supportedQuestIds.has(recommendation.quest.api_no)
    )
    .map((recommendation) => ({
      questId: recommendation.quest.api_no,
      title: recommendation.quest.api_title,
      active: recommendation.status === 'active',
      readiness: recommendation.readiness
    }))
}

export function normalizeQuestStrategySelection(
  value: unknown,
  candidateQuestIds: ReadonlySet<number>,
  maximum = QuestStrategyMaximumSelection
): number[] {
  if (!Array.isArray(value)) {
    return []
  }
  const result: number[] = []
  for (const item of value) {
    if (
      Number.isInteger(item) &&
      candidateQuestIds.has(item as number) &&
      !result.includes(item as number)
    ) {
      result.push(item as number)
    }
    if (result.length >= maximum) {
      break
    }
  }
  return result
}

export function buildQuestStrategyLocalSnapshot(
  input: QuestStrategySnapshotInput
): StrategyLocalSnapshot {
  const recommendationById = new Map(
    input.recommendations.map((recommendation) => [recommendation.quest.api_no, recommendation])
  )
  const mapKeys = new Set(input.recipes.map((recipe) => recipe.mapKey))
  const mapAvailability: Record<string, StrategyMapAvailability> = {}
  for (const mapKey of mapKeys) {
    mapAvailability[mapKey] = !input.mapDataAvailable
      ? 'unknown'
      : input.availableMapKeys.has(mapKey)
        ? 'available'
        : 'unavailable'
  }
  const questCapacity =
    input.questCapacity !== undefined && input.questCapacity >= input.activeQuestCount
      ? {
          active: input.activeQuestCount,
          maximum: input.questCapacity
        }
      : undefined

  return normalizeStrategyLocalSnapshot({
    schemaVersion: 1,
    capturedAt: input.capturedAt,
    selectedQuestIds: [...input.selectedQuestIds],
    quests: input.selectedQuestIds.map((questId) =>
      questSnapshot(questId, recommendationById.get(questId))
    ),
    mapAvailability,
    ...(input.shipTypeCounts ? { shipTypeCounts: { ...input.shipTypeCounts } } : {}),
    ...(input.equipmentTypeCounts ? { equipmentTypeCounts: { ...input.equipmentTypeCounts } } : {}),
    ...(questCapacity ? { questCapacity } : {})
  })
}

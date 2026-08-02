import type { QuestGuideRecommendation } from '@common/quest_guide'
import { ApiQuestCategory } from '@common/kcs'
import {
  normalizeStrategyLocalSnapshot,
  StrategyMaximumSelectedQuests,
  type QuestStrategyRecipe,
  type StrategyDeadlineUrgency,
  type StrategyLocalSnapshot,
  type StrategyMapAvailability,
  type StrategyQuestSnapshot
} from '@common/quest_strategy'
import {
  auditQuestStrategyRecipeObjective,
  questStrategyCoverageStatus,
  questStrategyRecipeIsOperational,
  type QuestStrategyCoverageStatus
} from '@common/quest_strategy_v2'

export const QuestStrategyMaximumSelection = StrategyMaximumSelectedQuests
export const QuestStrategyFeatureDefaultEnabled = false

export function normalizeQuestStrategyVisibility(value: unknown): boolean {
  if (value === 'true') return true
  if (value === 'false') return false
  return QuestStrategyFeatureDefaultEnabled
}

export interface QuestStrategyCandidate {
  questId: number
  title: string
  active: boolean
  readiness: QuestGuideRecommendation['readiness']
  deadlineUrgency: StrategyDeadlineUrgency
  coverageStatus: QuestStrategyCoverageStatus
  group: QuestStrategyCandidateGroup
  selectable: boolean
  autoSelectable: boolean
}

export type QuestStrategyCandidateGroup = 'route-ready' | 'partial' | 'diagnostic'

export interface QuestStrategyDefaultBundle {
  recipeIds: string[]
  questIds: number[]
}

export interface StoredQuestStrategySelectionV2 {
  schemaVersion: 2
  mode: 'manual'
  questIds: number[]
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
  recommendations: readonly QuestGuideRecommendation[],
  generatedAt: string
): QuestStrategyCandidate[] {
  return recommendations
    .filter(
      (recommendation) =>
        recommendation.status !== 'claim' &&
        recommendation.quest.api_category === ApiQuestCategory.syutugeki
    )
    .map((recommendation) => {
      const operationalRecipes = recipes.filter(
        (recipe) =>
          recipe.questIds.includes(recommendation.quest.api_no) &&
          questStrategyRecipeIsOperational(recipe, generatedAt)
      )
      const coverageStatus = questStrategyCoverageStatus(
        recommendation.quest.api_no,
        recipes,
        generatedAt,
        (recommendation.knowledge?.conflicts.length ?? 0) > 0
      )
      const group: QuestStrategyCandidateGroup =
        coverageStatus === 'route-ready'
          ? 'route-ready'
          : operationalRecipes.some(
                (recipe) =>
                  auditQuestStrategyRecipeObjective(recipe, recommendation.quest.api_no)
                    .contributions.length > 0
              ) &&
              (coverageStatus === 'route-unreviewed' ||
                coverageStatus === 'unsupported-v1-multi-stage')
            ? 'partial'
            : 'diagnostic'
      return {
        questId: recommendation.quest.api_no,
        title: recommendation.quest.api_title,
        active: recommendation.status === 'active',
        readiness: recommendation.readiness,
        deadlineUrgency: deadlineUrgency(recommendation),
        coverageStatus,
        group,
        selectable: group !== 'diagnostic',
        autoSelectable: group === 'route-ready'
      }
    })
    .sort(compareQuestStrategyCandidates)
}

function groupPriority(group: QuestStrategyCandidateGroup): number {
  switch (group) {
    case 'route-ready':
      return 0
    case 'partial':
      return 1
    case 'diagnostic':
      return 2
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function readinessPriority(readiness: QuestGuideRecommendation['readiness']): number {
  switch (readiness) {
    case 'ready':
      return 0
    case 'needs-preparation':
      return 1
    case 'unknown':
      return 2
    case 'blocked':
      return 3
  }
}

function compareQuestStrategyCandidates(
  left: QuestStrategyCandidate,
  right: QuestStrategyCandidate
): number {
  return (
    groupPriority(left.group) - groupPriority(right.group) ||
    Number(right.active) - Number(left.active) ||
    deadlineValue(right.deadlineUrgency) - deadlineValue(left.deadlineUrgency) ||
    readinessPriority(left.readiness) - readinessPriority(right.readiness) ||
    left.questId - right.questId
  )
}

export function listQuestStrategyDefaultBundles(
  recipes: readonly QuestStrategyRecipe[],
  candidates: readonly QuestStrategyCandidate[],
  generatedAt: string,
  maximum = QuestStrategyMaximumSelection
): QuestStrategyDefaultBundle[] {
  const candidateById = new Map(candidates.map((candidate) => [candidate.questId, candidate]))
  const operationalRecipes = recipes.filter((recipe) =>
    questStrategyRecipeIsOperational(recipe, generatedAt)
  )
  const recipeSetsByQuestId = new Map<number, string[]>()
  for (const candidate of candidates.filter((item) => item.autoSelectable)) {
    const routeCandidates = operationalRecipes
      .map((recipe) => ({
        recipe,
        audit: auditQuestStrategyRecipeObjective(recipe, candidate.questId)
      }))
      .filter(({ audit }) =>
        audit.contributions.some((contribution) => contribution.machineConstraintComplete)
      )
    const requiredStageCount = routeCandidates[0]?.audit.requiredStageCount ?? 0
    const uncoveredStages = new Set(
      Array.from({ length: requiredStageCount }, (_, stageIndex) => stageIndex)
    )
    const recipeIds: string[] = []
    const remaining = [...routeCandidates]
    while (uncoveredStages.size > 0 && recipeIds.length < QuestStrategyMaximumSelection) {
      const next = remaining
        .map((route) => ({
          ...route,
          newStageIndexes: [
            ...new Set(
              route.audit.contributions
                .filter(
                  (contribution) =>
                    contribution.machineConstraintComplete &&
                    uncoveredStages.has(contribution.stageIndex)
                )
                .map((contribution) => contribution.stageIndex)
            )
          ]
        }))
        .filter((route) => route.newStageIndexes.length > 0)
        .sort(
          (left, right) =>
            right.newStageIndexes.length - left.newStageIndexes.length ||
            compareText(left.recipe.id, right.recipe.id)
        )[0]
      if (!next) break
      recipeIds.push(next.recipe.id)
      next.newStageIndexes.forEach((stageIndex) => uncoveredStages.delete(stageIndex))
      remaining.splice(
        remaining.findIndex((route) => route.recipe.id === next.recipe.id),
        1
      )
    }
    if (uncoveredStages.size === 0 && recipeIds.length > 0) {
      recipeSetsByQuestId.set(candidate.questId, recipeIds.sort(compareText))
    }
  }

  const bundlesByRecipeSet = new Map<string, QuestStrategyDefaultBundle>()
  for (const recipeIds of recipeSetsByQuestId.values()) {
    const recipeIdSet = new Set(recipeIds)
    const questIds = [...recipeSetsByQuestId.entries()]
      .filter(([, requiredRecipeIds]) =>
        requiredRecipeIds.every((recipeId) => recipeIdSet.has(recipeId))
      )
      .map(([questId]) => candidateById.get(questId)!)
      .sort(compareQuestStrategyCandidates)
      .slice(0, maximum)
      .map((candidate) => candidate.questId)
    const key = recipeIds.join(',')
    bundlesByRecipeSet.set(key, { recipeIds: [...recipeIds], questIds })
  }

  return [...bundlesByRecipeSet.values()].sort((left, right) => {
    const leftCandidates = left.questIds.map((questId) => candidateById.get(questId)!)
    const rightCandidates = right.questIds.map((questId) => candidateById.get(questId)!)
    const leftUrgency = leftCandidates.reduce(
      (total, candidate) => total + deadlineValue(candidate.deadlineUrgency),
      0
    )
    const rightUrgency = rightCandidates.reduce(
      (total, candidate) => total + deadlineValue(candidate.deadlineUrgency),
      0
    )
    const leftReady = leftCandidates.filter((candidate) => candidate.readiness === 'ready').length
    const rightReady = rightCandidates.filter((candidate) => candidate.readiness === 'ready').length
    return (
      right.questIds.length - left.questIds.length ||
      rightCandidates.filter((candidate) => candidate.active).length -
        leftCandidates.filter((candidate) => candidate.active).length ||
      rightUrgency - leftUrgency ||
      rightReady - leftReady ||
      left.recipeIds.length - right.recipeIds.length ||
      compareText(left.recipeIds.join(','), right.recipeIds.join(',')) ||
      compareText(left.questIds.join(','), right.questIds.join(','))
    )
  })
}

export function normalizeStoredQuestStrategySelectionV2(
  value: unknown,
  candidates: readonly QuestStrategyCandidate[],
  maximum = QuestStrategyMaximumSelection
): StoredQuestStrategySelectionV2 | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }
  const record = value as Record<string, unknown>
  if (record.schemaVersion !== 2 || record.mode !== 'manual') {
    return undefined
  }
  const selectableIds = new Set(
    candidates.filter((candidate) => candidate.selectable).map((candidate) => candidate.questId)
  )
  return {
    schemaVersion: 2,
    mode: 'manual',
    questIds: normalizeQuestStrategySelection(record.questIds, selectableIds, maximum)
  }
}

export function migrateLegacyQuestStrategySelection(
  value: unknown,
  candidates: readonly QuestStrategyCandidate[],
  bundles: readonly QuestStrategyDefaultBundle[],
  maximum = QuestStrategyMaximumSelection
): StoredQuestStrategySelectionV2 | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximum) {
    return undefined
  }
  const candidateById = new Map(candidates.map((candidate) => [candidate.questId, candidate]))
  if (
    !value.every(
      (questId) =>
        Number.isInteger(questId) && candidateById.get(questId as number)?.selectable === true
    )
  ) {
    return undefined
  }
  const questIds = [...new Set(value as number[])]
  if (!bundles.some((bundle) => bundle.questIds.some((questId) => questIds.includes(questId)))) {
    return undefined
  }
  return { schemaVersion: 2, mode: 'manual', questIds }
}

export function questStrategyEligibilityFingerprint(
  knowledgeVersion: string,
  hiddenRecipeIds: readonly string[],
  recipes: readonly QuestStrategyRecipe[],
  candidates: readonly QuestStrategyCandidate[]
): string {
  return JSON.stringify({
    knowledgeVersion,
    hiddenRecipeIds: [...hiddenRecipeIds].sort(),
    recipes: recipes
      .map((recipe) => [recipe.id, recipe.revision, recipe.status] as const)
      .sort((left, right) => compareText(left[0], right[0])),
    candidates: candidates.map((candidate) => [
      candidate.questId,
      candidate.group,
      candidate.coverageStatus,
      candidate.active,
      candidate.readiness,
      candidate.deadlineUrgency
    ])
  })
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

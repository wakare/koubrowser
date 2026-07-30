import type { QuestGoalPlanStep } from '@common/quest_knowledge'

export type QuestGoalViewMode = 'current' | 'all'

export interface QuestGoalOption {
  questId: number
  questTitle: string
}

export interface QuestGoalStepView<T extends QuestGoalPlanStep> {
  steps: T[]
  excludedNotShownCount: number
  collapsedCount: number
  candidateCount: number
}

export function filterQuestGoalOptions<T extends QuestGoalOption>(
  options: readonly T[],
  query: string
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) {
    return [...options]
  }
  const numberQuery = normalizedQuery.startsWith('#')
    ? normalizedQuery.slice(1).trim()
    : normalizedQuery

  return options.filter(
    (option) =>
      (numberQuery && String(option.questId).includes(numberQuery)) ||
      option.questTitle.toLocaleLowerCase().includes(normalizedQuery)
  )
}

export function normalizeQuestGoalViewMode(value: unknown): QuestGoalViewMode {
  return value === 'all' ? 'all' : 'current'
}

export function buildQuestGoalStepView<T extends QuestGoalPlanStep>(
  steps: readonly T[],
  mode: QuestGoalViewMode,
  expanded: boolean,
  collapsedLimit: number
): QuestGoalStepView<T> {
  const candidates =
    mode === 'current'
      ? steps.filter((step) => step.status !== 'not-shown' || step.isTarget)
      : [...steps]
  const excludedNotShownCount = steps.length - candidates.length
  const limit = Math.max(2, Math.trunc(collapsedLimit))

  if (expanded || candidates.length <= limit) {
    return {
      steps: candidates,
      excludedNotShownCount,
      collapsedCount: 0,
      candidateCount: candidates.length
    }
  }

  const target = candidates.find((step) => step.isTarget)
  const visible = candidates.slice(0, limit)
  if (target && !visible.includes(target)) {
    visible.splice(limit - 1, 1, target)
  }

  return {
    steps: visible,
    excludedNotShownCount,
    collapsedCount: candidates.length - visible.length,
    candidateCount: candidates.length
  }
}

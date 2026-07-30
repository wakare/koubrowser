import type {
  QuestGuideReadiness,
  QuestGuideRecommendation,
  QuestGuideStatus
} from '@common/quest_guide'
import { questGuideIsRecurring } from '@common/quest_guide'

export type QuestGuideViewFilter =
  | 'all'
  | 'current'
  | 'ready'
  | 'attention'
  | 'limited'
  | 'recurring-unregistered'
  | 'recurring-unresolved'
  | 'recurring-review'
  | 'relation-review'

export type QuestGuideViewEntry = Pick<QuestGuideRecommendation, 'isLimited'> & {
  status: QuestGuideStatus
  readiness: QuestGuideReadiness
  knowledge: Pick<QuestGuideRecommendation['knowledge'], 'relationCoverageStatus'>
  quest: Pick<
    QuestGuideRecommendation['quest'],
    'api_no' | 'api_title' | 'api_detail' | 'api_type' | 'api_label_type'
  >
}

export function normalizeQuestGuideViewFilter(value: unknown): QuestGuideViewFilter {
  switch (value) {
    case 'current':
    case 'ready':
    case 'attention':
    case 'limited':
    case 'recurring-unregistered':
    case 'recurring-unresolved':
    case 'recurring-review':
    case 'relation-review':
      return value
    default:
      return 'all'
  }
}

function matchesFilter(recommendation: QuestGuideViewEntry, filter: QuestGuideViewFilter): boolean {
  switch (filter) {
    case 'current':
      return recommendation.status === 'claim' || recommendation.status === 'active'
    case 'ready':
      return recommendation.readiness === 'ready'
    case 'attention':
      return recommendation.readiness !== 'ready'
    case 'limited':
      return recommendation.isLimited
    case 'recurring-unregistered':
      return (
        questGuideIsRecurring(recommendation.quest) &&
        recommendation.knowledge.relationCoverageStatus === 'unregistered'
      )
    case 'recurring-unresolved':
      return (
        questGuideIsRecurring(recommendation.quest) &&
        recommendation.knowledge.relationCoverageStatus === 'unresolved'
      )
    case 'recurring-review':
      return (
        questGuideIsRecurring(recommendation.quest) &&
        recommendation.knowledge.relationCoverageStatus !== 'represented'
      )
    case 'relation-review':
      return recommendation.knowledge.relationCoverageStatus !== 'represented'
    case 'all':
      return true
  }
}

function matchesQuery(recommendation: QuestGuideViewEntry, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true
  }

  const numberQuery = normalizedQuery.startsWith('#')
    ? normalizedQuery.slice(1).trim()
    : normalizedQuery
  if (numberQuery && String(recommendation.quest.api_no).includes(numberQuery)) {
    return true
  }

  return (
    recommendation.quest.api_title.toLocaleLowerCase().includes(normalizedQuery) ||
    recommendation.quest.api_detail.toLocaleLowerCase().includes(normalizedQuery)
  )
}

export function filterQuestGuideRecommendations<T extends QuestGuideViewEntry>(
  recommendations: readonly T[],
  filter: QuestGuideViewFilter,
  query: string
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  return recommendations.filter(
    (recommendation) =>
      matchesFilter(recommendation, filter) && matchesQuery(recommendation, normalizedQuery)
  )
}

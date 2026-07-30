import { describe, expect, it } from 'vitest'
import {
  filterQuestGuideRecommendations,
  normalizeQuestGuideViewFilter,
  type QuestGuideViewEntry
} from '../quest-guide-view'

const recommendations: QuestGuideViewEntry[] = [
  {
    quest: {
      api_no: 101,
      api_title: '受取任務',
      api_detail: '報酬を受け取れます',
      api_type: 1,
      api_label_type: 0
    },
    status: 'claim',
    readiness: 'unknown',
    isLimited: false,
    knowledge: {
      relationCoverageStatus: 'represented'
    }
  },
  {
    quest: {
      api_no: 202,
      api_title: '北方海域任務',
      api_detail: '北方海域に出撃する',
      api_type: 2,
      api_label_type: 0
    },
    status: 'active',
    readiness: 'ready',
    isLimited: true,
    knowledge: {
      relationCoverageStatus: 'unresolved'
    }
  },
  {
    quest: {
      api_no: 303,
      api_title: '装備準備',
      api_detail: '指定装備を用意する',
      api_type: 4,
      api_label_type: 0
    },
    status: 'available',
    readiness: 'needs-preparation',
    isLimited: false,
    knowledge: {
      relationCoverageStatus: 'unregistered'
    }
  },
  {
    quest: {
      api_no: 404,
      api_title: '南方海域任務',
      api_detail: '未開放の海域に出撃する',
      api_type: 4,
      api_label_type: 0
    },
    status: 'available',
    readiness: 'blocked',
    isLimited: false,
    knowledge: {
      relationCoverageStatus: 'represented'
    }
  },
  {
    quest: {
      api_no: 505,
      api_title: '月間遠征任務',
      api_detail: '毎月の遠征を達成する',
      api_type: 3,
      api_label_type: 0
    },
    status: 'available',
    readiness: 'unknown',
    isLimited: false,
    knowledge: {
      relationCoverageStatus: 'unregistered'
    }
  }
]

describe('quest guide view filters', () => {
  it('normalizes unknown persisted values to all', () => {
    expect(normalizeQuestGuideViewFilter('current')).toBe('current')
    expect(normalizeQuestGuideViewFilter('old-value')).toBe('all')
    expect(normalizeQuestGuideViewFilter(undefined)).toBe('all')
  })

  it('retains recommendation order while filtering current quests', () => {
    expect(
      filterQuestGuideRecommendations(recommendations, 'current', '').map(
        (entry) => entry.quest.api_no
      )
    ).toEqual([101, 202])
  })

  it('separates ready and attention-needed recommendations', () => {
    expect(
      filterQuestGuideRecommendations(recommendations, 'ready', '').map(
        (entry) => entry.quest.api_no
      )
    ).toEqual([202])
    expect(
      filterQuestGuideRecommendations(recommendations, 'attention', '').map(
        (entry) => entry.quest.api_no
      )
    ).toEqual([101, 303, 404, 505])
  })

  it('filters limited-time recommendations independently of status', () => {
    expect(
      filterQuestGuideRecommendations(recommendations, 'limited', '').map(
        (entry) => entry.quest.api_no
      )
    ).toEqual([202])
  })

  it('surfaces unresolved and unregistered quest relationships for review', () => {
    expect(normalizeQuestGuideViewFilter('relation-review')).toBe('relation-review')
    expect(
      filterQuestGuideRecommendations(recommendations, 'relation-review', '').map(
        (entry) => entry.quest.api_no
      )
    ).toEqual([202, 303, 505])
    expect(normalizeQuestGuideViewFilter('recurring-review')).toBe('recurring-review')
    expect(normalizeQuestGuideViewFilter('recurring-unregistered')).toBe('recurring-unregistered')
    expect(normalizeQuestGuideViewFilter('recurring-unresolved')).toBe('recurring-unresolved')
    expect(
      filterQuestGuideRecommendations(recommendations, 'recurring-review', '').map(
        (entry) => entry.quest.api_no
      )
    ).toEqual([202, 505])
    expect(
      filterQuestGuideRecommendations(recommendations, 'recurring-unregistered', '').map(
        (entry) => entry.quest.api_no
      )
    ).toEqual([505])
    expect(
      filterQuestGuideRecommendations(recommendations, 'recurring-unresolved', '').map(
        (entry) => entry.quest.api_no
      )
    ).toEqual([202])
  })

  it('searches by number, title, or description', () => {
    expect(filterQuestGuideRecommendations(recommendations, 'all', ' #202 ')).toEqual([
      recommendations[1]
    ])
    expect(filterQuestGuideRecommendations(recommendations, 'all', '南方')).toEqual([
      recommendations[3]
    ])
    expect(filterQuestGuideRecommendations(recommendations, 'all', '指定装備')).toEqual([
      recommendations[2]
    ])
  })

  it('combines the selected filter and query', () => {
    expect(filterQuestGuideRecommendations(recommendations, 'current', '北方')).toEqual([
      recommendations[1]
    ])
    expect(filterQuestGuideRecommendations(recommendations, 'ready', '南方')).toEqual([])
  })
})

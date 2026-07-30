import { describe, expect, it } from 'vitest'
import type { QuestGoalPlanStep } from '@common/quest_knowledge'
import {
  buildQuestGoalStepView,
  filterQuestGoalOptions,
  normalizeQuestGoalViewMode
} from '../quest-goal-view'

function step(
  questId: number,
  status: QuestGoalPlanStep['status'],
  isTarget = false
): QuestGoalPlanStep {
  return {
    questId,
    title: `任務${questId}`,
    status,
    depth: 0,
    isTarget
  }
}

const route = [
  step(1, 'not-shown'),
  step(2, 'claim'),
  step(3, 'active'),
  step(4, 'available'),
  step(5, 'not-shown'),
  step(6, 'available'),
  step(7, 'not-shown', true)
]

describe('quest goal step view', () => {
  it('filters goal options by quest number or title without changing order', () => {
    const options = [
      { questId: 101, questTitle: '北方海域任務' },
      { questId: 202, questTitle: '工廠任務' },
      { questId: 1202, questTitle: 'Bismarck編成' }
    ]

    expect(filterQuestGoalOptions(options, '')).toEqual(options)
    expect(filterQuestGoalOptions(options, ' #20 ')).toEqual([options[1], options[2]])
    expect(filterQuestGoalOptions(options, '北方')).toEqual([options[0]])
    expect(filterQuestGoalOptions(options, 'bismarck')).toEqual([options[2]])
    expect(filterQuestGoalOptions(options, '該当なし')).toEqual([])
  })

  it('defaults stale persisted modes to the current quest list', () => {
    expect(normalizeQuestGoalViewMode('all')).toBe('all')
    expect(normalizeQuestGoalViewMode('old-mode')).toBe('current')
    expect(normalizeQuestGoalViewMode(undefined)).toBe('current')
  })

  it('shows current-list steps without treating a hidden target as completed', () => {
    const view = buildQuestGoalStepView(route, 'current', true, 6)

    expect(view.steps.map((entry) => entry.questId)).toEqual([2, 3, 4, 6, 7])
    expect(view.excludedNotShownCount).toBe(2)
    expect(view.collapsedCount).toBe(0)
  })

  it('shows every reviewed route step in all mode', () => {
    const view = buildQuestGoalStepView(route, 'all', true, 6)

    expect(view.steps).toEqual(route)
    expect(view.excludedNotShownCount).toBe(0)
  })

  it('keeps the route start and target visible while collapsing a long route', () => {
    const view = buildQuestGoalStepView(route, 'all', false, 4)

    expect(view.steps.map((entry) => entry.questId)).toEqual([1, 2, 3, 7])
    expect(view.candidateCount).toBe(7)
    expect(view.collapsedCount).toBe(3)
  })

  it('does not collapse a route that fits the configured limit', () => {
    const view = buildQuestGoalStepView(route.slice(0, 3), 'all', false, 6)

    expect(view.steps).toEqual(route.slice(0, 3))
    expect(view.collapsedCount).toBe(0)
  })

  it('clamps an invalid collapse limit while preserving the target', () => {
    const view = buildQuestGoalStepView(route, 'all', false, 0)

    expect(view.steps.map((entry) => entry.questId)).toEqual([1, 7])
    expect(view.collapsedCount).toBe(5)
  })
})

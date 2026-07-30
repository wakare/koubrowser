import {
  ApiProgressFlag,
  ApiQuestCategory,
  ApiQuestState,
  ApiQuestType,
  type ApiQuest
} from '@common/kcs'
import {
  InternalPseudoLocale,
  createAppTranslator
} from '@common/localization'
import {
  questProgressDetailItems,
  type QuestProgressDetailResolvers
} from '@common/kcquest'
import {
  buildQuestGuideRecommendations,
  questGuideCadenceText,
  questGuideSlotPressure
} from '@common/quest_guide'
import type { Quest } from '@common/record'
import { describe, expect, it } from 'vitest'

const pseudo = createAppTranslator(() => InternalPseudoLocale)

function apiQuest(overrides: Partial<ApiQuest> = {}): ApiQuest {
  return {
    api_no: 862,
    api_category: ApiQuestCategory.syutugeki,
    api_type: ApiQuestType.weekly,
    api_label_type: 0,
    api_state: ApiQuestState.in_progress,
    api_title: 'ゲーム由来の任務名',
    api_detail: 'ゲーム由来の任務説明',
    api_voice_id: 0,
    api_get_material: [0, 0, 0, 0],
    api_bonus_flag: 0,
    api_progress_flag: ApiProgressFlag.fifty,
    api_invalid_flag: 0,
    ...overrides
  }
}

function trackedQuest(
  no: number,
  state: { count: number[]; countMax: number[] },
  resolvers: QuestProgressDetailResolvers = {}
) {
  const quest: Quest = {
    no,
    dateKey: 'weekly',
    date: '2026-07-30T00:00:00.000Z',
    quest: apiQuest({ api_no: no }),
    state
  }
  return questProgressDetailItems(quest, resolvers)
}

describe('quest business localization', () => {
  it('formats structured progress from stable quest metadata', () => {
    const items = trackedQuest(
      862,
      { count: [1], countMax: [2] },
      { translate: pseudo }
    )
    expect(items?.[0]).toMatchObject({
      kind: 'battle',
      current: 1,
      required: 2,
      completed: false
    })
    expect(items?.[0].label).toMatch(/^［6-3 A勝勝利利］$/u)
  })

  it('localizes guide-generated text while preserving game quest text', () => {
    const quest = apiQuest()
    const recommendation = buildQuestGuideRecommendations([quest], {
      translate: pseudo,
      questDataSource: 'live'
    })[0]

    expect(recommendation.statusText).toMatch(/^［.+］$/u)
    expect(recommendation.cadenceText).toMatch(/^［.+］$/u)
    expect(recommendation.reasons.every((reason) => reason.startsWith('［'))).toBe(true)
    expect(recommendation.quest.api_title).toBe('ゲーム由来の任務名')
    expect(recommendation.quest.api_detail).toBe('ゲーム由来の任務説明')
  })

  it('localizes standalone cadence and slot-pressure formatters', () => {
    expect(questGuideCadenceText(apiQuest(), pseudo)).toMatch(/^［.+］$/u)
    expect(questGuideSlotPressure(7, 8, pseudo).text).toMatch(/^［.+］$/u)
  })
})

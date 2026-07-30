import { reactive } from 'vue'
import type { ApiQuest } from '@common/kcs'
import {
  createQuestGuideHistory,
  normalizeQuestGuideHistory,
  updateQuestGuideHistory,
  type QuestGuideHistory,
} from '@common/quest_guide'

const LocalStorageKey = 'questGuideHistory:v1'

function load(): QuestGuideHistory {
  const json = localStorage.getItem(LocalStorageKey)
  if (!json) {
    return createQuestGuideHistory()
  }

  try {
    return normalizeQuestGuideHistory(JSON.parse(json))
  } catch {
    return createQuestGuideHistory()
  }
}

export const questGuideHistory = reactive<QuestGuideHistory>(load())

export function refreshQuestGuideHistory(quests: readonly ApiQuest[]): void {
  const updated = updateQuestGuideHistory(questGuideHistory, quests)
  Object.assign(questGuideHistory, updated)
  localStorage.setItem(LocalStorageKey, JSON.stringify(updated))
}

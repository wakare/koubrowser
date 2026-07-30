import { shallowRef } from 'vue'
import type { QuestStrategyKnowledgeBundle } from '@common/quest_strategy_knowledge'
import {
  BundledQuestStrategyKnowledge,
  validateQuestStrategyKnowledgeBundle
} from '@common/quest_strategy_knowledge'

export const questStrategyKnowledge = shallowRef<QuestStrategyKnowledgeBundle>(
  BundledQuestStrategyKnowledge
)

export function setQuestStrategyKnowledgeUpdate(update: QuestStrategyKnowledgeBundle | null): void {
  questStrategyKnowledge.value =
    update === null ? BundledQuestStrategyKnowledge : validateQuestStrategyKnowledgeBundle(update)
}

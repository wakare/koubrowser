import { normalizeQuestStrategyRecipes, type QuestStrategyRecipe } from '@common/quest_strategy'

export interface QuestStrategyKnowledgeBundle {
  schemaVersion: 1
  version: string
  recipes: readonly QuestStrategyRecipe[]
}

/**
 * 実在の攻略配方は、参照先と有効期間をレビューしてからここへ追加する。
 * 内核の実装段階では、未確認の攻略情報を製品データとして同梱しない。
 */
export const BundledQuestStrategyKnowledge: QuestStrategyKnowledgeBundle = {
  schemaVersion: 1,
  version: '2026-07-31.0',
  recipes: normalizeQuestStrategyRecipes([])
}

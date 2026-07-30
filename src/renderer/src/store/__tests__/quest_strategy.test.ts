import { afterEach, describe, expect, it } from 'vitest'
import {
  BundledQuestStrategyKnowledge,
  type QuestStrategyKnowledgeBundle
} from '@common/quest_strategy_knowledge'
import { questStrategyKnowledge, setQuestStrategyKnowledgeUpdate } from '../quest_strategy'

afterEach(() => {
  setQuestStrategyKnowledgeUpdate(null)
})

describe('quest strategy renderer knowledge store', () => {
  it('uses a validated signed update and restores the bundled fallback', () => {
    const update: QuestStrategyKnowledgeBundle = {
      schemaVersion: 1,
      version: 'signed-test-1',
      recipes: [BundledQuestStrategyKnowledge.recipes[1]]
    }

    setQuestStrategyKnowledgeUpdate(update)

    expect(questStrategyKnowledge.value.version).toBe('signed-test-1')
    expect(questStrategyKnowledge.value.recipes.map((recipe) => recipe.id)).toEqual([
      'normal-4-2-western-periodic'
    ])

    setQuestStrategyKnowledgeUpdate(null)
    expect(questStrategyKnowledge.value).toBe(BundledQuestStrategyKnowledge)
  })

  it('rejects an unvalidated update without replacing the fallback', () => {
    expect(() =>
      setQuestStrategyKnowledgeUpdate({
        schemaVersion: 1,
        version: 'invalid-test',
        recipes: [{ executable: 'alert(1)' }]
      } as unknown as QuestStrategyKnowledgeBundle)
    ).toThrow('unknown field')
    expect(questStrategyKnowledge.value).toBe(BundledQuestStrategyKnowledge)
  })
})

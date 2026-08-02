import { afterEach, describe, expect, it } from 'vitest'
import { getCuratedQuestKnowledge, setCuratedQuestKnowledgeUpdate } from '@common/quest_knowledge'
import {
  parseQuestKnowledgeUpdate,
  validateQuestKnowledgeUpdate,
  type QuestKnowledgeUpdate
} from '@common/quest_knowledge_update'
import { BundledQuestStrategyKnowledge } from '@common/quest_strategy_knowledge'
import { QuestGrowthReviewedRouteCatalog } from '@common/quest_growth_reviewed_routes'

function createUpdate(
  overrides: Partial<QuestKnowledgeUpdate['claims'][number]> = {}
): QuestKnowledgeUpdate {
  return {
    schemaVersion: 1,
    claims: [
      {
        source: 'wikiwiki',
        sourceLabel: '日本語攻略Wiki',
        url: 'https://wikiwiki.jp/kancolle/任務/出撃任務',
        lastVerifiedAt: '2026-07-29',
        dataVersion: 'ページ確認 2026-07-29',
        questId: 900001,
        questTitle: '更新テスト任務',
        prerequisites: [
          {
            mode: 'all',
            quests: [{ questId: 201, title: '敵艦隊を撃破せよ！' }]
          }
        ],
        ...overrides
      }
    ]
  }
}

function growthRoutes() {
  return {
    schemaVersion: 1 as const,
    version: 'signed-growth-routes-1',
    publicationAuthorization: 'R7_RUNTIME_SIGNED_CANDIDATE' as const,
    routes: QuestGrowthReviewedRouteCatalog.routes.map((route) => ({
      routeId: route.routeId,
      routeFamily: route.routeFamily,
      revision: route.revision,
      semanticDigest: route.review.approvalDigest!,
      status: 'reviewed' as const
    }))
  }
}

afterEach(() => {
  setCuratedQuestKnowledgeUpdate(null)
})

describe('quest knowledge update', () => {
  it('parses a strictly declarative update', () => {
    const update = createUpdate()

    expect(parseQuestKnowledgeUpdate(JSON.stringify(update))).toEqual(update)
  })

  it('parses signed strategy recipes and rejects unknown strategy versions', () => {
    const update: QuestKnowledgeUpdate = {
      ...createUpdate(),
      strategy: {
        schemaVersion: 1,
        version: 'strategy-test-1',
        recipes: [BundledQuestStrategyKnowledge.recipes[0]]
      }
    }

    expect(parseQuestKnowledgeUpdate(JSON.stringify(update)).strategy).toEqual(update.strategy)
    expect(() =>
      validateQuestKnowledgeUpdate({
        ...update,
        strategy: {
          ...update.strategy,
          schemaVersion: 2
        }
      })
    ).toThrow('unsupported quest strategy knowledge schema')
    expect(() =>
      validateQuestKnowledgeUpdate({
        ...update,
        strategy: {
          ...update.strategy,
          executable: 'alert(1)'
        }
      })
    ).toThrow('unsupported or missing fields')
  })

  it('parses strict signed growth routes and rejects withdrawn-content expansion', () => {
    const update: QuestKnowledgeUpdate = {
      ...createUpdate(),
      growthRoutes: growthRoutes()
    }

    expect(parseQuestKnowledgeUpdate(JSON.stringify(update)).growthRoutes).toEqual(
      update.growthRoutes
    )
    expect(() =>
      validateQuestKnowledgeUpdate({
        ...update,
        growthRoutes: { ...update.growthRoutes, executable: 'alert(1)' }
      })
    ).toThrow('unsupported or missing fields')
  })

  it('rejects unsupported fields and non-Wiki reference hosts', () => {
    expect(() =>
      validateQuestKnowledgeUpdate({
        ...createUpdate(),
        executable: 'alert(1)'
      })
    ).toThrow('unsupported or missing fields')

    expect(() =>
      validateQuestKnowledgeUpdate(createUpdate({ url: 'https://example.com/unreviewed' }))
    ).toThrow('invalid quest knowledge claim 0 URL')
  })

  it('rejects duplicate sources and self prerequisites', () => {
    const update = createUpdate()
    expect(() =>
      validateQuestKnowledgeUpdate({
        ...update,
        claims: [...update.claims, { ...update.claims[0] }]
      })
    ).toThrow('duplicate quest knowledge source')

    expect(() =>
      validateQuestKnowledgeUpdate(
        createUpdate({
          prerequisites: [
            {
              mode: 'all',
              quests: [{ questId: 900001, title: '更新テスト任務' }]
            }
          ]
        })
      )
    ).toThrow('self prerequisite')
  })

  it('replaces only listed quest claims and can restore the bundled fallback', () => {
    const bundledTitle = getCuratedQuestKnowledge(216)?.questTitle
    expect(bundledTitle).toBeTruthy()

    setCuratedQuestKnowledgeUpdate(
      createUpdate({
        questId: 216,
        questTitle: '更新された主力撃滅任務'
      })
    )

    expect(getCuratedQuestKnowledge(216)?.questTitle).toBe('更新された主力撃滅任務')
    expect(getCuratedQuestKnowledge(201)?.downstream).toContainEqual(
      expect.objectContaining({
        questId: 216,
        title: '更新された主力撃滅任務'
      })
    )

    setCuratedQuestKnowledgeUpdate(null)
    expect(getCuratedQuestKnowledge(216)?.questTitle).toBe(bundledTitle)
  })
})

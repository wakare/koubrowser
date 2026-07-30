import { describe, expect, it } from 'vitest'
import { getQuestStuff } from '@common/kcquest'
import {
  buildQuestGoalPlan,
  getCuratedQuestKnowledge,
  listCuratedQuestKnowledge,
  resolveCuratedQuestKnowledge,
  type QuestCuratedClaim
} from '@common/quest_knowledge'

function claim(
  source: 'wikiwiki' | 'kcwiki',
  prerequisiteIds: number[],
  mode: 'all' | 'any' = 'all',
  prerequisitesComplete = true
): QuestCuratedClaim {
  return {
    source,
    sourceLabel: source,
    url: `https://example.test/${source}`,
    lastVerifiedAt: '2026-07-25',
    dataVersion: 'test',
    questId: 200,
    questTitle: '対象任務',
    prerequisites: [
      {
        mode,
        quests: prerequisiteIds.map((questId) => ({
          questId,
          title: `前提${questId}`
        }))
      }
    ],
    prerequisitesComplete
  }
}

describe('curated quest knowledge', () => {
  it('merges matching claims and retains provenance per field', () => {
    const graph = resolveCuratedQuestKnowledge([
      claim('wikiwiki', [100, 101]),
      claim('kcwiki', [101, 100])
    ])
    const target = graph.get(200)

    expect(target?.conflicts).toEqual([])
    expect(target?.prerequisiteGroups[0]).toMatchObject({
      mode: 'all',
      quests: [{ questId: 100 }, { questId: 101 }]
    })
    expect(target?.prerequisiteGroups[0].provenance.map((entry) => entry.source)).toEqual([
      'wikiwiki',
      'kcwiki'
    ])
    expect(graph.get(100)?.downstream[0]).toMatchObject({
      questId: 200,
      prerequisiteMode: 'all'
    })
  })

  it('surfaces source conflicts instead of silently selecting one claim', () => {
    const graph = resolveCuratedQuestKnowledge([
      claim('wikiwiki', [100], 'all'),
      claim('kcwiki', [101], 'any')
    ])
    const target = graph.get(200)

    expect(target?.prerequisiteGroups).toEqual([])
    expect(target?.conflicts).toHaveLength(1)
    expect(target?.conflicts[0].kind).toBe('source-disagreement')
    expect(target?.conflicts[0].summary).toContain('自動判定には使用しません')
    expect(target?.conflicts[0].details).toEqual([
      expect.objectContaining({
        source: 'wikiwiki',
        prerequisitesComplete: true,
        prerequisiteGroups: [
          expect.objectContaining({
            mode: 'all',
            quests: [expect.objectContaining({ questId: 100 })]
          })
        ]
      }),
      expect.objectContaining({
        source: 'kcwiki',
        prerequisitesComplete: true,
        prerequisiteGroups: [
          expect.objectContaining({
            mode: 'any',
            quests: [expect.objectContaining({ questId: 101 })]
          })
        ]
      })
    ])
    expect(graph.get(100)).toBeUndefined()
    expect(graph.get(101)).toBeUndefined()
  })

  it('treats an explicitly incomplete source claim as a conflict', () => {
    const graph = resolveCuratedQuestKnowledge([
      claim('wikiwiki', [100], 'all', false),
      claim('kcwiki', [100])
    ])
    const target = graph.get(200)

    expect(target?.prerequisiteGroups).toEqual([])
    expect(target?.conflicts).toHaveLength(1)
    expect(
      target?.conflicts[0].details.map((detail) => ({
        source: detail.source,
        complete: detail.prerequisitesComplete
      }))
    ).toEqual([
      { source: 'wikiwiki', complete: false },
      { source: 'kcwiki', complete: true }
    ])
    expect(graph.get(100)).toBeUndefined()
  })

  it('keeps matching but unverified source claims out of automatic reasoning', () => {
    const graph = resolveCuratedQuestKnowledge([
      {
        ...claim('wikiwiki', [100]),
        reviewStatus: 'under-review'
      },
      {
        ...claim('kcwiki', [100]),
        reviewStatus: 'under-review'
      }
    ])
    const target = graph.get(200)

    expect(target?.prerequisiteGroups).toEqual([])
    expect(target?.conflicts).toHaveLength(1)
    expect(target?.conflicts[0]).toMatchObject({
      kind: 'unresolved-review',
      summary: expect.stringContaining('検証中または不完全')
    })
    expect(
      target?.conflicts[0].details.map((detail) => detail.reviewStatus)
    ).toEqual(['under-review', 'under-review'])
    expect(graph.get(100)).toBeUndefined()
  })

  it('contains the reviewed daily and weekly chains from both wiki sources', () => {
    const daily = getCuratedQuestKnowledge(210)
    const dailyRoot = getCuratedQuestKnowledge(216)

    expect(daily?.prerequisiteGroups[0].quests).toEqual([
      {
        questId: 216,
        title: '敵艦隊主力を撃滅せよ！'
      }
    ])
    expect(daily?.prerequisiteGroups[0].provenance.map((entry) => entry.source)).toEqual([
      'wikiwiki',
      'kcwiki'
    ])
    expect(dailyRoot?.downstream.map((entry) => entry.questId)).toEqual(
      expect.arrayContaining([210, 213, 214])
    )
  })

  it('represents reviewed AND prerequisites for monthly and quarterly quests', () => {
    const monthly = getCuratedQuestKnowledge(264)
    const quarterly = getCuratedQuestKnowledge(875)

    expect(monthly?.prerequisiteGroups[0]).toMatchObject({
      mode: 'all',
      quests: [{ questId: 239 }, { questId: 221 }]
    })
    expect(quarterly?.prerequisiteGroups[0]).toMatchObject({
      mode: 'all',
      quests: [{ questId: 873 }, { questId: 188 }]
    })
    expect(monthly?.conflicts).toEqual([])
    expect(quarterly?.conflicts).toEqual([])
  })

  it('includes confirmed monthly factory prerequisites from both sources', () => {
    const cases = [
      {
        questId: 626,
        prerequisiteIds: [114, 264]
      },
      {
        questId: 645,
        prerequisiteIds: [294, 228]
      }
    ] as const

    for (const expected of cases) {
      const knowledge = getCuratedQuestKnowledge(expected.questId)
      const plan = buildQuestGoalPlan(expected.questId)
      const stepIds = plan?.steps.map((step) => step.questId) ?? []

      expect(
        knowledge?.prerequisiteGroups[0].quests.map((quest) => quest.questId)
      ).toEqual(expected.prerequisiteIds)
      expect(
        knowledge?.prerequisiteGroups[0].provenance.map(
          (entry) => entry.source
        )
      ).toEqual(['wikiwiki', 'kcwiki'])
      expect(knowledge?.prerequisiteGroups[0].provenance[0].url).toBe(
        'https://wikiwiki.jp/kancolle/任務/工廠任務'
      )
      expect(knowledge?.conflicts).toEqual([])
      for (const prerequisiteId of expected.prerequisiteIds) {
        expect(stepIds.indexOf(prerequisiteId)).toBeLessThan(
          stepIds.indexOf(expected.questId)
        )
      }
      expect(stepIds.at(-1)).toBe(expected.questId)
      expect(plan?.conflictCount).toBe(0)
    }
  })

  it('retains unresolved monthly prerequisites as inspectable evidence', () => {
    const cases = [
      {
        questId: 257,
        kind: 'unresolved-review',
        statuses: ['incomplete', 'incomplete'],
        questIds: [[221], [221]],
        japaneseUrl: 'https://wikiwiki.jp/kancolle/任務/出撃定期'
      },
      {
        questId: 311,
        kind: 'source-disagreement',
        statuses: ['verified', 'incomplete'],
        questIds: [[216], [216]],
        japaneseUrl: 'https://wikiwiki.jp/kancolle/任務/演習任務'
      },
      {
        questId: 318,
        kind: 'source-disagreement',
        statuses: ['verified', 'incomplete'],
        questIds: [[617, 676], [617, 676]],
        japaneseUrl: 'https://wikiwiki.jp/kancolle/任務/演習任務'
      },
      {
        questId: 424,
        kind: 'source-disagreement',
        statuses: ['verified', 'incomplete'],
        questIds: [[402, 419], [402, 419]],
        japaneseUrl: 'https://wikiwiki.jp/kancolle/任務/遠征任務'
      },
      {
        questId: 628,
        kind: 'source-disagreement',
        statuses: ['under-review', 'incomplete'],
        questIds: [[627, 265], [627, 265]],
        japaneseUrl: 'https://wikiwiki.jp/kancolle/任務/工廠任務'
      }
    ] as const

    for (const expected of cases) {
      const knowledge = getCuratedQuestKnowledge(expected.questId)
      const plan = buildQuestGoalPlan(expected.questId)

      expect(knowledge?.prerequisiteGroups).toEqual([])
      expect(knowledge?.conflicts).toHaveLength(1)
      expect(knowledge?.conflicts[0].kind).toBe(expected.kind)
      expect(
        knowledge?.conflicts[0].details.map((detail) => ({
          status: detail.reviewStatus,
          questIds: detail.prerequisiteGroups.flatMap((group) =>
            group.quests.map((quest) => quest.questId)
          )
        }))
      ).toEqual(
        expected.statuses.map((status, index) => ({
          status,
          questIds: expected.questIds[index]
        }))
      )
      expect(knowledge?.conflicts[0].details[0].url).toBe(
        expected.japaneseUrl
      )
      expect(plan?.steps.map((step) => step.questId)).toEqual([
        expected.questId
      ])
      expect(plan?.conflictCount).toBe(1)
    }
  })

  it('retains disputed February yearly prerequisites as inspectable evidence', () => {
    const cases = [
      {
        questId: 904,
        statuses: ['incomplete', 'verified'],
        questIds: [[276], [276, 662]],
        japaneseUrl: 'https://wikiwiki.jp/kancolle/任務/出撃定期'
      },
      {
        questId: 905,
        statuses: ['incomplete', 'verified'],
        questIds: [[303], [303, 217]],
        japaneseUrl: 'https://wikiwiki.jp/kancolle/任務/出撃定期'
      },
      {
        questId: 434,
        statuses: ['incomplete', 'verified'],
        questIds: [[425], [425]],
        japaneseUrl: 'https://wikiwiki.jp/kancolle/任務/遠征任務'
      },
      {
        questId: 442,
        statuses: ['under-review', 'verified'],
        questIds: [[415, 419, 432], [415, 432]],
        japaneseUrl: 'https://wikiwiki.jp/kancolle/任務/遠征任務'
      }
    ] as const

    for (const expected of cases) {
      const knowledge = getCuratedQuestKnowledge(expected.questId)
      const plan = buildQuestGoalPlan(expected.questId)

      expect(knowledge?.prerequisiteGroups).toEqual([])
      expect(knowledge?.conflicts).toHaveLength(1)
      expect(knowledge?.conflicts[0].kind).toBe('source-disagreement')
      expect(
        knowledge?.conflicts[0].details.map((detail) => ({
          status: detail.reviewStatus,
          questIds: detail.prerequisiteGroups.flatMap((group) =>
            group.quests.map((quest) => quest.questId)
          )
        }))
      ).toEqual(
        expected.statuses.map((status, index) => ({
          status,
          questIds: expected.questIds[index]
        }))
      )
      expect(knowledge?.conflicts[0].details[0].url).toBe(
        expected.japaneseUrl
      )
      expect(plan?.steps.map((step) => step.questId)).toEqual([
        expected.questId
      ])
      expect(plan?.conflictCount).toBe(1)
    }
  })

  it('retains disputed March yearly prerequisites as inspectable evidence', () => {
    const cases = [
      {
        questId: 912,
        statuses: ['incomplete', 'verified'],
        questIds: [[], [618]],
        japaneseUrl: 'https://wikiwiki.jp/kancolle/任務/出撃定期'
      },
      {
        questId: 914,
        statuses: ['under-review', 'verified'],
        questIds: [[905, 838], [905, 838]],
        japaneseUrl: 'https://wikiwiki.jp/kancolle/任務/出撃定期'
      },
      {
        questId: 350,
        statuses: ['incomplete', 'verified'],
        questIds: [[], [301, 109]],
        japaneseUrl: 'https://wikiwiki.jp/kancolle/任務/演習任務'
      },
      {
        questId: 444,
        statuses: ['under-review', 'verified'],
        questIds: [[425, 427, 432], [425, 432]],
        japaneseUrl: 'https://wikiwiki.jp/kancolle/任務/遠征任務'
      }
    ] as const

    for (const expected of cases) {
      const knowledge = getCuratedQuestKnowledge(expected.questId)
      const plan = buildQuestGoalPlan(expected.questId)

      expect(knowledge?.prerequisiteGroups).toEqual([])
      expect(knowledge?.conflicts).toHaveLength(1)
      expect(knowledge?.conflicts[0].kind).toBe('source-disagreement')
      expect(
        knowledge?.conflicts[0].details.map((detail) => ({
          status: detail.reviewStatus,
          questIds: detail.prerequisiteGroups.flatMap((group) =>
            group.quests.map((quest) => quest.questId)
          )
        }))
      ).toEqual(
        expected.statuses.map((status, index) => ({
          status,
          questIds: expected.questIds[index]
        }))
      )
      expect(knowledge?.conflicts[0].details[0].url).toBe(
        expected.japaneseUrl
      )
      expect(plan?.steps.map((step) => step.questId)).toEqual([
        expected.questId
      ])
      expect(plan?.conflictCount).toBe(1)
    }
  })

  it('retains disputed quarterly practice prerequisites as inspectable evidence', () => {
    const cases = [
      {
        questId: 330,
        statuses: ['under-review', 'verified'],
        questIds: [[201, 209], [201, 209]]
      },
      {
        questId: 337,
        statuses: ['incomplete', 'verified'],
        questIds: [[201], [120, 201]]
      },
      {
        questId: 339,
        statuses: ['under-review', 'incomplete'],
        questIds: [[337, 177], [337, 177]]
      },
      {
        questId: 342,
        statuses: ['verified', 'verified'],
        questIds: [[307, 174], [307]]
      }
    ] as const

    for (const expected of cases) {
      const knowledge = getCuratedQuestKnowledge(expected.questId)
      const plan = buildQuestGoalPlan(expected.questId)

      expect(knowledge?.prerequisiteGroups).toEqual([])
      expect(knowledge?.conflicts).toHaveLength(1)
      expect(knowledge?.conflicts[0].kind).toBe('source-disagreement')
      expect(
        knowledge?.conflicts[0].details.map((detail) => ({
          status: detail.reviewStatus,
          questIds: detail.prerequisiteGroups.flatMap((group) =>
            group.quests.map((quest) => quest.questId)
          )
        }))
      ).toEqual(
        expected.statuses.map((status, index) => ({
          status,
          questIds: expected.questIds[index]
        }))
      )
      expect(knowledge?.conflicts[0].details[0].url).toBe(
        'https://wikiwiki.jp/kancolle/任務/演習任務'
      )
      expect(plan?.steps.map((step) => step.questId)).toEqual([
        expected.questId
      ])
      expect(plan?.conflictCount).toBe(1)
    }
  })

  it('includes reviewed quarterly chains and surfaces the disputed Bq11 edge', () => {
    const zFront = getCuratedQuestKnowledge(854)
    const mikawa = getCuratedQuestKnowledge(888)
    const sixthTorpedo = getCuratedQuestKnowledge(903)
    const southwestSecurity = getCuratedQuestKnowledge(284)
    const zPlan = buildQuestGoalPlan(872)
    const securityPlan = buildQuestGoalPlan(284)

    expect(zFront?.prerequisiteGroups[0]).toMatchObject({
      mode: 'all',
      quests: [{ questId: 846 }, { questId: 220 }]
    })
    expect(mikawa?.prerequisiteGroups[0]).toMatchObject({
      mode: 'all',
      quests: [{ questId: 273 }, { questId: 243 }]
    })
    expect(sixthTorpedo?.prerequisiteGroups[0].quests).toEqual([
      {
        questId: 902,
        title: '新編「六水戦」出撃！後で感想、聞かせてね！'
      }
    ])
    expect(zPlan?.steps.map((step) => step.questId)).toEqual(
      expect.arrayContaining([846, 220, 854, 872])
    )
    expect(southwestSecurity?.prerequisiteGroups).toEqual([])
    expect(southwestSecurity?.conflicts).toHaveLength(1)
    expect(
      southwestSecurity?.conflicts[0].details.map((detail) => ({
        source: detail.source,
        questIds: detail.prerequisiteGroups[0].quests.map(
          (quest) => quest.questId
        ),
        reviewStatus: detail.reviewStatus,
        note: detail.reviewNote
      }))
    ).toEqual([
      {
        source: 'wikiwiki',
        questIds: [280, 303],
        reviewStatus: 'verified',
        note: undefined
      },
      {
        source: 'kcwiki',
        questIds: [280, 303],
        reviewStatus: 'under-review',
        note: expect.stringContaining('#261')
      }
    ])
    expect(securityPlan?.steps.map((step) => step.questId)).toEqual([284])
    expect(securityPlan?.conflictCount).toBe(1)
  })

  it('retains unresolved quarterly sortie prerequisites as inspectable evidence', () => {
    const cases = [
      {
        questId: 822,
        kind: 'source-disagreement',
        statuses: ['under-review', 'verified'],
        questIds: [[233, 264], [233, 264]]
      },
      {
        questId: 861,
        kind: 'unresolved-review',
        statuses: ['under-review', 'under-review'],
        questIds: [[217, 617], [217, 617]]
      },
      {
        questId: 862,
        kind: 'unresolved-review',
        statuses: ['incomplete', 'incomplete'],
        questIds: [[861, 846], [861, 846]]
      },
      {
        questId: 893,
        kind: 'source-disagreement',
        statuses: ['verified', 'incomplete'],
        questIds: [[214, 299], [214, 299]]
      },
      {
        questId: 894,
        kind: 'source-disagreement',
        statuses: ['incomplete', 'verified'],
        questIds: [[], [206]]
      },
      {
        questId: 845,
        kind: 'source-disagreement',
        statuses: ['under-review', 'verified'],
        questIds: [[247, 284], [247, 284]]
      }
    ] as const

    for (const expected of cases) {
      const knowledge = getCuratedQuestKnowledge(expected.questId)
      const plan = buildQuestGoalPlan(expected.questId)

      expect(knowledge?.prerequisiteGroups).toEqual([])
      expect(knowledge?.conflicts).toHaveLength(1)
      expect(knowledge?.conflicts[0].kind).toBe(expected.kind)
      expect(
        knowledge?.conflicts[0].details.map((detail) => ({
          status: detail.reviewStatus,
          questIds: detail.prerequisiteGroups.flatMap((group) =>
            group.quests.map((quest) => quest.questId)
          )
        }))
      ).toEqual(
        expected.statuses.map((status, index) => ({
          status,
          questIds: expected.questIds[index]
        }))
      )
      expect(plan?.steps.map((step) => step.questId)).toEqual([
        expected.questId
      ])
      expect(plan?.conflictCount).toBe(1)
    }
  })

  it('includes the reviewed June yearly sortie branch and surfaces the uncertain target', () => {
    const logistics = getCuratedQuestKnowledge(945)
    const carrier = getCuratedQuestKnowledge(946)
    const alOperation = getCuratedQuestKnowledge(947)

    expect(logistics?.prerequisiteGroups[0].quests).toEqual([
      {
        questId: 944,
        title: '鎮守府近海海域の哨戒を実施せよ！'
      }
    ])
    expect(carrier?.prerequisiteGroups[0].quests).toEqual([
      {
        questId: 944,
        title: '鎮守府近海海域の哨戒を実施せよ！'
      }
    ])
    expect(alOperation?.prerequisiteGroups[0]).toMatchObject({
      mode: 'all',
      quests: [{ questId: 291 }, { questId: 946 }]
    })
    expect(alOperation?.prerequisiteGroups[0].provenance.map((entry) => entry.source)).toEqual([
      'wikiwiki',
      'kcwiki'
    ])
    const decisiveBattle = getCuratedQuestKnowledge(948)
    const plan = buildQuestGoalPlan(948)

    expect(decisiveBattle?.prerequisiteGroups).toEqual([])
    expect(decisiveBattle?.conflicts).toHaveLength(1)
    expect(
      decisiveBattle?.conflicts[0].provenance.map((entry) => entry.source)
    ).toEqual(['wikiwiki', 'kcwiki'])
    expect(
      decisiveBattle?.conflicts[0].details.map((detail) => ({
        source: detail.source,
        questIds: detail.prerequisiteGroups[0].quests.map(
          (quest) => quest.questId
        ),
        complete: detail.prerequisitesComplete
      }))
    ).toEqual([
      {
        source: 'wikiwiki',
        questIds: [925, 947],
        complete: false
      },
      {
        source: 'kcwiki',
        questIds: [925, 947],
        complete: true
      }
    ])
    expect(plan?.steps.map((step) => step.questId)).toEqual([948])
    expect(plan?.conflictCount).toBe(1)
  })

  it('includes the reviewed September yearly sortie prerequisites', () => {
    const tenthAreaFleet = getCuratedQuestKnowledge(928)
    const plan = buildQuestGoalPlan(928)
    const stepIds = plan?.steps.map((step) => step.questId) ?? []

    expect(tenthAreaFleet?.prerequisiteGroups[0]).toMatchObject({
      mode: 'all',
      quests: [{ questId: 237 }, { questId: 927 }]
    })
    expect(
      tenthAreaFleet?.prerequisiteGroups[0].provenance.map((entry) => entry.source)
    ).toEqual(['wikiwiki', 'kcwiki'])
    expect(stepIds.indexOf(237)).toBeLessThan(stepIds.indexOf(928))
    expect(stepIds.indexOf(927)).toBeLessThan(stepIds.indexOf(928))
    expect(plan?.conflictCount).toBe(0)
    expect(plan?.hasCycle).toBe(false)
  })

  it('surfaces the disputed May yearly sortie prerequisites by source', () => {
    const jointFleet = getCuratedQuestKnowledge(973)
    const plan = buildQuestGoalPlan(973)

    expect(jointFleet?.prerequisiteGroups).toEqual([])
    expect(jointFleet?.conflicts).toHaveLength(1)
    expect(
      jointFleet?.conflicts[0].details.map((detail) => ({
        source: detail.source,
        questIds: detail.prerequisiteGroups.flatMap((group) =>
          group.quests.map((quest) => quest.questId)
        ),
        complete: detail.prerequisitesComplete
      }))
    ).toEqual([
      {
        source: 'wikiwiki',
        questIds: [],
        complete: false
      },
      {
        source: 'kcwiki',
        questIds: [818],
        complete: true
      }
    ])
    expect(plan?.steps.map((step) => step.questId)).toEqual([973])
    expect(plan?.conflictCount).toBe(1)
  })

  it('retains the reviewed April yearly prerequisites without resolving uncertain evidence', () => {
    const cases = [
      {
        questId: 1045,
        kind: 'source-disagreement',
        statuses: ['incomplete', 'verified'],
        questIds: [[931, 1025], []]
      },
      {
        questId: 362,
        kind: 'source-disagreement',
        statuses: ['incomplete', 'verified'],
        questIds: [[149], [149]]
      },
      {
        questId: 371,
        kind: 'unresolved-review',
        statuses: ['under-review', 'under-review'],
        questIds: [[1006, 350], [1006, 350]]
      }
    ] as const

    for (const expected of cases) {
      const knowledge = getCuratedQuestKnowledge(expected.questId)
      const plan = buildQuestGoalPlan(expected.questId)

      expect(knowledge?.prerequisiteGroups).toEqual([])
      expect(knowledge?.conflicts).toHaveLength(1)
      expect(knowledge?.conflicts[0].kind).toBe(expected.kind)
      expect(
        knowledge?.conflicts[0].details.map((detail) => ({
          source: detail.source,
          status: detail.reviewStatus,
          questIds: detail.prerequisiteGroups.flatMap((group) =>
            group.quests.map((quest) => quest.questId)
          )
        }))
      ).toEqual(
        expected.statuses.map((status, index) => ({
          source: index === 0 ? 'wikiwiki' : 'kcwiki',
          status,
          questIds: expected.questIds[index]
        }))
      )
      expect(plan?.steps.map((step) => step.questId)).toEqual([
        expected.questId
      ])
      expect(plan?.conflictCount).toBe(1)
    }
  })

  it('retains the remaining reviewed May yearly prerequisites without promoting tentative claims', () => {
    const cases = [
      {
        questId: 975,
        statuses: ['verified', 'under-review'],
        questIds: [[356], [356]]
      },
      {
        questId: 1012,
        statuses: ['incomplete', 'under-review'],
        questIds: [[], [216, 118]]
      },
      {
        questId: 356,
        statuses: ['verified', 'under-review'],
        questIds: [[974], [974]]
      }
    ] as const

    for (const expected of cases) {
      const knowledge = getCuratedQuestKnowledge(expected.questId)
      const plan = buildQuestGoalPlan(expected.questId)

      expect(knowledge?.prerequisiteGroups).toEqual([])
      expect(knowledge?.conflicts).toHaveLength(1)
      expect(knowledge?.conflicts[0].kind).toBe('source-disagreement')
      expect(
        knowledge?.conflicts[0].details.map((detail) => ({
          source: detail.source,
          status: detail.reviewStatus,
          questIds: detail.prerequisiteGroups.flatMap((group) =>
            group.quests.map((quest) => quest.questId)
          )
        }))
      ).toEqual(
        expected.statuses.map((status, index) => ({
          source: index === 0 ? 'wikiwiki' : 'kcwiki',
          status,
          questIds: expected.questIds[index]
        }))
      )
      expect(plan?.steps.map((step) => step.questId)).toEqual([
        expected.questId
      ])
      expect(plan?.conflictCount).toBe(1)
    }
  })

  it('retains the remaining reviewed June practice prerequisites as source conflicts', () => {
    const cases = [
      {
        questId: 353,
        statuses: ['incomplete', 'under-review'],
        questIds: [[320], []]
      },
      {
        questId: 372,
        statuses: ['incomplete', 'verified'],
        questIds: [[348], [348, 126]]
      }
    ] as const

    for (const expected of cases) {
      const knowledge = getCuratedQuestKnowledge(expected.questId)
      const plan = buildQuestGoalPlan(expected.questId)

      expect(knowledge?.prerequisiteGroups).toEqual([])
      expect(knowledge?.conflicts).toHaveLength(1)
      expect(knowledge?.conflicts[0].kind).toBe('source-disagreement')
      expect(
        knowledge?.conflicts[0].details.map((detail) => ({
          source: detail.source,
          status: detail.reviewStatus,
          questIds: detail.prerequisiteGroups.flatMap((group) =>
            group.quests.map((quest) => quest.questId)
          )
        }))
      ).toEqual(
        expected.statuses.map((status, index) => ({
          source: index === 0 ? 'wikiwiki' : 'kcwiki',
          status,
          questIds: expected.questIds[index]
        }))
      )
      expect(plan?.steps.map((step) => step.questId)).toEqual([
        expected.questId
      ])
      expect(plan?.conflictCount).toBe(1)
    }
  })

  it('retains reviewed July through October yearly evidence without promoting tentative claims', () => {
    const cases = [
      {
        questId: 368,
        kind: 'source-disagreement',
        statuses: ['incomplete', 'verified'],
        questIds: [[224], [224]]
      },
      {
        questId: 373,
        kind: 'source-disagreement',
        statuses: ['verified', 'under-review'],
        questIds: [[358, 406], [358, 406]]
      },
      {
        questId: 438,
        kind: 'source-disagreement',
        statuses: ['incomplete', 'under-review'],
        questIds: [[], []]
      },
      {
        questId: 375,
        kind: 'source-disagreement',
        statuses: ['incomplete', 'under-review'],
        questIds: [[], [118, 223]]
      },
      {
        questId: 345,
        kind: 'source-disagreement',
        statuses: ['verified', 'under-review'],
        questIds: [[322, 343], [322, 343]]
      },
      {
        questId: 346,
        kind: 'unresolved-review',
        statuses: ['under-review', 'under-review'],
        questIds: [[197, 323], [197, 323]]
      },
      {
        questId: 355,
        kind: 'source-disagreement',
        statuses: ['incomplete', 'under-review'],
        questIds: [[884], [884]]
      },
      {
        questId: 377,
        kind: 'unresolved-review',
        statuses: ['under-review', 'under-review'],
        questIds: [[1006, 1017], [1006, 1017]]
      },
      {
        questId: 1005,
        kind: 'source-disagreement',
        statuses: ['incomplete', 'under-review'],
        questIds: [[198], [198]]
      },
      {
        questId: 348,
        kind: 'source-disagreement',
        statuses: ['incomplete', 'under-review'],
        questIds: [[], []]
      }
    ] as const

    for (const expected of cases) {
      const knowledge = getCuratedQuestKnowledge(expected.questId)
      const plan = buildQuestGoalPlan(expected.questId)

      expect(knowledge?.prerequisiteGroups).toEqual([])
      expect(knowledge?.conflicts).toHaveLength(1)
      expect(knowledge?.conflicts[0].kind).toBe(expected.kind)
      expect(
        knowledge?.conflicts[0].details.map((detail) => ({
          source: detail.source,
          status: detail.reviewStatus,
          questIds: detail.prerequisiteGroups.flatMap((group) =>
            group.quests.map((quest) => quest.questId)
          )
        }))
      ).toEqual(
        expected.statuses.map((status, index) => ({
          source: index === 0 ? 'wikiwiki' : 'kcwiki',
          status,
          questIds: expected.questIds[index]
        }))
      )
      expect(plan?.steps.map((step) => step.questId)).toEqual([
        expected.questId
      ])
      expect(plan?.conflictCount).toBe(1)
    }
  })

  it('includes reviewed yearly practice and expedition prerequisites', () => {
    const carrierPractice = getCuratedQuestKnowledge(354)
    const yamatoPractice = getCuratedQuestKnowledge(357)
    const trainingExpedition = getCuratedQuestKnowledge(436)
    const ogasawaraExpedition = getCuratedQuestKnowledge(437)
    const expandedLogistics = getCuratedQuestKnowledge(440)
    const plan = buildQuestGoalPlan(440)
    const stepIds = plan?.steps.map((step) => step.questId) ?? []

    expect(carrierPractice?.prerequisiteGroups[0].quests).toEqual([
      { questId: 343, title: '航空母艦演習' }
    ])
    expect(yamatoPractice?.prerequisiteGroups).toEqual([])
    expect(yamatoPractice?.conflicts).toHaveLength(1)
    expect(
      yamatoPractice?.conflicts[0].provenance.map((entry) => entry.source)
    ).toEqual(['wikiwiki', 'kcwiki'])
    expect(
      yamatoPractice?.conflicts[0].details.map((detail) =>
        detail.prerequisiteGroups[0].quests.map((quest) => quest.questId)
      )
    ).toEqual([[343], [343, 610]])
    expect(trainingExpedition?.prerequisiteGroups[0].quests).toEqual([
      {
        questId: 432,
        title: '警備及び哨戒偵察を強化せよ！'
      }
    ])
    expect(ogasawaraExpedition?.prerequisiteGroups[0]).toMatchObject({
      mode: 'all',
      quests: [{ questId: 425 }, { questId: 432 }]
    })
    expect(
      ogasawaraExpedition?.prerequisiteGroups[0].provenance.map(
        (entry) => entry.source
      )
    ).toEqual(['wikiwiki', 'kcwiki'])
    expect(expandedLogistics?.prerequisiteGroups[0]).toMatchObject({
      mode: 'all',
      quests: [{ questId: 433 }, { questId: 439 }]
    })
    expect(
      expandedLogistics?.prerequisiteGroups[0].provenance.map(
        (entry) => entry.source
      )
    ).toEqual(['wikiwiki', 'kcwiki'])
    expect(carrierPractice?.prerequisiteGroups[0].provenance[0].url).toBe(
      'https://wikiwiki.jp/kancolle/任務/演習任務'
    )
    expect(trainingExpedition?.prerequisiteGroups[0].provenance[0].url).toBe(
      'https://wikiwiki.jp/kancolle/任務/遠征任務'
    )
    expect(stepIds.indexOf(433)).toBeLessThan(stepIds.indexOf(440))
    expect(stepIds.indexOf(439)).toBeLessThan(stepIds.indexOf(440))
    expect(plan?.conflictCount).toBe(0)
    expect(plan?.hasCycle).toBe(false)
  })

  it('retains reviewed yearly modernization evidence without promoting tentative claims', () => {
    const cases = [
      {
        questId: 714,
        kind: 'source-disagreement',
        statuses: ['incomplete', 'under-review'],
        questIds: [[], [612, 701]]
      },
      {
        questId: 715,
        kind: 'unresolved-review',
        statuses: ['under-review', 'under-review'],
        questIds: [[714, 607], [714, 607]]
      },
      {
        questId: 716,
        kind: 'source-disagreement',
        statuses: ['incomplete', 'under-review'],
        questIds: [[], [612, 701]]
      },
      {
        questId: 717,
        kind: 'source-disagreement',
        statuses: ['incomplete', 'under-review'],
        questIds: [[716], [716, 704]]
      }
    ] as const

    for (const expected of cases) {
      const knowledge = getCuratedQuestKnowledge(expected.questId)
      const plan = buildQuestGoalPlan(expected.questId)

      expect(knowledge?.prerequisiteGroups).toEqual([])
      expect(knowledge?.conflicts).toHaveLength(1)
      expect(knowledge?.conflicts[0].kind).toBe(expected.kind)
      expect(
        knowledge?.conflicts[0].details.map((detail) => ({
          source: detail.source,
          status: detail.reviewStatus,
          questIds: detail.prerequisiteGroups.flatMap((group) =>
            group.quests.map((quest) => quest.questId)
          )
        }))
      ).toEqual(
        expected.statuses.map((status, index) => ({
          source: index === 0 ? 'wikiwiki' : 'kcwiki',
          status,
          questIds: expected.questIds[index]
        }))
      )
      expect(knowledge?.conflicts[0].details[0].url).toBe(
        'https://wikiwiki.jp/kancolle/任務/改装任務'
      )
      expect(plan?.steps.map((step) => step.questId)).toEqual([
        expected.questId
      ])
      expect(plan?.conflictCount).toBe(1)
    }
  })

  it('includes the reviewed quarterly expedition chain with category-specific provenance', () => {
    const antiSubmarine = getCuratedQuestKnowledge(428)
    const plan = buildQuestGoalPlan(428)
    const stepIds = plan?.steps.map((step) => step.questId) ?? []

    expect(antiSubmarine?.prerequisiteGroups[0]).toMatchObject({
      mode: 'all',
      quests: [{ questId: 426 }, { questId: 427 }]
    })
    expect(
      antiSubmarine?.prerequisiteGroups[0].provenance.map(
        (entry) => entry.source
      )
    ).toEqual(['wikiwiki', 'kcwiki'])
    expect(antiSubmarine?.prerequisiteGroups[0].provenance[0].url).toBe(
      'https://wikiwiki.jp/kancolle/任務/遠征任務'
    )
    expect(stepIds.indexOf(426)).toBeLessThan(stepIds.indexOf(428))
    expect(stepIds.indexOf(427)).toBeLessThan(stepIds.indexOf(428))
    expect(plan?.conflictCount).toBe(0)
    expect(plan?.hasCycle).toBe(false)
  })

  it('includes reviewed quarterly and yearly factory prerequisites', () => {
    const quarterlyLandAttack = getCuratedQuestKnowledge(643)
    const quarterlyResearch = getCuratedQuestKnowledge(663)
    const quarterlyIntegration = getCuratedQuestKnowledge(675)
    const quarterlyAntiAir = getCuratedQuestKnowledge(680)
    const yearlySubmarine = getCuratedQuestKnowledge(1103)

    expect(quarterlyLandAttack?.prerequisiteGroups[0]).toMatchObject({
      mode: 'all',
      quests: [{ questId: 642 }, { questId: 410 }]
    })
    expect(quarterlyResearch?.prerequisiteGroups[0].quests).toEqual([
      { questId: 425, title: '海上護衛総隊、遠征開始！' }
    ])
    expect(quarterlyIntegration?.prerequisiteGroups[0]).toMatchObject({
      mode: 'all',
      quests: [{ questId: 617 }, { questId: 674 }]
    })
    expect(quarterlyAntiAir?.prerequisiteGroups[0]).toMatchObject({
      mode: 'all',
      quests: [{ questId: 679 }, { questId: 605 }]
    })
    expect(yearlySubmarine?.prerequisiteGroups[0]).toMatchObject({
      mode: 'all',
      quests: [{ questId: 658 }, { questId: 1101 }]
    })

    for (const questId of [643, 663, 675, 680, 1103]) {
      const knowledge = getCuratedQuestKnowledge(questId)
      const plan = buildQuestGoalPlan(questId)
      expect(
        knowledge?.prerequisiteGroups[0].provenance.map(
          (entry) => entry.source
        )
      ).toEqual(['wikiwiki', 'kcwiki'])
      expect(knowledge?.prerequisiteGroups[0].provenance[0].url).toBe(
        'https://wikiwiki.jp/kancolle/任務/工廠任務'
      )
      expect(plan?.steps.at(-1)?.questId).toBe(questId)
      expect(plan?.conflictCount).toBe(0)
      expect(plan?.hasCycle).toBe(false)
    }

    const landAttackSteps =
      buildQuestGoalPlan(643)?.steps.map((step) => step.questId) ?? []
    expect(landAttackSteps.indexOf(642)).toBeLessThan(
      landAttackSteps.indexOf(643)
    )
    expect(landAttackSteps.indexOf(410)).toBeLessThan(
      landAttackSteps.indexOf(643)
    )

    const integrationSteps =
      buildQuestGoalPlan(675)?.steps.map((step) => step.questId) ?? []
    expect(integrationSteps.indexOf(617)).toBeLessThan(
      integrationSteps.indexOf(675)
    )
    expect(integrationSteps.indexOf(674)).toBeLessThan(
      integrationSteps.indexOf(675)
    )

    const antiAirSteps =
      buildQuestGoalPlan(680)?.steps.map((step) => step.questId) ?? []
    expect(antiAirSteps.indexOf(679)).toBeLessThan(
      antiAirSteps.indexOf(680)
    )
    expect(antiAirSteps.indexOf(605)).toBeLessThan(
      antiAirSteps.indexOf(680)
    )

    const submarineSteps =
      buildQuestGoalPlan(1103)?.steps.map((step) => step.questId) ?? []
    expect(submarineSteps.indexOf(658)).toBeLessThan(
      submarineSteps.indexOf(1103)
    )
    expect(submarineSteps.indexOf(1101)).toBeLessThan(
      submarineSteps.indexOf(1103)
    )
  })

  it('retains disputed quarterly factory prerequisites without resolving them', () => {
    const cases = [
      {
        questId: 678,
        statuses: ['verified', 'verified'],
        questIds: [[216], [216, 209]]
      },
      {
        questId: 686,
        statuses: ['verified', 'incomplete'],
        questIds: [[685, 680], [685, 680]]
      },
      {
        questId: 688,
        statuses: ['verified', 'verified'],
        questIds: [[674], [674, 117]]
      },
      {
        questId: 653,
        statuses: ['verified', 'verified'],
        questIds: [[607], [208, 607]]
      }
    ] as const

    for (const expected of cases) {
      const knowledge = getCuratedQuestKnowledge(expected.questId)
      const plan = buildQuestGoalPlan(expected.questId)

      expect(knowledge?.prerequisiteGroups).toEqual([])
      expect(knowledge?.conflicts).toHaveLength(1)
      expect(knowledge?.conflicts[0].kind).toBe('source-disagreement')
      expect(
        knowledge?.conflicts[0].details.map((detail) => ({
          source: detail.source,
          status: detail.reviewStatus,
          questIds: detail.prerequisiteGroups.flatMap((group) =>
            group.quests.map((quest) => quest.questId)
          )
        }))
      ).toEqual(
        expected.statuses.map((status, index) => ({
          source: index === 0 ? 'wikiwiki' : 'kcwiki',
          status,
          questIds: expected.questIds[index]
        }))
      )
      expect(
        knowledge?.conflicts[0].details[0].url
      ).toBe('https://wikiwiki.jp/kancolle/任務/工廠任務')
      expect(plan?.steps.map((step) => step.questId)).toEqual([
        expected.questId
      ])
      expect(plan?.conflictCount).toBe(1)
    }
  })

  it('retains matching but unverified Fq1 evidence outside automatic reasoning', () => {
    const knowledge = getCuratedQuestKnowledge(637)
    const plan = buildQuestGoalPlan(637)

    expect(knowledge?.prerequisiteGroups).toEqual([])
    expect(knowledge?.conflicts).toHaveLength(1)
    expect(knowledge?.conflicts[0].kind).toBe('unresolved-review')
    expect(
      knowledge?.conflicts[0].details.map((detail) => ({
        source: detail.source,
        status: detail.reviewStatus,
        questIds: detail.prerequisiteGroups.flatMap((group) =>
          group.quests.map((quest) => quest.questId)
        )
      }))
    ).toEqual([
      {
        source: 'wikiwiki',
        status: 'under-review',
        questIds: [209]
      },
      {
        source: 'kcwiki',
        status: 'under-review',
        questIds: [209]
      }
    ])
    expect(knowledge?.conflicts[0].details[0].url).toBe(
      'https://wikiwiki.jp/kancolle/任務/工廠任務'
    )
    expect(plan?.steps.map((step) => step.questId)).toEqual([637])
    expect(plan?.conflictCount).toBe(1)
  })

  it('represents every currently catalogued quarterly sortie and factory target', () => {
    const quarterlySortieQuestIds = [
      822, 854, 861, 862, 873, 875, 888, 893, 894, 872, 284, 845, 903
    ]
    const quarterlyFactoryQuestIds = [
      637, 643, 663, 675, 678, 680, 686, 688, 653
    ]

    for (const questId of [
      ...quarterlySortieQuestIds,
      ...quarterlyFactoryQuestIds
    ]) {
      expect(getCuratedQuestKnowledge(questId)).toBeDefined()
      expect(getQuestStuff(questId)).toBeDefined()
    }
  })

  it('surfaces disputed yearly factory prerequisites without resolving them', () => {
    const development = getCuratedQuestKnowledge(657)
    const electronics = getCuratedQuestKnowledge(1104)

    expect(development?.prerequisiteGroups).toEqual([])
    expect(
      development?.conflicts[0].details.map((detail) => ({
        source: detail.source,
        questIds: detail.prerequisiteGroups[0].quests.map(
          (quest) => quest.questId
        ),
        reviewStatus: detail.reviewStatus
      }))
    ).toEqual([
      {
        source: 'wikiwiki',
        questIds: [617, 674],
        reviewStatus: 'under-review'
      },
      {
        source: 'kcwiki',
        questIds: [674],
        reviewStatus: 'verified'
      }
    ])
    expect(development?.conflicts[0].details[0].reviewNote).toContain(
      '#617 と #674'
    )

    expect(electronics?.prerequisiteGroups).toEqual([])
    expect(
      electronics?.conflicts[0].details.map((detail) => ({
        source: detail.source,
        questIds: detail.prerequisiteGroups[0].quests.map(
          (quest) => quest.questId
        ),
        reviewStatus: detail.reviewStatus,
        complete: detail.prerequisitesComplete
      }))
    ).toEqual([
      {
        source: 'wikiwiki',
        questIds: [1103],
        reviewStatus: 'incomplete',
        complete: false
      },
      {
        source: 'kcwiki',
        questIds: [1103],
        reviewStatus: 'verified',
        complete: true
      }
    ])

    for (const questId of [657, 1104]) {
      const plan = buildQuestGoalPlan(questId)
      expect(plan?.steps.map((step) => step.questId)).toEqual([questId])
      expect(plan?.conflictCount).toBe(1)
    }
  })

  it('retains the next reviewed yearly factory batch without resolving uncertain prerequisites', () => {
    const cases = [
      {
        questId: 681,
        kind: 'source-disagreement',
        statuses: ['incomplete', 'verified'],
        questIds: [[642], [642]]
      },
      {
        questId: 1123,
        kind: 'source-disagreement',
        statuses: ['incomplete', 'verified'],
        questIds: [[], [716]]
      },
      {
        questId: 1138,
        kind: 'unresolved-review',
        statuses: ['under-review', 'under-review'],
        questIds: [[372, 607], [372, 607]]
      },
      {
        questId: 1105,
        kind: 'source-disagreement',
        statuses: ['verified', 'incomplete'],
        questIds: [[647, 1102], [1102]]
      },
      {
        questId: 1107,
        kind: 'source-disagreement',
        statuses: ['incomplete', 'incomplete'],
        questIds: [[642], []]
      },
      {
        questId: 654,
        kind: 'source-disagreement',
        statuses: ['under-review', 'incomplete'],
        questIds: [[919, 619], [619]]
      },
      {
        questId: 655,
        kind: 'unresolved-review',
        statuses: ['incomplete', 'incomplete'],
        questIds: [[648], [648]]
      },
      {
        questId: 1120,
        kind: 'unresolved-review',
        statuses: ['incomplete', 'incomplete'],
        questIds: [[1102], [1102]]
      }
    ] as const

    for (const expected of cases) {
      const knowledge = getCuratedQuestKnowledge(expected.questId)
      const plan = buildQuestGoalPlan(expected.questId)

      expect(knowledge?.prerequisiteGroups).toEqual([])
      expect(knowledge?.conflicts).toHaveLength(1)
      expect(knowledge?.conflicts[0].kind).toBe(expected.kind)
      expect(
        knowledge?.conflicts[0].details.map((detail) => ({
          source: detail.source,
          status: detail.reviewStatus,
          questIds: detail.prerequisiteGroups.flatMap((group) =>
            group.quests.map((quest) => quest.questId)
          )
        }))
      ).toEqual(
        expected.statuses.map((status, index) => ({
          source: index === 0 ? 'wikiwiki' : 'kcwiki',
          status,
          questIds: expected.questIds[index]
        }))
      )
      expect(knowledge?.conflicts[0].details[0].url).toBe(
        'https://wikiwiki.jp/kancolle/任務/工廠任務'
      )
      expect(knowledge?.conflicts[0].details[1].url).toBe(
        'https://zh.kcwiki.cn/wiki/任务分类'
      )
      expect(plan?.steps.map((step) => step.questId)).toEqual([
        expected.questId
      ])
      expect(plan?.conflictCount).toBe(1)
    }
  })

  it('includes the reviewed early one-time sortie chain from both wiki sources', () => {
    const plan = buildQuestGoalPlan(209)
    const carrierSortie = getCuratedQuestKnowledge(209)

    expect(plan?.steps.map((step) => step.questId)).toEqual([
      202, 203, 204, 205, 206, 207, 208, 209
    ])
    expect(carrierSortie?.prerequisiteGroups[0].provenance).toEqual([
      expect.objectContaining({
        source: 'wikiwiki',
        url: 'https://wikiwiki.jp/kancolle/任務/出撃任務'
      }),
      expect.objectContaining({
        source: 'kcwiki',
        url: 'https://zh.kcwiki.cn/wiki/任务分类'
      })
    ])
  })

  it.each([
    [215, 115, '第２艦隊を編成せよ！'],
    [217, 117, '第２艦隊で空母機動部隊を編成せよ！'],
    [219, 119, '「三川艦隊」を編成せよ！'],
    [223, 121, '「第四戦隊」を編成せよ！'],
    [224, 122, '「西村艦隊」を編成せよ！'],
    [225, 123, '「第五航空戦隊」を編成せよ！'],
    [227, 124, '新「三川艦隊」を編成せよ！'],
    [231, 125, '潜水艦隊を編成せよ！'],
    [232, 126, '航空水上打撃艦隊を編成せよ！'],
    [233, 128, '「第六戦隊」を編成せよ！'],
    [239, 131, '「第八駆逐隊」を編成せよ！'],
    [240, 132, '「第十八駆逐隊」を編成せよ！'],
    [244, 133, '「第三十駆逐隊(第一次)」を編成せよ！'],
    [247, 412, '航空火力艦の運用を強化せよ！'],
    [248, 136, '「第三十駆逐隊(第二次)」を編成せよ！'],
    [250, 138, '新編「第二航空戦隊」を編成せよ！'],
    [251, 141, '再編成「第二航空戦隊」を強化せよ！'],
    [252, 248, '「第三十駆逐隊」対潜哨戒！'],
    [253, 143, '「新型正規空母」を配備せよ！'],
    [254, 105, '軽巡２隻を擁する隊を編成せよ！'],
    [255, 206, '「水雷戦隊」で出撃せよ！'],
    [258, 144, '主力戦艦部隊「第二戦隊」を編成せよ！'],
    [262, 147, '「西村艦隊」を再編成せよ！'],
    [263, 233, '「第六戦隊」出撃せよ！'],
    [267, 149, '「第十一駆逐隊」を編成せよ！'],
    [268, 149, '「第十一駆逐隊」を編成せよ！'],
    [269, 150, '「第二一駆逐隊」を編成せよ！'],
    [270, 151, '「第二二駆逐隊」を編成せよ！'],
    [272, 416, '防空射撃演習を実施せよ！'],
    [273, 307, '艦隊の練度向上に努めよ！'],
    [274, 120, '「第六駆逐隊」を編成せよ！'],
    [275, 153, '「第十八戦隊」を新編成せよ！'],
    [278, 156, '「第一水雷戦隊」北方突入準備！'],
    [279, 157, '「第一水雷戦隊」北方再突入準備！'],
    [287, 161, '「第五航空戦隊」を再編成せよ！'],
    [288, 162, '新編「第二一戦隊」出撃準備！'],
    [289, 163, '「第十六戦隊(第一次)」を編成せよ！'],
    [293, 164, '「第三航空戦隊」を編成せよ！'],
    [294, 166, '「小沢艦隊」を編成せよ！'],
    [295, 168, '「第十六戦隊(第二次)」を編成せよ！'],
    [814, 173, '強行高速輸送部隊を編成せよ！'],
    [817, 174, '新編「水雷戦隊」を含む艦隊を再編成せよ！'],
    [818, 817, '新編艦隊、南西諸島防衛線へ急行せよ！'],
    [820, 175, '新編「第八駆逐隊」を再編成せよ！'],
    [835, 178, '「第十六戦隊(第三次)」を編成せよ！'],
    [836, 179, '精鋭「第十六戦隊」を再編成せよ！'],
    [848, 846, '潜水艦隊、中部海域の哨戒を実施せよ！']
  ])(
    'includes the reviewed formation prerequisite for one-time sortie %i (formation %i)',
    (questId, prerequisiteId, prerequisiteTitle) => {
      const knowledge = getCuratedQuestKnowledge(questId)

      expect(knowledge?.prerequisiteGroups).toHaveLength(1)
      expect(knowledge?.prerequisiteGroups[0]).toMatchObject({
        mode: 'all',
        quests: [
          {
            questId: prerequisiteId,
            title: prerequisiteTitle
          }
        ]
      })
      expect(knowledge?.prerequisiteGroups[0].provenance.map((entry) => entry.source)).toEqual([
        'wikiwiki',
        'kcwiki'
      ])
    }
  )

  it('keeps the disputed B12 prerequisite out of the curated graph', () => {
    expect(getCuratedQuestKnowledge(222)).toBeUndefined()
  })

  it('orders reviewed formation tasks before their one-time sortie goals', () => {
    const plan = buildQuestGoalPlan(233)
    const formation = getCuratedQuestKnowledge(128)

    expect(plan?.steps.map((step) => step.questId)).toEqual([128, 233])
    expect(formation?.downstream.map((entry) => entry.questId)).toContain(233)
  })

  it('orders the reviewed A34 to B24 to B27 one-time chain', () => {
    const plan = buildQuestGoalPlan(252)

    expect(plan?.steps.map((step) => step.questId)).toEqual([136, 248, 252])
    expect(plan?.conflictCount).toBe(0)
    expect(plan?.hasCycle).toBe(false)
  })

  it('preserves both reviewed prerequisites for the B38 one-time goal', () => {
    const knowledge = getCuratedQuestKnowledge(271)
    const plan = buildQuestGoalPlan(271)
    const stepIds = plan?.steps.map((step) => step.questId) ?? []

    expect(knowledge?.prerequisiteGroups[0]).toMatchObject({
      mode: 'all',
      quests: [{ questId: 269 }, { questId: 249 }]
    })
    expect(knowledge?.prerequisiteGroups[0].provenance.map((entry) => entry.source)).toEqual([
      'wikiwiki',
      'kcwiki'
    ])
    expect(stepIds.indexOf(150)).toBeLessThan(stepIds.indexOf(269))
    expect(stepIds.indexOf(269)).toBeLessThan(stepIds.indexOf(271))
    expect(stepIds.indexOf(137)).toBeLessThan(stepIds.indexOf(249))
    expect(stepIds.indexOf(249)).toBeLessThan(stepIds.indexOf(271))
    expect(plan?.conflictCount).toBe(0)
  })

  it.each([
    [
      276,
      [
        [154, '海上突入部隊を編成せよ！'],
        [243, '南方海域珊瑚諸島沖の制空権を握れ！']
      ]
    ],
    [
      277,
      [
        [155, '新編「第六駆逐隊」を編成せよ！'],
        [274, '「第六駆逐隊」対潜哨戒なのです！']
      ]
    ],
    [
      297,
      [
        [170, '精強な「水上反撃部隊」を再編成せよ！'],
        [265, '海上護衛強化月間']
      ]
    ],
    [
      812,
      [
        [811, '南西諸島防衛線を強化せよ！'],
        [239, '「第八駆逐隊」出撃せよ！']
      ]
    ],
    [
      813,
      [
        [812, 'オリョール海の制海権を確保せよ！'],
        [806, '旗艦「霞」出撃！敵艦隊を撃滅せよ！']
      ]
    ],
    [
      815,
      [
        [814, '強行高速輸送部隊、出撃せよ！'],
        [636, '上陸戦用新装備の調達']
      ]
    ],
    [
      819,
      [
        [171, '「第三十一戦隊(第一次)」を編成せよ！'],
        [228, '海上護衛戦']
      ]
    ],
    [
      844,
      [
        [820, '新編「第八駆逐隊」出撃せよ！'],
        [829, '夜間突入！敵上陸部隊を叩け！']
      ]
    ],
    [
      846,
      [
        [815, '「第一航空戦隊」西へ！'],
        [218, '敵補給艦を 3 隻撃沈せよ！']
      ]
    ],
    [
      851,
      [
        [838, '重巡戦隊、抜錨せよ！'],
        [287, '「第五航空戦隊」珊瑚諸島沖に出撃せよ！']
      ]
    ],
    [
      864,
      [
        [185, '精強「任務部隊」を編成せよ！'],
        [216, '敵艦隊主力を撃滅せよ！']
      ]
    ],
    [
      871,
      [
        [186, '最精鋭「第八駆逐隊」を編成せよ！'],
        [429, '「捷一号作戦」、発動準備！']
      ]
    ],
    [
      877,
      [
        [189, '精鋭「四水戦」抜錨準備！'],
        [860, '旗艦「由良」、抜錨！']
      ]
    ],
    [
      880,
      [
        [320, '駆逐隊、特訓始め！'],
        [680, '対空兵装の整備拡充']
      ]
    ],
    [
      881,
      [
        [192, '精鋭「第十八駆逐隊」を編成せよ！'],
        [230, '敵潜水艦を制圧せよ！']
      ]
    ],
    [
      292,
      [
        [290, '「比叡」の出撃'],
        [303, '「演習」で練度向上！']
      ]
    ],
    [
      902,
      [
        [901, '「夕張改二」試してみてもいいかしら？']
      ]
    ],
    [
      929,
      [
        [231, '「潜水艦隊」出撃せよ！'],
        [235, '近海哨戒を実施せよ！']
      ]
    ],
    [
      847,
      [
        [298, '「第七駆逐隊」、南西諸島を駆ける！'],
        [299, '近海の警戒監視と哨戒活動を強化せよ！']
      ]
    ],
    [
      937,
      [
        [298, '「第七駆逐隊」、南西諸島を駆ける！'],
        [235, '近海哨戒を実施せよ！']
      ]
    ],
    [
      943,
      [
        [279, '「第一水雷戦隊」北方ケ号作戦、再突入！'],
        [420, '機動部隊の運用を強化せよ！']
      ]
    ],
    [
      949,
      [
        [923, '合同艦隊機動部隊、出撃せよ！'],
        [933, '【艦隊司令部強化】艦隊旗艦、出撃せよ！']
      ]
    ],
    [
      957,
      [
        [235, '近海哨戒を実施せよ！']
      ]
    ],
    [
      958,
      [
        [236, '精鋭「二四駆逐隊」出撃せよ！'],
        [957, '「山風改二」、抜錨せよ！']
      ]
    ],
    [
      967,
      [
        [966, '南西海域「基地航空隊」開設！']
      ]
    ],
    [
      968,
      [
        [967, '海上護衛！ヒ船団を護り抜け！']
      ]
    ],
    [
      969,
      [
        [844, '精鋭「第八駆逐隊」突入せよ！'],
        [967, '海上護衛！ヒ船団を護り抜け！']
      ]
    ],
    [
      996,
      [
        [292, '「比叡改二丙」見参！第三戦隊、南方突入！']
      ]
    ],
    [
      1001,
      [
        [806, '旗艦「霞」出撃！敵艦隊を撃滅せよ！'],
        [970, '第十六戦隊、改装「浦波改二」出撃します！']
      ]
    ],
    [
      1007,
      [
        [290, '「比叡」の出撃'],
        [1006, '「第二駆逐隊」抜錨！']
      ]
    ],
    [
      1033,
      [
        [636, '上陸戦用新装備の調達'],
        [933, '【艦隊司令部強化】艦隊旗艦、出撃せよ！']
      ]
    ]
  ])('preserves reviewed AND prerequisites for one-time sortie %i', (questId, prerequisites) => {
    const knowledge = getCuratedQuestKnowledge(questId)
    const plan = buildQuestGoalPlan(questId)

    expect(knowledge?.prerequisiteGroups).toHaveLength(1)
    expect(knowledge?.prerequisiteGroups[0]).toMatchObject({
      mode: 'all',
      quests: prerequisites.map(([prerequisiteId, title]) => ({
        questId: prerequisiteId,
        title
      }))
    })
    expect(knowledge?.prerequisiteGroups[0].provenance.map((entry) => entry.source)).toEqual([
      'wikiwiki',
      'kcwiki'
    ])
    for (const [prerequisiteId] of prerequisites) {
      expect(plan?.steps.map((step) => step.questId)).toContain(prerequisiteId)
    }
    expect(plan?.steps.at(-1)?.questId).toBe(questId)
    expect(plan?.conflictCount).toBe(0)
  })

  it('orders the reviewed B81-B100 prerequisite paths before their goals', () => {
    const b90Steps = buildQuestGoalPlan(844)?.steps.map((step) => step.questId) ?? []
    const b92Steps = buildQuestGoalPlan(848)?.steps.map((step) => step.questId) ?? []
    const b95Steps = buildQuestGoalPlan(851)?.steps.map((step) => step.questId) ?? []

    expect(b90Steps.indexOf(175)).toBeLessThan(b90Steps.indexOf(820))
    expect(b90Steps.indexOf(820)).toBeLessThan(b90Steps.indexOf(844))
    expect(b90Steps.indexOf(829)).toBeLessThan(b90Steps.indexOf(844))

    expect(b92Steps.indexOf(815)).toBeLessThan(b92Steps.indexOf(846))
    expect(b92Steps.indexOf(218)).toBeLessThan(b92Steps.indexOf(846))
    expect(b92Steps.indexOf(846)).toBeLessThan(b92Steps.indexOf(848))

    expect(b95Steps.indexOf(161)).toBeLessThan(b95Steps.indexOf(287))
    expect(b95Steps.indexOf(287)).toBeLessThan(b95Steps.indexOf(851))
    expect(b95Steps.indexOf(838)).toBeLessThan(b95Steps.indexOf(851))
  })

  it('orders the reviewed B101-B120 prerequisite paths before their goals', () => {
    for (const [questId, prerequisiteIds] of [
      [864, [185, 216]],
      [871, [186, 429]],
      [877, [189, 860]],
      [880, [320, 680]],
      [881, [192, 230]]
    ] as const) {
      const stepIds = buildQuestGoalPlan(questId)?.steps.map((step) => step.questId) ?? []

      for (const prerequisiteId of prerequisiteIds) {
        expect(stepIds.indexOf(prerequisiteId)).toBeLessThan(stepIds.indexOf(questId))
      }
      expect(stepIds.at(-1)).toBe(questId)
    }
  })

  it('orders the reviewed B121-B140 prerequisite path before its goal', () => {
    const stepIds = buildQuestGoalPlan(292)?.steps.map((step) => step.questId) ?? []

    expect(stepIds.indexOf(290)).toBeLessThan(stepIds.indexOf(292))
    expect(stepIds.indexOf(303)).toBeLessThan(stepIds.indexOf(292))
    expect(stepIds.at(-1)).toBe(292)
  })

  it('orders the reviewed B141-B160 prerequisite paths before their goals', () => {
    for (const [questId, prerequisiteIds] of [
      [902, [901]],
      [929, [231, 235]]
    ] as const) {
      const stepIds = buildQuestGoalPlan(questId)?.steps.map((step) => step.questId) ?? []

      for (const prerequisiteId of prerequisiteIds) {
        expect(stepIds.indexOf(prerequisiteId)).toBeLessThan(stepIds.indexOf(questId))
      }
      expect(stepIds.at(-1)).toBe(questId)
    }
  })

  it('orders the reviewed B161-B180 prerequisite paths before their goals', () => {
    for (const [questId, prerequisiteIds] of [
      [847, [298, 299]],
      [937, [298, 235]],
      [943, [279, 420]],
      [949, [923, 933]],
      [957, [235]],
      [958, [236, 957]],
      [967, [966]],
      [968, [967]],
      [969, [844, 967]]
    ] as const) {
      const stepIds = buildQuestGoalPlan(questId)?.steps.map((step) => step.questId) ?? []

      for (const prerequisiteId of prerequisiteIds) {
        expect(stepIds.indexOf(prerequisiteId)).toBeLessThan(stepIds.indexOf(questId))
      }
      expect(stepIds.at(-1)).toBe(questId)
    }
  })

  it('orders the reviewed B181-B200 prerequisite paths before their goals', () => {
    for (const [questId, prerequisiteIds] of [
      [996, [292]],
      [1001, [806, 970]],
      [1007, [290, 1006]]
    ] as const) {
      const stepIds = buildQuestGoalPlan(questId)?.steps.map((step) => step.questId) ?? []

      for (const prerequisiteId of prerequisiteIds) {
        expect(stepIds.indexOf(prerequisiteId)).toBeLessThan(stepIds.indexOf(questId))
      }
      expect(stepIds.at(-1)).toBe(questId)
    }
  })

  it('orders the reviewed B201-B216 prerequisite path before its goal', () => {
    const stepIds = buildQuestGoalPlan(1033)?.steps.map((step) => step.questId) ?? []

    expect(stepIds.indexOf(636)).toBeLessThan(stepIds.indexOf(1033))
    expect(stepIds.indexOf(933)).toBeLessThan(stepIds.indexOf(1033))
    expect(stepIds.at(-1)).toBe(1033)
  })

  it('keeps the disputed B32 prerequisite out of the curated graph', () => {
    expect(getCuratedQuestKnowledge(260)).toBeUndefined()
  })

  it('keeps disputed B48-B60 relationships out of automatic reasoning', () => {
    for (const questId of [285, 286, 296, 805, 807]) {
      expect(getCuratedQuestKnowledge(questId)).toBeUndefined()
    }
    expect(
      getCuratedQuestKnowledge(806)?.prerequisiteGroups ?? []
    ).toHaveLength(0)

    expect(
      listCuratedQuestKnowledge().some((entry) =>
        entry.prerequisiteGroups.length > 0 &&
        [
            '旗艦「霞」北方海域を哨戒せよ！',
            '旗艦「霞」出撃！敵艦隊を撃滅せよ！',
            '「第三十一戦隊」出撃せよ！'
          ].includes(entry.questTitle)
      )
    ).toBe(false)
  })

  it('keeps disputed B61-B80 relationships out of automatic reasoning', () => {
    for (const questId of [808, 809, 810, 811, 816, 823, 824, 825, 826, 827, 828]) {
      expect(
        getCuratedQuestKnowledge(questId)?.prerequisiteGroups ?? []
      ).toHaveLength(0)
    }
  })

  it('keeps disputed B81-B100 relationships out of automatic reasoning', () => {
    for (const questId of [
      829, 830, 834, 837, 838, 839, 842, 849, 850, 852, 853, 855, 856, 857
    ]) {
      expect(
        getCuratedQuestKnowledge(questId)?.prerequisiteGroups ?? []
      ).toHaveLength(0)
    }
  })

  it('keeps disputed B101-B120 relationships out of automatic reasoning', () => {
    for (const questId of [
      858, 859, 860, 863, 865, 869, 870, 874, 876, 878, 879, 884, 885, 886,
      887
    ]) {
      expect(
        getCuratedQuestKnowledge(questId)?.prerequisiteGroups ?? []
      ).toHaveLength(0)
    }
  })

  it('keeps disputed B121-B140 relationships out of automatic reasoning', () => {
    for (const questId of [
      889, 890, 891, 298, 299, 892, 895, 290, 281, 282, 896, 897, 291, 235,
      236, 283, 237, 833, 901
    ]) {
      expect(
        getCuratedQuestKnowledge(questId)?.prerequisiteGroups ?? []
      ).toHaveLength(0)
    }
  })

  it('keeps disputed B141-B160 relationships out of automatic reasoning', () => {
    for (const questId of [
      911, 913, 916, 917, 918, 919, 920, 921, 922, 923, 924, 925, 926, 927,
      930, 931, 933, 934
    ]) {
      expect(
        getCuratedQuestKnowledge(questId)?.prerequisiteGroups ?? []
      ).toHaveLength(0)
    }
  })

  it('keeps disputed B161-B180 relationships out of automatic reasoning', () => {
    for (const questId of [935, 898, 936, 938, 939, 940, 952, 961, 966, 970, 974]) {
      expect(
        getCuratedQuestKnowledge(questId)?.prerequisiteGroups ?? []
      ).toHaveLength(0)
    }
  })

  it('keeps disputed B181-B200 relationships out of automatic reasoning', () => {
    for (const questId of [
      976, 977, 978, 980, 981, 982, 983, 989, 995, 997, 998, 993, 1003,
      1004, 1006, 1008, 1013
    ]) {
      expect(
        getCuratedQuestKnowledge(questId)?.prerequisiteGroups ?? []
      ).toHaveLength(0)
    }
  })

  it('keeps disputed B201-B216 relationships out of automatic reasoning', () => {
    for (const questId of [
      1014, 1015, 1016, 1017, 1019, 1021, 1023, 1025, 1029, 1036, 1010,
      1041, 1042, 1044, 1047
    ]) {
      expect(
        getCuratedQuestKnowledge(questId)?.prerequisiteGroups ?? []
      ).toHaveLength(0)
    }
  })

  it('keeps the local API mapping for the monthly and one-time sortie ids distinct', () => {
    expect(getCuratedQuestKnowledge(266)?.questTitle).toBe('「水上反撃部隊」突入せよ！')
    expect(getCuratedQuestKnowledge(267)?.questTitle).toBe('「第十一駆逐隊」出撃せよ！')
  })

  it.each([273, 274, 275, 276, 277, 278, 279, 287, 288, 289, 293, 294, 295, 297])(
    'maps reviewed B41-B57 target %i to a bundled quest definition',
    (questId) => {
      expect(getQuestStuff(questId)).toBeDefined()
    }
  )

  it.each([290, 292, 303])(
    'maps reviewed B133 quest id %i to a bundled quest definition',
    (questId) => {
      expect(getQuestStuff(questId)).toBeDefined()
    }
  )

  it.each([231, 235, 901, 902, 929])(
    'maps reviewed B141-B160 quest id %i to a bundled quest definition',
    (questId) => {
      expect(getQuestStuff(questId)).toBeDefined()
    }
  )

  it.each([
    235, 236, 279, 298, 299, 420, 844, 847, 923, 933, 937, 943, 949, 957,
    958, 966, 967, 968, 969
  ])(
    'maps reviewed B161-B180 quest id %i to a bundled quest definition',
    (questId) => {
      expect(getQuestStuff(questId)).toBeDefined()
    }
  )

  it.each([290, 292, 806, 970, 996, 1001, 1006, 1007])(
    'maps reviewed B181-B200 quest id %i to a bundled quest definition',
    (questId) => {
      expect(getQuestStuff(questId)).toBeDefined()
    }
  )

  it.each([636, 933, 1033])(
    'maps reviewed B201-B216 quest id %i to a bundled quest definition',
    (questId) => {
      expect(getQuestStuff(questId)).toBeDefined()
    }
  )

  it.each([237, 927, 928])(
    'maps the reviewed September yearly quest id %i to a bundled quest definition',
    (questId) => {
      expect(getQuestStuff(questId)).toBeDefined()
    }
  )

  it.each([904, 905, 912, 914, 975, 1005, 1012, 1045])(
    'maps the disputed February through May yearly sortie target %i to a bundled quest definition',
    (questId) => {
      expect(getQuestStuff(questId)).toBeDefined()
    }
  )

  it.each([
    415,
    261,
    280,
    284,
    301,
    303,
    307,
    311,
    318,
    330,
    337,
    339,
    342,
    345,
    346,
    348,
    350,
    353,
    355,
    356,
    362,
    368,
    371,
    372,
    373,
    375,
    377,
    343,
    354,
    402,
    419,
    424,
    426,
    427,
    428,
    434,
    432,
    433,
    436,
    438,
    439,
    440,
    442,
    444
  ])(
    'maps reviewed periodic practice and expedition quest id %i to a bundled quest definition',
    (questId) => {
      expect(getQuestStuff(questId)).toBeDefined()
    }
  )

  it.each([714, 715, 716, 717])(
    'maps reviewed yearly modernization quest id %i to a bundled quest definition',
    (questId) => {
      expect(getQuestStuff(questId)).toBeDefined()
    }
  )

  it.each([
    114,
    117,
    208,
    209,
    216,
    228,
    265,
    294,
    410,
    425,
    605,
    607,
    617,
    618,
    626,
    627,
    628,
    637,
    642,
    643,
    645,
    647,
    648,
    653,
    655,
    657,
    658,
    662,
    663,
    674,
    675,
    676,
    678,
    679,
    680,
    681,
    685,
    686,
    688,
    716,
    1101,
    1102,
    1103,
    1104,
    1105,
    1107,
    1120,
    1123,
    1138
  ])(
    'maps reviewed periodic factory quest id %i to a bundled quest definition',
    (questId) => {
      expect(getQuestStuff(questId)).toBeDefined()
    }
  )

  it.each([
    188,
    206,
    214,
    217,
    220,
    233,
    243,
    247,
    264,
    284,
    299,
    617,
    822,
    845,
    846,
    854,
    861,
    862,
    873,
    875,
    888,
    893,
    894,
    902,
    903
  ])(
    'maps reviewed quarterly quest id %i to a bundled quest definition',
    (questId) => {
      expect(getQuestStuff(questId)).toBeDefined()
    }
  )

  it('builds a prerequisite-first goal path without treating hidden quests as incomplete', () => {
    const plan = buildQuestGoalPlan(
      266,
      new Map([
        [221, 'claim'],
        [264, 'available'],
        [266, 'not-shown']
      ])
    )

    const stepIds = plan?.steps.map((step) => step.questId) ?? []
    expect(stepIds.at(-1)).toBe(266)
    expect(stepIds.indexOf(201)).toBeLessThan(stepIds.indexOf(216))
    expect(stepIds.indexOf(216)).toBeLessThan(stepIds.indexOf(214))
    expect(stepIds.indexOf(214)).toBeLessThan(stepIds.indexOf(221))
    expect(stepIds.indexOf(221)).toBeLessThan(stepIds.indexOf(264))
    expect(stepIds.indexOf(239)).toBeLessThan(stepIds.indexOf(264))
    expect(stepIds.indexOf(264)).toBeLessThan(stepIds.indexOf(266))
    expect(stepIds.indexOf(148)).toBeLessThan(stepIds.indexOf(266))
    expect(plan?.steps.find((step) => step.questId === 221)?.status).toBe('claim')
    expect(plan?.notShownCount).toBe(7)
    expect(plan?.conflictCount).toBe(0)
    expect(plan?.hasCycle).toBe(false)
  })

  it('lists every curated target and prerequisite as a selectable goal', () => {
    const ids = listCuratedQuestKnowledge().map((entry) => entry.questId)

    expect(ids).toEqual(
      expect.arrayContaining([
        137,
        188,
        201,
        202,
        209,
        220,
        237,
        243,
        249,
        267,
        273,
        343,
        354,
        432,
        433,
        436,
        439,
        440,
        846,
        854,
        872,
        873,
        875,
        888,
        902,
        903,
        927,
        928,
        944,
        947
      ])
    )
  })
})

import { describe, expect, it } from 'vitest'
import {
  ApiDeckPortId,
  ApiProgressFlag,
  ApiQuestCategory,
  ApiQuestState,
  ApiQuestType,
  ApiShipCategory,
  ApiShipType,
  SlotitemType,
  type ApiQuest,
  type SvData
} from '@common/kcs'
import {
  checkCondition,
  getQuestStuff,
  questConditionChecks,
  questFleetChecks,
  questIsDeckMatch,
  questProgressDetailFormat,
  questProgressDetailItems,
  QuestType,
  type DestroyItemCondition,
  type QuestType as QuestTypeValue
} from '@common/kcquest'
import type { Quest } from '@common/record'
import {
  buildQuestGuideEquipmentStock,
  buildQuestKnowledgeEntry,
  buildQuestGuideRecommendations,
  createQuestGuideHistory,
  normalizeQuestGuideWikiSource,
  questGuideCadenceDeadline,
  questGuideConsumableRequirements,
  questGuideEquipmentRequirements,
  questGuideIsRecurring,
  questGuideIsLimited,
  questGuideLimitedDeadline,
  questGuideLimitedEvidence,
  questGuideProgressDetailText,
  questGuideProgressDetailsText,
  questGuideProgressMarkupText,
  questGuideSlotPressure,
  questGuideWikiSearchUrl,
  questGuideWikiUrl,
  updateQuestGuideHistory
} from '@common/quest_guide'

function createQuest(overrides: Partial<ApiQuest> = {}): ApiQuest {
  return {
    api_no: 9991,
    api_category: ApiQuestCategory.syutugeki,
    api_type: ApiQuestType.single,
    api_label_type: 0,
    api_state: ApiQuestState.not_started,
    api_title: 'テスト任務',
    api_detail: 'テスト任務の詳細',
    api_voice_id: 0,
    api_get_material: [0, 0, 0, 0],
    api_bonus_flag: 0,
    api_progress_flag: ApiProgressFlag.zero,
    api_invalid_flag: 0,
    ...overrides
  }
}

interface ConditionSvDataOptions {
  flagshipType?: ApiShipType
  flagshipCategory?: ApiShipCategory
  flagshipLevel?: number
  firstSlotProficiency?: number
  secondSlotEquipped?: boolean
  expansionSlotEquipped?: boolean
  includeDeck?: boolean
}

function createConditionSvData(options: ConditionSvDataOptions = {}): SvData {
  const firstSlot = {
    api: {
      api_slotitem_id: 19,
      api_level: 10,
      api_alv: options.firstSlotProficiency ?? 7
    },
    mst: {
      api_id: 19,
      api_name: '九六式艦戦'
    }
  }
  const otherSlot = {
    api: {
      api_slotitem_id: 20,
      api_level: 0,
      api_alv: 0
    },
    mst: {
      api_id: 20,
      api_name: '零式艦戦21型'
    }
  }
  const slots = new Map<number, typeof firstSlot>([[101, firstSlot]])
  if (options.secondSlotEquipped) {
    slots.set(102, otherSlot)
  }
  if (options.expansionSlotEquipped) {
    slots.set(103, otherSlot)
  }

  const ship = {
    api_ship_id: 100,
    api_lv: options.flagshipLevel ?? 80,
    api_slot: [101, options.secondSlotEquipped ? 102 : -1, -1, -1],
    api_slot_ex: options.expansionSlotEquipped ? 103 : 0
  }
  const mstShips = new Map([
    [
      100,
      {
        api_id: 100,
        api_name: 'テスト軽巡改',
        api_stype: options.flagshipType ?? ApiShipType.keijyun,
        api_ctype: options.flagshipCategory ?? ApiShipCategory.sendai
      }
    ],
    [
      200,
      {
        api_id: 200,
        api_name: '別の艦娘',
        api_stype: ApiShipType.kutikukan,
        api_ctype: ApiShipCategory.fubuki
      }
    ]
  ])

  return {
    deckPort: () =>
      options.includeDeck === false
        ? undefined
        : {
            api_ship: [1, -1, -1, -1, -1, -1]
          },
    ship: (id: number) => (id === 1 ? ship : undefined),
    mstShip: (id: number) => mstShips.get(id),
    mstSlotitem: (id: number) =>
      id === 19 ? firstSlot.mst : id === 20 ? otherSlot.mst : undefined,
    slot: (id: number) => slots.get(id)
  } as unknown as SvData
}

function createDestroyItemCondition(
  overrides: Partial<DestroyItemCondition> = {}
): DestroyItemCondition {
  return {
    flagship_slotitem_ids: [],
    flagship_slotitem_lvl: [],
    ...overrides
  }
}

interface FleetShipFixture {
  mstId: number
  type?: ApiShipType
  category?: ApiShipCategory
  level?: number
  speed?: number
  slotitemIds?: readonly number[]
}

function fleetShip(
  mstId: number,
  type: ApiShipType = ApiShipType.keijyun,
  category: ApiShipCategory = ApiShipCategory.none,
  level = 1,
  speed = 10
): FleetShipFixture {
  return { mstId, type, category, level, speed }
}

function createFleetSvData(
  firstFleet: readonly FleetShipFixture[],
  secondFleet: readonly FleetShipFixture[] | null = [],
  thirdFleet: readonly FleetShipFixture[] | null = [],
  battleDeckId: ApiDeckPortId | number | null = ApiDeckPortId.deck1st
): SvData {
  const allShips = [...firstFleet, ...(secondFleet ?? []), ...(thirdFleet ?? [])]
  const slotitems = new Map<number, { api_slotitem_id: number }>()
  const ships = new Map(
    allShips.map((fixture, index) => {
      const slotIds = (fixture.slotitemIds ?? []).map((itemId, slotIndex) => {
        const instanceId = (index + 1) * 1000 + slotIndex + 1
        slotitems.set(instanceId, { api_slotitem_id: itemId })
        return instanceId
      })
      return [
        index + 1,
        {
          api_id: index + 1,
          api_ship_id: fixture.mstId,
          api_lv: fixture.level ?? 1,
          api_slot: [...slotIds, -1, -1, -1, -1].slice(0, 4),
          api_slot_ex: 0
        }
      ] as const
    })
  )
  const masters = new Map(
    allShips.map((fixture) => [
      fixture.mstId,
      {
        api_id: fixture.mstId,
        api_name: `艦${fixture.mstId}`,
        api_stype: fixture.type ?? ApiShipType.keijyun,
        api_ctype: fixture.category ?? ApiShipCategory.none,
        api_soku: fixture.speed ?? 10
      }
    ])
  )
  const firstIds = firstFleet.map((_, index) => index + 1)
  const secondIds = secondFleet?.map((_, index) => firstFleet.length + index + 1)
  const thirdIds = thirdFleet?.map(
    (_, index) => firstFleet.length + (secondFleet?.length ?? 0) + index + 1
  )
  const deckIds = new Map<number, readonly number[] | undefined>([
    [ApiDeckPortId.deck1st, firstIds],
    [ApiDeckPortId.deck2st, secondIds],
    [ApiDeckPortId.deck3st, thirdIds]
  ])

  return {
    battleDeck:
      battleDeckId === null
        ? undefined
        : {
            api_id: battleDeckId,
            api_ship: [...(deckIds.get(battleDeckId) ?? [])]
          },
    deckPort: (deckId: number) => {
      if (deckId === ApiDeckPortId.deck1st) {
        return { api_ship: [...firstIds] }
      }
      if (deckId === ApiDeckPortId.deck2st && secondIds !== undefined) {
        return { api_ship: [...secondIds] }
      }
      if (deckId === ApiDeckPortId.deck3st && thirdIds !== undefined) {
        return { api_ship: [...thirdIds] }
      }
      return undefined
    },
    ship: (id: number) => ships.get(id),
    mstShipFrom: (id: number) => {
      const ship = ships.get(id)
      return ship ? masters.get(ship.api_ship_id) : undefined
    },
    mstShip: (id: number) =>
      masters.get(id) ?? {
        api_id: id,
        api_name: `艦${id}`,
        api_stype: ApiShipType.keijyun,
        api_ctype: ApiShipCategory.none,
        api_soku: 10
      },
    mstSlotitem: (id: number) => ({
      api_id: id,
      api_name: `装備${id}`
    }),
    slotitem: (id: number) => slotitems.get(id),
    shipInfo: (id: number) => {
      const fixture = allShips[id - 1]
      if (!fixture) {
        return undefined
      }
      return {
        slots: (fixture.slotitemIds ?? []).map((itemId) => ({
          mst: {
            api_id: itemId,
            api_name: `装備${itemId}`
          }
        }))
      }
    },
    shipMstIds: (id: number) => [id]
  } as unknown as SvData
}

describe('quest guide recommendations', () => {
  it('prioritizes claimable quests before active and available quests', () => {
    const recommendations = buildQuestGuideRecommendations([
      createQuest({ api_no: 9001, api_state: ApiQuestState.not_started }),
      createQuest({
        api_no: 9002,
        api_state: ApiQuestState.in_progress,
        api_progress_flag: ApiProgressFlag.eighty
      }),
      createQuest({ api_no: 9003, api_state: ApiQuestState.completed })
    ])

    expect(recommendations.map((entry) => entry.quest.api_no)).toEqual([9003, 9002, 9001])
    expect(recommendations[0].status).toBe('claim')
  })

  it('recognizes likely limited-time titles', () => {
    expect(questGuideIsLimited(createQuest({ api_title: '【期間限定任務】テスト作戦' }))).toBe(true)
    expect(questGuideIsLimited(createQuest({ api_title: '通常の単発任務' }))).toBe(false)
  })

  it('separates explicit game evidence from seasonal limited-time candidates', () => {
    const observedAt = new Date('2026-07-25T10:00:00.000Z')
    const explicit = questGuideLimitedEvidence(
      createQuest({ api_title: '【期間限定任務】テスト作戦' }),
      'live',
      observedAt
    )
    const cached = questGuideLimitedEvidence(
      createQuest({ api_title: '【期間限定任務】テスト作戦' }),
      'cache',
      observedAt
    )
    const seasonal = questGuideLimitedEvidence(
      createQuest({ api_title: '新春特別作戦' }),
      'live',
      observedAt
    )

    expect(explicit).toEqual([
      expect.objectContaining({
        source: 'game-api',
        confidence: 'verified',
        observedAt: observedAt.toISOString()
      })
    ])
    expect(cached[0]).toMatchObject({
      source: 'cached-game-data',
      confidence: 'supported'
    })
    expect(seasonal).toEqual([])
    expect(questGuideIsLimited(createQuest({ api_title: '新春特別作戦' }))).toBe(true)
  })

  it('calculates a limited-time deadline only from exact supplied evidence', () => {
    const evidence = [
      {
        source: 'official-announcement' as const,
        sourceLabel: '運営告知',
        confidence: 'verified' as const,
        summary: '終了時刻を告知',
        observedAt: '2026-07-24T12:00:00.000Z',
        endsAt: '2026-07-25T20:00:00+09:00'
      }
    ]

    expect(questGuideLimitedDeadline(evidence, new Date('2026-07-25T05:30:00.000Z'))).toMatchObject(
      {
        endsAt: '2026-07-25T11:00:00.000Z',
        hoursRemaining: 6,
        text: '終了まで約6時間',
        urgency: 'urgent',
        evidence: evidence[0]
      }
    )
    expect(
      questGuideLimitedDeadline(
        [{ ...evidence[0], endsAt: undefined }],
        new Date('2026-07-25T05:30:00.000Z')
      )
    ).toBeUndefined()
    expect(
      questGuideLimitedDeadline(
        [{ ...evidence[0], endsAt: 'not-a-date' }],
        new Date('2026-07-25T05:30:00.000Z')
      )
    ).toBeUndefined()
    expect(questGuideLimitedDeadline(evidence, new Date('2026-07-25T12:00:00.000Z'))).toMatchObject(
      {
        hoursRemaining: 0,
        text: '終了予定を経過',
        urgency: 'expired'
      }
    )
  })

  it('calculates recurring reset deadlines in Japan Standard Time', () => {
    const daily = questGuideCadenceDeadline(
      createQuest({ api_type: ApiQuestType.daily }),
      new Date('2026-07-25T19:00:00.000Z')
    )
    const monthly = questGuideCadenceDeadline(
      createQuest({ api_type: ApiQuestType.monthly }),
      new Date('2026-07-31T14:00:00.000Z')
    )
    const quarterly = questGuideCadenceDeadline(
      createQuest({ api_type: ApiQuestType.quarterly }),
      new Date('2026-08-31T14:00:00.000Z')
    )
    const yearly = questGuideCadenceDeadline(
      createQuest({
        api_type: ApiQuestType.quarterly,
        api_label_type: 107
      }),
      new Date('2026-06-30T19:30:00.000Z')
    )

    expect(daily).toMatchObject({
      resetsAt: '2026-07-25T20:00:00.000Z',
      hoursRemaining: 1,
      urgency: 'urgent'
    })
    expect(monthly).toMatchObject({
      resetsAt: '2026-07-31T20:00:00.000Z',
      hoursRemaining: 6,
      urgency: 'urgent'
    })
    expect(quarterly?.resetsAt).toBe('2026-08-31T20:00:00.000Z')
    expect(yearly?.resetsAt).toBe('2026-06-30T20:00:00.000Z')
    expect(
      questGuideCadenceDeadline(createQuest({ api_type: ApiQuestType.single }))
    ).toBeUndefined()
  })

  it('distinguishes one-time quests from recurring and yearly quests', () => {
    expect(questGuideIsRecurring(createQuest({ api_type: ApiQuestType.daily }))).toBe(true)
    expect(questGuideIsRecurring(createQuest({ api_type: ApiQuestType.single }))).toBe(false)
    expect(
      questGuideIsRecurring(
        createQuest({
          api_type: ApiQuestType.single,
          api_label_type: 107
        })
      )
    ).toBe(true)
  })

  it('reports task-slot pressure from the game-provided capacity', () => {
    expect(questGuideSlotPressure(7, 8)).toMatchObject({
      remaining: 1,
      level: 'tight',
      text: '受諾枠 7/8（空き1）'
    })
    expect(questGuideSlotPressure(8, 8)).toMatchObject({
      remaining: 0,
      level: 'full'
    })
    expect(questGuideSlotPressure(2, 0)).toMatchObject({
      remaining: undefined,
      level: 'unknown'
    })
  })

  it('raises expiring recurring quests without inventing a limited-time deadline', () => {
    const recommendations = buildQuestGuideRecommendations(
      [
        createQuest({
          api_no: 9010,
          api_type: ApiQuestType.daily
        }),
        createQuest({
          api_no: 9011,
          api_type: ApiQuestType.single,
          api_title: '【期間限定任務】期限未公表'
        })
      ],
      { now: new Date('2026-07-25T19:00:00.000Z') }
    )

    const daily = recommendations.find((entry) => entry.quest.api_no === 9010)!
    const single = recommendations.find((entry) => entry.quest.api_no === 9011)!
    expect(daily.cadenceDeadline?.urgency).toBe('urgent')
    expect(daily.reasons).toContain('更新まで約1時間：失効前に確認')
    expect(single.isLimited).toBe(true)
    expect(single.limitedEvidence).toHaveLength(1)
    expect(single.limitedDeadline).toBeUndefined()
    expect(single.cadenceDeadline).toBeUndefined()
    expect(single.cautions).toContain('終了時刻は確認できていません')
  })

  it('raises urgency only when exact reviewed limited-time evidence is supplied', () => {
    const quests = [
      createQuest({
        api_no: 9012,
        api_title: '【期間限定任務】期限未公表'
      }),
      createQuest({
        api_no: 9013,
        api_title: '【期間限定任務】終了告知済み'
      })
    ]
    const withoutDeadline = buildQuestGuideRecommendations(quests, {
      now: new Date('2026-07-25T05:00:00.000Z')
    })
    const withDeadline = buildQuestGuideRecommendations(quests, {
      now: new Date('2026-07-25T05:00:00.000Z'),
      limitedEvidenceById: new Map([
        [
          9013,
          [
            {
              source: 'official-announcement',
              sourceLabel: '運営告知',
              confidence: 'verified',
              summary: '終了時刻を告知',
              endsAt: '2026-07-25T10:00:00.000Z'
            }
          ]
        ]
      ])
    })
    const unknown = withoutDeadline.find((entry) => entry.quest.api_no === 9013)!
    const urgent = withDeadline.find((entry) => entry.quest.api_no === 9013)!

    expect(unknown.limitedDeadline).toBeUndefined()
    expect(urgent.limitedDeadline?.urgency).toBe('urgent')
    expect(urgent.reasons).toContain('終了まで約5時間：終了前に確認')
    expect(urgent.score - unknown.score).toBe(260)
  })

  it('marks a known target map as blocked when it is not unlocked', () => {
    const [recommendation] = buildQuestGuideRecommendations(
      [
        createQuest({
          api_no: 256,
          api_title: '「潜水艦隊」出撃せよ！'
        })
      ],
      { availableMapKeys: new Set() }
    )

    expect(recommendation.maps).toEqual(['6-1'])
    expect(recommendation.mapState).toBe('blocked')
    expect(recommendation.readiness).toBe('blocked')
    expect(recommendation.readinessText).toBe('海域未開放')
    expect(recommendation.cautions.join(' ')).toContain('6-1')
  })

  it('reports equipment shortages in recommendation reasons', () => {
    const [recommendation] = buildQuestGuideRecommendations(
      [createQuest({ api_no: 673, api_title: '装備開発力の整備' })],
      {
        equipmentStock: [
          {
            itemId: 1,
            name: '12cm単装砲',
            type: SlotitemType.SmallMainGun,
            owned: 4,
            disposable: 3
          }
        ]
      }
    )

    expect(recommendation.equipmentRequirements).toEqual([
      expect.objectContaining({
        kind: 'discard',
        label: '小口径主砲',
        required: 4,
        available: 3,
        missing: 1
      })
    ])
    expect(recommendation.cautions).toContain('装備準備不足 合計1')
    expect(recommendation.readiness).toBe('needs-preparation')
    expect(recommendation.readinessDetail).toContain('1件')
  })

  it('aggregates locally provable execution readiness without guessing unknown tasks', () => {
    const recommendations = buildQuestGuideRecommendations(
      [
        createQuest({ api_no: 9001 }),
        createQuest({ api_no: 101, api_title: 'はじめての「編成」！' }),
        createQuest({
          api_no: 9002,
          api_state: ApiQuestState.completed
        }),
        createQuest({
          api_no: 9003,
          api_invalid_flag: 1
        })
      ],
      {
        deckMatchById: new Map([[101, true]]),
        fleetChecksById: new Map([
          [
            101,
            [
              {
                kind: 'ship-count',
                label: '第1艦隊 2隻以上',
                current: 2,
                required: 2,
                satisfied: true
              }
            ]
          ]
        ])
      }
    )

    const byId = new Map(
      recommendations.map((recommendation) => [recommendation.quest.api_no, recommendation])
    )
    expect(byId.get(9001)?.readiness).toBe('unknown')
    expect(byId.get(101)?.readiness).toBe('ready')
    expect(byId.get(9002)?.readinessText).toBe('受取可能')
    expect(byId.get(9003)?.readinessText).toBe('現在無効')
  })

  it('keeps partially unknown local checks out of the ready state', () => {
    const [recommendation] = buildQuestGuideRecommendations(
      [createQuest({ api_no: 101, api_title: 'はじめての「編成」！' })],
      {
        deckMatchById: new Map([[101, true]]),
        fleetChecksById: new Map([
          [
            101,
            [
              {
                kind: 'ship-count',
                label: '第1艦隊 2隻以上',
                current: 2,
                required: 2,
                satisfied: true
              },
              {
                kind: 'specific-ships',
                label: '艦娘条件',
                current: undefined,
                required: undefined,
                satisfied: undefined
              }
            ]
          ]
        ])
      }
    )

    expect(recommendation.readiness).toBe('unknown')
    expect(recommendation.readinessText).toBe('要確認')
  })

  it('keeps exact local counters alongside the percentage estimate', () => {
    const [recommendation] = buildQuestGuideRecommendations(
      [
        createQuest({
          api_state: ApiQuestState.in_progress,
          api_progress_flag: ApiProgressFlag.eighty
        })
      ],
      {
        progressDetailById: new Map([[9991, '条件1 2/3 / 条件2 1/2']])
      }
    )

    expect(recommendation.progress).toBe(80)
    expect(recommendation.progressDetail).toBe('条件1 2/3 / 条件2 1/2')
    expect(questGuideProgressDetailText([2], [5])).toBe('2/5')
    expect(questGuideProgressDetailText([2, 1], [3, 2])).toBe('条件1 2/3 / 条件2 1/2')
    expect(questGuideProgressDetailText([1], [])).toBeUndefined()
    expect(
      questGuideProgressMarkupText('<span class="cleared">6-1A：1/1</span> <span>6-2S：0/1</span>')
    ).toBe('6-1A：1/1 6-2S：0/1')
    expect(questGuideProgressMarkupText('  ')).toBeUndefined()
  })

  it('prefers structured progress details over legacy text', () => {
    const progressDetails = [
      {
        kind: 'battle' as const,
        label: '6-3 A勝利',
        current: 1,
        required: 2,
        completed: false
      }
    ]
    const [recommendation] = buildQuestGuideRecommendations(
      [
        createQuest({
          api_state: ApiQuestState.in_progress
        })
      ],
      {
        progressDetailsById: new Map([[9991, progressDetails]]),
        progressDetailById: new Map([[9991, '旧形式']])
      }
    )

    expect(recommendation.progressDetails).toEqual(progressDetails)
    expect(recommendation.progressDetail).toBe('6-3 A勝利 1/2')
    expect(questGuideProgressDetailsText(progressDetails)).toBe('6-3 A勝利 1/2')
  })

  it('uses bundled task labels for semantic exact progress', () => {
    const quest: Quest = {
      no: 866,
      dateKey: 'yearly',
      date: '2026-07-26T00:00:00.000Z',
      quest: createQuest({
        api_no: 866,
        api_title: '秋刀魚漁：鎮守府秋刀魚祭り開幕だね。頑張ろう！'
      }),
      state: {
        count: [7],
        countMax: [10]
      }
    }

    expect(questGuideProgressMarkupText(questProgressDetailFormat(quest))).toBe(
      '秋刀魚所持数：7/10'
    )
    expect(questProgressDetailItems(quest)).toEqual([
      {
        kind: 'collection',
        label: '秋刀魚所持数',
        current: 7,
        required: 10,
        completed: false
      }
    ])
  })

  it('builds structured map, arrival, and gauge progress from task metadata', () => {
    const trackedQuest = (no: number, count: number[], countMax: number[]): Quest => ({
      no,
      dateKey: 'single',
      date: '2026-07-26T00:00:00.000Z',
      quest: createQuest({ api_no: no }),
      state: { count, countMax }
    })

    expect(questProgressDetailItems(trackedQuest(862, [1], [2]))).toEqual([
      {
        kind: 'battle',
        label: '6-3 A勝利',
        current: 1,
        required: 2,
        completed: false
      }
    ])
    expect(questProgressDetailItems(trackedQuest(966, [1, 1, 0, 1], [1, 1, 1, 1]))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '7-3(第2) S勝利',
          completed: true
        })
      ])
    )
    expect(questProgressDetailItems(trackedQuest(927, [3], [4]))?.[0]).toEqual({
      kind: 'battle',
      label: '7-3(第1) A勝利',
      current: 3,
      required: 4,
      completed: false
    })
    expect(questProgressDetailItems(trackedQuest(846, [0], [1]))?.[0]).toEqual({
      kind: 'battle',
      label: '6-1 B勝利',
      current: 0,
      required: 1,
      completed: false
    })
    expect(questProgressDetailItems(trackedQuest(861, [1], [2]))?.[0]).toMatchObject({
      kind: 'arrival',
      label: '1-6 到達',
      current: 1,
      required: 2
    })
    expect(questProgressDetailItems(trackedQuest(967, [1], [1]))?.[0]).toEqual({
      kind: 'gauge',
      label: '7-4 ゲージ破壊',
      current: 1,
      required: 1,
      completed: true
    })
  })

  it('builds structured operational progress without parsing formatter HTML', () => {
    const trackedQuest = (no: number, count: number[], countMax: number[]): Quest => ({
      no,
      dateKey: 'single',
      date: '2026-07-26T00:00:00.000Z',
      quest: createQuest({ api_no: no }),
      state: { count, countMax }
    })

    expect(questProgressDetailItems(trackedQuest(202, [1], [1]))?.[0]).toMatchObject({
      kind: 'sortie',
      label: '出撃',
      completed: true
    })
    expect(questProgressDetailItems(trackedQuest(383, [2], [3]))?.[0]).toMatchObject({
      kind: 'practice',
      label: '演習 A勝利',
      current: 2,
      required: 3
    })
    expect(
      questProgressDetailItems(trackedQuest(214, [36, 6, 20, 10], [36, 6, 24, 12]))?.map(
        (item) => item.label
      )
    ).toEqual(['出撃', 'S勝利', 'ボス到達', 'ボス勝利'])
    expect(
      questProgressDetailItems(trackedQuest(451, [2, 1, 0], [2, 2, 2]))?.map((item) => item.label)
    ).toEqual(['海上護衛任務 成功', 'タンカー護衛任務 成功', 'ボーキサイト輸送任務 成功'])
    expect(questProgressDetailItems(trackedQuest(702, [1], [2]))?.[0]).toMatchObject({
      kind: 'maintenance',
      label: '近代化改修成功'
    })
    expect(questProgressDetailItems(trackedQuest(607, [2], [3]))?.[0]).toMatchObject({
      kind: 'development',
      label: '装備開発'
    })
  })

  it('builds structured enemy and specified modernization progress', () => {
    const trackedQuest = (no: number, count: number[], countMax: number[]): Quest => ({
      no,
      dateKey: 'single',
      date: '2026-07-26T00:00:00.000Z',
      quest: createQuest({ api_no: no }),
      state: { count, countMax }
    })

    expect(questProgressDetailItems(trackedQuest(211, [2], [3]))?.[0]).toMatchObject({
      kind: 'battle',
      label: '空母系撃沈',
      current: 2,
      required: 3
    })
    expect(questProgressDetailItems(trackedQuest(212, [4], [5]))?.[0].label).toBe('補給艦撃沈')
    expect(questProgressDetailItems(trackedQuest(228, [8], [15]))?.[0].label).toBe('潜水艦撃沈')

    expect(
      [707, 709, 710, 711, 718, 720].map(
        (questId) => questProgressDetailItems(trackedQuest(questId, [1], [2]))?.[0].label
      )
    ).toEqual([
      '駆逐艦へ軽巡3隻使用改修成功',
      '吹雪型へ川内型3隻使用改修成功',
      '駆逐艦へ睦月型4隻使用改修成功',
      '綾波型へ吹雪型駆逐艦5隻使用改修成功',
      '最上型へ軽巡級3隻使用改修成功',
      '夕雲型へ重巡級3隻使用改修成功'
    ])
  })

  it('builds structured specified equipment disposal progress', () => {
    const trackedQuest = (no: number, count: number[], countMax: number[]): Quest => ({
      no,
      dateKey: 'single',
      date: '2026-07-26T00:00:00.000Z',
      quest: createQuest({ api_no: no }),
      state: { count, countMax }
    })
    const slotitemNames: Readonly<Record<number, string>> = {
      17: '天山',
      25: '零式水上偵察機'
    }
    const resolvers = {
      slotitemName: (itemId: number) => slotitemNames[itemId],
      equipmentCondition: (questId: number) =>
        questId === 637
          ? {
              flagship_ids: [],
              flagship_slotitem_ids: [19],
              flagship_slotitem_lvl: [10],
              flagship_slotitem_alv_max: true
            }
          : undefined
    }

    expect(questProgressDetailItems(trackedQuest(614, [1], [2]), resolvers)?.[0]).toEqual({
      kind: 'disposal',
      label: '天山 廃棄',
      current: 1,
      required: 2,
      completed: false
    })
    expect(questProgressDetailItems(trackedQuest(638, [5], [6]))?.[0].label).toBe('対空機銃 廃棄')
    expect(questProgressDetailItems(trackedQuest(664, [3], [10]))?.[0].label).toBe(
      '小型電探 / 大型電探 廃棄'
    )
    expect(
      questProgressDetailItems(
        trackedQuest(1150, [20, 20, 10, 6], [20, 20, 10, 10]),
        resolvers
      )?.map((item) => item.label)
    ).toEqual([
      '中口径主砲 廃棄',
      '大口径主砲 廃棄',
      '副砲 廃棄',
      '零式水上偵察機（熟練度max）廃棄'
    ])

    expect(questProgressDetailItems(trackedQuest(614, [0], [2]))?.[0].label).toBe('装備#17 廃棄')
    expect(
      questProgressDetailItems(trackedQuest(637, [0], [1]), {
        ...resolvers,
        slotitemName: (itemId) => (itemId === 19 ? '九六式艦戦' : slotitemNames[itemId])
      })?.[0]
    ).toMatchObject({
      kind: 'equipment',
      label: '旗艦装備 九六式艦戦 ★+10（熟練度max）'
    })
    expect(questProgressDetailItems(trackedQuest(620, [1], [4]), resolvers)).toBeUndefined()
  })

  it('builds structured formation and held-equipment progress', () => {
    const trackedQuest = (no: number, count: number[], countMax: number[]): Quest => ({
      no,
      dateKey: 'single',
      date: '2026-07-26T00:00:00.000Z',
      quest: createQuest({ api_no: no }),
      state: { count, countMax }
    })
    const slotitemNames: Readonly<Record<number, string>> = {
      145: '戦闘糧食',
      446: '二式複戦 屠龍 丙型',
      453: 'キ102乙'
    }
    const resolvers = {
      slotitemName: (itemId: number) => slotitemNames[itemId]
    }

    expect(questProgressDetailItems(trackedQuest(101, [0], [1]))?.[0]).toMatchObject({
      kind: 'formation',
      label: '艦隊編成条件',
      completed: false
    })
    expect(questProgressDetailItems(trackedQuest(668, [1], [2]), resolvers)?.[0]).toMatchObject({
      kind: 'equipment',
      label: '戦闘糧食 保有',
      current: 1,
      required: 2
    })
    expect(
      questProgressDetailItems(trackedQuest(1113, [1, 0], [1, 1]), resolvers)?.map(
        (item) => item.label
      )
    ).toEqual(['キ102乙 保有', '二式複戦 屠龍 丙型 保有'])
  })

  it('keeps every registered advanced progress type structurally aligned', () => {
    const advancedTypes = new Set<QuestTypeValue>([
      QuestType.battleEnemy,
      QuestType.kaisouUseType,
      QuestType.kaisouUseId,
      QuestType.kaisouUseIdToId,
      QuestType.kaisouUseTypeToId,
      QuestType.kaisouUseCategoryToCategory,
      QuestType.kaisouUseCategoryToType,
      QuestType.destroyItemIdOrType,
      QuestType.hensei,
      QuestType.slotitemCondition
    ])
    const checkedQuestIds: number[] = []

    for (let questId = 1; questId <= 5000; questId += 1) {
      const stuff = getQuestStuff(questId)
      if (!stuff || !advancedTypes.has(stuff.questType)) {
        continue
      }
      if (stuff.max.length === 0) {
        continue
      }
      checkedQuestIds.push(questId)
      const quest: Quest = {
        no: questId,
        dateKey: 'single',
        date: '2026-07-26T00:00:00.000Z',
        quest: createQuest({ api_no: questId }),
        state: {
          count: stuff.max.map(() => 0),
          countMax: [...stuff.max]
        }
      }
      const details = questProgressDetailItems(quest)
      expect(details, `quest ${questId}`).toHaveLength(stuff.max.length)
      expect(
        details?.every(
          (item) => item.label.length > 0 && item.required > 0 && Number.isFinite(item.required)
        ),
        `quest ${questId}`
      ).toBe(true)
    }

    expect(checkedQuestIds.length).toBeGreaterThan(50)
  })

  it('reports locally verifiable consumable stock requirements', () => {
    expect(
      questGuideConsumableRequirements(866, [{ itemId: 68, name: '秋刀魚', owned: 7 }])
    ).toEqual([
      {
        itemId: 68,
        label: '秋刀魚',
        required: 10,
        available: 7,
        missing: 3
      }
    ])

    const [recommendation] = buildQuestGuideRecommendations(
      [
        createQuest({
          api_no: 866,
          api_title: '秋刀魚漁：鎮守府秋刀魚祭り開幕だね。頑張ろう！'
        })
      ],
      {
        consumableStock: [{ itemId: 68, name: '秋刀魚', owned: 7 }]
      }
    )
    expect(recommendation.consumableRequirements).toHaveLength(1)
    expect(recommendation.cautions).toContain('アイテム準備不足 合計3')
  })

  it('distinguishes fleet matching from local execution conditions', () => {
    const recommendations = buildQuestGuideRecommendations(
      [
        createQuest({ api_no: 101, api_title: 'はじめての「編成」！' }),
        createQuest({ api_no: 614, api_title: '機種転換' })
      ],
      {
        deckMatchById: new Map([
          [101, true],
          [614, false]
        ]),
        conditionChecksById: new Map([
          [
            614,
            [
              {
                kind: 'equipment',
                label: '旗艦第1スロット 天山',
                satisfied: false
              }
            ]
          ]
        ])
      }
    )

    const fleet = recommendations.find((entry) => entry.quest.api_no === 101)!
    const condition = recommendations.find((entry) => entry.quest.api_no === 614)!
    expect(fleet.matchKind).toBe('fleet')
    expect(fleet.reasons).toContain('現在の第1艦隊が条件一致')
    expect(condition.matchKind).toBe('condition')
    expect(condition.cautions).toContain('現在の実行条件 未達1/1')
    expect(condition.cautions).not.toContain('現在の第1艦隊は条件不一致')
  })

  it('summarizes the exact unmet fleet checks in recommendation cautions', () => {
    const [recommendation] = buildQuestGuideRecommendations(
      [createQuest({ api_no: 102, api_title: '「駆逐隊」を編成せよ！' })],
      {
        deckMatchById: new Map([[102, false]]),
        fleetChecksById: new Map([
          [
            102,
            [
              {
                kind: 'ship-type',
                label: '駆逐艦 4隻以上',
                current: 2,
                required: 4,
                satisfied: false
              }
            ]
          ]
        ])
      }
    )

    expect(recommendation.matchKind).toBe('fleet')
    expect(recommendation.fleetChecks).toHaveLength(1)
    expect(recommendation.cautions).toContain('現在の編成条件 未達1/1')
    expect(recommendation.cautions).not.toContain('現在の第1艦隊は条件不一致')
  })

  it('builds links for both supported quest wiki sources', () => {
    expect(questGuideWikiUrl('wikiwiki')).toBe('https://wikiwiki.jp/kancolle/任務')
    expect(questGuideWikiUrl('kcwiki')).toBe('https://zh.kcwiki.cn/wiki/任务')

    const kcwikiSearch = new URL(questGuideWikiSearchUrl('テスト任務', 'kcwiki'))
    expect(kcwikiSearch.origin).toBe('https://zh.kcwiki.cn')
    expect(kcwikiSearch.searchParams.get('title')).toBe('Special:Search')
    expect(kcwikiSearch.searchParams.get('fulltext')).toBe('1')
    expect(kcwikiSearch.searchParams.get('search')).toBe('テスト任務')
    expect(normalizeQuestGuideWikiSource('unknown')).toBe('wikiwiki')
  })

  it('keeps game, bundled, observed, and wiki evidence distinguishable', () => {
    const knowledge = buildQuestKnowledgeEntry(
      createQuest({
        api_no: 256,
        api_title: '「潜水艦隊」出撃せよ！'
      }),
      [
        {
          from: 101,
          fromTitle: '前の任務',
          to: 256,
          title: '「潜水艦隊」出撃せよ！',
          count: 2,
          lastSeenAt: '2026-07-25T00:00:00.000Z'
        },
        {
          from: 256,
          fromTitle: '「潜水艦隊」出撃せよ！',
          to: 301,
          title: '後の任務',
          count: 1,
          lastSeenAt: '2026-07-25T00:01:00.000Z'
        }
      ]
    )

    expect(knowledge.evidence.map((entry) => entry.source)).toEqual([
      'game-api',
      'bundled-definition',
      'curated-reference'
    ])
    expect(knowledge.relationCoverageStatus).toBe('represented')
    expect(knowledge.evidence[1].summary).toContain('対象海域 6-1')
    expect(knowledge.prerequisites[0]).toMatchObject({
      questId: 101,
      observedCount: 2,
      evidence: {
        source: 'local-observation',
        confidence: 'observed'
      }
    })
    expect(knowledge.downstream[0].questId).toBe(301)
    expect(knowledge.references).toEqual([
      expect.objectContaining({ source: 'wikiwiki', structured: false }),
      expect.objectContaining({ source: 'kcwiki', structured: false })
    ])
  })

  it('does not present cached quest state as current game data', () => {
    const knowledge = buildQuestKnowledgeEntry(createQuest({ api_no: 9999 }), [], 'cache')

    expect(knowledge.evidence[0]).toMatchObject({
      source: 'cached-game-data',
      confidence: 'supported',
      sourceLabel: '保存済みの任務キャッシュ'
    })
    expect(knowledge.relationCoverageStatus).toBe('unregistered')
  })

  it('adds reviewed prerequisite evidence without mixing it with observation', () => {
    const knowledge = buildQuestKnowledgeEntry(
      createQuest({
        api_no: 210,
        api_title: '敵艦隊を10回邀撃せよ！'
      }),
      [
        {
          from: 999,
          fromTitle: '端末で観測した任務',
          to: 210,
          title: '敵艦隊を10回邀撃せよ！',
          count: 1,
          lastSeenAt: '2026-07-25T00:00:00.000Z'
        }
      ]
    )

    expect(knowledge.evidence).toContainEqual(
      expect.objectContaining({
        source: 'curated-reference',
        confidence: 'supported'
      })
    )
    expect(knowledge.curatedPrerequisiteGroups[0].quests[0]).toMatchObject({
      questId: 216
    })
    expect(knowledge.prerequisites[0]).toMatchObject({
      questId: 999,
      evidence: { source: 'local-observation' }
    })
    expect(knowledge.conflicts).toEqual([])
  })

  it('keeps each reviewed source claim when prerequisite references conflict', () => {
    const knowledge = buildQuestKnowledgeEntry(
      createQuest({
        api_no: 357,
        api_title: '「大和型戦艦」第一戦隊演習、始め！'
      })
    )

    expect(knowledge.curatedPrerequisiteGroups).toEqual([])
    expect(knowledge.relationCoverageStatus).toBe('unresolved')
    expect(knowledge.evidence).toContainEqual(
      expect.objectContaining({
        source: 'curated-reference',
        summary: expect.stringContaining('不一致あり')
      })
    )
    expect(
      knowledge.conflicts[0].details.map((detail) => ({
        source: detail.source,
        questIds: detail.prerequisiteGroups[0].quests.map((quest) => quest.questId)
      }))
    ).toEqual([
      { source: 'wikiwiki', questIds: [343] },
      { source: 'kcwiki', questIds: [343, 610] }
    ])
  })
})

describe('quest execution condition checks', () => {
  const questCondition = (questId: number, svdata: SvData): DestroyItemCondition => {
    const stuff = getQuestStuff(questId) as
      | {
          getCondition?: (current: SvData) => DestroyItemCondition | undefined
        }
      | undefined
    const condition = stuff?.getCondition?.(svdata)
    if (!condition) {
      throw new Error(`quest ${questId} has no execution condition`)
    }
    return condition
  }

  it('reports each satisfied flagship and equipment condition', () => {
    const condition = createDestroyItemCondition({
      deck_checked: true,
      flagship_ids: [100],
      flagship_categories: [ApiShipCategory.sendai],
      flagship_type_ids: [ApiShipType.keijyun],
      flagship_id_lvs: [{ ids: [100], lv: 70 }],
      flagship_lv: 75,
      flagship_slotitem_ids: [19],
      flagship_slotitem_lvl: [10],
      flagship_slotitem_alv_max: true,
      flagship_slotitem_only: true
    })
    const checks = questConditionChecks(createConditionSvData(), condition)

    expect(checks).toHaveLength(8)
    expect(checks.every((check) => check.satisfied === true)).toBe(true)
    expect(checks.map((check) => check.label)).toEqual(
      expect.arrayContaining([
        '旗艦 軽巡',
        '旗艦 テスト軽巡改 Lv70以上',
        '旗艦第1スロット 九六式艦戦 ★+10（熟練度max）',
        '旗艦第2スロット以降・補強増設を空にする'
      ])
    )
    expect(checkCondition(createConditionSvData(), condition)).toBe(true)
  })

  it('rejects a mismatched flagship ship type', () => {
    const condition = createDestroyItemCondition({
      flagship_type_ids: [ApiShipType.kutikukan]
    })
    const svdata = createConditionSvData()

    expect(questConditionChecks(svdata, condition)).toContainEqual({
      kind: 'flagship',
      label: '旗艦 駆逐艦',
      satisfied: false
    })
    expect(checkCondition(svdata, condition)).toBe(false)
  })

  it('checks required proficiency even without an improvement-level entry', () => {
    const condition = createDestroyItemCondition({
      flagship_slotitem_ids: [19],
      flagship_slotitem_alv_max: true
    })
    const svdata = createConditionSvData({ firstSlotProficiency: 6 })

    expect(questConditionChecks(svdata, condition)).toContainEqual({
      kind: 'equipment',
      label: '旗艦第1スロット 九六式艦戦（熟練度max）',
      satisfied: false
    })
    expect(checkCondition(svdata, condition)).toBe(false)
  })

  it('requires later and expansion slots to be empty for equipment-only tasks', () => {
    const condition = createDestroyItemCondition({
      flagship_slotitem_ids: [19],
      flagship_slotitem_only: true
    })

    for (const svdata of [
      createConditionSvData({ secondSlotEquipped: true }),
      createConditionSvData({ expansionSlotEquipped: true })
    ]) {
      expect(questConditionChecks(svdata, condition)).toContainEqual({
        kind: 'equipment-only',
        label: '旗艦第2スロット以降・補強増設を空にする',
        satisfied: false
      })
      expect(checkCondition(svdata, condition)).toBe(false)
    }
  })

  it('keeps missing fleet data unknown instead of treating it as satisfied', () => {
    const condition = createDestroyItemCondition({
      flagship_ids: [100]
    })
    const svdata = createConditionSvData({ includeDeck: false })

    expect(questConditionChecks(svdata, condition)).toEqual([
      {
        kind: 'deck',
        label: '第1艦隊データ',
        satisfied: undefined
      }
    ])
    expect(checkCondition(svdata, condition)).toBe(false)
  })

  it.each<[number, SvData]>([
    [1158, createFleetSvData([fleetShip(528), fleetShip(674), fleetShip(675), fleetShip(485)])],
    [1160, createFleetSvData([fleetShip(196), fleetShip(981), fleetShip(982), fleetShip(983)])],
    [1164, createFleetSvData([fleetShip(674), fleetShip(485), fleetShip(25)])],
    [
      1165,
      createFleetSvData([
        fleetShip(131),
        fleetShip(139),
        fleetShip(167),
        fleetShip(170),
        fleetShip(20),
        fleetShip(533)
      ])
    ],
    [1168, createFleetSvData([fleetShip(717), fleetShip(637)])],
    [1169, createFleetSvData([fleetShip(637), fleetShip(638)])]
  ])('decomposes quest %i deck requirements into named local checks', (questId, svdata) => {
    const condition = questCondition(questId, svdata)
    const checks = questConditionChecks(svdata, condition)

    expect(condition.deck_checked).toBeUndefined()
    expect(condition.deck_condition?.rules.length).toBeGreaterThan(0)
    expect(checks.some((check) => check.label === '指定艦隊条件')).toBe(false)
    expect(checks.filter((check) => check.current !== undefined)).not.toHaveLength(0)
    expect(checks.every((check) => check.satisfied === true)).toBe(true)
    expect(checkCondition(svdata, condition)).toBe(true)
  })

  it('keeps every registered execution deck condition declarative', () => {
    const svdata = createFleetSvData([])
    const checkedQuestIds: number[] = []

    for (let questId = 1; questId <= 5000; questId += 1) {
      const stuff = getQuestStuff(questId) as
        | {
            getCondition?: (current: SvData) => DestroyItemCondition | undefined
          }
        | undefined
      const condition = stuff?.getCondition?.(svdata)
      if (!condition?.deck_condition) {
        continue
      }

      checkedQuestIds.push(questId)
      expect(condition.deck_checked, `quest ${questId}`).toBeUndefined()
      const checks = questConditionChecks(svdata, condition)
      expect(checks.length, `quest ${questId}`).toBeGreaterThan(0)
      expect(
        checks.some((check) => check.label === '指定艦隊条件'),
        `quest ${questId}`
      ).toBe(false)
    }

    expect(checkedQuestIds).toEqual([1158, 1160, 1164, 1165, 1168, 1169])
  })

  it('reports each missing subcondition instead of one combined result', () => {
    const svdata = createFleetSvData([
      fleetShip(131),
      fleetShip(139),
      fleetShip(167),
      fleetShip(170),
      fleetShip(20)
    ])
    const checks = questConditionChecks(svdata, questCondition(1165, svdata))

    expect(checks).toEqual(
      expect.arrayContaining([
        {
          kind: 'ship-count',
          label: '編成隻数 6隻以上',
          current: 5,
          required: 6,
          satisfied: false
        },
        {
          kind: 'specific-ships',
          label: '第2艦 矢矧',
          current: 1,
          required: 1,
          satisfied: true
        },
        {
          kind: 'specific-ships',
          label: '第3艦以降の指定艦 4隻',
          current: 3,
          required: 4,
          satisfied: false
        }
      ])
    )
    expect(checkCondition(svdata, questCondition(1165, svdata))).toBe(false)
  })

  it('does not count the flagship toward an explicitly excluded escort group', () => {
    const svdata = createFleetSvData([
      fleetShip(196),
      fleetShip(981),
      fleetShip(982),
      fleetShip(196)
    ])
    const checks = questConditionChecks(svdata, questCondition(1160, svdata))

    expect(checks).toContainEqual({
      kind: 'specific-ships',
      label: '旗艦以外の藤波改二・早波改二・浜波改二・風雲改二 3隻以上',
      current: 2,
      required: 3,
      satisfied: false
    })
  })
})

describe('quest fleet condition checks', () => {
  const dd = (id: number) => fleetShip(id, ApiShipType.kutikukan)
  const ca = (id: number) => fleetShip(id, ApiShipType.jyuujyun)
  const sub = (id: number) => fleetShip(id, ApiShipType.sensuikan)
  const categoryShips = (category: ApiShipCategory, count: number, startId: number) =>
    Array.from({ length: count }, (_, index) =>
      fleetShip(startId + index, ApiShipType.keijyun, category)
    )
  const ids = (shipIds: readonly number[], type: ApiShipType = ApiShipType.keijyun) =>
    shipIds.map((id) => fleetShip(id, type))

  const positiveFleetByQuest = new Map<number, SvData>([
    [101, createFleetSvData(ids([1, 2]))],
    [102, createFleetSvData([dd(1), dd(2), dd(3), dd(4)])],
    [103, createFleetSvData([fleetShip(1, ApiShipType.keijyun), dd(2), dd(3)])],
    [104, createFleetSvData(ids([1, 2, 3, 4, 5, 6]))],
    [
      105,
      createFleetSvData([fleetShip(1, ApiShipType.keijyun), fleetShip(2, ApiShipType.keijyun)])
    ],
    [106, createFleetSvData([ca(1), ca(2)])],
    [
      107,
      createFleetSvData([fleetShip(1, ApiShipType.seiki_kuubo), dd(2), dd(3), dd(4), ca(5), ca(6)])
    ],
    [108, createFleetSvData(categoryShips(ApiShipCategory.tenryu, 2, 1000))],
    [109, createFleetSvData(categoryShips(ApiShipCategory.sendai, 3, 1010))],
    [110, createFleetSvData(categoryShips(ApiShipCategory.myoukou, 4, 1020))],
    [111, createFleetSvData(categoryShips(ApiShipCategory.fusou, 2, 1030))],
    [112, createFleetSvData(categoryShips(ApiShipCategory.ise, 2, 1040))],
    [113, createFleetSvData([fleetShip(1, ApiShipType.teisoku_senkan), ca(2), ca(3)])],
    [114, createFleetSvData(ids([83, 84, 90, 91], ApiShipType.seiki_kuubo))],
    [115, createFleetSvData(ids([1]), [])],
    [116, createFleetSvData([fleetShip(1, ApiShipType.suibo)])],
    [117, createFleetSvData(ids([1]), [fleetShip(10, ApiShipType.seiki_kuubo), dd(11), dd(12)])],
    [118, createFleetSvData(categoryShips(ApiShipCategory.kongou, 4, 1050))],
    [119, createFleetSvData(ids([69, 61, 60, 59, 51, 999]))],
    [120, createFleetSvData(ids([34, 35, 36, 37], ApiShipType.kutikukan))],
    [121, createFleetSvData(ids([67, 66, 69, 68]))],
    [122, createFleetSvData(ids([26, 27, 70, 43]))],
    [123, createFleetSvData([...ids([110, 111], ApiShipType.seiki_kuubo), dd(1), dd(2)])],
    [124, createFleetSvData(ids([69, 61, 60, 59, 51, 123]))],
    [125, createFleetSvData([sub(1), sub(2)])],
    [
      126,
      createFleetSvData([
        fleetShip(1, ApiShipType.koukuu_senkan),
        fleetShip(2, ApiShipType.koukuu_senkan),
        fleetShip(3, ApiShipType.koujyun),
        fleetShip(4, ApiShipType.koujyun)
      ])
    ],
    [127, createFleetSvData([sub(1), sub(2), sub(3)])],
    [128, createFleetSvData(ids([61, 60, 59, 123]))],
    [129, createFleetSvData(ids([63, 64, 100, 101]))],
    [130, createFleetSvData(ids([114, 15, 16, 49, 18]))],
    [131, createFleetSvData(ids([95, 97, 96, 98], ApiShipType.kutikukan))],
    [132, createFleetSvData(ids([49, 48, 17, 18], ApiShipType.kutikukan))],
    [133, createFleetSvData(ids([1, 2, 164, 31], ApiShipType.kutikukan))],
    [134, createFleetSvData([fleetShip(1, ApiShipType.keijyun, ApiShipCategory.none, 95)])],
    [
      135,
      createFleetSvData([
        fleetShip(1, ApiShipType.keijyun, ApiShipCategory.none, 100),
        ...ids([2, 3, 4, 5, 6])
      ])
    ],
    [136, createFleetSvData(ids([1, 165, 164, 31], ApiShipType.kutikukan))],
    [137, createFleetSvData(ids([62, 63, 65]))],
    [
      138,
      createFleetSvData([
        fleetShip(196, ApiShipType.seiki_kuubo),
        fleetShip(90, ApiShipType.seiki_kuubo),
        dd(1),
        dd(2)
      ])
    ],
    [
      139,
      createFleetSvData([fleetShip(1, ApiShipType.sensuibokan), sub(2), sub(3), sub(4), sub(5)])
    ],
    [140, createFleetSvData([fleetShip(319, ApiShipType.jyuujyun)])],
    [
      141,
      createFleetSvData([
        fleetShip(197, ApiShipType.seiki_kuubo),
        fleetShip(196, ApiShipType.seiki_kuubo),
        dd(1),
        dd(2)
      ])
    ],
    [142, createFleetSvData(ids([149, 150, 151, 152]))],
    [143, createFleetSvData(ids([404]))],
    [
      144,
      createFleetSvData([
        ...categoryShips(ApiShipCategory.nagato, 2, 1100),
        ...categoryShips(ApiShipCategory.fusou, 2, 1110)
      ])
    ],
    [
      145,
      createFleetSvData([
        ...categoryShips(ApiShipCategory.yamato, 3, 1120),
        fleetShip(1130, ApiShipType.keijyun)
      ])
    ],
    [146, createFleetSvData(ids([182]))],
    [147, createFleetSvData(ids([26, 27, 70, 43, 97]))],
    [
      148,
      createFleetSvData([
        dd(49),
        ca(64),
        fleetShip(1140, ApiShipType.keijyun),
        dd(1141),
        dd(1142),
        dd(1143)
      ])
    ],
    [149, createFleetSvData(ids([9, 10, 11, 32]))],
    [150, createFleetSvData(ids([38, 39, 40, 41]))],
    [151, createFleetSvData([dd(28), dd(29), dd(6), dd(1150)])],
    [152, createFleetSvData(ids([427, 59, 60, 61, 123, 115]))],
    [153, createFleetSvData(ids([51, 52, 1160, 1161]))],
    [155, createFleetSvData(ids([437, 35, 36, 37]))],
    [156, createFleetSvData(ids([114, 35, 41, 40, 46, 50]))],
    [157, createFleetSvData(ids([200, 35, 133, 135, 132, 50]))],
    [158, createFleetSvData(ids([541, 573]))],
    [161, createFleetSvData(ids([110, 111, 93, 132]))],
    [162, createFleetSvData(ids([192, 193, 100, 101]))],
    [163, createFleetSvData(ids([64, 100, 21]))],
    [164, createFleetSvData(ids([112, 116, 108, 109]))],
    [165, createFleetSvData(ids([82, 88]))],
    [166, createFleetSvData(ids([112, 117, 108, 109, 82, 88]))],
    [
      167,
      createFleetSvData([
        fleetShip(461, ApiShipType.seiki_kuubo),
        fleetShip(462, ApiShipType.seiki_kuubo),
        dd(1170),
        dd(1171)
      ])
    ],
    [168, createFleetSvData(ids([53, 22, 113, 1180, 1181, 1182]))],
    [
      169,
      createFleetSvData([
        fleetShip(1190, ApiShipType.seiki_kuubo),
        fleetShip(1191, ApiShipType.kei_kuubo),
        fleetShip(1192, ApiShipType.koukuu_senkan),
        fleetShip(1193, ApiShipType.koujyun),
        dd(1194),
        dd(1195)
      ])
    ],
    [170, createFleetSvData(ids([49, 64, 183, 425, 410, 1200]))],
    [171, createFleetSvData(ids([141, 418, 309]))],
    [172, createFleetSvData(ids([242, 43, 405, 46]))],
    [
      173,
      createFleetSvData([fleetShip(158, ApiShipType.keijyun), dd(469), dd(145), dd(1210), dd(1211)])
    ],
    [
      174,
      createFleetSvData([
        fleetShip(1220, ApiShipType.keijyun),
        dd(1221),
        dd(1222),
        dd(1223),
        dd(1224)
      ])
    ],
    [175, createFleetSvData(ids([463, 97, 96, 98]))],
    [176, createFleetSvData(ids([468, 199]))],
    [177, createFleetSvData(ids([12, 486, 13, 14]))],
    [178, createFleetSvData(ids([113, 61, 25, 24]))],
    [179, createFleetSvData(ids([487, 119, 118, 215, 264, 368]))],
    [180, createFleetSvData(ids([541, 276]))],
    [181, createFleetSvData(ids([504, 503, 73, 121]))],
    [
      182,
      createFleetSvData([
        fleetShip(82, ApiShipType.koukuu_senkan, ApiShipCategory.ise, 50),
        fleetShip(88, ApiShipType.koukuu_senkan, ApiShipCategory.ise, 50),
        fleetShip(1230, ApiShipType.keijyun),
        dd(1231),
        dd(1232),
        fleetShip(1233, ApiShipType.jyuujyun)
      ])
    ],
    [
      183,
      createFleetSvData([
        fleetShip(488, ApiShipType.keijyun),
        dd(44),
        dd(45),
        dd(405),
        dd(46),
        dd(1240)
      ])
    ],
    [184, createFleetSvData(ids([548, 418, 366, 258]))],
    [
      185,
      createFleetSvData([
        fleetShip(545, ApiShipType.seiki_kuubo),
        fleetShip(1250, ApiShipType.keijyun),
        dd(1251),
        dd(1252)
      ])
    ],
    [186, createFleetSvData(ids([463, 199, 490, 489]))],
    [187, createFleetSvData(ids([1260]), [], ids([70, 43, 97, 413, 414]))],
    [188, createFleetSvData(ids([543, 345]))],
    [189, createFleetSvData(ids([498, 488, 144, 323, 1270, 1271]))],
    [190, createFleetSvData(ids([240, 326, 419]))],
    [191, createFleetSvData(ids([317, 313, 557, 558]))],
    [192, createFleetSvData(ids([198, 464, 225, 226]))],
    [
      193,
      createFleetSvData([
        fleetShip(566, ApiShipType.kutikukan, ApiShipCategory.kagerou),
        fleetShip(567, ApiShipType.kutikukan, ApiShipCategory.kagerou),
        fleetShip(568, ApiShipType.kutikukan, ApiShipCategory.kagerou),
        fleetShip(1280, ApiShipType.kutikukan, ApiShipCategory.kagerou, 70),
        fleetShip(1281, ApiShipType.kutikukan, ApiShipCategory.yuugumo, 75),
        fleetShip(1282, ApiShipType.kutikukan, ApiShipCategory.yuugumo, 80)
      ])
    ],
    [194, createFleetSvData(ids([477, 478]))],
    [195, createFleetSvData(ids([557, 558, 556, 559]))],
    [196, createFleetSvData(ids([542, 563]))],
    [197, createFleetSvData(ids([542, 563, 564, 648]))],
    [198, createFleetSvData(ids([230, 232, 231, 233]))],
    [199, createFleetSvData(ids([994, 992, 993, 642, 16]))],
    [206, createFleetSvData([fleetShip(1400, ApiShipType.keijyun), dd(1401), dd(1402), dd(1403)])],
    [207, createFleetSvData([ca(1410)])],
    [208, createFleetSvData([fleetShip(1420, ApiShipType.kousoku_senkan)])],
    [
      209,
      createFleetSvData([
        fleetShip(1430, ApiShipType.seiki_kuubo),
        fleetShip(1431),
        fleetShip(1432),
        fleetShip(1433)
      ])
    ],
    [215, createFleetSvData(ids([1440]), ids([1441]), [], ApiDeckPortId.deck2st)],
    [219, createFleetSvData(ids([69, 61, 60, 59, 51, 1450]))],
    [222, createFleetSvData(ids([34, 35, 36, 37]))],
    [223, createFleetSvData(ids([67, 66, 69, 68]))],
    [224, createFleetSvData(ids([26, 27, 70, 43]))],
    [225, createFleetSvData(ids([110, 111]))],
    [227, createFleetSvData(ids([69, 61, 60, 59, 51, 123]))],
    [231, createFleetSvData([sub(1460), sub(1461)])],
    [
      232,
      createFleetSvData([
        fleetShip(1470, ApiShipType.koukuu_senkan),
        fleetShip(1471, ApiShipType.koukuu_senkan),
        fleetShip(1472, ApiShipType.koujyun),
        fleetShip(1473, ApiShipType.koujyun)
      ])
    ],
    [233, createFleetSvData(ids([61, 60, 59, 123]))],
    [234, createFleetSvData(ids([24, 99, 465]))],
    [
      235,
      createFleetSvData([
        fleetShip(1480, ApiShipType.keijyun),
        dd(1481),
        dd(1482),
        fleetShip(1483, ApiShipType.kaiboukan)
      ])
    ],
    [236, createFleetSvData(ids([587, 457, 459]))],
    [237, createFleetSvData([ca(65), dd(471), dd(1490), dd(1491), dd(1492), dd(1493)])],
    [238, createFleetSvData(ids([416, 142, 321]))],
    [239, createFleetSvData(ids([95, 97, 96, 98]))],
    [240, createFleetSvData(ids([49, 48, 17, 18]))],
    [244, createFleetSvData(ids([1, 2, 164, 31]))],
    [245, createFleetSvData([fleetShip(1500, ApiShipType.keijyun, ApiShipCategory.none, 95)])],
    [246, createFleetSvData([fleetShip(1510, ApiShipType.keijyun, ApiShipCategory.none, 100)])],
    [
      247,
      createFleetSvData([
        fleetShip(1520, ApiShipType.koukuu_senkan),
        fleetShip(1521, ApiShipType.koukuu_senkan)
      ])
    ],
    [248, createFleetSvData(ids([1, 2, 164, 31]))],
    [249, createFleetSvData(ids([62, 63, 65]))],
    [
      250,
      createFleetSvData([
        fleetShip(196, ApiShipType.seiki_kuubo),
        fleetShip(90, ApiShipType.seiki_kuubo),
        dd(1530),
        dd(1531)
      ])
    ],
    [
      251,
      createFleetSvData([
        fleetShip(197, ApiShipType.seiki_kuubo),
        fleetShip(196, ApiShipType.seiki_kuubo),
        dd(1560),
        dd(1561)
      ])
    ],
    [252, createFleetSvData(ids([954]))],
    [253, createFleetSvData(ids([406]))],
    [
      254,
      createFleetSvData([
        fleetShip(1570, ApiShipType.keijyun),
        dd(1571),
        dd(1572),
        dd(1573),
        fleetShip(1574, ApiShipType.kei_kuubo)
      ])
    ],
    [255, createFleetSvData([fleetShip(1580, ApiShipType.keijyun), dd(1581)])],
    [
      257,
      createFleetSvData([
        fleetShip(1590, ApiShipType.keijyun),
        dd(1591),
        dd(1592),
        dd(1593),
        dd(1594),
        dd(1595)
      ])
    ],
    [
      258,
      createFleetSvData([
        ...categoryShips(ApiShipCategory.nagato, 2, 1600),
        ...categoryShips(ApiShipCategory.fusou, 2, 1610)
      ])
    ],
    [259, createFleetSvData(ids([131, 143, 80]))],
    [
      260,
      createFleetSvData([
        fleetShip(1620, ApiShipType.kousoku_senkan),
        fleetShip(1621, ApiShipType.teisoku_senkan),
        fleetShip(1622, ApiShipType.kei_kuubo)
      ])
    ],
    [262, createFleetSvData(ids([26, 27, 70, 43, 97]))],
    [263, createFleetSvData(ids([61, 60, 59, 123]))],
    [
      264,
      createFleetSvData([
        fleetShip(1630, ApiShipType.seiki_kuubo),
        fleetShip(1631, ApiShipType.kei_kuubo),
        dd(1632),
        dd(1633)
      ])
    ],
    [
      266,
      createFleetSvData([
        dd(1640),
        dd(1641),
        dd(1642),
        dd(1643),
        fleetShip(1644, ApiShipType.keijyun),
        ca(1645)
      ])
    ],
    [267, createFleetSvData(ids([9, 10, 11, 32]))],
    [268, createFleetSvData(ids([9, 10, 11, 32]))],
    [269, createFleetSvData(ids([38, 39, 40, 41]))],
    [270, createFleetSvData([dd(28), dd(29), dd(6), dd(1650)])],
    [271, createFleetSvData(ids([63, 41, 49, 15, 16]))],
    [272, createFleetSvData([ca(271), fleetShip(1660, ApiShipType.keijyun), dd(1661), dd(1662)])],
    [273, createFleetSvData(ids([427, 59, 60, 61, 123, 115]))],
    [274, createFleetSvData(ids([34, 35, 36, 37]))],
    [275, createFleetSvData(categoryShips(ApiShipCategory.tenryu, 2, 1670))],
    [276, createFleetSvData(ids([85, 86, 21, 34, 36, 37]))],
    [277, createFleetSvData(ids([34, 35, 36, 37]))],
    [278, createFleetSvData(ids([114, 35, 41, 40, 46, 50]))],
    [279, createFleetSvData(ids([200, 35, 133, 135, 132, 50]))],
    [
      280,
      createFleetSvData([fleetShip(1680, ApiShipType.kei_kuubo), dd(1681), dd(1682), dd(1683)])
    ],
    [281, createFleetSvData(ids([541, 276]))],
    [282, createFleetSvData(ids([541, 276]))],
    [283, createFleetSvData(ids([594, 84]))],
    [
      284,
      createFleetSvData([
        fleetShip(1690, ApiShipType.keijyun),
        dd(1691),
        dd(1692),
        fleetShip(1693, ApiShipType.kaiboukan)
      ])
    ],
    [285, createFleetSvData([fleetShip(1700, ApiShipType.seiki_kuubo)])],
    [287, createFleetSvData(ids([110, 111, 93, 132]))],
    [288, createFleetSvData(ids([192, 193, 100, 101]))],
    [289, createFleetSvData(ids([64, 100, 21]))],
    [290, createFleetSvData(ids([86]))],
    [291, createFleetSvData(ids([183, 182]))],
    [
      292,
      createFleetSvData([
        fleetShip(591, ApiShipType.kousoku_senkan, ApiShipCategory.kongou),
        dd(1710),
        dd(1711)
      ])
    ],
    [293, createFleetSvData(ids([112, 116, 108, 109]))],
    [294, createFleetSvData(ids([112, 117, 108, 109, 82, 88]))],
    [295, createFleetSvData(ids([53, 22, 113]))],
    [
      296,
      createFleetSvData([
        fleetShip(1720, ApiShipType.seiki_kuubo),
        fleetShip(1721, ApiShipType.kei_kuubo),
        fleetShip(1722, ApiShipType.koukuu_senkan),
        fleetShip(1723, ApiShipType.koujyun),
        dd(1724),
        dd(1725)
      ])
    ],
    [297, createFleetSvData(ids([49, 64, 183, 425, 410]))],
    [298, createFleetSvData(ids([15, 16]))],
    [299, createFleetSvData([fleetShip(1730, ApiShipType.keijyun), dd(1731), dd(1732)])],
    [318, createFleetSvData(ids([2000, 2001]))],
    [319, createFleetSvData(ids([240, 326, 419]))],
    [320, createFleetSvData([dd(2010), dd(2011), dd(2012), dd(2013)])],
    [322, createFleetSvData([fleetShip(2020, ApiShipType.kaiboukan), dd(2021), dd(2022)])],
    [
      323,
      createFleetSvData([
        fleetShip(2030, ApiShipType.kutikukan, ApiShipCategory.kagerou, 70),
        fleetShip(2031, ApiShipType.kutikukan, ApiShipCategory.kagerou, 71),
        fleetShip(2032, ApiShipType.kutikukan, ApiShipCategory.yuugumo, 72),
        fleetShip(2033, ApiShipType.kutikukan, ApiShipCategory.yuugumo, 73)
      ])
    ],
    [324, createFleetSvData([fleetShip(553, ApiShipType.koukuu_senkan), dd(2040), dd(2041)])],
    [325, createFleetSvData(ids([542, 543]))],
    [327, createFleetSvData(categoryShips(ApiShipCategory.asasio, 4, 2050))],
    [328, createFleetSvData(ids([557, 558, 556, 559]))],
    [
      329,
      createFleetSvData([
        fleetShip(2060, ApiShipType.kaiboukan),
        fleetShip(2061, ApiShipType.kaiboukan),
        fleetShip(2062, ApiShipType.kaiboukan)
      ])
    ],
    [
      330,
      createFleetSvData([
        fleetShip(2070, ApiShipType.seiki_kuubo),
        fleetShip(2071, ApiShipType.kei_kuubo),
        dd(2072),
        dd(2073)
      ])
    ],
    [
      331,
      createFleetSvData([
        fleetShip(2080, ApiShipType.seiki_kuubo),
        fleetShip(2081, ApiShipType.soukou_kuubo),
        dd(2082),
        dd(2083)
      ])
    ],
    [332, createFleetSvData([fleetShip(2090, ApiShipType.keijyun), dd(2091), dd(2092), dd(2093)])],
    [
      333,
      createFleetSvData([
        fleetShip(2100, ApiShipType.seiki_kuubo),
        fleetShip(2101, ApiShipType.kei_kuubo),
        fleetShip(2102, ApiShipType.soukou_kuubo),
        dd(2103),
        dd(2104)
      ])
    ],
    [
      334,
      createFleetSvData([
        fleetShip(2110, ApiShipType.seiki_kuubo),
        fleetShip(2111, ApiShipType.kei_kuubo),
        fleetShip(2112, ApiShipType.soukou_kuubo),
        dd(2113),
        dd(2114)
      ])
    ],
    [335, createFleetSvData(ids([68, 65]))],
    [
      336,
      createFleetSvData([
        fleetShip(2120, ApiShipType.kaiboukan),
        fleetShip(2121, ApiShipType.yourikukan)
      ])
    ],
    [337, createFleetSvData(ids([49, 48, 17, 18]))],
    [338, createFleetSvData(categoryShips(ApiShipCategory.mutuki, 4, 2130))],
    [339, createFleetSvData(ids([12, 486, 13, 14]))],
    [
      340,
      createFleetSvData([
        fleetShip(2140, ApiShipType.kaiboukan),
        fleetShip(2141, ApiShipType.kaiboukan),
        fleetShip(2142, ApiShipType.kaiboukan)
      ])
    ],
    [342, createFleetSvData([dd(2150), dd(2151), dd(2152), dd(2153)])],
    [
      343,
      createFleetSvData([
        fleetShip(2160, ApiShipType.seiki_kuubo),
        fleetShip(2161, ApiShipType.seiki_kuubo),
        dd(2162),
        dd(2163)
      ])
    ],
    [344, createFleetSvData(ids([65, 64]))],
    [345, createFleetSvData(ids([439, 78, 515, 571]))],
    [346, createFleetSvData(ids([542, 563, 564, 648]))],
    [347, createFleetSvData([dd(20), dd(2170), dd(2171), dd(2172)])],
    [
      348,
      createFleetSvData([
        fleetShip(2180, ApiShipType.keijyun),
        fleetShip(2181, ApiShipType.renjyun),
        fleetShip(2182, ApiShipType.keijyun),
        dd(2183),
        dd(2184)
      ])
    ],
    [349, createFleetSvData(ids([973, 615, 962]))],
    [350, createFleetSvData(ids([93, 15, 94, 16]))],
    [351, createFleetSvData([fleetShip(501), dd(2190), dd(2191), dd(2192)])],
    [352, createFleetSvData([fleetShip(663), dd(2200), dd(2201), dd(2202), dd(2203)])],
    [
      353,
      createFleetSvData([
        ca(2210),
        ca(2211),
        fleetShip(2212, ApiShipType.koujyun),
        ca(2213),
        dd(2214),
        dd(2215)
      ])
    ],
    [
      354,
      createFleetSvData([
        fleetShip(707, ApiShipType.kei_kuubo),
        fleetShip(2220, ApiShipType.kutikukan, ApiShipCategory.fletcher),
        fleetShip(2221, ApiShipType.kutikukan, ApiShipCategory.johnCButle)
      ])
    ],
    [355, createFleetSvData(ids([568, 670]))],
    [356, createFleetSvData(ids([666, 647, 195, 627]))],
    [
      357,
      createFleetSvData([
        fleetShip(131, ApiShipType.teisoku_senkan),
        fleetShip(143, ApiShipType.teisoku_senkan),
        fleetShip(2230, ApiShipType.keijyun),
        dd(2231),
        dd(2232)
      ])
    ],
    [358, createFleetSvData(ids([544, 562, 561]))],
    [359, createFleetSvData(ids([1005, 114, 93, 45]))],
    [360, createFleetSvData([fleetShip(894), dd(2240), dd(2241), dd(2242)])],
    [
      361,
      createFleetSvData([
        {
          ...fleetShip(2250),
          slotitemIds: [42, 42]
        },
        fleetShip(2251, ApiShipType.kaiboukan),
        fleetShip(2252, ApiShipType.kaiboukan)
      ])
    ],
    [362, createFleetSvData(ids([9, 10, 11, 32]))],
    [363, createFleetSvData(ids([992, 93]))],
    [364, createFleetSvData([fleetShip(591), fleetShip(593), dd(2260), dd(2261)])],
    [365, createFleetSvData(ids([43, 42]))],
    [366, createFleetSvData([dd(961), dd(2270), dd(2271)])],
    [
      367,
      createFleetSvData([
        fleetShip(2280, ApiShipType.kaiboukan),
        fleetShip(2281, ApiShipType.kaiboukan),
        fleetShip(2282, ApiShipType.kaiboukan)
      ])
    ],
    [368, createFleetSvData(ids([181, 20]))],
    [369, createFleetSvData(ids([421, 423, 995, 527]))],
    [370, createFleetSvData(ids([465, 524, 525, 531]))],
    [371, createFleetSvData(ids([405, 42, 43, 45]))],
    [
      372,
      createFleetSvData([
        fleetShip(2290, ApiShipType.kutikukan, ApiShipCategory.akizuki),
        dd(2291),
        dd(2292),
        fleetShip(2293, ApiShipType.koukuu_senkan),
        fleetShip(2294, ApiShipType.koukuu_senkan)
      ])
    ],
    [
      373,
      createFleetSvData([
        fleetShip(2300, ApiShipType.teisoku_senkan, ApiShipCategory.richelieu),
        fleetShip(2301, ApiShipType.suibo, ApiShipCategory.commandantTeste),
        fleetShip(2302, ApiShipType.keijyun, ApiShipCategory.la_galissonniere)
      ])
    ],
    [374, createFleetSvData(ids([674, 675, 485]))],
    [
      375,
      createFleetSvData([
        fleetShip(86, ApiShipType.kousoku_senkan),
        fleetShip(85, ApiShipType.kousoku_senkan),
        fleetShip(2310, ApiShipType.keijyun),
        dd(2311),
        dd(2312)
      ])
    ],
    [
      376,
      createFleetSvData([
        fleetShip(85, ApiShipType.kousoku_senkan),
        fleetShip(86, ApiShipType.kousoku_senkan),
        fleetShip(2320, ApiShipType.keijyun),
        dd(2321),
        dd(2322)
      ])
    ],
    [377, createFleetSvData(ids([409, 625, 425]))],
    [
      378,
      createFleetSvData([
        fleetShip(2330, ApiShipType.sensuibokan),
        fleetShip(2331, ApiShipType.sensuibokan),
        fleetShip(2332, ApiShipType.sensuikan)
      ])
    ],
    [379, createFleetSvData(ids([426, 986]))],
    [
      380,
      createFleetSvData([
        fleetShip(2340, ApiShipType.yourikukan),
        fleetShip(2341, ApiShipType.kaiboukan),
        fleetShip(2342, ApiShipType.kaiboukan)
      ])
    ],
    [381, createFleetSvData(categoryShips(ApiShipCategory.akizuki, 3, 2350))],
    [382, createFleetSvData(ids([994, 992, 993, 642, 16]))],
    [
      383,
      createFleetSvData([
        fleetShip(2360, ApiShipType.teisoku_senkan, ApiShipCategory.richelieu),
        fleetShip(2361, ApiShipType.suibo, ApiShipCategory.commandantTeste),
        fleetShip(2362, ApiShipType.kutikukan, ApiShipCategory.mogador)
      ])
    ],
    [
      801,
      createFleetSvData([
        fleetShip(2500, ApiShipType.keijyun),
        fleetShip(2501, ApiShipType.kaiboukan),
        fleetShip(2502, ApiShipType.kaiboukan)
      ])
    ],
    [
      802,
      createFleetSvData([
        fleetShip(2510, ApiShipType.keijyun),
        ca(2511),
        fleetShip(2512, ApiShipType.koujyun),
        dd(2513)
      ])
    ],
    [803, createFleetSvData([fleetShip(2520, ApiShipType.seiki_kuubo), dd(2521), dd(2522)])],
    [804, createFleetSvData(ids([515, 885]))],
    [806, createFleetSvData([fleetShip(464, ApiShipType.kutikukan), dd(2523), dd(2524)])],
    [
      817,
      createFleetSvData([
        fleetShip(2530, ApiShipType.keijyun),
        dd(2531),
        dd(2532),
        dd(2533),
        dd(2534)
      ])
    ],
    [
      824,
      createFleetSvData([fleetShip(2540, ApiShipType.kei_kuubo), dd(2541), dd(2542), dd(2543)])
    ],
    [840, createFleetSvData(ids([89, 183]))],
    [841, createFleetSvData(ids([935, 931]))],
    [843, createFleetSvData([ca(2550), ca(2551), fleetShip(2552, ApiShipType.kei_kuubo)])],
    [844, createFleetSvData(ids([490, 95]))],
    [846, createFleetSvData([sub(2553), sub(2554), sub(2555), sub(2556)])],
    [847, createFleetSvData(ids([652]))],
    [
      861,
      createFleetSvData([
        fleetShip(2560, ApiShipType.koukuu_senkan),
        fleetShip(2561, ApiShipType.hokyuukan)
      ])
    ],
    [
      862,
      createFleetSvData([
        fleetShip(2570, ApiShipType.suibo),
        fleetShip(2571, ApiShipType.keijyun),
        fleetShip(2572, ApiShipType.keijyun)
      ])
    ],
    [869, createFleetSvData([fleetShip(2580, ApiShipType.keijyun), dd(2581), dd(2582)])],
    [873, createFleetSvData(ids([2590]))],
    [875, createFleetSvData(ids([543, 345]))],
    [882, createFleetSvData(ids([137, 140, 2]))],
    [888, createFleetSvData(ids([69, 61, 123, 60]))],
    [894, createFleetSvData([fleetShip(2600, ApiShipType.kei_kuubo)])],
    [901, createFleetSvData(ids([622]))],
    [902, createFleetSvData(ids([622, 1, 2, 164]))],
    [903, createFleetSvData(ids([622, 23]))],
    [904, createFleetSvData(ids([195, 627]))],
    [
      905,
      createFleetSvData([
        fleetShip(2610, ApiShipType.kaiboukan),
        fleetShip(2611, ApiShipType.kaiboukan),
        fleetShip(2612, ApiShipType.kaiboukan)
      ])
    ],
    [906, createFleetSvData([dd(2620), dd(2621), dd(2622)])],
    [907, createFleetSvData([dd(2630), dd(2631), dd(2632), dd(2633)])],
    [908, createFleetSvData(ids([1005, 561]))],
    [910, createFleetSvData([fleetShip(2640, ApiShipType.keijyun), dd(2641), dd(2642), dd(2643)])],
    [912, createFleetSvData([fleetShip(182), dd(2650), dd(2651), dd(2652)])],
    [914, createFleetSvData([ca(2660), ca(2661), ca(2662), dd(2663)])],
    [915, createFleetSvData([fleetShip(2670, ApiShipType.suibo), dd(2671), dd(2672)])],
    [923, createFleetSvData([fleetShip(2675, ApiShipType.seiki_kuubo, ApiShipCategory.yorktown)])],
    [927, createFleetSvData(ids([65]))],
    [928, createFleetSvData(ids([65, 64]))],
    [929, createFleetSvData([fleetShip(184, ApiShipType.sensuibokan), sub(2673), sub(2674)])],
    [931, createFleetSvData(ids([497, 145]))],
    [932, createFleetSvData(ids([181, 20]))],
    [
      933,
      createFleetSvData([
        fleetShip(183),
        fleetShip(2680, ApiShipType.kaiboukan),
        fleetShip(2681, ApiShipType.kaiboukan),
        fleetShip(2682, ApiShipType.kaiboukan)
      ])
    ],
    [934, createFleetSvData(ids([651]))],
    [935, createFleetSvData(ids([145, 656]))],
    [936, createFleetSvData([fleetShip(662), dd(2690), dd(2691), dd(2692)])],
    [937, createFleetSvData(ids([665, 407]))],
    [938, createFleetSvData(ids([501]))],
    [939, createFleetSvData(ids([501, 43, 97, 2700, 2701, 2702]))],
    [940, createFleetSvData([fleetShip(663), dd(2710), dd(2711)])],
    [
      941,
      createFleetSvData([
        fleetShip(2720, ApiShipType.renjyun),
        dd(2721),
        dd(2722),
        dd(2723),
        dd(2724)
      ])
    ],
    [942, createFleetSvData(ids([9, 133]))],
    [943, createFleetSvData(ids([883, 145]))],
    [944, createFleetSvData([ca(2730), dd(2731), dd(2732), dd(2733)])],
    [945, createFleetSvData([fleetShip(2740, ApiShipType.keijyun), dd(2741), dd(2742), dd(2743)])],
    [946, createFleetSvData([fleetShip(2750, ApiShipType.seiki_kuubo), ca(2751), ca(2752)])],
    [
      947,
      createFleetSvData([
        fleetShip(2760, ApiShipType.kei_kuubo),
        fleetShip(2761, ApiShipType.kei_kuubo)
      ])
    ],
    [948, createFleetSvData([fleetShip(2770, ApiShipType.seiki_kuubo)])],
    [
      949,
      createFleetSvData([
        fleetShip(707, ApiShipType.kei_kuubo),
        fleetShip(2780, ApiShipType.kutikukan, ApiShipCategory.fletcher)
      ])
    ],
    [
      952,
      createFleetSvData([
        dd(2830),
        dd(2831),
        dd(2832),
        fleetShip(2833),
        fleetShip(2834),
        fleetShip(2835)
      ])
    ],
    [
      953,
      createFleetSvData([
        fleetShip(2840, ApiShipType.kaiboukan),
        fleetShip(2841, ApiShipType.kaiboukan),
        dd(2842),
        dd(2843)
      ])
    ],
    [954, createFleetSvData([fleetShip(2850, ApiShipType.kei_kuubo), dd(2851), dd(2852)])],
    [
      955,
      createFleetSvData([
        fleetShip(2860, ApiShipType.teisoku_senkan),
        fleetShip(2861, ApiShipType.kutikukan, ApiShipCategory.yuugumo),
        fleetShip(2862, ApiShipType.kutikukan, ApiShipCategory.yuugumo)
      ])
    ],
    [
      957,
      createFleetSvData([
        fleetShip(588),
        fleetShip(2870, ApiShipType.kaiboukan),
        fleetShip(2871, ApiShipType.kaiboukan)
      ])
    ],
    [958, createFleetSvData(ids([588, 469]))],
    [959, createFleetSvData([fleetShip(2880, ApiShipType.keijyun)])],
    [960, createFleetSvData([fleetShip(2890, ApiShipType.renjyun)])],
    [961, createFleetSvData(ids([670, 568]))],
    [962, createFleetSvData(ids([455, 456, 48, 93]))],
    [963, createFleetSvData(ids([953, 182]))],
    [964, createFleetSvData(ids([439, 927]))],
    [965, createFleetSvData(ids([123, 124, 125]))],
    [967, createFleetSvData(ids([2900]))],
    [968, createFleetSvData(ids([884]))],
    [969, createFleetSvData(ids([903, 61, 24]))],
    [970, createFleetSvData(ids([647, 61, 113]))],
    [
      971,
      createFleetSvData([
        fleetShip(2910, ApiShipType.sensuibokan),
        dd(2911),
        fleetShip(2912, ApiShipType.sensuikan),
        fleetShip(2913, ApiShipType.keijyun)
      ])
    ],
    [972, createFleetSvData(ids([83, 84]))],
    [
      973,
      createFleetSvData([
        fleetShip(2920, ApiShipType.kutikukan, ApiShipCategory.fletcher),
        fleetShip(2921, ApiShipType.kutikukan, ApiShipCategory.johnCButle),
        fleetShip(2922, ApiShipType.kutikukan, ApiShipCategory.atlanta)
      ])
    ],
    [974, createFleetSvData(ids([666]))],
    [975, createFleetSvData(ids([666, 647, 195, 627]))],
    [976, createFleetSvData([fleetShip(911, ApiShipType.keijyun), dd(2930), dd(2931)])],
    [977, createFleetSvData([fleetShip(911), fleetShip(546), dd(2970), dd(2971)])],
    [978, createFleetSvData(ids([916]))],
    [
      979,
      createFleetSvData([
        fleetShip(2980, ApiShipType.kaiboukan),
        fleetShip(2981, ApiShipType.kaiboukan),
        fleetShip(2982, ApiShipType.kaiboukan)
      ])
    ],
    [980, createFleetSvData(ids([915, 670]))],
    [
      981,
      createFleetSvData([
        fleetShip(2990, ApiShipType.kutikukan, ApiShipCategory.fletcher),
        fleetShip(2991, ApiShipType.kutikukan, ApiShipCategory.johnCButle)
      ])
    ],
    [982, createFleetSvData(ids([920]))],
    [983, createFleetSvData(ids([544, 561, 562]))],
    [984, createFleetSvData(ids([93, 921]))],
    [985, createFleetSvData(ids([49, 64, 183]))],
    [986, createFleetSvData(ids([544, 1005, 923]))],
    [987, createFleetSvData(ids([442, 1005, 44]))],
    [988, createFleetSvData([fleetShip(3000, ApiShipType.keijyun)])],
    [989, createFleetSvData(ids([894]))],
    [990, createFleetSvData(ids([15, 540]))],
    [
      991,
      createFleetSvData([
        fleetShip(3010, ApiShipType.keijyun),
        dd(3011),
        fleetShip(3012, ApiShipType.koujyun)
      ])
    ],
    [992, createFleetSvData(ids([181, 20]))],
    [993, createFleetSvData(ids([951]))],
    [
      994,
      createFleetSvData([
        fleetShip(3020, ApiShipType.teisoku_senkan),
        fleetShip(3021, ApiShipType.kutikukan, ApiShipCategory.yuugumo),
        fleetShip(3022, ApiShipType.kutikukan, ApiShipCategory.yuugumo)
      ])
    ],
    [
      995,
      createFleetSvData([
        fleetShip(959, ApiShipType.kutikukan, ApiShipCategory.fubuki),
        fleetShip(3030, ApiShipType.kutikukan, ApiShipCategory.fubuki)
      ])
    ],
    [996, createFleetSvData([fleetShip(591), fleetShip(593), dd(3040), dd(3041)])],
    [997, createFleetSvData([dd(3050), dd(3051), dd(3052), dd(3053)])],
    [998, createFleetSvData(ids([961, 42]))],
    [1001, createFleetSvData(ids([955, 49, 425]))],
    [1002, createFleetSvData(ids([544, 1005, 923]))],
    [1003, createFleetSvData(ids([891]))],
    [1004, createFleetSvData(ids([502]))],
    [1005, createFleetSvData(ids([230, 232, 231, 233]))],
    [1006, createFleetSvData(ids([405, 45, 44]))],
    [1007, createFleetSvData([fleetShip(975, ApiShipType.keijyun), dd(3100), dd(3101)])],
    [1008, createFleetSvData(ids([144, 975]))],
    [1009, createFleetSvData(ids([131, 110]))],
    [1010, createFleetSvData(ids([963]))],
    [1011, createFleetSvData(ids([131, 139, 167, 170, 20, 533]))],
    [
      1012,
      createFleetSvData([
        fleetShip(3110, ApiShipType.kaiboukan, ApiShipCategory.ukuru),
        fleetShip(3111, ApiShipType.kaiboukan)
      ])
    ],
    [1013, createFleetSvData(ids([979]))],
    [
      1014,
      createFleetSvData([
        fleetShip(3120, ApiShipType.kaiboukan),
        fleetShip(3121, ApiShipType.kaiboukan),
        fleetShip(3122, ApiShipType.kaiboukan)
      ])
    ],
    [1015, createFleetSvData(categoryShips(ApiShipCategory.akizuki, 3, 3130))],
    [1016, createFleetSvData(ids([968]))],
    [1017, createFleetSvData(ids([409, 625, 425]))],
    [1018, createFleetSvData([fleetShip(85), fleetShip(86), dd(3140), dd(3141)])],
    [
      1019,
      createFleetSvData([
        fleetShip(85),
        fleetShip(86),
        fleetShip(3150, ApiShipType.kutikukan, ApiShipCategory.yuugumo),
        fleetShip(3151, ApiShipType.kutikukan, ApiShipCategory.yuugumo)
      ])
    ],
    [1020, createFleetSvData(ids([78, 79]))],
    [1021, createFleetSvData(ids([956, 410]))],
    [1022, createFleetSvData(ids([674, 675, 485]))],
    [1023, createFleetSvData(ids([981, 69, 674]))],
    [1024, createFleetSvData(ids([973]))],
    [
      1025,
      createFleetSvData([
        fleetShip(986, ApiShipType.kutikukan, ApiShipCategory.fubuki),
        fleetShip(3160, ApiShipType.kutikukan, ApiShipCategory.fubuki)
      ])
    ],
    [1026, createFleetSvData(ids([114, 49, 18, 631]))],
    [1027, createFleetSvData(ids([64, 63, 100, 101, 114]))],
    [1028, createFleetSvData(ids([925]))],
    [1029, createFleetSvData(ids([983, 674, 675]))],
    [
      1030,
      createFleetSvData([
        fleetShip(3210, ApiShipType.kutikukan, ApiShipCategory.fletcher),
        fleetShip(3211, ApiShipType.kutikukan, ApiShipCategory.fletcher),
        fleetShip(3212, ApiShipType.jyuujyun, ApiShipCategory.northampton)
      ])
    ],
    [1031, createFleetSvData(ids([79, 544, 923]))],
    [
      1032,
      createFleetSvData([
        fleetShip(3220, ApiShipType.teisoku_senkan, ApiShipCategory.none, 88),
        fleetShip(3221, ApiShipType.kousoku_senkan, ApiShipCategory.none, 90),
        fleetShip(3222, ApiShipType.keijyun, ApiShipCategory.none, 89),
        fleetShip(3223, ApiShipType.kutikukan, ApiShipCategory.none, 88),
        fleetShip(3224, ApiShipType.kutikukan, ApiShipCategory.none, 95)
      ])
    ],
    [1033, createFleetSvData([fleetShip(945), dd(3230), dd(3231)])],
    [1034, createFleetSvData([fleetShip(953), fleetShip(3240, ApiShipType.kaiboukan)])],
    [1035, createFleetSvData([fleetShip(138), dd(3250), dd(3251), dd(3252)])],
    [
      1036,
      createFleetSvData([
        fleetShip(3260, ApiShipType.yourikukan),
        fleetShip(3261, ApiShipType.hokyuukan),
        fleetShip(3262, ApiShipType.kaiboukan),
        fleetShip(3263, ApiShipType.kaiboukan)
      ])
    ],
    [1037, createFleetSvData(ids([132]))],
    [1039, createFleetSvData(ids([114, 15, 95, 671]))],
    [1040, createFleetSvData(ids([923, 93, 45]))],
    [1041, createFleetSvData(ids([982, 674, 675]))],
    [1042, createFleetSvData(ids([1031, 674, 675]))],
    [1043, createFleetSvData(ids([79, 521]))],
    [1044, createFleetSvData(ids([1033, 485]))],
    [
      1045,
      createFleetSvData([
        fleetShip(1035),
        fleetShip(3270, ApiShipType.kutikukan, ApiShipCategory.fubuki)
      ])
    ],
    [
      1046,
      createFleetSvData([
        fleetShip(900),
        dd(3280),
        fleetShip(3281, ApiShipType.kaiboukan),
        fleetShip(3282, ApiShipType.kaiboukan)
      ])
    ],
    [1047, createFleetSvData(ids([1034, 69, 124]))],
    [
      1048,
      createFleetSvData([
        fleetShip(3290, ApiShipType.hokyuukan),
        dd(3291),
        dd(3292),
        fleetShip(3293, ApiShipType.kaiboukan),
        fleetShip(3294, ApiShipType.kaiboukan)
      ])
    ],
    [
      1049,
      createFleetSvData([
        fleetShip(3300, ApiShipType.yourikukan),
        dd(3301),
        fleetShip(3302, ApiShipType.kaiboukan),
        fleetShip(3303, ApiShipType.kaiboukan)
      ])
    ],
    [
      1118,
      createFleetSvData([
        {
          ...fleetShip(920),
          slotitemIds: [284]
        }
      ])
    ]
  ])

  it('shows current and required counts for migrated composition rules', () => {
    const svdata = createFleetSvData([dd(1), dd(2), fleetShip(3, ApiShipType.keijyun)])

    expect(questFleetChecks(svdata, 102)).toEqual([
      {
        kind: 'ship-type',
        label: '駆逐艦 4隻以上',
        current: 2,
        required: 4,
        satisfied: false
      }
    ])
    expect(questFleetChecks(svdata, 134)).toEqual([
      {
        kind: 'flagship',
        label: '旗艦 Lv90～99',
        current: 1,
        required: 90,
        satisfied: false
      }
    ])
  })

  it('keeps every migrated rule aligned with the legacy matcher', () => {
    const negativeFleet = createFleetSvData([
      fleetShip(9001, ApiShipType.keijyun),
      fleetShip(9002, ApiShipType.keijyun),
      fleetShip(9003, ApiShipType.keijyun)
    ])

    const migratedQuestIds = [
      ...Array.from({ length: 41 }, (_, index) => 101 + index),
      ...Array.from({ length: 39 }, (_, index) => 142 + index).filter(
        (questId) => ![154, 159, 160].includes(questId)
      ),
      ...Array.from({ length: 19 }, (_, index) => 181 + index),
      206,
      207,
      208,
      209,
      215,
      219,
      222,
      223,
      224,
      225,
      227,
      231,
      232,
      233,
      234,
      235,
      236,
      237,
      238,
      239,
      240,
      244,
      245,
      246,
      247,
      248,
      249,
      250,
      ...Array.from({ length: 49 }, (_, index) => 251 + index).filter(
        (questId) => ![256, 261, 265, 286].includes(questId)
      ),
      ...Array.from({ length: 66 }, (_, index) => 318 + index).filter(
        (questId) => ![321, 326, 341].includes(questId)
      ),
      801,
      802,
      803,
      804,
      806,
      817,
      824,
      840,
      841,
      843,
      844,
      846,
      847,
      861,
      862,
      869,
      873,
      875,
      882,
      888,
      894,
      901,
      902,
      903,
      904,
      905,
      906,
      907,
      908,
      910,
      912,
      914,
      915,
      923,
      927,
      928,
      929,
      931,
      932,
      933,
      934,
      935,
      936,
      937,
      938,
      939,
      940,
      941,
      942,
      943,
      944,
      945,
      946,
      947,
      948,
      949,
      952,
      953,
      954,
      955,
      957,
      958,
      959,
      960,
      961,
      962,
      963,
      964,
      965,
      967,
      968,
      969,
      970,
      971,
      972,
      973,
      974,
      975,
      976,
      977,
      978,
      979,
      980,
      981,
      982,
      983,
      984,
      985,
      986,
      987,
      988,
      989,
      990,
      991,
      992,
      993,
      994,
      995,
      996,
      997,
      998,
      ...Array.from({ length: 37 }, (_, index) => 1001 + index),
      ...Array.from({ length: 11 }, (_, index) => 1039 + index),
      1118
    ]
    const registeredLegacyMatcherIds = Array.from({ length: 2000 }, (_, index) => index + 1).filter(
      (questId) => {
        const stuff = getQuestStuff(questId) as { isDeckMatch?: unknown } | undefined
        return typeof stuff?.isDeckMatch === 'function'
      }
    )

    expect(migratedQuestIds).toEqual(registeredLegacyMatcherIds)

    for (const questId of migratedQuestIds) {
      const positiveFleet = positiveFleetByQuest.get(questId)
      expect(positiveFleet, `positive fixture for quest ${questId}`).toBeDefined()
      const positiveChecks = questFleetChecks(positiveFleet!, questId)
      expect(positiveChecks, `structured checks for quest ${questId}`).toBeDefined()
      expect(
        positiveChecks!.every((check) => check.satisfied === true),
        `structured positive result for quest ${questId}`
      ).toBe(true)
      expect(
        questIsDeckMatch(positiveFleet!, questId),
        `legacy positive result for quest ${questId}`
      ).toBe(true)

      const negativeChecks = questFleetChecks(negativeFleet, questId)!
      expect(
        negativeChecks.every((check) => check.satisfied === true),
        `negative consistency for quest ${questId}`
      ).toBe(questIsDeckMatch(negativeFleet, questId))
    }
  })

  it('reports an unavailable second fleet as an unmet local condition', () => {
    const svdata = createFleetSvData(ids([1]), null)

    expect(questFleetChecks(svdata, 117)).toEqual([
      {
        kind: 'deck',
        label: '第2艦隊データ',
        current: undefined,
        required: undefined,
        satisfied: false
      }
    ])
    expect(questIsDeckMatch(svdata, 117)).toBe(false)
  })

  it('keeps fixed ship positions distinct from fleet-wide presence', () => {
    const correct = createFleetSvData(ids([541, 573]))
    const reversed = createFleetSvData(ids([573, 541]))

    expect(questFleetChecks(correct, 158)).toContainEqual({
      kind: 'specific-ships',
      label: '第2艦 艦573',
      current: 1,
      required: 1,
      satisfied: true
    })
    expect(questFleetChecks(reversed, 158)?.some((check) => check.satisfied === false)).toBe(true)
    expect(questIsDeckMatch(reversed, 158)).toBe(false)
  })

  it('reports fleet-size ranges and third-fleet availability', () => {
    const oversized = createFleetSvData(ids([240, 326, 419, 1300, 1301]))
    const missingThirdFleet = createFleetSvData(ids([1]), [], null)

    expect(questFleetChecks(oversized, 190)?.[0]).toEqual({
      kind: 'ship-count',
      label: '編成隻数 3～4隻',
      current: 5,
      required: 3,
      satisfied: false
    })
    expect(questIsDeckMatch(oversized, 190)).toBe(false)
    expect(questFleetChecks(missingThirdFleet, 187)).toEqual([
      {
        kind: 'deck',
        label: '第3艦隊データ',
        current: undefined,
        required: undefined,
        satisfied: false
      }
    ])
  })

  it('checks level requirements only on the remaining ships for quest 193', () => {
    const fleet = createFleetSvData([
      fleetShip(566, ApiShipType.kutikukan, ApiShipCategory.kagerou, 1),
      fleetShip(567, ApiShipType.kutikukan, ApiShipCategory.kagerou, 1),
      fleetShip(568, ApiShipType.kutikukan, ApiShipCategory.kagerou, 1),
      fleetShip(1310, ApiShipType.kutikukan, ApiShipCategory.kagerou, 70),
      fleetShip(1311, ApiShipType.kutikukan, ApiShipCategory.yuugumo, 69),
      fleetShip(1312, ApiShipType.kutikukan, ApiShipCategory.yuugumo, 80)
    ])

    expect(questFleetChecks(fleet, 193)).toContainEqual({
      kind: 'ship-category',
      label: '指定艦以外の陽炎型 / 夕雲型 Lv70以上 3隻',
      current: 2,
      required: 3,
      satisfied: false
    })
    expect(questIsDeckMatch(fleet, 193)).toBe(false)
  })

  it('distinguishes the active sortie fleet from an unlocked fleet', () => {
    const secondFleetSortie = createFleetSvData(ids([1]), ids([2]), [], ApiDeckPortId.deck2st)
    const firstFleetSortie = createFleetSvData(ids([1]), ids([2]))

    expect(questFleetChecks(secondFleetSortie, 215)).toEqual([
      {
        kind: 'deck',
        label: '出撃艦隊 第2艦隊',
        current: 2,
        required: 2,
        satisfied: true
      }
    ])
    expect(questFleetChecks(firstFleetSortie, 215)?.[0].satisfied).toBe(false)
    expect(questIsDeckMatch(firstFleetSortie, 215)).toBe(false)
  })

  it('evaluates both valid composition branches for quest 237', () => {
    const fiveShipBranch = createFleetSvData([ca(65), dd(471), ca(1540), dd(1541), dd(1542)])
    const invalidBranch = createFleetSvData([
      ca(65),
      dd(471),
      fleetShip(1550, ApiShipType.keijyun),
      dd(1551),
      dd(1552)
    ])

    expect(questFleetChecks(fiveShipBranch, 237)).toContainEqual({
      kind: 'alternative',
      label: '6隻（駆逐艦5）/ 5隻（重巡2・駆逐艦3）',
      current: 1,
      required: 1,
      satisfied: true
    })
    expect(questIsDeckMatch(fiveShipBranch, 237)).toBe(true)
    expect(questFleetChecks(invalidBranch, 237)?.at(-1)?.satisfied).toBe(false)
    expect(questIsDeckMatch(invalidBranch, 237)).toBe(false)
  })

  it('enforces count ranges and allowed ship types for quest 254', () => {
    const invalidExtraType = createFleetSvData([
      fleetShip(1800, ApiShipType.keijyun),
      dd(1801),
      dd(1802),
      dd(1803),
      fleetShip(1804, ApiShipType.kei_kuubo),
      ca(1805)
    ])

    expect(questFleetChecks(invalidExtraType, 254)).toContainEqual({
      kind: 'ship-type',
      label: '駆逐艦 3～4隻',
      current: 3,
      required: 3,
      satisfied: true
    })
    expect(questFleetChecks(invalidExtraType, 254)?.at(-1)).toMatchObject({
      kind: 'ship-type',
      current: 5,
      required: 6,
      satisfied: false
    })
    expect(questIsDeckMatch(invalidExtraType, 254)).toBe(false)
  })

  it('accepts either Akashi or a seaplane tender for quest 291', () => {
    const seaplaneTenderBranch = createFleetSvData([
      fleetShip(183, ApiShipType.keijyun),
      fleetShip(1810, ApiShipType.suibo)
    ])
    const invalidBranch = createFleetSvData([fleetShip(183, ApiShipType.keijyun), dd(1811)])

    expect(questFleetChecks(seaplaneTenderBranch, 291)).toContainEqual({
      kind: 'alternative',
      label: '随伴艦 明石 または 水上機母艦',
      current: 1,
      required: 1,
      satisfied: true
    })
    expect(questIsDeckMatch(seaplaneTenderBranch, 291)).toBe(true)
    expect(questFleetChecks(invalidBranch, 291)?.at(-1)?.satisfied).toBe(false)
    expect(questIsDeckMatch(invalidBranch, 291)).toBe(false)
  })

  it('evaluates all three fleet branches for quest 329', () => {
    const submarineBranch = createFleetSvData([
      fleetShip(2400, ApiShipType.sensuibokan),
      fleetShip(2401, ApiShipType.sensuikan),
      fleetShip(2402, ApiShipType.sensuikan),
      fleetShip(2403, ApiShipType.sensui_kuubo)
    ])
    const landingBranch = createFleetSvData([
      fleetShip(2410, ApiShipType.yourikukan),
      dd(2411),
      dd(2412),
      dd(2413),
      dd(2414),
      dd(2415)
    ])

    expect(questFleetChecks(submarineBranch, 329)?.[0].satisfied).toBe(true)
    expect(questIsDeckMatch(submarineBranch, 329)).toBe(true)
    expect(questFleetChecks(landingBranch, 329)?.[0].satisfied).toBe(true)
    expect(questIsDeckMatch(landingBranch, 329)).toBe(true)
  })

  it('keeps exact remodel ids distinct from ship-family expansion', () => {
    const laterRemodel = createFleetSvData([fleetShip(2499), dd(2420), dd(2421), dd(2422)])
    laterRemodel.shipMstIds = (id: number) => (id === 501 ? [501, 2499] : [id])

    expect(questFleetChecks(laterRemodel, 351)?.[0].satisfied).toBe(false)
    expect(questIsDeckMatch(laterRemodel, 351)).toBe(false)
  })

  it('checks the designated flagship slots for quest 361', () => {
    const missingSecondItem = createFleetSvData([
      {
        ...fleetShip(2430),
        slotitemIds: [42, 1]
      },
      fleetShip(2431, ApiShipType.kaiboukan),
      fleetShip(2432, ApiShipType.kaiboukan)
    ])

    expect(questFleetChecks(missingSecondItem, 361)?.[0]).toMatchObject({
      kind: 'equipment',
      current: 1,
      required: 2,
      satisfied: false
    })
    expect(questIsDeckMatch(missingSecondItem, 361)).toBe(false)
  })

  it('preserves additive category and named-ship counting for quest 370', () => {
    const overlappingShip = createFleetSvData([
      fleetShip(465, ApiShipType.kaiboukan, ApiShipCategory.tyougataKaiboukan),
      fleetShip(524),
      fleetShip(525)
    ])

    expect(questFleetChecks(overlappingShip, 370)?.[0]).toMatchObject({
      kind: 'combined-count',
      current: 4,
      required: 4,
      satisfied: true
    })
    expect(questIsDeckMatch(overlappingShip, 370)).toBe(true)
  })

  it('does not count Danyang itself as one of three escort destroyers for quest 933', () => {
    const valid = createFleetSvData([
      fleetShip(651, ApiShipType.kutikukan),
      dd(2790),
      dd(2791),
      dd(2792)
    ])
    const missingEscort = createFleetSvData([
      fleetShip(651, ApiShipType.kutikukan),
      dd(2800),
      dd(2801)
    ])

    expect(questFleetChecks(valid, 933)?.[0].satisfied).toBe(true)
    expect(questIsDeckMatch(valid, 933)).toBe(true)
    expect(questFleetChecks(missingEscort, 933)?.[0].satisfied).toBe(false)
    expect(questIsDeckMatch(missingEscort, 933)).toBe(false)
  })

  it('separates the flagship from the four escort slots for quest 941', () => {
    const trainingCruiserBranch = createFleetSvData([
      fleetShip(2810, ApiShipType.renjyun),
      dd(2811),
      dd(2812),
      fleetShip(2813, ApiShipType.kaiboukan),
      fleetShip(2814, ApiShipType.sensuikan)
    ])
    const invalidEscort = createFleetSvData([
      fleetShip(2820, ApiShipType.renjyun),
      dd(2821),
      dd(2822),
      fleetShip(2823, ApiShipType.kaiboukan),
      ca(2824)
    ])

    expect(questFleetChecks(trainingCruiserBranch, 941)?.at(-1)?.satisfied).toBe(true)
    expect(questIsDeckMatch(trainingCruiserBranch, 941)).toBe(true)
    expect(questFleetChecks(invalidEscort, 941)?.at(-1)?.satisfied).toBe(false)
    expect(questIsDeckMatch(invalidEscort, 941)).toBe(false)
  })

  it('requires the first two ships to use the same valid type branch for quest 953', () => {
    const mixedFront = createFleetSvData([
      fleetShip(2940, ApiShipType.kaiboukan),
      fleetShip(2941, ApiShipType.suibo),
      dd(2942),
      dd(2943)
    ])

    expect(questFleetChecks(mixedFront, 953)?.[1]).toMatchObject({
      kind: 'alternative',
      satisfied: false
    })
    expect(questIsDeckMatch(mixedFront, 953)).toBe(false)
  })

  it('keeps the Taigei-only exact id exception for quest 963', () => {
    const laterRemodel = createFleetSvData(ids([2950, 953]))
    laterRemodel.shipMstIds = (id: number) => (id === 184 ? [184, 2950] : [id])

    expect(questFleetChecks(laterRemodel, 963)?.[0].satisfied).toBe(false)
    expect(questIsDeckMatch(laterRemodel, 963)).toBe(false)
  })

  it('rejects carriers even when the foreign-ship count is met for quest 973', () => {
    const carrierIncluded = createFleetSvData([
      fleetShip(2960, ApiShipType.seiki_kuubo, ApiShipCategory.yorktown),
      fleetShip(2961, ApiShipType.kutikukan, ApiShipCategory.fletcher),
      fleetShip(2962, ApiShipType.kutikukan, ApiShipCategory.johnCButle)
    ])

    expect(questFleetChecks(carrierIncluded, 973)?.[0]).toMatchObject({
      kind: 'ship-type',
      current: 1,
      required: 0,
      satisfied: false
    })
    expect(questIsDeckMatch(carrierIncluded, 973)).toBe(false)
  })

  it('checks the first three positions rather than fleet-wide totals for quest 979', () => {
    const wrongThirdPosition = createFleetSvData([
      fleetShip(3060, ApiShipType.kaiboukan),
      fleetShip(3061, ApiShipType.kaiboukan),
      dd(3062),
      fleetShip(3063, ApiShipType.kaiboukan)
    ])

    expect(questFleetChecks(wrongThirdPosition, 979)?.[3]).toMatchObject({
      kind: 'ship-type',
      satisfied: false
    })
    expect(questIsDeckMatch(wrongThirdPosition, 979)).toBe(false)
  })

  it('keeps quest 993 restricted to the exact remodel id', () => {
    const laterRemodel = createFleetSvData(ids([3070]))
    laterRemodel.shipMstIds = (id: number) => (id === 951 ? [951, 3070] : [id])

    expect(questFleetChecks(laterRemodel, 993)?.[0].satisfied).toBe(false)
    expect(questIsDeckMatch(laterRemodel, 993)).toBe(false)
  })

  it('accepts every alternative escort composition for quest 997', () => {
    const seaplaneTenderBranch = createFleetSvData([
      fleetShip(3080, ApiShipType.suibo),
      fleetShip(3081, ApiShipType.suibo)
    ])
    const mixedInvalid = createFleetSvData([
      dd(3090),
      dd(3091),
      fleetShip(3092, ApiShipType.kaiboukan),
      fleetShip(3093, ApiShipType.suibo)
    ])

    expect(questFleetChecks(seaplaneTenderBranch, 997)?.[0].satisfied).toBe(true)
    expect(questIsDeckMatch(seaplaneTenderBranch, 997)).toBe(true)
    expect(questFleetChecks(mixedInvalid, 997)?.[0].satisfied).toBe(false)
    expect(questIsDeckMatch(mixedInvalid, 997)).toBe(false)
  })

  it('keeps quest 1001 restricted to exact master id 955', () => {
    const laterRemodel = createFleetSvData(ids([3170, 49, 425]))
    laterRemodel.shipMstIds = (id: number) => (id === 955 ? [955, 3170] : [id])

    expect(questFleetChecks(laterRemodel, 1001)?.[0].satisfied).toBe(false)
    expect(questIsDeckMatch(laterRemodel, 1001)).toBe(false)
  })

  it('rejects non-coast-defense escorts for quest 1012', () => {
    const extraCruiser = createFleetSvData([
      fleetShip(3180, ApiShipType.kaiboukan, ApiShipCategory.ukuru),
      fleetShip(3181, ApiShipType.kaiboukan),
      ca(3182)
    ])

    expect(questFleetChecks(extraCruiser, 1012)?.at(-1)).toMatchObject({
      kind: 'ship-type',
      current: 2,
      required: 3,
      satisfied: false
    })
    expect(questIsDeckMatch(extraCruiser, 1012)).toBe(false)
  })

  it('supports both valid flagship branches for quest 1024', () => {
    const norgeBranch = createFleetSvData([
      fleetShip(3190, ApiShipType.kaiboukan, ApiShipCategory.norge),
      fleetShip(3191, ApiShipType.kaiboukan, ApiShipCategory.norge)
    ])
    const loneNorge = createFleetSvData([
      fleetShip(3200, ApiShipType.kaiboukan, ApiShipCategory.norge),
      dd(3201)
    ])

    expect(questFleetChecks(norgeBranch, 1024)?.[0].satisfied).toBe(true)
    expect(questIsDeckMatch(norgeBranch, 1024)).toBe(true)
    expect(questFleetChecks(loneNorge, 1024)?.[0].satisfied).toBe(false)
    expect(questIsDeckMatch(loneNorge, 1024)).toBe(false)
  })

  it('excludes the flagship from escort counts for quest 1031', () => {
    const onlyOneEscort = createFleetSvData(ids([79, 544]))

    expect(questFleetChecks(onlyOneEscort, 1031)?.[1]).toMatchObject({
      kind: 'specific-ships',
      current: 1,
      required: 2,
      satisfied: false
    })
    expect(questIsDeckMatch(onlyOneEscort, 1031)).toBe(false)
  })

  it('applies the level threshold to every required ship group for quest 1032', () => {
    const lowLevelBattleship = createFleetSvData([
      fleetShip(3310, ApiShipType.teisoku_senkan, ApiShipCategory.none, 88),
      fleetShip(3311, ApiShipType.kousoku_senkan, ApiShipCategory.none, 87),
      fleetShip(3312, ApiShipType.keijyun, ApiShipCategory.none, 88),
      fleetShip(3313, ApiShipType.kutikukan, ApiShipCategory.none, 88),
      fleetShip(3314, ApiShipType.kutikukan, ApiShipCategory.none, 88)
    ])

    expect(questFleetChecks(lowLevelBattleship, 1032)?.[0]).toMatchObject({
      current: 1,
      required: 2,
      satisfied: false
    })
    expect(questIsDeckMatch(lowLevelBattleship, 1032)).toBe(false)
  })

  it('checks the second ship position specifically for quest 1045', () => {
    const fubukiInThirdPosition = createFleetSvData([
      fleetShip(1035),
      ca(3320),
      fleetShip(3321, ApiShipType.kutikukan, ApiShipCategory.fubuki)
    ])

    expect(questFleetChecks(fubukiInThirdPosition, 1045)?.at(-1)).toMatchObject({
      kind: 'ship-category',
      satisfied: false
    })
    expect(questIsDeckMatch(fubukiInThirdPosition, 1045)).toBe(false)
  })

  it('requires Hedgehog in the flagship first slot for quest 1118', () => {
    const wrongSlot = createFleetSvData([
      {
        ...fleetShip(920),
        slotitemIds: [1, 284]
      }
    ])

    expect(questFleetChecks(wrongSlot, 1118)?.[1]).toMatchObject({
      kind: 'equipment',
      current: 0,
      required: 1,
      satisfied: false
    })
    expect(questIsDeckMatch(wrongSlot, 1118)).toBe(false)
  })
})

describe('quest guide equipment preparation', () => {
  it('excludes locked and equipped items from disposable stock', () => {
    const stock = buildQuestGuideEquipmentStock(
      [
        {
          itemId: 1,
          name: '12cm単装砲',
          type: SlotitemType.SmallMainGun
        }
      ],
      [
        { instanceId: 101, itemId: 1, locked: false, level: 4, proficiency: 2 },
        { instanceId: 102, itemId: 1, locked: true },
        { instanceId: 103, itemId: 1, locked: false },
        { instanceId: 104, itemId: 1, locked: false }
      ],
      new Set([103])
    )

    expect(stock[0]).toMatchObject({
      owned: 4,
      disposable: 2,
      ownedVariants: expect.arrayContaining([{ level: 4, proficiency: 2 }])
    })
  })

  it('distinguishes held-item requirements from disposable-item requirements', () => {
    const stock = [
      {
        itemId: 145,
        name: '戦闘糧食',
        type: SlotitemType.CombatRation,
        owned: 1,
        disposable: 0
      },
      {
        itemId: 1,
        name: '12cm単装砲',
        type: SlotitemType.SmallMainGun,
        owned: 5,
        disposable: 3
      }
    ]

    expect(questGuideEquipmentRequirements(668, stock)).toEqual([
      {
        kind: 'hold',
        label: '戦闘糧食',
        required: 2,
        available: 1,
        missing: 1
      }
    ])
    expect(questGuideEquipmentRequirements(673, stock)).toEqual([
      {
        kind: 'discard',
        label: '小口径主砲',
        required: 4,
        available: 3,
        missing: 1
      }
    ])
  })

  it('counts generic disposal tasks and flagship equipment conditions', () => {
    const stock = [
      {
        itemId: 17,
        name: '天山',
        type: SlotitemType.TorpedoBomber,
        owned: 3,
        disposable: 2,
        ownedVariants: [
          { level: 0, proficiency: 0 },
          { level: 0, proficiency: 0 },
          { level: 0, proficiency: 0 }
        ]
      },
      {
        itemId: 93,
        name: '天山一二型(友永隊)',
        type: SlotitemType.TorpedoBomber,
        owned: 1,
        disposable: 0,
        ownedVariants: [{ level: 0, proficiency: 0 }]
      }
    ]

    expect(
      questGuideEquipmentRequirements(614, stock, {
        flagship_slotitem_ids: [93],
        flagship_slotitem_lvl: [0]
      })
    ).toEqual([
      {
        kind: 'discard',
        label: '天山',
        required: 2,
        available: 2,
        missing: 0
      },
      {
        kind: 'equip',
        label: '天山一二型(友永隊)',
        required: 1,
        available: 1,
        missing: 0
      }
    ])

    expect(questGuideEquipmentRequirements(604, stock)[0]).toMatchObject({
      kind: 'discard',
      label: '任意の装備',
      required: 1,
      available: 2
    })
  })

  it('allocates improved and proficiency-qualified equipment without double counting', () => {
    const stock = [
      {
        itemId: 45,
        name: '零式水上偵察機',
        type: SlotitemType.RecSeaplane,
        owned: 2,
        disposable: 0,
        ownedVariants: [
          { level: 3, proficiency: 7 },
          { level: 0, proficiency: 0 }
        ]
      }
    ]

    const requirements = questGuideEquipmentRequirements(604, stock, {
      flagship_slotitem_ids: [45, 45, 45],
      flagship_slotitem_lvl: [3],
      flagship_slotitem_alv_max: true
    }).filter((requirement) => requirement.kind === 'equip')

    expect(requirements).toEqual([
      {
        kind: 'equip',
        label: '零式水上偵察機 ★+3（熟練度max）',
        required: 1,
        available: 1,
        missing: 0
      },
      {
        kind: 'equip',
        label: '零式水上偵察機',
        required: 2,
        available: 1,
        missing: 1
      }
    ])
  })
})

describe('quest guide history', () => {
  it('learns a possible unlock only after a completed quest disappears', () => {
    const initial = updateQuestGuideHistory(
      createQuestGuideHistory('2026-07-25T00:00:00.000Z'),
      [
        createQuest({
          api_no: 101,
          api_title: '最初の任務',
          api_state: ApiQuestState.completed
        })
      ],
      '2026-07-25T00:01:00.000Z'
    )
    const updated = updateQuestGuideHistory(
      initial,
      [createQuest({ api_no: 102, api_title: '次の任務' })],
      '2026-07-25T00:02:00.000Z'
    )

    expect(updated.learnedUnlocks).toEqual([
      {
        from: 101,
        fromTitle: '最初の任務',
        to: 102,
        title: '次の任務',
        count: 1,
        lastSeenAt: '2026-07-25T00:02:00.000Z'
      }
    ])
  })

  it('does not infer a chain from an unfinished quest disappearing', () => {
    const initial = updateQuestGuideHistory(createQuestGuideHistory(), [
      createQuest({ api_no: 101, api_state: ApiQuestState.in_progress })
    ])
    const updated = updateQuestGuideHistory(initial, [createQuest({ api_no: 102 })])

    expect(updated.learnedUnlocks).toEqual([])
  })
})

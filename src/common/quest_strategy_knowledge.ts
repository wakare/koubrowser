import { ApiFormation, ApiShipType, SlotitemType } from '@common/kcs'
import { normalizeQuestStrategyRecipes, type QuestStrategyRecipe } from '@common/quest_strategy'

export interface QuestStrategyKnowledgeBundle {
  schemaVersion: 1
  version: string
  recipes: readonly QuestStrategyRecipe[]
}

const ReviewedAt = '2026-07-31T00:00:00.000+09:00'
const ValidUntil = '2027-07-31T00:00:00.000+09:00'
const ReviewBy = '2026-10-31T00:00:00.000+09:00'

const PeriodicSortieEvidence = {
  sourceId: 'wikiwiki-periodic-sortie',
  sourceLabel: '艦これ攻略 Wiki - 定期出撃任務',
  url: 'https://wikiwiki.jp/kancolle/任務/出撃定期',
  reviewedAt: ReviewedAt,
  validUntil: ValidUntil,
  confidence: 'supported',
  summary: '定期任務の対象海域、勝利条件、編成条件を確認'
}

const recipes = [
  {
    schemaVersion: 1,
    id: 'normal-1-5-periodic-asw',
    revision: 1,
    title: '1-5 定期対潜任務まとめ',
    status: 'approved',
    questIds: [261, 265, 893],
    objectives: [
      { questId: 261, result: 'A', requiredCount: 3 },
      { questId: 265, result: 'A', requiredCount: 10 },
      { questId: 893, result: 'S', requiredCount: 3 }
    ],
    mapKey: '1-5',
    routeLabels: ['A-D-F-G-J'],
    targetNodes: ['J'],
    fleet: {
      minimumShips: 4,
      maximumShips: 4,
      shipTypeConstraints: []
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.Sonar, SlotitemType.LargeSonar],
        minimum: 4,
        required: false,
        label: 'ソナー系 4 個以上'
      },
      {
        equipmentTypeIds: [SlotitemType.DepthCharge],
        minimum: 4,
        required: false,
        label: '爆雷系 4 個以上'
      }
    ],
    formations: [
      {
        formationId: ApiFormation.tanou,
        label: '単横陣',
        when: 'A・D・F・J の対潜戦'
      }
    ],
    actions: [
      '対象任務を同時に受注してから出撃する',
      '4隻編成とし、通常戦艦・正規空母・潜水艦を含めず、軽巡級2隻以下・軽空母1隻以下にする',
      'Jボスで各任務の要求勝利回数までA勝利以上、任務893はS勝利を重ねる'
    ],
    cost: 'low',
    risk: 'low',
    evidence: [
      {
        sourceId: 'wikiwiki-map-1-5',
        sourceLabel: '艦これ攻略 Wiki - 1-5',
        url: 'https://wikiwiki.jp/kancolle/鎮守府海域/1-5',
        reviewedAt: ReviewedAt,
        validUntil: ValidUntil,
        confidence: 'supported',
        summary: '4隻のボス固定条件、対潜陣形、定期任務の勝利回数を確認'
      },
      PeriodicSortieEvidence
    ],
    validity: {
      reviewBy: ReviewBy
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-4-2-western-periodic',
    revision: 1,
    title: '4-2 西方定期任務まとめ',
    status: 'approved',
    questIds: [229, 264, 845],
    objectives: [
      { questId: 229, result: 'victory', requiredCount: 12 },
      { questId: 264, result: 'S', requiredCount: 1 },
      { questId: 845, result: 'S', requiredCount: 1 }
    ],
    mapKey: '4-2',
    routeLabels: ['A-C-L', 'B-D-C-L'],
    targetNodes: ['L'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.kei_kuubo, ApiShipType.seiki_kuubo, ApiShipType.soukou_kuubo],
          minimum: 2,
          label: '空母系 2 隻以上'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 3,
          label: '駆逐艦 3 隻以上'
        },
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 1,
          label: '軽巡洋艦 1 隻以上'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.Fighter],
        minimum: 2,
        required: false,
        label: '艦上戦闘機 2 個以上'
      }
    ],
    formations: [
      {
        formationId: ApiFormation.tanjyuu,
        label: '単縦陣',
        when: '通常戦・Lボス'
      }
    ],
    airState: {
      target: 'superiority',
      summary: '制空値85以上を目安にするとDマス航空優勢とLボス制空権確保を狙える'
    },
    actions: [
      '対象任務を同時に受注してから出撃する',
      '空母系2・軽巡1・駆逐3の6隻でA-C-LまたはB-D-C-Lを狙う',
      'LボスでS勝利し、任務229の残数があれば同じ海域で勝利を重ねる'
    ],
    cost: 'medium',
    risk: 'medium',
    evidence: [
      {
        sourceId: 'wikiwiki-map-4-2',
        sourceLabel: '艦これ攻略 Wiki - 4-2',
        url: 'https://wikiwiki.jp/kancolle/西方海域/4-2',
        reviewedAt: ReviewedAt,
        validUntil: ValidUntil,
        confidence: 'supported',
        summary: '空母2・軽巡1・駆逐3のルート候補、制空目安、定期任務条件を確認'
      },
      PeriodicSortieEvidence
    ],
    validity: {
      reviewBy: ReviewBy
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-1-4-light-fleet-periodic',
    revision: 1,
    title: '1-4 軽巡・駆逐定期任務まとめ',
    status: 'approved',
    questIds: [257, 280, 284],
    objectives: [
      { questId: 257, result: 'S', requiredCount: 1 },
      { questId: 280, result: 'S', requiredCount: 1 },
      { questId: 284, result: 'S', requiredCount: 1 }
    ],
    mapKey: '1-4',
    routeLabels: ['A-D-E-H-L', 'A-D-G-J-L', 'B-C-F-E-H-L'],
    targetNodes: ['L'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 1,
          label: '軽巡洋艦 1 隻以上'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 4,
          label: '駆逐艦 4 隻以上'
        }
      ]
    },
    equipmentTypeConstraints: [],
    formations: [
      {
        formationId: ApiFormation.tanjyuu,
        label: '単縦陣',
        when: '水上戦・Lボス'
      }
    ],
    airState: {
      target: 'denial',
      summary: '制空権喪失でも達成可能。搭載可能なら水上爆撃機や水上戦闘機で敵弾着の抑止を検討'
    },
    actions: [
      '対象任務を同時に受注してから出撃する',
      '軽巡洋艦を旗艦にし、軽巡洋艦1〜2・駆逐艦4〜5の合計6隻だけで編成する',
      'LボスでS勝利する'
    ],
    cost: 'low',
    risk: 'medium',
    evidence: [
      {
        sourceId: 'wikiwiki-map-1-4',
        sourceLabel: '艦これ攻略 Wiki - 1-4',
        url: 'https://wikiwiki.jp/kancolle/鎮守府海域/1-4',
        reviewedAt: ReviewedAt,
        validUntil: ValidUntil,
        confidence: 'supported',
        summary: '軽巡旗艦・駆逐4以上の両立編成、ボス固定候補、定期任務条件を確認'
      },
      PeriodicSortieEvidence
    ],
    validity: {
      reviewBy: ReviewBy
    }
  }
]

export const BundledQuestStrategyKnowledge: QuestStrategyKnowledgeBundle = {
  schemaVersion: 1,
  version: '2026-07-31.1',
  recipes: normalizeQuestStrategyRecipes(recipes)
}

import { ApiFormation, ApiShipType, SlotitemType } from '@common/kcs'
import { normalizeQuestStrategyRecipes, type QuestStrategyRecipe } from '@common/quest_strategy'

const MaximumStrategyRecipes = 512
const KnowledgeVersionPattern = /^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/

export interface QuestStrategyKnowledgeBundle {
  schemaVersion: 1
  version: string
  recipes: readonly QuestStrategyRecipe[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateQuestStrategyKnowledgeBundle(value: unknown): QuestStrategyKnowledgeBundle {
  if (!isRecord(value)) {
    throw new Error('quest strategy knowledge must be an object')
  }
  const keys = Object.keys(value)
  if (
    keys.length !== 3 ||
    !keys.includes('schemaVersion') ||
    !keys.includes('version') ||
    !keys.includes('recipes')
  ) {
    throw new Error('quest strategy knowledge has unsupported or missing fields')
  }
  if (value.schemaVersion !== 1) {
    throw new Error('unsupported quest strategy knowledge schema')
  }
  if (typeof value.version !== 'string' || !KnowledgeVersionPattern.test(value.version)) {
    throw new Error('invalid quest strategy knowledge version')
  }
  if (
    !Array.isArray(value.recipes) ||
    value.recipes.length === 0 ||
    value.recipes.length > MaximumStrategyRecipes
  ) {
    throw new Error('invalid quest strategy recipe list')
  }
  return {
    schemaVersion: 1,
    version: value.version,
    recipes: normalizeQuestStrategyRecipes(value.recipes)
  }
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
      flagshipTypeIds: [ApiShipType.keijyun],
      allowedShipTypeIds: [ApiShipType.keijyun, ApiShipType.kutikukan],
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 1,
          maximum: 2,
          label: '軽巡洋艦 1〜2 隻（旗艦を含む）'
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
      {
        sourceId: 'kcwiki-map-1-4-current',
        sourceLabel: '舰娘百科 - 1-4',
        url: 'https://zh.kcwiki.cn/wiki/1-4',
        reviewedAt: '2026-08-03T03:30:00.000Z',
        validUntil: '2027-02-02T00:00:00.000Z',
        confidence: 'supported',
        summary: '軽巡旗艦・軽巡と駆逐のみの任務条件、駆逐4によるJ-Lボス固定を独立照合'
      },
      PeriodicSortieEvidence
    ],
    validity: {
      reviewBy: ReviewBy
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-1-2-logistics-line-periodic',
    revision: 1,
    title: '1-2 兵站線確保任務',
    status: 'approved',
    questIds: [280],
    objectives: [{ questId: 280, result: 'S', requiredCount: 1 }],
    mapKey: '1-2',
    routeLabels: ['A-E'],
    targetNodes: ['E'],
    fleet: {
      minimumShips: 5,
      maximumShips: 5,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 1,
          label: '軽巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 4,
          label: '駆逐艦 4 隻'
        }
      ]
    },
    equipmentTypeConstraints: [],
    formations: [
      {
        formationId: ApiFormation.tanjyuu,
        label: '単縦陣',
        when: 'A・E の水上戦'
      }
    ],
    actions: [
      '任務280を受注し、1-2段階が残っていることを確認する',
      '高速の軽巡洋艦1・駆逐艦4の5隻で編成する',
      'A-Eの最短ルートを進み、EボスでS勝利する'
    ],
    cost: 'low',
    risk: 'low',
    evidence: [
      {
        sourceId: 'wikiwiki-map-1-2',
        sourceLabel: '艦これ攻略 Wiki - 1-2',
        url: 'https://wikiwiki.jp/kancolle/鎮守府海域/1-2',
        reviewedAt: '2026-08-02T16:30:00.000Z',
        validUntil: '2027-02-01T00:00:00.000Z',
        confidence: 'supported',
        summary: '高速の軽巡1・駆逐4によるA-E固定と任務280の1-2条件を確認'
      },
      {
        sourceId: 'kcwiki-map-1-2',
        sourceLabel: '舰娘百科 - 1-2',
        url: 'https://zh.kcwiki.cn/wiki/1-2',
        reviewedAt: '2026-08-02T16:30:00.000Z',
        validUntil: '2027-02-01T00:00:00.000Z',
        confidence: 'supported',
        summary: '軽巡1・駆逐4のA-E最短分岐を独立照合'
      }
    ],
    validity: {
      reviewBy: '2026-11-01T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-1-3-carrier-logistics-periodic',
    revision: 1,
    title: '1-3 空母兵站線任務まとめ',
    status: 'approved',
    questIds: [280, 894],
    objectives: [
      { questId: 280, result: 'S', requiredCount: 1 },
      { questId: 894, result: 'S', requiredCount: 1 }
    ],
    mapKey: '1-3',
    routeLabels: ['C-F-J'],
    targetNodes: ['J'],
    fleet: {
      minimumShips: 5,
      maximumShips: 5,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.kei_kuubo],
          minimum: 1,
          label: '軽空母 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 4,
          label: '駆逐艦 4 隻'
        }
      ]
    },
    equipmentTypeConstraints: [],
    formations: [
      {
        formationId: ApiFormation.tanjyuu,
        label: '単縦陣',
        when: 'C・F・J の水上戦'
      }
    ],
    actions: [
      '任務280・894を同時に受注し、両方の1-3段階が残っていることを確認する',
      '軽空母1・駆逐艦4の5隻で編成する',
      'C-F-Jを進み、各戦闘後に損傷を確認して大破時は進撃しない',
      'JボスでS勝利し、両任務の進捗を確認する'
    ],
    cost: 'low',
    risk: 'medium',
    evidence: [
      {
        sourceId: 'wikiwiki-map-1-3',
        sourceLabel: '艦これ攻略 Wiki - 1-3',
        url: 'https://wikiwiki.jp/kancolle/鎮守府海域/1-3',
        reviewedAt: '2026-08-02T16:30:00.000Z',
        validUntil: '2027-02-01T00:00:00.000Z',
        confidence: 'supported',
        summary: '軽空母でC、駆逐4でF-J固定となる分岐と任務280・894条件を確認'
      },
      {
        sourceId: 'kcwiki-map-1-3',
        sourceLabel: '舰娘百科 - 1-3',
        url: 'https://zh.kcwiki.cn/wiki/1-3',
        reviewedAt: '2026-08-02T16:30:00.000Z',
        validUntil: '2027-02-01T00:00:00.000Z',
        confidence: 'supported',
        summary: '軽空母1・駆逐4のC-F-J分岐を独立照合'
      }
    ],
    validity: {
      reviewBy: '2026-11-01T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-1-4-carrier-periodic',
    revision: 1,
    title: '1-4 空母定期任務まとめ',
    status: 'approved',
    questIds: [280, 284, 894],
    objectives: [
      { questId: 280, result: 'S', requiredCount: 1 },
      { questId: 284, result: 'S', requiredCount: 1 },
      { questId: 894, result: 'S', requiredCount: 1 }
    ],
    mapKey: '1-4',
    routeLabels: ['A-D-E-H-L', 'A-D-G-J-L', 'B-C-F-E-H-L'],
    targetNodes: ['L'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.kei_kuubo],
          minimum: 2,
          label: '軽空母 2 隻'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 4,
          label: '駆逐艦 4 隻'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.Fighter],
        minimum: 1,
        required: false,
        label: '艦上戦闘機 1 個以上（制空値30に余裕を加える）'
      }
    ],
    formations: [
      {
        formationId: ApiFormation.tanjyuu,
        label: '単縦陣',
        when: '水上戦・Lボス'
      }
    ],
    airState: {
      target: 'superiority',
      summary: '全敵編成の航空優勢境界30に搭載機損耗分の余裕を加える'
    },
    actions: [
      '任務280・284・894を同時に受注し、各任務の1-4段階が残っていることを確認する',
      '軽空母2・駆逐艦4の6隻にし、現在の制空値を確認する',
      '分岐先に応じてボスLへ進み、各戦闘後に損傷を確認して大破時は進撃しない',
      'LボスでS勝利し、3任務の進捗を確認する'
    ],
    cost: 'low',
    risk: 'medium',
    evidence: [
      {
        sourceId: 'wikiwiki-map-1-4-current',
        sourceLabel: '艦これ攻略 Wiki - 1-4',
        url: 'https://wikiwiki.jp/kancolle/鎮守府海域/1-4',
        reviewedAt: '2026-08-02T16:30:00.000Z',
        validUntil: '2027-02-01T00:00:00.000Z',
        confidence: 'supported',
        summary: '空母系2以下・駆逐4のボス到達分岐、制空境界、定期任務条件を確認'
      },
      {
        sourceId: 'kcwiki-map-1-4',
        sourceLabel: '舰娘百科 - 1-4',
        url: 'https://zh.kcwiki.cn/wiki/1-4',
        reviewedAt: '2026-08-02T16:30:00.000Z',
        validUntil: '2027-02-01T00:00:00.000Z',
        confidence: 'supported',
        summary: '軽空母2・駆逐4の編成例とボス到達分岐を独立照合'
      }
    ],
    validity: {
      reviewBy: '2026-11-01T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-2-1-southwest-periodic',
    revision: 1,
    title: '2-1 南西諸島定期任務まとめ',
    status: 'approved',
    questIds: [226, 280, 284, 894],
    objectives: [
      { questId: 226, result: 'victory', requiredCount: 5 },
      { questId: 280, result: 'S', requiredCount: 1 },
      { questId: 284, result: 'S', requiredCount: 1 },
      { questId: 894, result: 'S', requiredCount: 1 }
    ],
    mapKey: '2-1',
    routeLabels: ['C-D-H', 'C-E-D-H'],
    targetNodes: ['H'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.kei_kuubo],
          minimum: 2,
          label: '軽空母 2 隻以上'
        },
        {
          shipTypeIds: [ApiShipType.raijyun],
          minimum: 1,
          label: '重雷装巡洋艦 1 隻以上'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 3,
          label: '駆逐艦 3 隻以上'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.Fighter],
        minimum: 2,
        required: false,
        label: '艦上戦闘機 2 個以上（出撃前に制空値を再計算）'
      }
    ],
    formations: [
      {
        formationId: ApiFormation.tanjyuu,
        label: '単縦陣',
        when: 'C・D・H の水上戦'
      }
    ],
    airState: {
      target: 'superiority',
      summary: 'Hの航空優勢境界81に搭載機損耗分の余裕を加え、出撃前に現在値を確認する'
    },
    actions: [
      '2-1を対象とする表示中の任務を同時に受注し、各任務の2-1段階が残っていることを確認する',
      '軽空母2・重雷装巡洋艦1・駆逐艦3の6隻にし、現在の制空値を確認する',
      'C-D-HまたはC-E-D-Hを進み、各戦闘後に損傷を確認して大破時は進撃しない',
      'Hボス戦後に勝敗と各任務の進捗を確認する'
    ],
    cost: 'low',
    risk: 'medium',
    evidence: [
      {
        sourceId: 'wikiwiki-map-2-1',
        sourceLabel: '艦これ攻略 Wiki - 2-1',
        url: 'https://wikiwiki.jp/kancolle/南西諸島海域/2-1',
        reviewedAt: '2026-08-02T15:03:58.374Z',
        validUntil: '2027-01-28T00:00:00.000Z',
        confidence: 'supported',
        summary: 'C-D-H / C-E-D-H の分岐条件、航空優勢境界、敵編成を確認'
      },
      {
        sourceId: 'kcwiki-map-2-1',
        sourceLabel: '舰娘百科 - 2-1',
        url: 'https://zh.kcwiki.cn/wiki/2-1',
        reviewedAt: '2026-08-02T15:03:58.374Z',
        validUntil: '2027-01-28T00:00:00.000Z',
        confidence: 'supported',
        summary: '軽空母2・雷巡1・駆逐3の編成、分岐条件、制空境界を独立照合'
      }
    ],
    validity: {
      reviewBy: '2026-10-30T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-2-2-carrier-southwest-periodic',
    revision: 1,
    title: '2-2 空母南西任務まとめ',
    status: 'approved',
    questIds: [284, 894],
    objectives: [
      { questId: 284, result: 'S', requiredCount: 1 },
      { questId: 894, result: 'S', requiredCount: 1 }
    ],
    mapKey: '2-2',
    routeLabels: ['C-E-K', 'C-E-G-H-K'],
    targetNodes: ['K'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.kei_kuubo],
          minimum: 1,
          label: '軽空母 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.suibo],
          minimum: 1,
          label: '水上機母艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 1,
          label: '軽巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 3,
          label: '駆逐艦 3 隻'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.Fighter],
        minimum: 1,
        required: false,
        label: '艦上戦闘機 1 個以上（制空値41に余裕を加える）'
      }
    ],
    formations: [
      {
        formationId: ApiFormation.tanjyuu,
        label: '単縦陣',
        when: 'E・G・K の水上戦'
      }
    ],
    airState: {
      target: 'superiority',
      summary: 'Kボスの航空優勢境界41に搭載機損耗分の余裕を加える'
    },
    actions: [
      '任務284・894を同時に受注し、両方の2-2段階が残っていることを確認する',
      '軽空母1・水上機母艦1・軽巡洋艦1・駆逐艦3の6隻にし、現在の制空値を確認する',
      'C-E-KまたはC-E-G-H-Kを進み、各戦闘後に損傷を確認して大破時は進撃しない',
      'KボスでS勝利し、両任務の進捗を確認する'
    ],
    cost: 'low',
    risk: 'medium',
    evidence: [
      {
        sourceId: 'wikiwiki-map-2-2',
        sourceLabel: '艦これ攻略 Wiki - 2-2',
        url: 'https://wikiwiki.jp/kancolle/南西諸島海域/2-2',
        reviewedAt: '2026-08-02T16:30:00.000Z',
        validUntil: '2027-02-01T00:00:00.000Z',
        confidence: 'supported',
        summary: '水母によるC-E、軽空母を含むE-K/EGHKのボス到達、制空境界を確認'
      },
      {
        sourceId: 'kcwiki-map-2-2',
        sourceLabel: '舰娘百科 - 2-2',
        url: 'https://zh.kcwiki.cn/wiki/2-2',
        reviewedAt: '2026-08-02T16:30:00.000Z',
        validUntil: '2027-02-01T00:00:00.000Z',
        confidence: 'supported',
        summary: '軽空母1・水母1・軽巡1・駆逐3の分岐とボス到達を独立照合'
      }
    ],
    validity: {
      reviewBy: '2026-11-01T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-2-3-carrier-southwest-periodic',
    revision: 1,
    title: '2-3 空母南西任務まとめ',
    status: 'approved',
    questIds: [284, 894],
    objectives: [
      { questId: 284, result: 'S', requiredCount: 1 },
      { questId: 894, result: 'S', requiredCount: 1 }
    ],
    mapKey: '2-3',
    routeLabels: ['A/B 分岐-N'],
    targetNodes: ['N'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.kei_kuubo],
          minimum: 1,
          label: '軽空母 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 1,
          label: '軽巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 4,
          label: '駆逐艦 4 隻'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.Fighter],
        minimum: 2,
        required: false,
        label: '艦上戦闘機 2 個以上（制空値81に余裕を加える）'
      }
    ],
    formations: [
      {
        formationId: ApiFormation.tanjyuu,
        label: '単縦陣',
        when: '水上戦・Nボス'
      }
    ],
    airState: {
      target: 'superiority',
      summary: 'Nボスの航空優勢境界81に搭載機損耗分の余裕を加える'
    },
    actions: [
      '任務284・894を同時に受注し、両方の2-3段階が残っていることを確認する',
      '軽空母1・軽巡洋艦1・駆逐艦4の6隻にし、現在の制空値を確認する',
      '初手と途中の分岐に従ってボスNへ進み、各戦闘後に損傷を確認して大破時は進撃しない',
      'NボスでS勝利し、両任務の進捗を確認する'
    ],
    cost: 'low',
    risk: 'medium',
    evidence: [
      {
        sourceId: 'wikiwiki-map-2-3',
        sourceLabel: '艦これ攻略 Wiki - 2-3',
        url: 'https://wikiwiki.jp/kancolle/南西諸島海域/2-3',
        reviewedAt: '2026-08-02T16:30:00.000Z',
        validUntil: '2027-02-01T00:00:00.000Z',
        confidence: 'supported',
        summary: '軽巡1・駆逐4・自由1のボス固定編成、空母任務、制空境界を確認'
      },
      {
        sourceId: 'kcwiki-map-2-3',
        sourceLabel: '舰娘百科 - 2-3',
        url: 'https://zh.kcwiki.cn/wiki/2-3',
        reviewedAt: '2026-08-02T16:30:00.000Z',
        validUntil: '2027-02-01T00:00:00.000Z',
        confidence: 'supported',
        summary: '軽空母1・軽巡1・駆逐4によるNボス固定を独立照合'
      }
    ],
    validity: {
      reviewBy: '2026-11-01T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-2-4-okinoshima-periodic',
    revision: 1,
    title: '2-4 沖ノ島定期任務まとめ',
    status: 'approved',
    questIds: [226, 822, 854],
    objectives: [
      { questId: 226, result: 'victory', requiredCount: 5 },
      { questId: 822, result: 'S', requiredCount: 2 },
      { questId: 854, result: 'A', requiredCount: 1 }
    ],
    mapKey: '2-4',
    routeLabels: ['B-G-H-L-P'],
    targetNodes: ['P'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.koujyun],
          minimum: 1,
          maximum: 1,
          label: '航空巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 1,
          maximum: 1,
          label: '軽巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 4,
          label: '駆逐艦 4 隻'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.SeaplaneFighter],
        minimum: 2,
        required: false,
        label: 'L航空優勢用の水上戦闘機 2 個以上'
      },
      {
        equipmentTypeIds: [SlotitemType.SeaplaneBomber],
        minimum: 1,
        required: false,
        label: '航空戦と弾着観測用の水上爆撃機'
      }
    ],
    formations: [{ formationId: ApiFormation.tanjyuu, label: '単縦陣', when: 'B・L・Pボス' }],
    airState: {
      target: 'superiority',
      summary: 'Lの航空優勢境界84に搭載機損耗分の余裕を加える'
    },
    actions: [
      '任務226・822・854のうち表示中の対象を受注し、2-4の必要勝利数が残っていることを確認する',
      '航空巡洋艦1・軽巡洋艦1・駆逐艦4の6隻にし、近代化改修とL航空優勢84への余裕を確認する',
      'B-G-H-L-Pの固定ルートを進み、B・L戦後に損傷を確認して大破時は進撃しない',
      'PボスでS勝利を狙い、表示中の任務に必要な回数まで繰り返す'
    ],
    cost: 'medium',
    risk: 'high',
    evidence: [
      {
        sourceId: 'wikiwiki-map-2-4-current',
        sourceLabel: '艦これ攻略 Wiki - 2-4',
        url: 'https://wikiwiki.jp/kancolle/南西諸島海域/2-4',
        reviewedAt: '2026-08-03T05:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary:
          '重巡級1以下・軽巡1・駆逐4のB-G-H-L-P固定と軽量編成のS勝利リスク、任務822のS勝利2回を確認'
      },
      {
        sourceId: 'kcwiki-map-2-4-current',
        sourceLabel: '舰娘百科 - 2-4',
        url: 'https://zh.kcwiki.cn/wiki/2-4',
        reviewedAt: '2026-08-03T05:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary: '航巡1・軽巡1・駆逐4の固定経路、L航空優勢84と軽量編成の火力注意を独立照合'
      },
      PeriodicSortieEvidence
    ],
    validity: {
      reviewBy: '2026-11-03T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-2-5-surface-counterattack-monthly',
    revision: 1,
    title: '2-5 水上反撃部隊',
    status: 'approved',
    questIds: [266],
    objectives: [{ questId: 266, result: 'S', requiredCount: 1 }],
    mapKey: '2-5',
    routeLabels: ['B-F-E-I-O'],
    targetNodes: ['O'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      flagshipTypeIds: [ApiShipType.kutikukan],
      allowedShipTypeIds: [ApiShipType.kutikukan, ApiShipType.keijyun, ApiShipType.jyuujyun],
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 4,
          maximum: 4,
          label: '旗艦を含む駆逐艦 4 隻'
        },
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 1,
          maximum: 1,
          label: '軽巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.jyuujyun],
          minimum: 1,
          maximum: 1,
          label: '重巡洋艦 1 隻（航空巡洋艦は不可）'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [
          SlotitemType.RecSeaplane,
          SlotitemType.SeaplaneBomber,
          SlotitemType.SmallRadar,
          SlotitemType.LargeRadar
        ],
        minimum: 4,
        required: false,
        label: '分岐点係数1の索敵値34以上へ余裕を加える偵察機・電探'
      },
      {
        equipmentTypeIds: [SlotitemType.SeaplaneFighter, SlotitemType.SeaplaneBomber],
        minimum: 2,
        required: false,
        label: 'Oボス航空優勢42を狙える場合の水上戦闘機・水上爆撃機'
      }
    ],
    formations: [{ formationId: ApiFormation.tanjyuu, label: '単縦陣', when: 'F・E・I・Oボス' }],
    airState: {
      target: 'superiority',
      summary: 'Oボスの空母編成に対する航空優勢境界42を目安にし、索敵と夜戦火力を損なわない範囲で調整する'
    },
    actions: [
      '任務266を受注し、駆逐艦が旗艦であることと2-5のS勝利が残っていることを確認する',
      '駆逐艦4・軽巡洋艦1・重巡洋艦1の6隻にする。航空巡洋艦は任務条件を満たさないため使用しない',
      '分岐点係数1の索敵値34以上に余裕を加え、可能ならOボス航空優勢42を狙う。索敵装備で夜戦連撃を失わないか確認する',
      'B-F-E-I-Oを進み、全戦闘で単縦陣を選ぶ。各戦闘後に損傷を確認し、大破時は進撃しない',
      'Oボスは必要なら夜戦してS勝利を取り、任務266の達成表示を確認する'
    ],
    cost: 'medium',
    risk: 'high',
    evidence: [
      {
        sourceId: 'wikiwiki-map-2-5-surface-counterattack-current',
        sourceLabel: '艦これ攻略 Wiki - 2-5',
        url: 'https://wikiwiki.jp/kancolle/南西諸島海域/2-5',
        reviewedAt: '2026-08-03T12:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary:
          '駆逐旗艦・駆逐4・軽巡1・重巡1、B-F-E-I-O、分岐点係数1の索敵34、軽量艦隊の高いS勝利リスクを確認'
      },
      {
        sourceId: 'kcwiki-map-2-5-surface-counterattack-current',
        sourceLabel: '舰娘百科 - 2-5',
        url: 'https://zh.kcwiki.cn/wiki/2-5',
        reviewedAt: '2026-08-03T12:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary:
          '駆逐旗艦・駆逐4・軽巡1・重巡1（航巡不可）、B-F-E-I-O、索敵34とO航空優勢42を独立照合'
      },
      PeriodicSortieEvidence
    ],
    validity: {
      reviewBy: '2026-11-03T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-2-5-fifth-squadron-monthly',
    revision: 1,
    title: '2-5 第五戦隊マンスリー',
    status: 'approved',
    questIds: [249],
    objectives: [{ questId: 249, result: 'S', requiredCount: 1 }],
    mapKey: '2-5',
    routeLabels: ['B-F-J-O'],
    targetNodes: ['O'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.koukuu_senkan],
          minimum: 1,
          maximum: 1,
          label: '航空戦艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.koujyun],
          minimum: 1,
          maximum: 1,
          label: '航空巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 1,
          maximum: 1,
          label: '軽巡洋艦 1 隻'
        }
      ],
      specificShipConstraints: [
        {
          baseShipIds: [62, 63, 65],
          minimum: 3,
          maximum: 3,
          label: '妙高・那智・羽黒（改装段階は問わない）'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.STContainer],
        minimum: 2,
        required: true,
        label: '別々の 2 隻に載せるドラム缶 2 個'
      },
      {
        equipmentTypeIds: [
          SlotitemType.RecSeaplane,
          SlotitemType.SeaplaneBomber,
          SlotitemType.SmallRadar,
          SlotitemType.LargeRadar
        ],
        minimum: 4,
        required: false,
        label: '分岐点係数1の索敵値49以上へ余裕を加える偵察機・電探'
      },
      {
        equipmentTypeIds: [SlotitemType.SeaplaneFighter, SlotitemType.SeaplaneBomber],
        minimum: 2,
        required: false,
        label: 'Oボス制空権確保84を狙う水上戦闘機・水上爆撃機'
      }
    ],
    formations: [{ formationId: ApiFormation.tanjyuu, label: '単縦陣', when: 'B・F・J・Oボス' }],
    airState: {
      target: 'supremacy',
      summary: 'Oボスの制空権確保境界84に搭載機損耗分の余裕を加える'
    },
    actions: [
      '任務249を受注し、妙高・那智・羽黒の3隻と2-5のS勝利が残っていることを確認する',
      '妙高・那智・羽黒・航空戦艦1・航空巡洋艦1・軽巡洋艦1の6隻にし、低速艦を含める',
      '別々の2隻へドラム缶を1個ずつ載せ、分岐点係数1の索敵値49以上と制空値84への余裕を確認する',
      'B-F-J-Oを進み、全戦闘で単縦陣を選ぶ。各戦闘後に損傷を確認し、大破時は進撃しない',
      'OボスでS勝利を取り、任務249の達成表示を確認する'
    ],
    cost: 'medium',
    risk: 'high',
    evidence: [
      {
        sourceId: 'wikiwiki-map-2-5-fifth-squadron-current',
        sourceLabel: '艦これ攻略 Wiki - 2-5',
        url: 'https://wikiwiki.jp/kancolle/南西諸島海域/2-5',
        reviewedAt: '2026-08-03T13:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary:
          '妙高・那智・羽黒と自由枠3、ボスS勝利、低速艦・ドラム缶搭載艦2隻を使う上ルート候補を確認'
      },
      {
        sourceId: 'kcwiki-map-2-5-fifth-squadron-current',
        sourceLabel: '舰娘百科 - 2-5',
        url: 'https://zh.kcwiki.cn/wiki/2-5',
        reviewedAt: '2026-08-03T13:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary:
          '妙高・那智・羽黒・航戦1・航巡1・軽巡1、B-F-J-O、低速艦、2隻のドラム缶、索敵49と制空84を独立照合'
      },
      PeriodicSortieEvidence
    ],
    validity: {
      reviewBy: '2026-11-03T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-5-1-surface-striking-monthly',
    revision: 1,
    title: '5-1 水上打撃部隊マンスリー',
    status: 'approved',
    questIds: [259],
    objectives: [{ questId: 259, result: 'S', requiredCount: 1 }],
    mapKey: '5-1',
    routeLabels: ['B-E-G-J / A-D-E-G-J'],
    targetNodes: ['J'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 1,
          maximum: 1,
          label: '軽巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 2,
          maximum: 2,
          label: '駆逐艦 2 隻'
        }
      ],
      specificShipConstraints: [
        {
          baseShipIds: [131, 143, 80, 81, 77, 87, 26, 27],
          minimum: 3,
          maximum: 3,
          label: '大和型・長門型・伊勢型・扶桑型から 3 隻（改装段階は問わない）'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.Fighter, SlotitemType.SeaplaneFighter],
        minimum: 3,
        required: false,
        label: 'D航空優勢287・Jボス航空優勢252へ余裕を加える艦戦・水上戦闘機'
      },
      {
        equipmentTypeIds: [SlotitemType.Sonar],
        minimum: 1,
        required: false,
        label: 'Eの潜水艦編成に備えるソナー'
      },
      {
        equipmentTypeIds: [SlotitemType.SmallRadar, SlotitemType.LargeRadar],
        minimum: 3,
        required: false,
        label: 'Aのうずしおを通る場合の電探 3 個'
      }
    ],
    formations: [
      { formationId: ApiFormation.tanou, label: '単横陣', when: 'E が潜水艦編成の場合' },
      { formationId: ApiFormation.tanjyuu, label: '単縦陣', when: 'D・G・Jボスの水上戦' }
    ],
    airState: {
      target: 'superiority',
      summary: 'D航空優勢287・Jボス航空優勢252に搭載機損耗分の余裕を加える'
    },
    actions: [
      '任務259を受注し、指定艦3隻と5-1のS勝利が残っていることを確認する',
      '大和型・長門型・伊勢型・扶桑型から3隻、軽巡洋艦1・駆逐艦2の6隻にする。指定艦が正しい基礎艦に属するか確認する',
      '制空値287以上へ余裕を加え、Aのうずしお対策の電探とEの潜水艦対策を用意する',
      'B-E-G-JまたはA-D-E-G-Jを進む。Eが潜水艦編成なら単横陣、D・G・Jは単縦陣を選び、大破時は進撃しない',
      'JボスでS勝利を取り、任務259の達成表示を確認する'
    ],
    cost: 'high',
    risk: 'high',
    evidence: [
      {
        sourceId: 'wikiwiki-map-5-1-surface-striking-current',
        sourceLabel: '艦これ攻略 Wiki - 5-1',
        url: 'https://wikiwiki.jp/kancolle/南方海域/5-1',
        reviewedAt: '2026-08-03T14:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary:
          '指定4艦型から3隻・軽巡1・自由2、ボスS勝利、駆逐2によるB-E-G-JまたはA-D-E-G-J、E潜水艦とG高リスクを確認'
      },
      {
        sourceId: 'kcwiki-map-5-1-surface-striking-current',
        sourceLabel: '舰娘百科 - 5-1',
        url: 'https://zh.kcwiki.cn/wiki/5-1',
        reviewedAt: '2026-08-03T14:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary:
          '指定艦3・軽巡1・駆逐2、B-E-G-JまたはA-D-E-G-J、D航空優勢287・J航空優勢252を独立照合'
      },
      PeriodicSortieEvidence
    ],
    validity: {
      reviewBy: '2026-11-03T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-1-6-transport-quarterly',
    revision: 1,
    title: '1-6 強行輸送艦隊',
    status: 'approved',
    questIds: [861],
    objectives: [{ questId: 861, result: 'arrival', requiredCount: 2 }],
    mapKey: '1-6',
    routeLabels: ['A-E-G-F-B-N（GからFはランダム）'],
    targetNodes: ['N'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.hokyuukan],
          minimum: 2,
          maximum: 2,
          label: '補給艦 2 隻'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 4,
          maximum: 4,
          label: '駆逐艦 4 隻'
        }
      ]
    },
    equipmentTypeConstraints: [],
    formations: [
      { formationId: ApiFormation.tanou, label: '単横陣', when: 'E の対潜戦' },
      { formationId: ApiFormation.rinkei, label: '輪形陣', when: 'F の航空戦' },
      { formationId: ApiFormation.tanjyuu, label: '単縦陣', when: 'B の水上戦' }
    ],
    actions: [
      '任務861を受注し、1-6到達回数が残っていることを確認する',
      '補給艦2・駆逐艦4の6隻にする。艦種が補給艦の状態であることを確認し、搭載可能なら水上戦闘機や対空カットインを用意する',
      'A-E-Gを進み、GからKへ逸れた場合は撤退して再出撃する。Fへ進んだ場合も各戦闘後に損傷を確認し、大破時は進撃しない',
      'A-E-G-F-B-NでNへ到達し、任務進捗を確認して合計2回まで繰り返す'
    ],
    cost: 'medium',
    risk: 'high',
    evidence: [
      {
        sourceId: 'wikiwiki-map-1-6-current',
        sourceLabel: '艦これ攻略 Wiki - 1-6',
        url: 'https://wikiwiki.jp/kancolle/鎮守府海域/1-6',
        reviewedAt: '2026-08-03T07:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary: '補給艦2・駆逐艦4の下ルート、Gからのランダム分岐、任務861のN到達2回を確認'
      },
      {
        sourceId: 'kcwiki-map-1-6-current',
        sourceLabel: '舰娘百科 - 1-6',
        url: 'https://zh.kcwiki.cn/wiki/1-6',
        reviewedAt: '2026-08-03T07:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary: '補給艦2・駆逐艦4のA-E-G-F-B-N候補、G分岐と任務条件を独立照合'
      },
      PeriodicSortieEvidence
    ],
    validity: {
      reviewBy: '2026-11-03T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-6-3-aerial-recon-quarterly',
    revision: 1,
    title: '6-3 前線航空偵察',
    status: 'approved',
    questIds: [854, 862],
    objectives: [
      { questId: 854, result: 'A', requiredCount: 1 },
      { questId: 862, result: 'A', requiredCount: 2 }
    ],
    mapKey: '6-3',
    routeLabels: ['A-C-E-F-H-J'],
    targetNodes: ['J'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.suibo],
          minimum: 2,
          maximum: 2,
          label: '水上機母艦 2 隻'
        },
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 3,
          maximum: 3,
          label: '軽巡洋艦 3 隻'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 1,
          maximum: 1,
          label: '駆逐艦 1 隻'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.RecSeaplane, SlotitemType.SeaplaneBomber],
        minimum: 2,
        required: false,
        label: '索敵・航空偵察用の水偵・水爆 2 個以上'
      }
    ],
    formations: [
      { formationId: ApiFormation.tanou, label: '単横陣', when: 'C の対潜戦' },
      { formationId: ApiFormation.tanjyuu, label: '単縦陣', when: 'E・F・Jボス' }
    ],
    airState: {
      target: 'supremacy',
      summary: '敵航空戦力はない。水上爆撃機などが1機以上残れば制空権確保になる'
    },
    actions: [
      '任務854・862のうち表示中の対象を受注し、6-3のA勝利回数が残っていることを確認する',
      '水上機母艦2・軽巡洋艦3・駆逐艦1の6隻にし、分岐点係数3の索敵値38以上に余裕を加える',
      'Aの能動分岐でCを選び、A-C-E-F-H-Jを進む。各戦闘後に損傷を確認し、大破時は進撃しない',
      'Jボスは夜戦も含めてA勝利以上を取り、任務854は1回、任務862は合計2回まで進捗を確認する'
    ],
    cost: 'medium',
    risk: 'high',
    evidence: [
      {
        sourceId: 'wikiwiki-map-6-3-current',
        sourceLabel: '艦これ攻略 Wiki - 6-3',
        url: 'https://wikiwiki.jp/kancolle/中部海域/6-3',
        reviewedAt: '2026-08-03T08:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary: '水母2・軽巡3・駆逐1のF固定、A-C-E-F-H-J、索敵38以上と任務862のA勝利2回を確認'
      },
      {
        sourceId: 'kcwiki-map-6-3-current',
        sourceLabel: '舰娘百科 - 6-3',
        url: 'https://zh.kcwiki.cn/wiki/中部海域/6-3',
        reviewedAt: '2026-08-03T08:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary: '水母2・軽巡3・駆逐1の高火力4戦候補、海域制限、索敵準備と任務条件を独立照合'
      },
      PeriodicSortieEvidence
    ],
    validity: {
      reviewBy: '2026-11-03T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-6-1-submarine-monthly',
    revision: 1,
    title: '6-1 潜水艦隊月次作戦',
    status: 'approved',
    questIds: [256, 854],
    objectives: [
      { questId: 256, result: 'S', requiredCount: 3 },
      { questId: 854, result: 'A', requiredCount: 1 }
    ],
    mapKey: '6-1',
    routeLabels: ['C-F-G-H-K（Gから約15%でIへ逸れる）'],
    targetNodes: ['K'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.seiki_kuubo, ApiShipType.soukou_kuubo],
          minimum: 1,
          maximum: 1,
          label: '正規空母・装甲空母 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.raijyun],
          minimum: 1,
          maximum: 1,
          label: '重雷装巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 1,
          maximum: 1,
          label: '軽巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.sensuikan, ApiShipType.sensui_kuubo],
          minimum: 3,
          maximum: 3,
          label: '潜水艦・潜水空母 3 隻'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.Fighter],
        minimum: 2,
        required: false,
        label: '艦上戦闘機（Kボスの航空優勢126に損耗分の余裕を加える）'
      },
      {
        equipmentTypeIds: [
          SlotitemType.RecAircraft,
          SlotitemType.RecSeaplane,
          SlotitemType.SmallRadar,
          SlotitemType.LargeRadar,
          SlotitemType.SubmarineEquipment
        ],
        minimum: 2,
        required: false,
        label: '彩雲・水偵・電探・潜水艦装備など（分岐点係数4の索敵36以上）'
      },
      {
        equipmentTypeIds: [SlotitemType.Torpedo, SlotitemType.SubmarineTorpedo],
        minimum: 6,
        required: false,
        label: '潜水艦3隻の夜戦カットイン用魚雷'
      }
    ],
    formations: [{ formationId: ApiFormation.tanjyuu, label: '単縦陣', when: 'C・F・H・Kボス' }],
    airState: {
      target: 'superiority',
      summary: 'Kボスの航空優勢境界126に、道中の搭載機損耗分を加える'
    },
    actions: [
      '任務256・854のうち表示中の対象を受注し、6-1の必要勝利数が残っていることを確認する',
      '正規空母系1・雷巡1・軽巡1・潜水艦3の6隻にし、制空値126以上と分岐点係数4の索敵値36以上に余裕を加える',
      'C-F-G-H-Kを進む。GからIへ逸れた場合は帰投し、各戦闘後に損傷を確認して大破時は進撃しない',
      '全戦闘で単縦陣を選び、Kボスは必要なら夜戦する。任務854はA勝利1回、任務256はS勝利合計3回まで進捗を確認する'
    ],
    cost: 'high',
    risk: 'high',
    evidence: [
      {
        sourceId: 'wikiwiki-map-6-1-current',
        sourceLabel: '艦これ攻略 Wiki - 6-1',
        url: 'https://wikiwiki.jp/kancolle/中部海域/6-1',
        reviewedAt: '2026-08-03T09:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary:
          '空母1・軽巡級2・潜水艦3の高安定編成、C-F-G-H-K、Gの約15%逸れ、索敵36、制空126と任務256のS勝利3回を確認'
      },
      {
        sourceId: 'kcwiki-map-6-1-current',
        sourceLabel: '舰娘百科 - 6-1',
        url: 'https://zh.kcwiki.cn/wiki/中部海域/6-1',
        reviewedAt: '2026-08-03T09:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary:
          '空母1・雷巡1・軽巡1・潜水艦3の通常編成、C-F-G-H-K、索敵36、制空126と高いボスS勝利率を独立照合'
      },
      PeriodicSortieEvidence
    ],
    validity: {
      reviewBy: '2026-11-03T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-6-4-z-operation-quarterly',
    revision: 1,
    title: '6-4 Z作戦前段',
    status: 'approved',
    questIds: [854],
    objectives: [{ questId: 854, result: 'S', requiredCount: 1 }],
    mapKey: '6-4',
    routeLabels: ['B-D-C-F-N'],
    targetNodes: ['N'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      flagshipTypeIds: [ApiShipType.keijyun],
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 1,
          maximum: 1,
          label: '旗艦の軽巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.kousoku_senkan],
          minimum: 1,
          maximum: 1,
          label: '高速戦艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.koujyun],
          minimum: 1,
          maximum: 1,
          label: '航空巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 3,
          maximum: 3,
          label: '駆逐艦 3 隻'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [
          SlotitemType.AntiGroundEquipment,
          SlotitemType.LandingCraft,
          SlotitemType.SpecialATank,
          SlotitemType.LandingForce
        ],
        minimum: 4,
        required: false,
        label: 'Nボス用の対地装備（WG系・陸戦隊・内火艇など）4個以上'
      },
      {
        equipmentTypeIds: [SlotitemType.SeaplaneFighter],
        minimum: 2,
        required: false,
        label: 'Cの敵弾着阻止と空襲対策用の水上戦闘機2個以上'
      },
      {
        equipmentTypeIds: [SlotitemType.LandAttackAircraft],
        minimum: 3,
        required: false,
        label: '行動半径5でNへ届く基地航空隊の陸攻3個以上'
      }
    ],
    formations: [
      { formationId: ApiFormation.rinkei, label: '輪形陣', when: 'D・F の空襲戦' },
      { formationId: ApiFormation.tanjyuu, label: '単縦陣', when: 'C・Nボス' }
    ],
    airState: {
      target: 'parity',
      summary: 'Cの敵弾着を止める航空均衡以上を最低線とし、Nは基地航空隊の削り込みで調整する'
    },
    actions: [
      '任務854を受注し、6-4段階が残っていることと基地航空隊の運用可否を確認する',
      '軽巡旗艦・高速戦艦1・航空巡洋艦1・駆逐艦3の全高速6隻にし、駆逐艦と軽巡へ対地装備を分散する',
      '基地航空隊は行動半径5以上でNボスへ集中し、航空隊を使えない場合は攻略準備不足として装備と練度を再確認する',
      'B-D-C-F-Nを進み、D・Fは輪形陣、Cは単縦陣とする。各戦闘後に損傷を確認し、大破時は進撃しない',
      'Nボスは単縦陣を選び、必要なら夜戦してS勝利を取り、4海域すべての任務進捗を確認する'
    ],
    cost: 'high',
    risk: 'high',
    evidence: [
      {
        sourceId: 'wikiwiki-map-6-4-current',
        sourceLabel: '艦これ攻略 Wiki - 6-4',
        url: 'https://wikiwiki.jp/kancolle/中部海域/6-4',
        reviewedAt: '2026-08-03T10:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary:
          '軽巡旗艦・高速戦艦1・駆逐3・巡洋艦枠1のB-D-C-F-N、対地装備、基地航空隊と任務854のS勝利1回を確認'
      },
      {
        sourceId: 'kcwiki-map-6-4-current',
        sourceLabel: '舰娘百科 - 6-4',
        url: 'https://zh.kcwiki.cn/wiki/中部海域/6-4',
        reviewedAt: '2026-08-03T10:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary:
          '全高速の左最短B-D-C-F-N、戦艦1・航巡1・軽巡旗艦・駆逐3、制空・対地・基地航空隊準備を独立照合'
      },
      PeriodicSortieEvidence
    ],
    validity: {
      reviewBy: '2026-11-03T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-5-5-z-operation-later-quarterly',
    revision: 1,
    title: '5-5 Z作戦後段',
    status: 'approved',
    questIds: [872],
    objectives: [{ questId: 872, result: 'S', requiredCount: 1 }],
    mapKey: '5-5',
    routeLabels: ['B-K-P-S'],
    targetNodes: ['S'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [
            ApiShipType.kousoku_senkan,
            ApiShipType.teisoku_senkan,
            ApiShipType.koukuu_senkan,
            ApiShipType.tyoudokyuu_senkan
          ],
          minimum: 3,
          maximum: 3,
          label: '戦艦級 3 隻'
        },
        {
          shipTypeIds: [ApiShipType.seiki_kuubo, ApiShipType.soukou_kuubo],
          minimum: 1,
          maximum: 1,
          label: '正規空母系 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.koujyun],
          minimum: 1,
          maximum: 1,
          label: '航空巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 1,
          maximum: 1,
          label: '軽巡洋艦 1 隻'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.Fighter, SlotitemType.SeaplaneFighter],
        minimum: 5,
        required: false,
        label: 'Sボス航空優勢と道中損耗に備える戦闘機・水上戦闘機'
      },
      {
        equipmentTypeIds: [SlotitemType.RecAircraft, SlotitemType.RecSeaplane],
        minimum: 2,
        required: false,
        label: 'P-Sの分岐点係数2で索敵値80以上を確保する偵察装備'
      },
      {
        equipmentTypeIds: [SlotitemType.Sonar, SlotitemType.LargeSonar],
        minimum: 1,
        required: false,
        label: 'BとSボスの潜水艦対策用ソナー'
      }
    ],
    formations: [
      { formationId: ApiFormation.tanou, label: '単横陣', when: 'B の対潜戦' },
      { formationId: ApiFormation.tanjyuu, label: '単縦陣', when: 'K・Pと潜水艦なしのSボス' },
      { formationId: ApiFormation.fukujyuu, label: '複縦陣', when: '潜水艦を含むSボスでS勝利を狙う場合' }
    ],
    airState: {
      target: 'superiority',
      summary: 'Sボス航空優勢と道中損耗を含め、出撃時制空値430〜440程度を確認する'
    },
    actions: [
      '任務872を受注し、5-5段階が残っていることと第一艦隊で出撃することを確認する',
      '戦艦級3・正規空母系1・航空巡洋艦1・軽巡洋艦1の6隻にし、出撃時制空値430〜440程度と分岐点係数2の索敵値80以上を確認する',
      'B-K-P-Sを進み、Bは単横陣、K・Pは単縦陣とする。Pのレ級戦後に損傷を確認し、大破時は進撃しない',
      '必要なら道中・決戦支援を出し、Sボスに潜水艦がいる場合は対潜装備と複縦陣を使ってS勝利を取る',
      'ゲージ破壊前は強編成があるため、戦力不足なら先にゲージを破壊してから任務872の進捗を確認する'
    ],
    cost: 'high',
    risk: 'high',
    evidence: [
      {
        sourceId: 'wikiwiki-map-5-5-current',
        sourceLabel: '艦これ攻略 Wiki - 5-5',
        url: 'https://wikiwiki.jp/kancolle/南方海域/5-5',
        reviewedAt: '2026-08-03T11:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary:
          'B-K-P-S、戦艦級と空母系4隻以下でのボス固定、索敵80、制空430〜440、S勝利用の潜水艦対策を確認'
      },
      {
        sourceId: 'kcwiki-map-5-5-current',
        sourceLabel: '舰娘百科 - 5-5',
        url: 'https://zh.kcwiki.cn/wiki/5-5',
        reviewedAt: '2026-08-03T11:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary: 'B-K-P-Sの重量編成、索敵・制空・支援艦隊、潜水艦を含むボスS勝利条件を独立照合'
      },
      PeriodicSortieEvidence
    ],
    validity: { reviewBy: '2026-11-03T00:00:00.000Z' }
  },
  {
    schemaVersion: 1,
    id: 'normal-6-2-z-operation-later-quarterly',
    revision: 1,
    title: '6-2 Z作戦後段',
    status: 'approved',
    questIds: [872],
    objectives: [{ questId: 872, result: 'S', requiredCount: 1 }],
    mapKey: '6-2',
    routeLabels: ['C-E-J-K'],
    targetNodes: ['K'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.kousoku_senkan],
          minimum: 1,
          maximum: 1,
          label: '高速戦艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.seiki_kuubo, ApiShipType.soukou_kuubo],
          minimum: 1,
          maximum: 1,
          label: '正規空母系 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.koujyun],
          minimum: 2,
          maximum: 2,
          label: '航空巡洋艦 2 隻'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 2,
          maximum: 2,
          label: '駆逐艦 2 隻'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.Fighter, SlotitemType.SeaplaneFighter],
        minimum: 3,
        required: false,
        label: 'Jのヲ級改編成を含む道中航空優勢に備える戦闘機・水上戦闘機'
      },
      {
        equipmentTypeIds: [SlotitemType.RecAircraft, SlotitemType.RecSeaplane],
        minimum: 3,
        required: false,
        label: 'E-JとJ-Kの索敵分岐用の偵察装備'
      }
    ],
    formations: [{ formationId: ApiFormation.tanjyuu, label: '単縦陣', when: 'C・E・J・Kボス' }],
    airState: {
      target: 'superiority',
      summary: 'Jのヲ級改編成を含む道中で航空優勢を狙い、艦載機損耗分の余裕を加える'
    },
    actions: [
      '任務872を受注し、6-2段階が残っていることを確認する',
      '高速戦艦1・正規空母系1・航空巡洋艦2・駆逐艦2の6隻にし、戦闘機3枠以上と索敵装備を確認する',
      'C-E-J-Kを進むため分岐点係数3の索敵値43以上に余裕を加え、各戦闘後に損傷を確認して大破時は進撃しない',
      '全戦闘で単縦陣を選び、Kボスは必要なら夜戦してS勝利を取り、任務872の進捗を確認する'
    ],
    cost: 'high',
    risk: 'high',
    evidence: [
      {
        sourceId: 'wikiwiki-map-6-2-current',
        sourceLabel: '艦これ攻略 Wiki - 6-2',
        url: 'https://wikiwiki.jp/kancolle/中部海域/6-2',
        reviewedAt: '2026-08-03T11:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary: '戦艦1・空母1・駆逐2・自由枠2のC-E-J-K、索敵分岐、道中航空優勢と高い事故率を確認'
      },
      {
        sourceId: 'kcwiki-map-6-2-current',
        sourceLabel: '舰娘百科 - 6-2',
        url: 'https://zh.kcwiki.cn/wiki/6-2',
        reviewedAt: '2026-08-03T11:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary: '戦艦1・空母1・巡洋艦2・駆逐2の南側経路と制空・索敵・艦載機損耗を独立照合'
      },
      PeriodicSortieEvidence
    ],
    validity: { reviewBy: '2026-11-03T00:00:00.000Z' }
  },
  {
    schemaVersion: 1,
    id: 'normal-6-5-z-operation-later-quarterly',
    revision: 1,
    title: '6-5 Z作戦後段',
    status: 'approved',
    questIds: [872],
    objectives: [{ questId: 872, result: 'S', requiredCount: 1 }],
    mapKey: '6-5',
    routeLabels: ['B-F-I-J-M'],
    targetNodes: ['M'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.koukuu_senkan],
          minimum: 2,
          maximum: 2,
          label: '航空戦艦 2 隻'
        },
        {
          shipTypeIds: [ApiShipType.koujyun],
          minimum: 1,
          maximum: 1,
          label: '航空巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 1,
          maximum: 1,
          label: '軽巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 2,
          maximum: 2,
          label: '駆逐艦 2 隻'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.SeaplaneFighter],
        minimum: 4,
        required: false,
        label: '本隊の航空均衡と敵弾着阻止に備える水上戦闘機'
      },
      {
        equipmentTypeIds: [SlotitemType.LandAttackAircraft],
        minimum: 6,
        required: false,
        label: '行動半径5でMへ届く基地航空隊2部隊分の陸攻'
      },
      {
        equipmentTypeIds: [SlotitemType.Sonar, SlotitemType.LargeSonar],
        minimum: 1,
        required: false,
        label: 'Bの潜水艦対策用ソナー'
      },
      {
        equipmentTypeIds: [SlotitemType.RecSeaplane],
        minimum: 2,
        required: false,
        label: 'I-J-Mの索敵分岐と弾着観測用の水上偵察機'
      }
    ],
    formations: [
      { formationId: ApiFormation.tanou, label: '単横陣', when: 'B の対潜戦' },
      { formationId: ApiFormation.tanjyuu, label: '単縦陣', when: 'F・I・J夜戦・Mボス' }
    ],
    airState: {
      target: 'parity',
      summary: '本隊は航空均衡を最低線とし、Mへ集中する基地航空隊2部隊の制空削りを含めて調整する'
    },
    actions: [
      '任務872を受注し、6-5段階が残っていること、基地航空隊が開放済みで2部隊出撃可能なことを確認する',
      '航空戦艦2・航空巡洋艦1・軽巡洋艦1・駆逐艦2の6隻にし、水上戦闘機・対空・索敵・対潜装備を分担する',
      '基地航空隊は行動半径5以上の2部隊をMボスへ集中し、航空隊を使えない場合は攻略準備不足として再確認する',
      'B-F-I-J-Mを進み、Bは単横陣、それ以外は単縦陣とする。各戦闘後に損傷を確認し、大破時は進撃しない',
      'Mボスは随伴艦隊を昼戦で減らし、必要なら夜戦して敵12隻を全滅させるS勝利を取り、任務872の達成を確認する'
    ],
    cost: 'high',
    risk: 'high',
    evidence: [
      {
        sourceId: 'wikiwiki-map-6-5-current',
        sourceLabel: '艦これ攻略 Wiki - 6-5',
        url: 'https://wikiwiki.jp/kancolle/中部海域/6-5',
        reviewedAt: '2026-08-03T11:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary:
          '航戦2・航巡1・軽巡1・駆逐2のB-F-I-J-M、航空均衡、基地航空隊2部隊集中と連合艦隊S勝利を確認'
      },
      {
        sourceId: 'kcwiki-map-6-5-current',
        sourceLabel: '舰娘百科 - 6-5',
        url: 'https://zh.kcwiki.cn/wiki/中部海域/6-5',
        reviewedAt: '2026-08-03T11:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary: '下回りの軽量水上編成、ボス半径5、基地航空隊2部隊と制空・資源負担を独立照合'
      },
      PeriodicSortieEvidence
    ],
    validity: { reviewBy: '2026-11-03T00:00:00.000Z' }
  },
  {
    schemaVersion: 1,
    id: 'normal-3-1-northern-quarterly',
    revision: 1,
    title: '3-1 北方海域警備',
    status: 'approved',
    questIds: [873],
    objectives: [{ questId: 873, result: 'A', requiredCount: 1 }],
    mapKey: '3-1',
    routeLabels: ['C-F-G'],
    targetNodes: ['G'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.seiki_kuubo, ApiShipType.soukou_kuubo],
          minimum: 1,
          maximum: 1,
          label: '正規空母・装甲空母 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.kei_kuubo],
          minimum: 1,
          maximum: 1,
          label: '軽空母 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 1,
          maximum: 1,
          label: '軽巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.jyuujyun, ApiShipType.koujyun],
          minimum: 1,
          maximum: 1,
          label: '重巡級 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 2,
          maximum: 2,
          label: '駆逐艦 2 隻'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.Fighter],
        minimum: 1,
        required: false,
        label: '艦上戦闘機（Gの航空優勢42に余裕を加える）'
      }
    ],
    formations: [{ formationId: ApiFormation.tanjyuu, label: '単縦陣', when: 'F・Gボス' }],
    airState: {
      target: 'superiority',
      summary: 'Gの航空優勢境界42に搭載機損耗分の余裕を加える'
    },
    actions: [
      '任務873を受注し、3-1段階が残っていることを確認する',
      '正規空母系1・軽空母1・軽巡洋艦1・重巡級1・駆逐艦2の6隻にする',
      'C-F-Gを進み、F戦後に損傷を確認して大破時は進撃しない',
      'GボスでA勝利以上を取り、3-1段階の進捗を確認する'
    ],
    cost: 'medium',
    risk: 'medium',
    evidence: [
      {
        sourceId: 'wikiwiki-map-3-1-current',
        sourceLabel: '艦これ攻略 Wiki - 3-1',
        url: 'https://wikiwiki.jp/kancolle/北方海域/3-1',
        reviewedAt: '2026-08-03T06:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary: '戦艦級・空母系2以下、駆逐2以上によるC-F-Gと任務873の軽巡条件を確認'
      },
      {
        sourceId: 'kcwiki-map-3-1-current',
        sourceLabel: '舰娘百科 - 3-1',
        url: 'https://zh.kcwiki.cn/wiki/3-1',
        reviewedAt: '2026-08-03T06:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary: '空母系2・巡洋艦級2・駆逐2の固定経路、軽巡入り編成と航空優勢42を独立照合'
      },
      PeriodicSortieEvidence
    ],
    validity: {
      reviewBy: '2026-11-03T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-3-2-northern-quarterly',
    revision: 1,
    title: '3-2 北方海域警備',
    status: 'approved',
    questIds: [873],
    objectives: [{ questId: 873, result: 'A', requiredCount: 1 }],
    mapKey: '3-2',
    routeLabels: ['C-E-F-L（高速+）', 'C-G-F-L（高速+）', 'C-G-H-F-L（通常高速時候補）'],
    targetNodes: ['L'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 1,
          maximum: 1,
          label: '軽巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 5,
          maximum: 5,
          label: '駆逐艦 5 隻'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.SmallRadar, SlotitemType.LargeRadar],
        minimum: 1,
        required: false,
        label: '分岐安定用の電探 1 個以上'
      }
    ],
    formations: [{ formationId: ApiFormation.tanjyuu, label: '単縦陣', when: '水上戦・Lボス' }],
    actions: [
      '任務873を受注し、3-2段階が残っていることを確認する',
      '軽巡洋艦1・駆逐艦5の6隻を全艦高速以上にし、少なくとも1隻へ電探を載せる',
      '高速+統一ならC-E-F-LまたはC-G-F-Lを狙い、通常高速ではHを経由する場合があるため各戦闘後に損傷を確認する',
      '大破時は進撃せず、LボスでA勝利以上を取って3-2段階の進捗を確認する'
    ],
    cost: 'low',
    risk: 'high',
    evidence: [
      {
        sourceId: 'wikiwiki-map-3-2-current',
        sourceLabel: '艦これ攻略 Wiki - 3-2',
        url: 'https://wikiwiki.jp/kancolle/北方海域/3-2',
        reviewedAt: '2026-08-03T06:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary: '軽巡1・駆逐5のボス到達、電探条件、高速+時のH回避と通常高速時のH経由リスクを確認'
      },
      {
        sourceId: 'kcwiki-map-3-2-current',
        sourceLabel: '舰娘百科 - 3-2',
        url: 'https://zh.kcwiki.cn/wiki/3-2',
        reviewedAt: '2026-08-03T06:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary: '軽巡1・駆逐5、高速+と電探による短縮候補、通常高速時のH分岐を独立照合'
      },
      PeriodicSortieEvidence
    ],
    validity: {
      reviewBy: '2026-11-03T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-3-3-northern-weekly',
    revision: 2,
    title: '3-3 北方定期任務まとめ',
    status: 'approved',
    questIds: [241, 873],
    objectives: [
      { questId: 241, result: 'victory', requiredCount: 5 },
      { questId: 873, result: 'A', requiredCount: 1 }
    ],
    mapKey: '3-3',
    routeLabels: ['A-C-G-M'],
    targetNodes: ['M'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.seiki_kuubo, ApiShipType.soukou_kuubo],
          minimum: 1,
          maximum: 1,
          label: '正規空母・装甲空母 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.kei_kuubo],
          minimum: 1,
          maximum: 1,
          label: '軽空母 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.jyuujyun, ApiShipType.koujyun],
          minimum: 1,
          maximum: 1,
          label: '重巡級 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 1,
          maximum: 1,
          label: '軽巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 2,
          maximum: 2,
          label: '駆逐艦 2 隻'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.Fighter],
        minimum: 2,
        required: false,
        label: '艦上戦闘機（Gの航空優勢78に余裕を加える）'
      },
      {
        equipmentTypeIds: [SlotitemType.SmallRadar, SlotitemType.LargeRadar],
        minimum: 3,
        required: false,
        label: 'Cうずしお軽減用の電探 3 個以上'
      }
    ],
    formations: [{ formationId: ApiFormation.tanjyuu, label: '単縦陣', when: 'G・Mボス' }],
    airState: {
      target: 'superiority',
      summary: 'Gの航空優勢境界78に搭載機損耗分の余裕を加える'
    },
    actions: [
      '任務241・873のうち表示中の対象を受注し、3-3の必要勝利が残っていることを確認する',
      '正規空母系1・軽空母1・重巡級1・軽巡洋艦1・駆逐艦2の6隻にし、3隻以上へ電探を載せる',
      'A-C-G-Mを進み、Cのうずしお後とG戦後に損傷を確認して大破時は進撃しない',
      'MボスでA勝利以上を取り、任務241は北方海域の合計5勝、任務873は3-3段階の進捗を確認する'
    ],
    cost: 'medium',
    risk: 'medium',
    evidence: [
      {
        sourceId: 'wikiwiki-map-3-3-current',
        sourceLabel: '艦これ攻略 Wiki - 3-3',
        url: 'https://wikiwiki.jp/kancolle/北方海域/3-3',
        reviewedAt: '2026-08-03T04:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary:
          '正規空母1・大型艦と空母系合計2・駆逐2以上・潜水艦なしのA-C-G-Mと軽巡入り任務873を確認'
      },
      {
        sourceId: 'kcwiki-map-3-3-current',
        sourceLabel: '舰娘百科 - 3-3',
        url: 'https://zh.kcwiki.cn/wiki/3-3',
        reviewedAt: '2026-08-03T04:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary:
          '正規空母1・軽空母1・軽巡を含む巡洋艦級2・駆逐2の固定経路、制空境界、任務873を独立照合'
      },
      PeriodicSortieEvidence
    ],
    validity: {
      reviewBy: '2026-11-03T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-4-1-western-quarterly',
    revision: 1,
    title: '4-1 西方海域作戦',
    status: 'approved',
    questIds: [845],
    objectives: [{ questId: 845, result: 'S', requiredCount: 1 }],
    mapKey: '4-1',
    routeLabels: ['A-B-D-H-J', 'C-F-D-H-J'],
    targetNodes: ['J'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.seiki_kuubo, ApiShipType.soukou_kuubo],
          minimum: 1,
          label: '正規空母・装甲空母 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.jyuujyun, ApiShipType.koujyun],
          minimum: 2,
          label: '重巡級 2 隻'
        },
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 1,
          label: '軽巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 2,
          label: '駆逐艦 2 隻'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.Fighter],
        minimum: 1,
        required: false,
        label: '艦上戦闘機（制空値36に余裕を加える）'
      },
      {
        equipmentTypeIds: [SlotitemType.Sonar, SlotitemType.LargeSonar],
        minimum: 1,
        required: false,
        label: 'Dの対潜戦用ソナー'
      }
    ],
    formations: [
      { formationId: ApiFormation.tanou, label: '単横陣', when: 'D の対潜戦' },
      { formationId: ApiFormation.tanjyuu, label: '単縦陣', when: '水上戦・Jボス' }
    ],
    airState: {
      target: 'superiority',
      summary: 'Jボスの航空優勢境界36に搭載機損耗分の余裕を加える'
    },
    actions: [
      '任務845を受注し、4-1段階が残っていることを確認する',
      '正規空母系1・重巡級2・軽巡洋艦1・駆逐艦2の6隻にし、現在の制空値を確認する',
      '初手分岐に応じてA-B-D-H-JまたはC-F-D-H-Jを進み、大破時は進撃しない',
      'JボスでS勝利し、4-1段階の進捗を確認する'
    ],
    cost: 'medium',
    risk: 'medium',
    evidence: [
      {
        sourceId: 'wikiwiki-map-4-1-current',
        sourceLabel: '艦これ攻略 Wiki - 4-1',
        url: 'https://wikiwiki.jp/kancolle/西方海域/4-1',
        reviewedAt: '2026-08-03T02:00:00.000Z',
        validUntil: '2027-02-02T00:00:00.000Z',
        confidence: 'supported',
        summary: '空母1以下・重巡級1以上・軽巡1・駆逐2でGを避ける分岐と制空境界を確認'
      },
      {
        sourceId: 'kcwiki-map-4-1-current',
        sourceLabel: '舰娘百科 - 4-1',
        url: 'https://zh.kcwiki.cn/wiki/西方海域/4-1',
        reviewedAt: '2026-08-03T02:00:00.000Z',
        validUntil: '2027-02-02T00:00:00.000Z',
        confidence: 'supported',
        summary: '正規空母1・重巡級2・軽巡1・駆逐2の分岐と航空優勢境界を独立照合'
      }
    ],
    validity: {
      reviewBy: '2026-11-02T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-4-3-western-quarterly',
    revision: 1,
    title: '4-3 西方海域作戦',
    status: 'approved',
    questIds: [845],
    objectives: [{ questId: 845, result: 'S', requiredCount: 1 }],
    mapKey: '4-3',
    routeLabels: ['D-H-N（HからNはランダム）'],
    targetNodes: ['N'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.kei_kuubo],
          minimum: 2,
          label: '軽空母 2 隻'
        },
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 1,
          label: '軽巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 3,
          label: '駆逐艦 3 隻'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.Fighter],
        minimum: 2,
        required: false,
        label: '艦上戦闘機（制空値155に余裕を加える）'
      },
      {
        equipmentTypeIds: [
          SlotitemType.AntiGroundEquipment,
          SlotitemType.LandingCraft,
          SlotitemType.SpecialATank,
          SlotitemType.LandingForce
        ],
        minimum: 2,
        required: false,
        label: '軽巡・駆逐用の対地装備 2 個以上'
      }
    ],
    formations: [{ formationId: ApiFormation.tanjyuu, label: '単縦陣', when: 'H・Nボス' }],
    airState: {
      target: 'superiority',
      summary: 'Nボスの航空優勢境界155に搭載機損耗分の余裕を加える'
    },
    actions: [
      '任務845を受注し、4-3段階が残っていることを確認する',
      '軽空母2・軽巡洋艦1・駆逐艦3の6隻にし、対地装備と現在の制空値を確認する',
      'D-Hへ進み、HからNボスへの分岐は固定できないため逸れた場合は再出撃する',
      'Nボスの陸上型旗艦を含む敵艦隊にS勝利し、4-3段階の進捗を確認する'
    ],
    cost: 'medium',
    risk: 'high',
    evidence: [
      {
        sourceId: 'wikiwiki-map-4-3-current',
        sourceLabel: '艦これ攻略 Wiki - 4-3',
        url: 'https://wikiwiki.jp/kancolle/西方海域/4-3',
        reviewedAt: '2026-08-03T02:00:00.000Z',
        validUntil: '2027-02-02T00:00:00.000Z',
        confidence: 'supported',
        summary: '軽巡1・駆逐3でD、空母系2でHからN寄りとなる分岐、陸上型ボスと任務条件を確認'
      },
      {
        sourceId: 'kcwiki-map-4-3-current',
        sourceLabel: '舰娘百科 - 4-3',
        url: 'https://zh.kcwiki.cn/wiki/西方海域/4-3',
        reviewedAt: '2026-08-03T02:00:00.000Z',
        validUntil: '2027-02-02T00:00:00.000Z',
        confidence: 'supported',
        summary: '軽空母2・軽巡1・駆逐3のD-H-N候補、制空と対地準備を独立照合'
      }
    ],
    validity: {
      reviewBy: '2026-11-02T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-4-4-western-quarterly',
    revision: 2,
    title: '4-4 西方定期任務まとめ',
    status: 'approved',
    questIds: [242, 845],
    objectives: [
      { questId: 242, result: 'victory', requiredCount: 1 },
      { questId: 845, result: 'S', requiredCount: 1 }
    ],
    mapKey: '4-4',
    routeLabels: ['A-E-I-K'],
    targetNodes: ['K'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.seiki_kuubo, ApiShipType.soukou_kuubo],
          minimum: 2,
          label: '正規空母・装甲空母 2 隻'
        },
        {
          shipTypeIds: [ApiShipType.jyuujyun, ApiShipType.koujyun],
          minimum: 1,
          label: '重巡級 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 1,
          label: '軽巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 2,
          label: '駆逐艦 2 隻'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.Fighter],
        minimum: 2,
        required: false,
        label: '艦上戦闘機（制空値72に余裕を加える）'
      },
      {
        equipmentTypeIds: [SlotitemType.Sonar, SlotitemType.LargeSonar],
        minimum: 1,
        required: false,
        label: 'Eとボス混成用ソナー'
      },
      {
        equipmentTypeIds: [SlotitemType.DepthCharge],
        minimum: 1,
        required: false,
        label: 'Eとボス混成用爆雷'
      }
    ],
    formations: [
      { formationId: ApiFormation.tanou, label: '単横陣', when: 'E の対潜戦' },
      { formationId: ApiFormation.tanjyuu, label: '単縦陣', when: 'I・Kボス' }
    ],
    airState: {
      target: 'superiority',
      summary: 'Kボスの航空優勢境界72に搭載機損耗分の余裕を加える'
    },
    actions: [
      '任務242・845のうち表示中の対象を受注し、4-4段階が残っていることを確認する',
      '正規空母系2・重巡級1・軽巡洋艦1・駆逐艦2の6隻にし、駆逐艦1隻へソナーと爆雷を載せる',
      'A-E-I-Kを進み、各戦闘後に損傷を確認して大破時は進撃しない',
      '潜水艦を含むボス編成にも備えてKボスでS勝利を狙い、対象任務の進捗を確認する'
    ],
    cost: 'medium',
    risk: 'medium',
    evidence: [
      {
        sourceId: 'wikiwiki-map-4-4-current',
        sourceLabel: '艦これ攻略 Wiki - 4-4',
        url: 'https://wikiwiki.jp/kancolle/西方海域/4-4',
        reviewedAt: '2026-08-03T02:00:00.000Z',
        validUntil: '2027-02-02T00:00:00.000Z',
        confidence: 'supported',
        summary: '正規空母2・駆逐2・重巡級または軽巡を含むA-E-I-Kとボス潜水艦対策を確認'
      },
      {
        sourceId: 'kcwiki-map-4-4-current',
        sourceLabel: '舰娘百科 - 4-4',
        url: 'https://zh.kcwiki.cn/wiki/西方海域/4-4',
        reviewedAt: '2026-08-03T02:00:00.000Z',
        validUntil: '2027-02-02T00:00:00.000Z',
        confidence: 'supported',
        summary: '空母2・重巡級1〜2・駆逐2のA-E-I-K編成とボス対潜準備を独立照合'
      },
      PeriodicSortieEvidence
    ],
    validity: {
      reviewBy: '2026-11-02T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-5-2-coral-weekly',
    revision: 1,
    title: '5-2 珊瑚諸島沖ウィークリー',
    status: 'approved',
    questIds: [243],
    objectives: [{ questId: 243, result: 'S', requiredCount: 2 }],
    mapKey: '5-2',
    routeLabels: ['B-C-E-F-O'],
    targetNodes: ['O'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.seiki_kuubo, ApiShipType.soukou_kuubo],
          minimum: 2,
          label: '正規空母・装甲空母 2 隻'
        },
        {
          shipTypeIds: [
            ApiShipType.kousoku_senkan,
            ApiShipType.teisoku_senkan,
            ApiShipType.koukuu_senkan,
            ApiShipType.tyoudokyuu_senkan
          ],
          minimum: 2,
          label: '戦艦級 2 隻'
        },
        {
          shipTypeIds: [ApiShipType.jyuujyun, ApiShipType.koujyun],
          minimum: 2,
          label: '重巡級 2 隻'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.Fighter],
        minimum: 4,
        required: false,
        label: '艦上戦闘機（出撃時制空値200以上を確認）'
      },
      {
        equipmentTypeIds: [SlotitemType.RecSeaplane, SlotitemType.RecAircraft],
        minimum: 3,
        required: false,
        label: 'F-O索敵分岐用の偵察装備'
      }
    ],
    formations: [
      { formationId: ApiFormation.rinkei, label: '輪形陣', when: 'C の空襲戦' },
      { formationId: ApiFormation.tanjyuu, label: '単縦陣', when: 'E・F・Oボス' }
    ],
    airState: {
      target: 'superiority',
      summary: 'Oボスの航空優勢境界176にC空襲戦などの搭載機損耗分を加え、出撃時200以上を確認する'
    },
    actions: [
      '任務243を受注し、5-2のS勝利回数が残っていることを確認する',
      '正規空母系2・戦艦級2・重巡級2の6隻にし、出撃時制空値200以上と分岐点係数2の索敵値71以上を確認する',
      'B-C-E-F-Oを進み、C空襲戦と各水上戦後に損傷を確認して大破時は進撃しない',
      'OボスでS勝利を2回取り、任務243の達成を確認する'
    ],
    cost: 'high',
    risk: 'high',
    evidence: [
      {
        sourceId: 'wikiwiki-map-5-2-current',
        sourceLabel: '艦これ攻略 Wiki - 5-2',
        url: 'https://wikiwiki.jp/kancolle/南方海域/5-2',
        reviewedAt: '2026-08-03T04:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary: '空母2・戦艦2・重巡級2のB-C-E-F-O、索敵分岐、S勝利向け重量編成と任務回数を確認'
      },
      {
        sourceId: 'kcwiki-map-5-2-current',
        sourceLabel: '舰娘百科 - 5-2',
        url: 'https://zh.kcwiki.cn/wiki/5-2',
        reviewedAt: '2026-08-03T04:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary: '重量編成のB-C-E-F-O、係数2で索敵71、ボス優勢176と出撃時制空200以上を独立照合'
      },
      PeriodicSortieEvidence
    ],
    validity: {
      reviewBy: '2026-11-03T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-4-5-western-quarterly',
    revision: 1,
    title: '4-5 西方海域作戦',
    status: 'approved',
    questIds: [845],
    objectives: [{ questId: 845, result: 'S', requiredCount: 1 }],
    mapKey: '4-5',
    routeLabels: ['A-D-H-T', 'C-D-H-T'],
    targetNodes: ['T'],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        {
          shipTypeIds: [ApiShipType.seiki_kuubo, ApiShipType.soukou_kuubo],
          minimum: 2,
          label: '正規空母・装甲空母 2 隻'
        },
        {
          shipTypeIds: [ApiShipType.keijyun],
          minimum: 1,
          label: '軽巡洋艦 1 隻'
        },
        {
          shipTypeIds: [ApiShipType.kutikukan],
          minimum: 3,
          label: '駆逐艦 3 隻'
        }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.Fighter],
        minimum: 3,
        required: false,
        label: '艦上戦闘機（制空値207に余裕を加える）'
      },
      {
        equipmentTypeIds: [
          SlotitemType.AntiGroundEquipment,
          SlotitemType.LandingCraft,
          SlotitemType.SpecialATank,
          SlotitemType.LandingForce
        ],
        minimum: 3,
        required: false,
        label: '軽巡・駆逐用の対地装備 3 個以上'
      },
      {
        equipmentTypeIds: [SlotitemType.Sonar, SlotitemType.LargeSonar],
        minimum: 1,
        required: false,
        label: 'Dの対潜戦用ソナー'
      }
    ],
    formations: [
      { formationId: ApiFormation.tanou, label: '単横陣', when: 'D の対潜戦' },
      { formationId: ApiFormation.tanjyuu, label: '単縦陣', when: 'H・Tボス' }
    ],
    airState: {
      target: 'superiority',
      summary: 'Tボス通常編成の航空優勢境界207に搭載機損耗分の余裕を加える'
    },
    actions: [
      '任務845を受注し、4-5段階が残っていることと海域が開放済みであることを確認する',
      '正規空母系2・軽巡洋艦1・駆逐艦3の6隻にし、対地装備と現在の制空値を確認する',
      '初手の能動分岐でDを選び、A-D-H-TまたはC-D-H-Tを進んで大破時は進撃しない',
      '陸上型の港湾棲姫を撃沈してTボスでS勝利し、任務845の達成を確認する'
    ],
    cost: 'high',
    risk: 'high',
    evidence: [
      {
        sourceId: 'wikiwiki-map-4-5-current',
        sourceLabel: '艦これ攻略 Wiki - 4-5',
        url: 'https://wikiwiki.jp/kancolle/西方海域/4-5',
        reviewedAt: '2026-08-03T02:00:00.000Z',
        validUntil: '2027-02-02T00:00:00.000Z',
        confidence: 'supported',
        summary: '軽巡1・駆逐3の中央最短、対潜・水上・陸上型への複合準備と海域開放条件を確認'
      },
      {
        sourceId: 'kcwiki-map-4-5-current',
        sourceLabel: '舰娘百科 - 4-5',
        url: 'https://zh.kcwiki.cn/wiki/4-5',
        reviewedAt: '2026-08-03T02:00:00.000Z',
        validUntil: '2027-02-02T00:00:00.000Z',
        confidence: 'supported',
        summary: '空母2・軽巡1・駆逐3のA/C-D-H-T、制空境界と対地準備を独立照合'
      }
    ],
    validity: {
      reviewBy: '2026-11-02T00:00:00.000Z'
    }
  },
  {
    schemaVersion: 1,
    id: 'normal-7-1-anchorage-quarterly',
    revision: 1,
    title: '7-1 ブルネイ泊地沖哨戒',
    status: 'approved',
    questIds: [893],
    objectives: [{ questId: 893, result: 'S', requiredCount: 3 }],
    mapKey: '7-1',
    routeLabels: ['D-E-G-H-K'],
    targetNodes: ['K'],
    fleet: {
      minimumShips: 5,
      maximumShips: 5,
      shipTypeConstraints: [
        { shipTypeIds: [ApiShipType.keijyun], minimum: 1, label: '軽巡洋艦 1 隻' },
        { shipTypeIds: [ApiShipType.kutikukan], minimum: 4, label: '駆逐艦 4 隻' }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.Sonar, SlotitemType.LargeSonar],
        minimum: 4,
        required: false,
        label: '先制対潜を行える艦へソナー'
      },
      {
        equipmentTypeIds: [SlotitemType.DepthCharge],
        minimum: 4,
        required: false,
        label: '対潜火力を補う爆雷'
      }
    ],
    formations: [
      { formationId: ApiFormation.tanou, label: '単横陣', when: 'D・H・Kボスの対潜戦' },
      { formationId: ApiFormation.tanjyuu, label: '単縦陣', when: 'G の水上戦' }
    ],
    actions: [
      '任務893を受注し、7-1段階が残っていることを確認する',
      '軽巡洋艦1・駆逐艦4の5隻にし、4隻以上が先制対潜できる装備を優先する',
      'D-E-G-H-Kを進み、Gの水上戦後に損傷を確認して大破時は進撃しない',
      'KボスでS勝利を3回取り、7-1段階の進捗を確認する'
    ],
    cost: 'low',
    risk: 'medium',
    evidence: [
      {
        sourceId: 'wikiwiki-map-7-1-current',
        sourceLabel: '艦これ攻略 Wiki - 7-1',
        url: 'https://wikiwiki.jp/kancolle/南西海域/7-1',
        reviewedAt: '2026-08-03T03:00:00.000Z',
        validUntil: '2027-02-02T00:00:00.000Z',
        confidence: 'supported',
        summary: '軽巡1・駆逐4のD-E-G-H-K固定と対潜・水上混成への準備を確認'
      },
      {
        sourceId: 'kcwiki-map-7-1-current',
        sourceLabel: '舰娘百科 - 7-1',
        url: 'https://zh.kcwiki.cn/wiki/7-1',
        reviewedAt: '2026-08-03T03:00:00.000Z',
        validUntil: '2027-02-02T00:00:00.000Z',
        confidence: 'supported',
        summary: '同編成の固定経路と4～5隻の先制対潜推奨を独立照合'
      }
    ],
    validity: { reviewBy: '2026-11-02T00:00:00.000Z' }
  },
  {
    schemaVersion: 1,
    id: 'normal-7-2-g-anchorage-quarterly',
    revision: 1,
    title: '7-2 タウイタウイ泊地沖 第一ゲージ',
    status: 'approved',
    questIds: [893],
    objectives: [{ questId: 893, result: 'S', requiredCount: 3 }],
    mapKey: '7-2',
    routeLabels: ['C-E-G'],
    targetNodes: ['G'],
    targetCellIds: [7],
    fleet: {
      minimumShips: 4,
      maximumShips: 4,
      shipTypeConstraints: [
        { shipTypeIds: [ApiShipType.keijyun], minimum: 1, label: '軽巡洋艦 1 隻' },
        { shipTypeIds: [ApiShipType.kutikukan], minimum: 3, label: '駆逐艦 3 隻' }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.Sonar, SlotitemType.LargeSonar],
        minimum: 3,
        required: false,
        label: '先制対潜を行える艦へソナー'
      },
      {
        equipmentTypeIds: [SlotitemType.DepthCharge],
        minimum: 3,
        required: false,
        label: '対潜火力を補う爆雷'
      }
    ],
    formations: [
      { formationId: ApiFormation.tanou, label: '単横陣', when: 'C・E の対潜戦' },
      { formationId: ApiFormation.fukujyuu, label: '複縦陣', when: 'Gボスの潜水・水上混成戦' }
    ],
    actions: [
      '任務893を受注し、7-2のG段階が残っていることを確認する',
      '軽巡洋艦1・駆逐艦3の4隻にし、先制対潜と水上艦への砲撃を両立させる',
      'C-E-Gを進み、Gボスの潜水艦と水上艦をすべて撃沈してS勝利を3回取る',
      '第一ゲージ破壊後に第二ゲージ側が開放されたことと任務進捗を確認する'
    ],
    cost: 'low',
    risk: 'medium',
    evidence: [
      {
        sourceId: 'wikiwiki-map-7-2-current',
        sourceLabel: '艦これ攻略 Wiki - 7-2',
        url: 'https://wikiwiki.jp/kancolle/南西海域/7-2',
        reviewedAt: '2026-08-03T03:00:00.000Z',
        validUntil: '2027-02-02T00:00:00.000Z',
        confidence: 'supported',
        summary: '第一ゲージのC-E-G、4隻編成とGボスS勝利に必要な対潜・水上両対応を確認'
      },
      {
        sourceId: 'kcwiki-map-7-2-current',
        sourceLabel: '舰娘百科 - 7-2',
        url: 'https://zh.kcwiki.cn/wiki/南西海域/7-2',
        reviewedAt: '2026-08-03T03:00:00.000Z',
        validUntil: '2027-02-02T00:00:00.000Z',
        confidence: 'supported',
        summary: '軽巡1・駆逐3のC-E-Gと第一ゲージ破壊による第二ゲージ開放を独立照合'
      }
    ],
    validity: { reviewBy: '2026-11-02T00:00:00.000Z' }
  },
  {
    schemaVersion: 1,
    id: 'normal-7-2-m-anchorage-quarterly',
    revision: 1,
    title: '7-2 タウイタウイ泊地沖 第二ゲージ',
    status: 'approved',
    questIds: [872, 893],
    objectives: [
      { questId: 872, result: 'S', requiredCount: 1 },
      { questId: 893, result: 'S', requiredCount: 3 }
    ],
    mapKey: '7-2',
    routeLabels: ['B-C-D-I-M'],
    targetNodes: ['M'],
    targetCellIds: [15],
    fleet: {
      minimumShips: 6,
      maximumShips: 6,
      shipTypeConstraints: [
        { shipTypeIds: [ApiShipType.kousoku_senkan], minimum: 1, label: '高速戦艦 1 隻' },
        {
          shipTypeIds: [ApiShipType.seiki_kuubo, ApiShipType.soukou_kuubo],
          minimum: 1,
          label: '正規空母系 1 隻'
        },
        { shipTypeIds: [ApiShipType.kei_kuubo], minimum: 1, label: '軽空母 1 隻' },
        { shipTypeIds: [ApiShipType.koujyun], minimum: 1, label: '航空巡洋艦 1 隻' },
        { shipTypeIds: [ApiShipType.kutikukan], minimum: 2, label: '駆逐艦 2 隻' }
      ]
    },
    equipmentTypeConstraints: [
      {
        equipmentTypeIds: [SlotitemType.Fighter, SlotitemType.SeaplaneFighter],
        minimum: 4,
        required: false,
        label: 'Mボス航空優勢359を目安にした戦闘機'
      },
      {
        equipmentTypeIds: [SlotitemType.RecAircraft, SlotitemType.RecSeaplane],
        minimum: 2,
        required: false,
        label: '分岐点係数4で索敵値69以上を確保する偵察機'
      },
      {
        equipmentTypeIds: [SlotitemType.Sonar, SlotitemType.LargeSonar],
        minimum: 1,
        required: false,
        label: '道中の対潜戦に備えるソナー'
      }
    ],
    formations: [
      { formationId: ApiFormation.tanou, label: '単横陣', when: '潜水艦隊と遭遇した戦闘' },
      { formationId: ApiFormation.tanjyuu, label: '単縦陣', when: '水上戦・Mボス' }
    ],
    airState: {
      target: 'superiority',
      summary: 'Mボス強編成の航空優勢境界359に搭載機損耗分の余裕を加える'
    },
    actions: [
      '任務872・893のうち表示中の対象を受注し、当月の第一ゲージを破壊してM側を開放してから7-2のM段階を確認する',
      '高速戦艦1・正規空母系1・軽空母1・航空巡洋艦1・駆逐艦2の全艦高速6隻にする',
      '制空値359以上と分岐点係数4の索敵値69以上を目安に装備を確認する',
      'B-C-D-I-Mを進んで大破時は進撃せず、Mボスで任務872はS勝利1回、任務893はS勝利3回まで進捗を確認する'
    ],
    cost: 'high',
    risk: 'high',
    evidence: [
      {
        sourceId: 'wikiwiki-map-7-2-current',
        sourceLabel: '艦これ攻略 Wiki - 7-2',
        url: 'https://wikiwiki.jp/kancolle/南西海域/7-2',
        reviewedAt: '2026-08-03T03:00:00.000Z',
        validUntil: '2027-02-02T00:00:00.000Z',
        confidence: 'supported',
        summary: '第二ゲージの高速統一B-C-D-I-M、艦種条件、索敵値と制空境界を確認'
      },
      {
        sourceId: 'kcwiki-map-7-2-current',
        sourceLabel: '舰娘百科 - 7-2',
        url: 'https://zh.kcwiki.cn/wiki/南西海域/7-2',
        reviewedAt: '2026-08-03T03:00:00.000Z',
        validUntil: '2027-02-02T00:00:00.000Z',
        confidence: 'supported',
        summary: '高速戦艦1・正規空母1・軽空母1・航巡1・駆逐2の経路と準備値を独立照合'
      },
      PeriodicSortieEvidence
    ],
    validity: { reviewBy: '2026-11-02T00:00:00.000Z' }
  }
]

export const BundledQuestStrategyKnowledge = validateQuestStrategyKnowledgeBundle({
  schemaVersion: 1,
  version: '2026-08-03.16',
  recipes
})

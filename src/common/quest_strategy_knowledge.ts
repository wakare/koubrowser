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
    questIds: [226, 822],
    objectives: [
      { questId: 226, result: 'victory', requiredCount: 5 },
      { questId: 822, result: 'S', requiredCount: 2 }
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
      '任務226・822のうち表示中の対象を受注し、2-4の必要勝利数が残っていることを確認する',
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
        summary: '重巡級1以下・軽巡1・駆逐4のB-G-H-L-P固定と軽量編成のS勝利リスク、任務822のS勝利2回を確認'
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
    id: 'normal-3-3-northern-weekly',
    revision: 1,
    title: '3-3 北方ウィークリー周回',
    status: 'approved',
    questIds: [241],
    objectives: [{ questId: 241, result: 'victory', requiredCount: 5 }],
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
          minimum: 2,
          label: '重巡級 2 隻'
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
      '任務241を受注し、3-3・3-4・3-5の合計勝利数が残っていることを確認する',
      '正規空母系1・軽空母1・重巡級2・駆逐艦2の6隻にし、3隻以上へ電探を載せる',
      'A-C-G-Mを進み、Cのうずしお後とG戦後に損傷を確認して大破時は進撃しない',
      'MボスでB勝利以上を取り、合計5勝まで同じ周回を繰り返す'
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
        summary: '正規空母1・大型艦と空母系合計2・駆逐2以上・潜水艦なしのA-C-G-Mと北方任務周回を確認'
      },
      {
        sourceId: 'kcwiki-map-3-3-current',
        sourceLabel: '舰娘百科 - 3-3',
        url: 'https://zh.kcwiki.cn/wiki/3-3',
        reviewedAt: '2026-08-03T04:00:00.000Z',
        validUntil: '2027-02-03T00:00:00.000Z',
        confidence: 'supported',
        summary: '正規空母1・軽空母1・巡洋艦級2・駆逐2の固定経路、制空境界、電探準備を独立照合'
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
    questIds: [893],
    objectives: [{ questId: 893, result: 'S', requiredCount: 3 }],
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
      '任務893を受注し、当月の第一ゲージを破壊してM側を開放してから7-2のM段階を確認する',
      '高速戦艦1・正規空母系1・軽空母1・航空巡洋艦1・駆逐艦2の全艦高速6隻にする',
      '制空値359以上と分岐点係数4の索敵値69以上を目安に装備を確認する',
      'B-C-D-I-Mを進んで大破時は進撃せず、MボスでS勝利を3回取って任務達成を確認する'
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
      }
    ],
    validity: { reviewBy: '2026-11-02T00:00:00.000Z' }
  }
]

export const BundledQuestStrategyKnowledge = validateQuestStrategyKnowledgeBundle({
  schemaVersion: 1,
  version: '2026-08-03.7',
  recipes
})

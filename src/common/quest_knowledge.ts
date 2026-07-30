import {
  validateQuestKnowledgeUpdate,
  type QuestKnowledgeUpdate
} from '@common/quest_knowledge_update'

export type QuestCuratedSource = 'wikiwiki' | 'kcwiki'
export type QuestPrerequisiteMode = 'all' | 'any'
export type QuestPrerequisiteReviewStatus = 'verified' | 'incomplete' | 'under-review'
export type QuestCuratedConflictKind = 'source-disagreement' | 'unresolved-review'

export interface QuestCuratedReference {
  source: QuestCuratedSource
  sourceLabel: string
  url: string
  lastVerifiedAt: string
  dataVersion: string
}

export interface QuestCuratedQuestRef {
  questId: number
  title: string
}

export interface QuestCuratedPrerequisiteGroup {
  mode: QuestPrerequisiteMode
  quests: QuestCuratedQuestRef[]
}

export interface QuestCuratedClaim extends QuestCuratedReference {
  questId: number
  questTitle: string
  prerequisites: QuestCuratedPrerequisiteGroup[]
  /**
   * false when the source explicitly states that another prerequisite may exist
   * but does not identify it. Incomplete and complete claims must not be merged.
   */
  prerequisitesComplete?: boolean
  /**
   * under-review keeps a source's tentative relationship visible without
   * allowing it into the resolved graph.
   */
  reviewStatus?: QuestPrerequisiteReviewStatus
  reviewNote?: string
}

export interface QuestCuratedResolvedGroup extends QuestCuratedPrerequisiteGroup {
  provenance: QuestCuratedReference[]
}

export interface QuestCuratedDownstream {
  questId: number
  title: string
  prerequisiteMode: QuestPrerequisiteMode
  provenance: QuestCuratedReference[]
}

export interface QuestCuratedConflictDetail extends QuestCuratedReference {
  prerequisiteGroups: QuestCuratedPrerequisiteGroup[]
  prerequisitesComplete: boolean
  reviewStatus: QuestPrerequisiteReviewStatus
  reviewNote?: string
}

export interface QuestCuratedConflict {
  field: 'prerequisites'
  kind: QuestCuratedConflictKind
  summary: string
  provenance: QuestCuratedReference[]
  details: QuestCuratedConflictDetail[]
}

export interface QuestCuratedKnowledge {
  questId: number
  questTitle: string
  prerequisiteGroups: QuestCuratedResolvedGroup[]
  downstream: QuestCuratedDownstream[]
  conflicts: QuestCuratedConflict[]
}

const JapanesePeriodicQuestUrl = 'https://wikiwiki.jp/kancolle/任務/出撃定期'
const JapaneseOneTimeSortieQuestUrl = 'https://wikiwiki.jp/kancolle/任務/出撃任務'
const JapanesePracticeQuestUrl = 'https://wikiwiki.jp/kancolle/任務/演習任務'
const JapaneseExpeditionQuestUrl = 'https://wikiwiki.jp/kancolle/任務/遠征任務'
const JapaneseFactoryQuestUrl = 'https://wikiwiki.jp/kancolle/任務/工廠任務'
const JapaneseModernizationQuestUrl = 'https://wikiwiki.jp/kancolle/任務/改装任務'
const ChineseQuestListUrl = 'https://zh.kcwiki.cn/wiki/任务分类'

const JapaneseReference: QuestCuratedReference = {
  source: 'wikiwiki',
  sourceLabel: '日本語攻略Wiki',
  url: JapanesePeriodicQuestUrl,
  lastVerifiedAt: '2026-07-26',
  dataVersion: 'ページ更新 2026-07-04'
}

const ChineseReference: QuestCuratedReference = {
  source: 'kcwiki',
  sourceLabel: '中文KCWiki',
  url: ChineseQuestListUrl,
  lastVerifiedAt: '2026-07-26',
  dataVersion: 'ページ確認 2026-07-26'
}

const JapaneseOneTimeSortieReference: QuestCuratedReference = {
  source: 'wikiwiki',
  sourceLabel: '日本語攻略Wiki',
  url: JapaneseOneTimeSortieQuestUrl,
  lastVerifiedAt: '2026-07-26',
  dataVersion: 'ページ更新 2026-07-06'
}

const JapanesePracticeReference: QuestCuratedReference = {
  source: 'wikiwiki',
  sourceLabel: '日本語攻略Wiki',
  url: JapanesePracticeQuestUrl,
  lastVerifiedAt: '2026-07-26',
  dataVersion: 'ページ更新 2026-07-08'
}

const JapaneseExpeditionReference: QuestCuratedReference = {
  source: 'wikiwiki',
  sourceLabel: '日本語攻略Wiki',
  url: JapaneseExpeditionQuestUrl,
  lastVerifiedAt: '2026-07-26',
  dataVersion: 'ページ更新 2025-06-14'
}

const JapaneseFactoryReference: QuestCuratedReference = {
  source: 'wikiwiki',
  sourceLabel: '日本語攻略Wiki',
  url: JapaneseFactoryQuestUrl,
  lastVerifiedAt: '2026-07-26',
  dataVersion: 'ページ更新 2026-07-26'
}

const JapaneseModernizationReference: QuestCuratedReference = {
  source: 'wikiwiki',
  sourceLabel: '日本語攻略Wiki',
  url: JapaneseModernizationQuestUrl,
  lastVerifiedAt: '2026-07-26',
  dataVersion: 'ページ更新 2024-07-12'
}

const ChineseOneTimeSortieReference: QuestCuratedReference = {
  ...ChineseReference
}

interface ReviewedPrerequisite {
  questId: number
  questTitle: string
  prerequisiteId: number
  prerequisiteTitle: string
}

interface ReviewedQuestPrerequisites {
  questId: number
  questTitle: string
  prerequisites: QuestCuratedPrerequisiteGroup[]
}

/**
 * 日本語攻略Wikiと中文KCWikiの双方で同じ前提関係を確認できた定期任務。
 * Wiki独自IDではなく、ゲームAPIとローカル定義で照合した内部任務IDで保持する。
 * Wikiの作業用内部ID表は関係の根拠には使用しない。
 */
const ReviewedPeriodicPrerequisites: readonly ReviewedPrerequisite[] = [
  {
    questId: 216,
    questTitle: '敵艦隊主力を撃滅せよ！',
    prerequisiteId: 201,
    prerequisiteTitle: '敵艦隊を撃破せよ！'
  },
  {
    questId: 210,
    questTitle: '敵艦隊を10回邀撃せよ！',
    prerequisiteId: 216,
    prerequisiteTitle: '敵艦隊主力を撃滅せよ！'
  },
  {
    questId: 211,
    questTitle: '敵空母を３隻撃沈せよ！',
    prerequisiteId: 201,
    prerequisiteTitle: '敵艦隊を撃破せよ！'
  },
  {
    questId: 218,
    questTitle: '敵補給艦を3隻撃沈せよ！',
    prerequisiteId: 216,
    prerequisiteTitle: '敵艦隊主力を撃滅せよ！'
  },
  {
    questId: 212,
    questTitle: '敵輸送船団を叩け！',
    prerequisiteId: 201,
    prerequisiteTitle: '敵艦隊を撃破せよ！'
  },
  {
    questId: 226,
    questTitle: '南西諸島海域の制海権を握れ！',
    prerequisiteId: 218,
    prerequisiteTitle: '敵補給艦を3隻撃沈せよ！'
  },
  {
    questId: 230,
    questTitle: '敵潜水艦を制圧せよ！',
    prerequisiteId: 226,
    prerequisiteTitle: '南西諸島海域の制海権を握れ！'
  },
  {
    questId: 214,
    questTitle: 'あ号作戦',
    prerequisiteId: 216,
    prerequisiteTitle: '敵艦隊主力を撃滅せよ！'
  },
  {
    questId: 220,
    questTitle: 'い号作戦',
    prerequisiteId: 218,
    prerequisiteTitle: '敵補給艦を3隻撃沈せよ！'
  },
  {
    questId: 213,
    questTitle: '海上通商破壊作戦',
    prerequisiteId: 216,
    prerequisiteTitle: '敵艦隊主力を撃滅せよ！'
  },
  {
    questId: 221,
    questTitle: 'ろ号作戦',
    prerequisiteId: 214,
    prerequisiteTitle: 'あ号作戦'
  },
  {
    questId: 228,
    questTitle: '海上護衛戦',
    prerequisiteId: 220,
    prerequisiteTitle: 'い号作戦'
  },
  {
    questId: 229,
    questTitle: '敵東方艦隊を撃滅せよ！',
    prerequisiteId: 228,
    prerequisiteTitle: '海上護衛戦'
  },
  {
    questId: 242,
    questTitle: '敵東方中枢艦隊を撃破せよ！',
    prerequisiteId: 229,
    prerequisiteTitle: '敵東方艦隊を撃滅せよ！'
  },
  {
    questId: 243,
    questTitle: '南方海域珊瑚諸島沖の制空権を握れ！',
    prerequisiteId: 242,
    prerequisiteTitle: '敵東方中枢艦隊を撃破せよ！'
  }
]

/**
 * 初期の単発出撃任務のうち、双方のWikiで同じ前提を確認できた範囲。
 * B12はA10以外の前提に争いがあるため、確定するまで収録しない。
 */
const ReviewedOneTimeSortiePrerequisites: readonly ReviewedPrerequisite[] = [
  {
    questId: 215,
    questTitle: '第２艦隊、出撃せよ！',
    prerequisiteId: 115,
    prerequisiteTitle: '第２艦隊を編成せよ！'
  },
  {
    questId: 203,
    questTitle: '鎮守府正面海域を護れ！',
    prerequisiteId: 202,
    prerequisiteTitle: 'はじめての「出撃」！'
  },
  {
    questId: 204,
    questTitle: '南西諸島沖に出撃せよ！',
    prerequisiteId: 203,
    prerequisiteTitle: '鎮守府正面海域を護れ！'
  },
  {
    questId: 205,
    questTitle: '接近する「敵前衛艦隊」を迎撃せよ！',
    prerequisiteId: 204,
    prerequisiteTitle: '南西諸島沖に出撃せよ！'
  },
  {
    questId: 206,
    questTitle: '「水雷戦隊」で出撃せよ！',
    prerequisiteId: 205,
    prerequisiteTitle: '接近する「敵前衛艦隊」を迎撃せよ！'
  },
  {
    questId: 207,
    questTitle: '「重巡洋艦」を出撃させよ！',
    prerequisiteId: 206,
    prerequisiteTitle: '「水雷戦隊」で出撃せよ！'
  },
  {
    questId: 208,
    questTitle: '「戦艦」を出撃させよ！',
    prerequisiteId: 207,
    prerequisiteTitle: '「重巡洋艦」を出撃させよ！'
  },
  {
    questId: 209,
    questTitle: '「空母機動部隊」出撃せよ！',
    prerequisiteId: 208,
    prerequisiteTitle: '「戦艦」を出撃させよ！'
  },
  {
    questId: 217,
    questTitle: '敵空母を撃沈せよ！',
    prerequisiteId: 117,
    prerequisiteTitle: '第２艦隊で空母機動部隊を編成せよ！'
  },
  {
    questId: 219,
    questTitle: '「三川艦隊」出撃せよ！',
    prerequisiteId: 119,
    prerequisiteTitle: '「三川艦隊」を編成せよ！'
  },
  {
    questId: 223,
    questTitle: '「第四戦隊」出撃せよ！',
    prerequisiteId: 121,
    prerequisiteTitle: '「第四戦隊」を編成せよ！'
  },
  {
    questId: 224,
    questTitle: '「西村艦隊」出撃せよ！',
    prerequisiteId: 122,
    prerequisiteTitle: '「西村艦隊」を編成せよ！'
  },
  {
    questId: 225,
    questTitle: '「第五航空戦隊」出撃せよ！',
    prerequisiteId: 123,
    prerequisiteTitle: '「第五航空戦隊」を編成せよ！'
  },
  {
    questId: 227,
    questTitle: '新「三川艦隊」出撃せよ！',
    prerequisiteId: 124,
    prerequisiteTitle: '新「三川艦隊」を編成せよ！'
  },
  {
    questId: 231,
    questTitle: '「潜水艦隊」出撃せよ！',
    prerequisiteId: 125,
    prerequisiteTitle: '潜水艦隊を編成せよ！'
  },
  {
    questId: 232,
    questTitle: '「航空水上打撃艦隊」出撃せよ！',
    prerequisiteId: 126,
    prerequisiteTitle: '航空水上打撃艦隊を編成せよ！'
  },
  {
    questId: 233,
    questTitle: '「第六戦隊」出撃せよ！',
    prerequisiteId: 128,
    prerequisiteTitle: '「第六戦隊」を編成せよ！'
  },
  {
    questId: 239,
    questTitle: '「第八駆逐隊」出撃せよ！',
    prerequisiteId: 131,
    prerequisiteTitle: '「第八駆逐隊」を編成せよ！'
  },
  {
    questId: 240,
    questTitle: '「第十八駆逐隊」出撃せよ！',
    prerequisiteId: 132,
    prerequisiteTitle: '「第十八駆逐隊」を編成せよ！'
  },
  {
    questId: 244,
    questTitle: '「第三十駆逐隊(第一次)」出撃せよ！',
    prerequisiteId: 133,
    prerequisiteTitle: '「第三十駆逐隊(第一次)」を編成せよ！'
  },
  {
    questId: 247,
    questTitle: '「航空戦艦」抜錨せよ！',
    prerequisiteId: 412,
    prerequisiteTitle: '航空火力艦の運用を強化せよ！'
  },
  {
    questId: 248,
    questTitle: '「第三十駆逐隊」対潜哨戒！',
    prerequisiteId: 136,
    prerequisiteTitle: '「第三十駆逐隊(第二次)」を編成せよ！'
  },
  {
    questId: 250,
    questTitle: '新編「第二航空戦隊」出撃せよ！',
    prerequisiteId: 138,
    prerequisiteTitle: '新編「第二航空戦隊」を編成せよ！'
  },
  {
    questId: 251,
    questTitle: '精鋭「第二航空戦隊」抜錨せよ！',
    prerequisiteId: 141,
    prerequisiteTitle: '再編成「第二航空戦隊」を強化せよ！'
  },
  {
    questId: 252,
    questTitle: '戦艦「榛名」出撃せよ！',
    prerequisiteId: 248,
    prerequisiteTitle: '「第三十駆逐隊」対潜哨戒！'
  },
  {
    questId: 253,
    questTitle: '「第六〇一航空隊」出撃せよ！',
    prerequisiteId: 143,
    prerequisiteTitle: '「新型正規空母」を配備せよ！'
  },
  {
    questId: 254,
    questTitle: '「軽空母」戦隊、出撃せよ！',
    prerequisiteId: 105,
    prerequisiteTitle: '軽巡２隻を擁する隊を編成せよ！'
  },
  {
    questId: 255,
    questTitle: '「水雷戦隊」バシー島沖緊急展開',
    prerequisiteId: 206,
    prerequisiteTitle: '「水雷戦隊」で出撃せよ！'
  },
  {
    questId: 258,
    questTitle: '「第二戦隊」抜錨！',
    prerequisiteId: 144,
    prerequisiteTitle: '主力戦艦部隊「第二戦隊」を編成せよ！'
  },
  {
    questId: 262,
    questTitle: '「西村艦隊」南方海域へ進出せよ！',
    prerequisiteId: 147,
    prerequisiteTitle: '「西村艦隊」を再編成せよ！'
  },
  {
    questId: 263,
    questTitle: '「第六戦隊」南西海域へ出撃せよ！',
    prerequisiteId: 233,
    prerequisiteTitle: '「第六戦隊」出撃せよ！'
  },
  {
    questId: 267,
    questTitle: '「第十一駆逐隊」出撃せよ！',
    prerequisiteId: 149,
    prerequisiteTitle: '「第十一駆逐隊」を編成せよ！'
  },
  {
    questId: 268,
    questTitle: '「第十一駆逐隊」対潜哨戒！',
    prerequisiteId: 149,
    prerequisiteTitle: '「第十一駆逐隊」を編成せよ！'
  },
  {
    questId: 269,
    questTitle: '「第二一駆逐隊」出撃せよ！',
    prerequisiteId: 150,
    prerequisiteTitle: '「第二一駆逐隊」を編成せよ！'
  },
  {
    questId: 270,
    questTitle: '「第二二駆逐隊」出撃せよ！',
    prerequisiteId: 151,
    prerequisiteTitle: '「第二二駆逐隊」を編成せよ！'
  },
  {
    questId: 272,
    questTitle: '「改装防空重巡」出撃せよ！',
    prerequisiteId: 416,
    prerequisiteTitle: '防空射撃演習を実施せよ！'
  },
  {
    questId: 273,
    questTitle: '新編「三川艦隊」ソロモン方面へ！',
    prerequisiteId: 307,
    prerequisiteTitle: '艦隊の練度向上に努めよ！'
  },
  {
    questId: 274,
    questTitle: '「第六駆逐隊」対潜哨戒なのです！',
    prerequisiteId: 120,
    prerequisiteTitle: '「第六駆逐隊」を編成せよ！'
  },
  {
    questId: 275,
    questTitle: '抜錨！「第十八戦隊」',
    prerequisiteId: 153,
    prerequisiteTitle: '「第十八戦隊」を新編成せよ！'
  },
  {
    questId: 278,
    questTitle: '「第一水雷戦隊」ケ号作戦、突入せよ！',
    prerequisiteId: 156,
    prerequisiteTitle: '「第一水雷戦隊」北方突入準備！'
  },
  {
    questId: 279,
    questTitle: '「第一水雷戦隊」北方ケ号作戦、再突入！',
    prerequisiteId: 157,
    prerequisiteTitle: '「第一水雷戦隊」北方再突入準備！'
  },
  {
    questId: 287,
    questTitle: '「第五航空戦隊」珊瑚諸島沖に出撃せよ！',
    prerequisiteId: 161,
    prerequisiteTitle: '「第五航空戦隊」を再編成せよ！'
  },
  {
    questId: 288,
    questTitle: '新編「第二一戦隊」北方へ出撃せよ！',
    prerequisiteId: 162,
    prerequisiteTitle: '新編「第二一戦隊」出撃準備！'
  },
  {
    questId: 289,
    questTitle: '「第十六戦隊(第一次)」出撃せよ！',
    prerequisiteId: 163,
    prerequisiteTitle: '「第十六戦隊(第一次)」を編成せよ！'
  },
  {
    questId: 293,
    questTitle: '「第三航空戦隊」南西諸島防衛線に出撃！',
    prerequisiteId: 164,
    prerequisiteTitle: '「第三航空戦隊」を編成せよ！'
  },
  {
    questId: 294,
    questTitle: '「小沢艦隊」出撃せよ！',
    prerequisiteId: 166,
    prerequisiteTitle: '「小沢艦隊」を編成せよ！'
  },
  {
    questId: 295,
    questTitle: '「第十六戦隊(第二次)」出撃せよ！',
    prerequisiteId: 168,
    prerequisiteTitle: '「第十六戦隊(第二次)」を編成せよ！'
  },
  {
    questId: 814,
    questTitle: '強行高速輸送部隊、出撃せよ！',
    prerequisiteId: 173,
    prerequisiteTitle: '強行高速輸送部隊を編成せよ！'
  },
  {
    questId: 817,
    questTitle: '新編艦隊、南西諸島防衛線へ急行せよ！',
    prerequisiteId: 174,
    prerequisiteTitle: '新編「水雷戦隊」を含む艦隊を再編成せよ！'
  },
  {
    questId: 818,
    questTitle: '鎮守府近海航路の安全確保を強化せよ！',
    prerequisiteId: 817,
    prerequisiteTitle: '新編艦隊、南西諸島防衛線へ急行せよ！'
  },
  {
    questId: 820,
    questTitle: '新編「第八駆逐隊」出撃せよ！',
    prerequisiteId: 175,
    prerequisiteTitle: '新編「第八駆逐隊」を再編成せよ！'
  },
  {
    questId: 835,
    questTitle: '「第十六戦隊(第三次)」出撃せよ！',
    prerequisiteId: 178,
    prerequisiteTitle: '「第十六戦隊(第三次)」を編成せよ！'
  },
  {
    questId: 836,
    questTitle: '精鋭「第十六戦隊」突入せよ！',
    prerequisiteId: 179,
    prerequisiteTitle: '精鋭「第十六戦隊」を再編成せよ！'
  },
  {
    questId: 848,
    questTitle: '重装甲巡洋艦、鉄底海峡に突入せよ！',
    prerequisiteId: 846,
    prerequisiteTitle: '潜水艦隊、中部海域の哨戒を実施せよ！'
  }
]

/**
 * 単発出撃任務のうち、双方のWikiで複数前提が一致する関係。
 * 単一前提の一覧と分け、AND/ORの意味を失わないように保持する。
 */
const ReviewedOneTimeGroupedPrerequisites: readonly ReviewedQuestPrerequisites[] = [
  {
    questId: 271,
    questTitle: '「那智戦隊」抜錨せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 269, title: '「第二一駆逐隊」出撃せよ！' },
          { questId: 249, title: '「第五戦隊」出撃せよ！' }
        ]
      }
    ]
  },
  {
    questId: 276,
    questTitle: '海上突入部隊、進発せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 154, title: '海上突入部隊を編成せよ！' },
          {
            questId: 243,
            title: '南方海域珊瑚諸島沖の制空権を握れ！'
          }
        ]
      }
    ]
  },
  {
    questId: 277,
    questTitle: '「第六駆逐隊」対潜哨戒を徹底なのです！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 155, title: '新編「第六駆逐隊」を編成せよ！' },
          { questId: 274, title: '「第六駆逐隊」対潜哨戒なのです！' }
        ]
      }
    ]
  },
  {
    questId: 297,
    questTitle: '「礼号作戦」実施せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 170,
            title: '精強な「水上反撃部隊」を再編成せよ！'
          },
          { questId: 265, title: '海上護衛強化月間' }
        ]
      }
    ]
  },
  {
    questId: 812,
    questTitle: 'オリョール海の制海権を確保せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 811, title: '南西諸島防衛線を強化せよ！' },
          { questId: 239, title: '「第八駆逐隊」出撃せよ！' }
        ]
      }
    ]
  },
  {
    questId: 813,
    questTitle: '旗艦「大潮」出撃せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 812, title: 'オリョール海の制海権を確保せよ！' },
          {
            questId: 806,
            title: '旗艦「霞」出撃！敵艦隊を撃滅せよ！'
          }
        ]
      }
    ]
  },
  {
    questId: 815,
    questTitle: '「第一航空戦隊」西へ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 814, title: '強行高速輸送部隊、出撃せよ！' },
          { questId: 636, title: '上陸戦用新装備の調達' }
        ]
      }
    ]
  },
  {
    questId: 819,
    questTitle: '「第三十一戦隊」敵潜を制圧せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 171,
            title: '「第三十一戦隊(第一次)」を編成せよ！'
          },
          { questId: 228, title: '海上護衛戦' }
        ]
      }
    ]
  },
  {
    questId: 844,
    questTitle: '精鋭「第八駆逐隊」突入せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 820, title: '新編「第八駆逐隊」出撃せよ！' },
          { questId: 829, title: '夜間突入！敵上陸部隊を叩け！' }
        ]
      }
    ]
  },
  {
    questId: 846,
    questTitle: '潜水艦隊、中部海域の哨戒を実施せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 815, title: '「第一航空戦隊」西へ！' },
          { questId: 218, title: '敵補給艦を 3 隻撃沈せよ！' }
        ]
      }
    ]
  },
  {
    questId: 851,
    questTitle: '改装航空巡洋艦、出撃！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 838, title: '重巡戦隊、抜錨せよ！' },
          { questId: 287, title: '「第五航空戦隊」珊瑚諸島沖に出撃せよ！' }
        ]
      }
    ]
  },
  {
    questId: 864,
    questTitle: '精強大型航空母艦、抜錨！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 185, title: '精強「任務部隊」を編成せよ！' },
          { questId: 216, title: '敵艦隊主力を撃滅せよ！' }
        ]
      }
    ]
  },
  {
    questId: 871,
    questTitle: '最精鋭「第八駆逐隊」、全力出撃！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 186, title: '最精鋭「第八駆逐隊」を編成せよ！' },
          { questId: 429, title: '「捷一号作戦」、発動準備！' }
        ]
      }
    ]
  },
  {
    questId: 877,
    questTitle: '精鋭「四水戦」、南方海域に展開せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 189, title: '精鋭「四水戦」抜錨準備！' },
          { questId: 860, title: '旗艦「由良」、抜錨！' }
        ]
      }
    ]
  },
  {
    questId: 880,
    questTitle: '精鋭駆逐隊、獅子奮迅！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 320, title: '駆逐隊、特訓始め！' },
          { questId: 680, title: '対空兵装の整備拡充' }
        ]
      }
    ]
  },
  {
    questId: 881,
    questTitle: '「十八駆」、北方海域キス島へ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 192, title: '精鋭「第十八駆逐隊」を編成せよ！' },
          { questId: 230, title: '敵潜水艦を制圧せよ！' }
        ]
      }
    ]
  },
  {
    questId: 292,
    questTitle: '重改装高速戦艦「金剛改二丙」、南方突入！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 290, title: '「比叡」の出撃' },
          { questId: 303, title: '「演習」で練度向上！' }
        ]
      }
    ]
  },
  {
    questId: 902,
    questTitle: '新編「六水戦」出撃！後で感想、聞かせてね！',
    prerequisites: [
      {
        mode: 'all',
        quests: [{ questId: 901, title: '「夕張改二」試してみてもいいかしら？' }]
      }
    ]
  },
  {
    questId: 929,
    questTitle: '静かな海を護る「鯨」、動き出す！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 231, title: '「潜水艦隊」出撃せよ！' },
          { questId: 235, title: '近海哨戒を実施せよ！' }
        ]
      }
    ]
  },
  {
    questId: 847,
    questTitle: '球磨型軽巡一番艦、出撃だクマ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 298, title: '「第七駆逐隊」、南西諸島を駆ける！' },
          { questId: 299, title: '近海の警戒監視と哨戒活動を強化せよ！' }
        ]
      }
    ]
  },
  {
    questId: 937,
    questTitle: '精鋭「第七駆逐隊」、出撃せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 298, title: '「第七駆逐隊」、南西諸島を駆ける！' },
          { questId: 235, title: '近海哨戒を実施せよ！' }
        ]
      }
    ]
  },
  {
    questId: 943,
    questTitle: '新しき翼。改装航空母艦「龍鳳」、出撃せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 279, title: '「第一水雷戦隊」北方ケ号作戦、再突入！' },
          { questId: 420, title: '機動部隊の運用を強化せよ！' }
        ]
      }
    ]
  },
  {
    questId: 949,
    questTitle: '改装特務空母「Gambier Bay Mk.II」抜錨！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 923, title: '合同艦隊機動部隊、出撃せよ！' },
          {
            questId: 933,
            title: '【艦隊司令部強化】艦隊旗艦、出撃せよ！'
          }
        ]
      }
    ]
  },
  {
    questId: 957,
    questTitle: '「山風改二」、抜錨せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [{ questId: 235, title: '近海哨戒を実施せよ！' }]
      }
    ]
  },
  {
    questId: 958,
    questTitle: '改白露型駆逐艦「山風改二」、奮戦す！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 236, title: '精鋭「二四駆逐隊」出撃せよ！' },
          { questId: 957, title: '「山風改二」、抜錨せよ！' }
        ]
      }
    ]
  },
  {
    questId: 967,
    questTitle: '海上護衛！ヒ船団を護り抜け！',
    prerequisites: [
      {
        mode: 'all',
        quests: [{ questId: 966, title: '南西海域「基地航空隊」開設！' }]
      }
    ]
  },
  {
    questId: 968,
    questTitle: '航空母艦「雲鷹」、抜錨せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [{ questId: 967, title: '海上護衛！ヒ船団を護り抜け！' }]
      }
    ]
  },
  {
    questId: 969,
    questTitle: '改特型駆逐艦「天霧改二」、出撃す！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 844, title: '精鋭「第八駆逐隊」突入せよ！' },
          { questId: 967, title: '海上護衛！ヒ船団を護り抜け！' }
        ]
      }
    ]
  },
  {
    questId: 996,
    questTitle: '改金剛型高速戦艦「榛名改二乙/丙」、抜錨！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 292,
            title: '「比叡改二丙」見参！第三戦隊、南方突入！'
          }
        ]
      }
    ]
  },
  {
    questId: 1001,
    questTitle: '主力オブ主力「清霜改二」、出撃せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 806,
            title: '旗艦「霞」出撃！敵艦隊を撃滅せよ！'
          },
          {
            questId: 970,
            title: '第十六戦隊、改装「浦波改二」出撃します！'
          }
        ]
      }
    ]
  },
  {
    questId: 1007,
    questTitle: '改装白露型「春雨改二」出撃です！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 290, title: '「比叡」の出撃' },
          { questId: 1006, title: '「第二駆逐隊」抜錨！' }
        ]
      }
    ]
  },
  {
    questId: 1033,
    questTitle: '二等輸送艦の積極運用',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 636, title: '上陸戦用新装備の調達' },
          {
            questId: 933,
            title: '【艦隊司令部強化】艦隊旗艦、出撃せよ！'
          }
        ]
      }
    ]
  }
]

/**
 * 月常・季常・年常のうち、双方のWikiで同じ前提を確認できた関係。
 * 内部IDはゲームAPIとローカル定義で照合する。
 * 不確定条件が併記されている任務は、確定するまで収録しない。
 */
const ReviewedExtendedPrerequisites: readonly ReviewedQuestPrerequisites[] = [
  {
    questId: 249,
    questTitle: '「第五戦隊」出撃せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [{ questId: 137, title: '「第五戦隊」を編成せよ！' }]
      }
    ]
  },
  {
    questId: 256,
    questTitle: '「潜水艦隊」出撃せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 255,
            title: '「水雷戦隊」バシー島沖緊急展開'
          }
        ]
      }
    ]
  },
  {
    questId: 259,
    questTitle: '「水上打撃部隊」南方へ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 145,
            title: '戦艦を主力とした水上打撃部隊を編成せよ！'
          }
        ]
      }
    ]
  },
  {
    questId: 265,
    questTitle: '海上護衛強化月間',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 249, title: '「第五戦隊」出撃せよ！' },
          { questId: 240, title: '「第十八駆逐隊」出撃せよ！' }
        ]
      }
    ]
  },
  {
    questId: 264,
    questTitle: '「空母機動部隊」西へ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 239, title: '「第八駆逐隊」出撃せよ！' },
          { questId: 221, title: 'ろ号作戦' }
        ]
      }
    ]
  },
  {
    questId: 266,
    questTitle: '「水上反撃部隊」突入せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 264, title: '「空母機動部隊」西へ！' },
          {
            questId: 148,
            title: '軽快な「水上反撃部隊」を編成せよ！'
          }
        ]
      }
    ]
  },
  {
    questId: 280,
    questTitle: '兵站線確保！海上警備を強化実施せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [{ questId: 311, title: '精鋭艦隊演習' }]
      }
    ]
  },
  {
    questId: 854,
    questTitle: '戦果拡張任務！「Z作戦」前段作戦',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 846,
            title: '潜水艦隊、中部海域の哨戒を実施せよ！'
          },
          { questId: 220, title: 'い号作戦' }
        ]
      }
    ]
  },
  {
    questId: 872,
    questTitle: '戦果拡張任務！「Z作戦」後段作戦',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 854,
            title: '戦果拡張任務！「Z作戦」前段作戦'
          }
        ]
      }
    ]
  },
  {
    questId: 875,
    questTitle: '精鋭「三一駆」、鉄底海域に突入せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 873,
            title: '北方海域警備を実施せよ！'
          },
          {
            questId: 188,
            title: '精鋭「三一駆」第一小隊、抜錨準備！'
          }
        ]
      }
    ]
  },
  {
    questId: 888,
    questTitle: '新編成「三川艦隊」、鉄底海峡に突入せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 273,
            title: '新編「三川艦隊」ソロモン方面へ！'
          },
          {
            questId: 243,
            title: '南方海域珊瑚諸島沖の制空権を握れ！'
          }
        ]
      }
    ]
  },
  {
    questId: 903,
    questTitle: '拡張「六水戦」、最前線へ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 902,
            title: '新編「六水戦」出撃！後で感想、聞かせてね！'
          }
        ]
      }
    ]
  },
  {
    questId: 354,
    questTitle: '「改装特務空母」任務部隊演習！',
    prerequisites: [
      {
        mode: 'all',
        quests: [{ questId: 343, title: '航空母艦演習' }]
      }
    ]
  },
  {
    questId: 436,
    questTitle: '練習航海及び警備任務を実施せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 432,
            title: '警備及び哨戒偵察を強化せよ！'
          }
        ]
      }
    ]
  },
  {
    questId: 437,
    questTitle: '小笠原沖哨戒線の強化を実施せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 425,
            title: '海上護衛総隊、遠征開始！'
          },
          {
            questId: 432,
            title: '警備及び哨戒偵察を強化せよ！'
          }
        ]
      }
    ]
  },
  {
    questId: 440,
    questTitle: '兵站強化遠征任務【拡張作戦】',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 433,
            title: '南方戦線遠征を実施せよ！'
          },
          {
            questId: 439,
            title: '兵站強化遠征任務【基本作戦】'
          }
        ]
      }
    ]
  },
  {
    questId: 428,
    questTitle: '近海に侵入する敵潜を制圧せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 426,
            title: '海上通商航路の警戒を厳とせよ！'
          },
          {
            questId: 427,
            title: '遠征「補給」支援体制を強化せよ！'
          }
        ]
      }
    ]
  },
  {
    questId: 626,
    questTitle: '精鋭「艦戦」隊の新編成',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 114,
            title: '「南雲機動部隊」を編成せよ！'
          },
          {
            questId: 264,
            title: '「空母機動部隊」西へ！'
          }
        ]
      }
    ]
  },
  {
    questId: 645,
    questTitle: '「洋上補給」物資の調達',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 294,
            title: '「小沢艦隊」出撃せよ！'
          },
          {
            questId: 228,
            title: '海上護衛戦'
          }
        ]
      }
    ]
  },
  {
    questId: 643,
    questTitle: '主力「陸攻」の調達',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 642,
            title: '「陸攻」隊の増勢'
          },
          {
            questId: 410,
            title: '南方への輸送作戦を成功させよ！'
          }
        ]
      }
    ]
  },
  {
    questId: 663,
    questTitle: '新型艤装の継続研究',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 425,
            title: '海上護衛総隊、遠征開始！'
          }
        ]
      }
    ]
  },
  {
    questId: 675,
    questTitle: '運用装備の統合整備',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 617,
            title: '「伊良湖」の準備'
          },
          {
            questId: 674,
            title: '工廠環境の整備'
          }
        ]
      }
    ]
  },
  {
    questId: 680,
    questTitle: '対空兵装の整備拡充',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 679,
            title: '対空兵装の拡充'
          },
          {
            questId: 605,
            title: '新装備「開発」指令'
          }
        ]
      }
    ]
  },
  {
    questId: 1103,
    questTitle: '潜水艦強化兵装の量産',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 658,
            title: '潜水艦武装の強化'
          },
          {
            questId: 1101,
            title: '海軍工廠の再整備'
          }
        ]
      }
    ]
  },
  {
    questId: 945,
    questTitle: '南西方面の兵站航路の安全を図れ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 944,
            title: '鎮守府近海海域の哨戒を実施せよ！'
          }
        ]
      }
    ]
  },
  {
    questId: 946,
    questTitle: '空母機動部隊、出撃！敵艦隊を迎撃せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 944,
            title: '鎮守府近海海域の哨戒を実施せよ！'
          }
        ]
      }
    ]
  },
  {
    questId: 947,
    questTitle: 'AL作戦',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 291,
            title: '艦隊司令部の強化 【実施段階】'
          },
          {
            questId: 946,
            title: '空母機動部隊、出撃！敵艦隊を迎撃せよ！'
          }
        ]
      }
    ]
  },
  {
    questId: 928,
    questTitle: '歴戦「第十方面艦隊」、全力出撃！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 237,
            title: '「羽黒」「神風」、出撃せよ！'
          },
          {
            questId: 927,
            title: '重巡「羽黒」、出撃！ペナン沖海戦'
          }
        ]
      }
    ]
  }
]

function claimForSource(
  entry: ReviewedPrerequisite,
  reference: QuestCuratedReference
): QuestCuratedClaim {
  return {
    ...reference,
    questId: entry.questId,
    questTitle: entry.questTitle,
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: entry.prerequisiteId,
            title: entry.prerequisiteTitle
          }
        ]
      }
    ]
  }
}

function groupedClaimForSource(
  entry: ReviewedQuestPrerequisites,
  reference: QuestCuratedReference
): QuestCuratedClaim {
  return {
    ...reference,
    questId: entry.questId,
    questTitle: entry.questTitle,
    prerequisites: entry.prerequisites.map((group) => ({
      mode: group.mode,
      quests: group.quests.map((quest) => ({ ...quest }))
    }))
  }
}

function extendedJapaneseReference(entry: ReviewedQuestPrerequisites): QuestCuratedReference {
  if ([354, 357].includes(entry.questId)) {
    return JapanesePracticeReference
  }
  if ([428, 436, 437, 440].includes(entry.questId)) {
    return JapaneseExpeditionReference
  }
  if ([626, 643, 645, 663, 675, 680, 1103].includes(entry.questId)) {
    return JapaneseFactoryReference
  }
  return JapaneseReference
}

const DisputedQuestClaims: readonly QuestCuratedClaim[] = [
  {
    ...JapaneseReference,
    questId: 257,
    questTitle: '「水雷戦隊」南西へ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 221,
            title: 'ろ号作戦'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは #221 に加えて、未特定の単発任務が前提となる可能性を検証中です。'
  },
  {
    ...ChineseReference,
    questId: 257,
    questTitle: '「水雷戦隊」南西へ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 221,
            title: 'ろ号作戦'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '中文KCWikiでも、#221 以外の前提は検証待ちです。'
  },
  {
    ...JapanesePracticeReference,
    questId: 311,
    questTitle: '精鋭艦隊演習',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 216,
            title: '敵艦隊主力を撃滅せよ！'
          }
        ]
      }
    ]
  },
  {
    ...ChineseReference,
    questId: 311,
    questTitle: '精鋭艦隊演習',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 216,
            title: '敵艦隊主力を撃滅せよ！'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '中文KCWikiでは #216 に加えて、未特定の前提がある可能性を検証中です。'
  },
  {
    ...JapanesePracticeReference,
    questId: 318,
    questTitle: '給糧艦「伊良湖」の支援',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 617,
            title: '「伊良湖」の準備'
          },
          {
            questId: 676,
            title: '装備開発力の集中整備'
          }
        ]
      }
    ]
  },
  {
    ...ChineseReference,
    questId: 318,
    questTitle: '給糧艦「伊良湖」の支援',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 617,
            title: '「伊良湖」の準備'
          },
          {
            questId: 676,
            title: '装備開発力の集中整備'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '中文KCWikiでは、記載済みの2件以外にも検証待ちの前提がある可能性を示しています。'
  },
  {
    ...JapaneseExpeditionReference,
    questId: 424,
    questTitle: '輸送船団護衛を強化せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 402,
            title: '「遠征」を3回成功させよう！'
          },
          {
            questId: 419,
            title: '観艦式を敢行せよ！'
          }
        ]
      }
    ]
  },
  {
    ...ChineseReference,
    questId: 424,
    questTitle: '輸送船団護衛を強化せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 402,
            title: '「遠征」を3回成功させよう！'
          },
          {
            questId: 419,
            title: '観艦式を敢行せよ！'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '中文KCWikiでは、記載済みの2件以外にも検証待ちの前提がある可能性を示しています。'
  },
  {
    ...JapaneseFactoryReference,
    questId: 628,
    questTitle: '機種転換',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 627,
            title: '機種転換'
          },
          {
            questId: 265,
            title: '海上護衛強化月間'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '日本語攻略Wikiでは #627 の前提関係を要確認として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 628,
    questTitle: '機種転換',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 627,
            title: '機種転換'
          },
          {
            questId: 265,
            title: '海上護衛強化月間'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '中文KCWikiでは、記載済みの2件以外にも検証待ちの前提がある可能性を示しています。'
  },
  {
    ...JapaneseReference,
    questId: 904,
    questTitle: '精鋭「十九駆」、躍り出る！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 276,
            title: '海上突入部隊、進発せよ！'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは #276 に加えて、未特定の前提がある可能性を検証中です。'
  },
  {
    ...ChineseReference,
    questId: 904,
    questTitle: '精鋭「十九駆」、躍り出る！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 276,
            title: '海上突入部隊、進発せよ！'
          },
          {
            questId: 662,
            title: '新型艤装の開発研究'
          }
        ]
      }
    ],
    reviewNote: '中文KCWikiでは #276 と #662 を前提として記載しています。'
  },
  {
    ...JapaneseReference,
    questId: 905,
    questTitle: '「海防艦」、海を護る！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 303,
            title: '「演習」で練度向上！'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは #303 に加えて、未特定の前提がある可能性を検証中です。'
  },
  {
    ...ChineseReference,
    questId: 905,
    questTitle: '「海防艦」、海を護る！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 303,
            title: '「演習」で練度向上！'
          },
          {
            questId: 217,
            title: '敵空母を撃沈せよ！'
          }
        ]
      }
    ],
    reviewNote: '中文KCWikiでは #303 と #217 を前提として記載しています。'
  },
  {
    ...JapaneseExpeditionReference,
    questId: 434,
    questTitle: '特設護衛船団司令部、活動開始！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 425,
            title: '海上護衛総隊、遠征開始！'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは #425 に加えて、未特定の前提がある可能性を検証中です。'
  },
  {
    ...ChineseReference,
    questId: 434,
    questTitle: '特設護衛船団司令部、活動開始！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 425,
            title: '海上護衛総隊、遠征開始！'
          }
        ]
      }
    ],
    reviewNote: '中文KCWikiでは #425 を前提として記載しています。'
  },
  {
    ...JapaneseExpeditionReference,
    questId: 442,
    questTitle: '西方連絡作戦準備を実施せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 415,
            title: '遠洋潜水艦作戦の成果を拡大せよ！'
          },
          {
            questId: 419,
            title: '観艦式を敢行せよ！'
          },
          {
            questId: 432,
            title: '警備及び哨戒偵察を強化せよ！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '日本語攻略Wikiでは #432 の前提関係を検証中として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 442,
    questTitle: '西方連絡作戦準備を実施せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 415,
            title: '遠洋潜水艦作戦の成果を拡大せよ！'
          },
          {
            questId: 432,
            title: '警備及び哨戒偵察を強化せよ！'
          }
        ]
      }
    ],
    reviewNote: '中文KCWikiでは #415 と #432 を前提として記載しています。'
  },
  {
    ...JapaneseReference,
    questId: 912,
    questTitle: '工作艦「明石」護衛任務',
    prerequisites: [],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは、2件の前提がある可能性を示していますが、いずれも未特定です。'
  },
  {
    ...ChineseReference,
    questId: 912,
    questTitle: '工作艦「明石」護衛任務',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 618,
            title: 'はじめての「装備改修」！'
          }
        ]
      }
    ],
    reviewNote: '中文KCWikiでは #618 を前提として記載しています。'
  },
  {
    ...JapaneseReference,
    questId: 914,
    questTitle: '重巡戦隊、西へ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 905,
            title: '「海防艦」、海を護る！'
          },
          {
            questId: 838,
            title: '重巡戦隊、抜錨せよ！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '日本語攻略Wikiでは #838 の前提関係を検証中として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 914,
    questTitle: '重巡戦隊、西へ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 905,
            title: '「海防艦」、海を護る！'
          },
          {
            questId: 838,
            title: '重巡戦隊、抜錨せよ！'
          }
        ]
      }
    ],
    reviewNote: '中文KCWikiでは #905 と #838 を前提として記載しています。'
  },
  {
    ...JapanesePracticeReference,
    questId: 350,
    questTitle: '精鋭「第七駆逐隊」演習開始！',
    prerequisites: [],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは、前提がある可能性を示していますが、内容は未特定です。'
  },
  {
    ...ChineseReference,
    questId: 350,
    questTitle: '精鋭「第七駆逐隊」演習開始！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 301,
            title: 'はじめての「演習」！'
          },
          {
            questId: 109,
            title: '「川内」型軽巡姉妹の全３艦を編成せよ！'
          }
        ]
      }
    ],
    reviewNote: '中文KCWikiでは #301 と #109 を前提として記載しています。'
  },
  {
    ...JapaneseExpeditionReference,
    questId: 444,
    questTitle: '新兵装開発資材輸送を船団護衛せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 425,
            title: '海上護衛総隊、遠征開始！'
          },
          {
            questId: 427,
            title: '遠征「補給」支援体制を強化せよ！'
          },
          {
            questId: 432,
            title: '警備及び哨戒偵察を強化せよ！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '日本語攻略Wikiでは #427 の前提関係を検証中として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 444,
    questTitle: '新兵装開発資材輸送を船団護衛せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 425,
            title: '海上護衛総隊、遠征開始！'
          },
          {
            questId: 432,
            title: '警備及び哨戒偵察を強化せよ！'
          }
        ]
      }
    ],
    reviewNote: '中文KCWikiでは #425 と #432 を前提として記載しています。'
  },
  {
    ...JapanesePracticeReference,
    questId: 330,
    questTitle: '空母機動部隊、演習始め！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 201,
            title: '敵艦隊を撃破せよ！'
          },
          {
            questId: 209,
            title: '「空母機動部隊」出撃せよ！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '日本語攻略Wikiでは #209 の前提関係を検証中として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 330,
    questTitle: '空母機動部隊、演習始め！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 201,
            title: '敵艦隊を撃破せよ！'
          },
          {
            questId: 209,
            title: '「空母機動部隊」出撃せよ！'
          }
        ]
      }
    ],
    reviewNote: '中文KCWikiでは #201 と #209 を前提として記載しています。'
  },
  {
    ...JapanesePracticeReference,
    questId: 337,
    questTitle: '「十八駆」演習！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 201,
            title: '敵艦隊を撃破せよ！'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは #201 に加えて、未特定の前提がある可能性を検証中です。'
  },
  {
    ...ChineseReference,
    questId: 337,
    questTitle: '「十八駆」演習！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 120,
            title: '「第六駆逐隊」を編成せよ！'
          },
          {
            questId: 201,
            title: '敵艦隊を撃破せよ！'
          }
        ]
      }
    ],
    reviewNote: '中文KCWikiでは #120 と #201 を前提として記載しています。'
  },
  {
    ...JapanesePracticeReference,
    questId: 339,
    questTitle: '「十九駆」演習！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 337,
            title: '「十八駆」演習！'
          },
          {
            questId: 177,
            title: '「第十九駆逐隊」を編成せよ！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '日本語攻略Wikiでは #177 の前提関係を検証中として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 339,
    questTitle: '「十九駆」演習！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 337,
            title: '「十八駆」演習！'
          },
          {
            questId: 177,
            title: '「第十九駆逐隊」を編成せよ！'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '中文KCWikiでは #337 と #177 を記載していますが、前提関係は検証待ちです。'
  },
  {
    ...JapanesePracticeReference,
    questId: 342,
    questTitle: '小艦艇群演習強化任務',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 307,
            title: '艦隊の練度向上に努めよ！'
          },
          {
            questId: 174,
            title: '新編「水雷戦隊」を含む艦隊を再編成せよ！'
          }
        ]
      }
    ]
  },
  {
    ...ChineseReference,
    questId: 342,
    questTitle: '小艦艇群演習強化任務',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 307,
            title: '艦隊の練度向上に努めよ！'
          }
        ]
      }
    ],
    reviewNote: '中文KCWikiでは #307 のみを前提として記載しています。'
  },
  {
    ...JapaneseReference,
    questId: 822,
    questTitle: '沖ノ島海域迎撃戦',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 233,
            title: '「第六戦隊」出撃せよ！'
          },
          {
            questId: 264,
            title: '「空母機動部隊」西へ！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '日本語攻略Wikiでは #233 と #264 の前提関係を要確認として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 822,
    questTitle: '沖ノ島海域迎撃戦',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 233,
            title: '「第六戦隊」出撃せよ！'
          },
          {
            questId: 264,
            title: '「空母機動部隊」西へ！'
          }
        ]
      }
    ]
  },
  {
    ...JapaneseReference,
    questId: 861,
    questTitle: '強行輸送艦隊、抜錨！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 217,
            title: '敵空母を撃沈せよ！'
          },
          {
            questId: 617,
            title: '「伊良湖」の準備'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '日本語攻略Wikiでは #217 と #617 の前提関係を検証中として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 861,
    questTitle: '強行輸送艦隊、抜錨！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 217,
            title: '敵空母を撃沈せよ！'
          },
          {
            questId: 617,
            title: '「伊良湖」の準備'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '中文KCWikiでも、この任務の前提関係は検証待ちとして記載されています。'
  },
  {
    ...JapaneseReference,
    questId: 862,
    questTitle: '前線の航空偵察を実施せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 861,
            title: '強行輸送艦隊、抜錨！'
          },
          {
            questId: 846,
            title: '潜水艦隊、中部海域の哨戒を実施せよ！'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは、記載済みの2件に加えて未特定の前提がある可能性を示しています。'
  },
  {
    ...ChineseReference,
    questId: 862,
    questTitle: '前線の航空偵察を実施せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 861,
            title: '強行輸送艦隊、抜錨！'
          },
          {
            questId: 846,
            title: '潜水艦隊、中部海域の哨戒を実施せよ！'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '中文KCWikiでも、記載済みの2件以外の前提は検証待ちです。'
  },
  {
    ...JapaneseReference,
    questId: 893,
    questTitle: '泊地周辺海域の安全確保を徹底せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 214,
            title: 'あ号作戦'
          },
          {
            questId: 299,
            title: '近海の警戒監視と哨戒活動を強化せよ！'
          }
        ]
      }
    ]
  },
  {
    ...ChineseReference,
    questId: 893,
    questTitle: '泊地周辺海域の安全確保を徹底せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 214,
            title: 'あ号作戦'
          },
          {
            questId: 299,
            title: '近海の警戒監視と哨戒活動を強化せよ！'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '中文KCWikiでは、記載済みの2件以外にも検証待ちの前提がある可能性を示しています。'
  },
  {
    ...JapaneseReference,
    questId: 894,
    questTitle: '空母戦力の投入による兵站線戦闘哨戒',
    prerequisites: [],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは前提条件を未特定の検証中として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 894,
    questTitle: '空母戦力の投入による兵站線戦闘哨戒',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 206,
            title: '「水雷戦隊」で出撃せよ！'
          }
        ]
      }
    ]
  },
  {
    ...JapaneseReference,
    questId: 845,
    questTitle: '発令！「西方海域作戦」',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 247,
            title: '「航空戦艦」抜錨せよ！'
          },
          {
            questId: 284,
            title: '南西諸島方面「海上警備行動」発令！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '日本語攻略Wikiでは #247 と #284 の前提関係を検証中として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 845,
    questTitle: '発令！「西方海域作戦」',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 247,
            title: '「航空戦艦」抜錨せよ！'
          },
          {
            questId: 284,
            title: '南西諸島方面「海上警備行動」発令！'
          }
        ]
      }
    ]
  },
  {
    ...JapaneseFactoryReference,
    questId: 637,
    questTitle: '「熟練搭乗員」養成',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 209,
            title: '「空母機動部隊」出撃せよ！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '日本語攻略Wikiでは #209 「空母機動部隊」出撃せよ！を前提候補として検証中です。'
  },
  {
    ...ChineseReference,
    questId: 637,
    questTitle: '「熟練搭乗員」養成',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 209,
            title: '「空母機動部隊」出撃せよ！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '中文KCWikiでも #209 「空母機動部隊」出撃せよ！を前提候補として検証中です。'
  },
  {
    ...JapaneseFactoryReference,
    questId: 678,
    questTitle: '主力艦上戦闘機の更新',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 216,
            title: '敵艦隊主力を撃滅せよ！'
          }
        ]
      }
    ]
  },
  {
    ...ChineseReference,
    questId: 678,
    questTitle: '主力艦上戦闘機の更新',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 216,
            title: '敵艦隊主力を撃滅せよ！'
          },
          {
            questId: 209,
            title: '「空母機動部隊」出撃せよ！'
          }
        ]
      }
    ]
  },
  {
    ...JapaneseFactoryReference,
    questId: 686,
    questTitle: '戦時改修A型高角砲の量産',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 685,
            title: '駆逐艦主砲兵装の戦時改修'
          },
          {
            questId: 680,
            title: '対空兵装の整備拡充'
          }
        ]
      }
    ]
  },
  {
    ...ChineseReference,
    questId: 686,
    questTitle: '戦時改修A型高角砲の量産',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 685,
            title: '駆逐艦主砲兵装の戦時改修'
          },
          {
            questId: 680,
            title: '対空兵装の整備拡充'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '中文KCWikiでは、記載済みの2件以外にも検証待ちの前提がある可能性を示しています。'
  },
  {
    ...JapaneseFactoryReference,
    questId: 688,
    questTitle: '航空戦力の強化',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 674,
            title: '工廠環境の整備'
          }
        ]
      }
    ]
  },
  {
    ...ChineseReference,
    questId: 688,
    questTitle: '航空戦力の強化',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 674,
            title: '工廠環境の整備'
          },
          {
            questId: 117,
            title: '第２艦隊で空母機動部隊を編成せよ！'
          }
        ]
      }
    ]
  },
  {
    ...JapaneseFactoryReference,
    questId: 653,
    questTitle: '工廠稼働！次期作戦準備！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 607,
            title: '装備「開発」集中強化！'
          }
        ]
      }
    ]
  },
  {
    ...ChineseReference,
    questId: 653,
    questTitle: '工廠稼働！次期作戦準備！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 208,
            title: '「戦艦」を出撃させよ！'
          },
          {
            questId: 607,
            title: '装備「開発」集中強化！'
          }
        ]
      }
    ]
  },
  {
    ...JapaneseReference,
    questId: 284,
    questTitle: '南西諸島方面「海上警備行動」発令！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 280,
            title: '兵站線確保！海上警備を強化実施せよ！'
          },
          {
            questId: 303,
            title: '「演習」で練度向上！'
          }
        ]
      }
    ]
  },
  {
    ...ChineseReference,
    questId: 284,
    questTitle: '南西諸島方面「海上警備行動」発令！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 280,
            title: '兵站線確保！海上警備を強化実施せよ！'
          },
          {
            questId: 303,
            title: '「演習」で練度向上！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '中文KCWikiでは #261 海上輸送路の安全確保に努めよ！も前提候補として検証中です。'
  },
  {
    ...JapaneseFactoryReference,
    questId: 657,
    questTitle: '新型兵装開発整備の強化',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 617,
            title: '「伊良湖」の準備'
          },
          {
            questId: 674,
            title: '工廠環境の整備'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '日本語攻略Wikiでは #617 と #674 の前提関係を検証中として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 657,
    questTitle: '新型兵装開発整備の強化',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 674,
            title: '工廠環境の整備'
          }
        ]
      }
    ]
  },
  {
    ...JapaneseFactoryReference,
    questId: 1104,
    questTitle: '潜水艦電子兵装の量産',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 1103,
            title: '潜水艦強化兵装の量産'
          }
        ]
      }
    ],
    prerequisitesComplete: false
  },
  {
    ...ChineseReference,
    questId: 1104,
    questTitle: '潜水艦電子兵装の量産',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 1103,
            title: '潜水艦強化兵装の量産'
          }
        ]
      }
    ]
  },
  {
    ...JapaneseFactoryReference,
    questId: 681,
    questTitle: '航空戦力の再編増強準備',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 642,
            title: '「陸攻」隊の増勢'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは #642 に加えて、未特定の前提がある可能性を検証中です。'
  },
  {
    ...ChineseReference,
    questId: 681,
    questTitle: '航空戦力の再編増強準備',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 642,
            title: '「陸攻」隊の増勢'
          }
        ]
      }
    ]
  },
  {
    ...JapaneseFactoryReference,
    questId: 1123,
    questTitle: '改良三座水上偵察機の増備',
    prerequisites: [],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは前提を2件とも未特定の検証中として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 1123,
    questTitle: '改良三座水上偵察機の増備',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 716,
            title: '「軽巡」級の改修工事を実施せよ！'
          }
        ]
      }
    ]
  },
  {
    ...JapaneseFactoryReference,
    questId: 1138,
    questTitle: '【高射装置量産】94式高射装置の追加配備',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 372,
            title: '水上艦「艦隊防空演習」を実施せよ！'
          },
          {
            questId: 607,
            title: '装備「開発」集中強化！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '日本語攻略Wikiでは #372 と #607 の前提関係を検証中として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 1138,
    questTitle: '【高射装置量産】94式高射装置の追加配備',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 372,
            title: '水上艦「艦隊防空演習」を実施せよ！'
          },
          {
            questId: 607,
            title: '装備「開発」集中強化！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '中文KCWikiでも、記載済みの2件以外の前提関係は検証待ちです。'
  },
  {
    ...JapaneseFactoryReference,
    questId: 1105,
    questTitle: '夏の格納庫整備＆航空基地整備',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 647,
            title: '中部海域「基地航空隊」展開！'
          },
          {
            questId: 1102,
            title: '工廠による装備兵装の強化準備'
          }
        ]
      }
    ]
  },
  {
    ...ChineseReference,
    questId: 1105,
    questTitle: '夏の格納庫整備＆航空基地整備',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 1102,
            title: '工廠による装備兵装の強化準備'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '中文KCWikiでは #1102 に加えて、未特定の前提がある可能性を検証中です。'
  },
  {
    ...JapaneseFactoryReference,
    questId: 1107,
    questTitle: '【鋼材輸出】基地航空兵力を増備せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 642,
            title: '「陸攻」隊の増勢'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは #642 に加えて、未特定の前提がある可能性を検証中です。'
  },
  {
    ...ChineseReference,
    questId: 1107,
    questTitle: '【鋼材輸出】基地航空兵力を増備せよ！',
    prerequisites: [],
    prerequisitesComplete: false,
    reviewNote: '中文KCWikiでは、この任務の前提条件を未特定の検証待ちとして記載しています。'
  },
  {
    ...JapaneseFactoryReference,
    questId: 654,
    questTitle: '精鋭複葉機飛行隊の編成',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 919,
            title: '南西諸島海域合同哨戒'
          },
          {
            questId: 619,
            title: '装備の改修強化'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '日本語攻略Wikiでは #919 と #619 の前提関係を検証中として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 654,
    questTitle: '精鋭複葉機飛行隊の編成',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 619,
            title: '装備の改修強化'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '中文KCWikiでは #619 を記載し、#919 も前提候補として検証中です。'
  },
  {
    ...JapaneseFactoryReference,
    questId: 655,
    questTitle: '工廠フル稼働！新兵装を開発せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 648,
            title: '「特注家具」の調達'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは #648 に加えて、未特定の前提がある可能性を検証中です。'
  },
  {
    ...ChineseReference,
    questId: 655,
    questTitle: '工廠フル稼働！新兵装を開発せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 648,
            title: '「特注家具」の調達'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '中文KCWikiでも、#648 以外の前提は検証待ちです。'
  },
  {
    ...JapaneseFactoryReference,
    questId: 1120,
    questTitle: '【機種整理統合】新型戦闘機の量産計画',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 1102,
            title: '工廠による装備兵装の強化準備'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは #1102 に加えて、未特定の前提がある可能性を検証中です。'
  },
  {
    ...ChineseReference,
    questId: 1120,
    questTitle: '【機種整理統合】新型戦闘機の量産計画',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 1102,
            title: '工廠による装備兵装の強化準備'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '中文KCWikiでも、#1102 以外の前提は検証待ちです。'
  },
  {
    ...JapaneseReference,
    questId: 973,
    questTitle: '日英米合同水上艦隊、抜錨せよ！',
    prerequisites: [],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは、2件の前提がある可能性を示していますが、いずれも未特定です。'
  },
  {
    ...ChineseReference,
    questId: 973,
    questTitle: '日英米合同水上艦隊、抜錨せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 818,
            title: '鎮守府近海航路の安全確保を強化せよ！'
          }
        ]
      }
    ],
    reviewNote: '中文KCWikiでは #818 を前提として記載しています。'
  },
  {
    ...JapaneseReference,
    questId: 1045,
    questTitle: '「吹雪改三」抜錨します！見てくださいっ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 931,
            title: '精鋭「二七駆」、回避運動は気をつけて！'
          },
          {
            questId: 1025,
            title: '精鋭十一駆「白雪改二」、抜錨します！'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewStatus: 'under-review',
    reviewNote: '日本語攻略Wikiでは #931 と #1025 に加えて、未特定の前提がある可能性を検証中です。'
  },
  {
    ...ChineseReference,
    questId: 1045,
    questTitle: '「吹雪改三」抜錨します！見てくださいっ！',
    prerequisites: [],
    reviewNote: '中文KCWikiでは前提任務が記載されていません。'
  },
  {
    ...JapanesePracticeReference,
    questId: 362,
    questTitle: '特型初代「第十一駆逐隊」演習スペシャル！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 149,
            title: '「第十一駆逐隊」を編成せよ！'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは #149 に加えて、未特定の前提がある可能性を検証中です。'
  },
  {
    ...ChineseReference,
    questId: 362,
    questTitle: '特型初代「第十一駆逐隊」演習スペシャル！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 149,
            title: '「第十一駆逐隊」を編成せよ！'
          }
        ]
      }
    ],
    reviewNote: '中文KCWikiでは #149 を前提として記載しています。'
  },
  {
    ...JapanesePracticeReference,
    questId: 371,
    questTitle: '春です！「春雨」、演習しますっ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 1006,
            title: '「第二駆逐隊」抜錨！'
          },
          {
            questId: 350,
            title: '精鋭「第七駆逐隊」演習開始！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '日本語攻略Wikiでは #1006 と #350 の前提関係を検証中として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 371,
    questTitle: '春です！「春雨」、演習しますっ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 1006,
            title: '「第二駆逐隊」抜錨！'
          },
          {
            questId: 350,
            title: '精鋭「第七駆逐隊」演習開始！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '中文KCWikiでも #1006 と #350 の前提関係は検証待ちです。'
  },
  {
    ...JapaneseReference,
    questId: 975,
    questTitle: '精鋭「第十九駆逐隊」、全力出撃！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 356,
            title: '精鋭「第十九駆逐隊」演習！'
          }
        ]
      }
    ],
    reviewNote: '日本語攻略Wikiでは #356 を前提として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 975,
    questTitle: '精鋭「第十九駆逐隊」、全力出撃！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 356,
            title: '精鋭「第十九駆逐隊」演習！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '中文KCWikiでは #356 の前提関係を検証待ちとして記載しています。'
  },
  {
    ...JapaneseReference,
    questId: 1012,
    questTitle: '鵜来型海防艦、静かな海を防衛せよ！',
    prerequisites: [],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは、2件の前提がある可能性を示していますが、いずれも未特定です。'
  },
  {
    ...ChineseReference,
    questId: 1012,
    questTitle: '鵜来型海防艦、静かな海を防衛せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 216,
            title: '敵艦隊主力を撃滅せよ！'
          },
          {
            questId: 118,
            title: '「金剛」型による高速戦艦部隊を編成せよ！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '中文KCWikiでは #216 と #118 の前提関係を検証待ちとして記載しています。'
  },
  {
    ...JapanesePracticeReference,
    questId: 356,
    questTitle: '精鋭「第十九駆逐隊」演習！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 974,
            title: '「磯波改二」、抜錨せよ！'
          }
        ]
      }
    ],
    reviewNote: '日本語攻略Wikiでは #974 を前提として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 356,
    questTitle: '精鋭「第十九駆逐隊」演習！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 974,
            title: '「磯波改二」、抜錨せよ！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '中文KCWikiでは #974 の前提関係を検証待ちとして記載しています。'
  },
  {
    ...JapanesePracticeReference,
    questId: 353,
    questTitle: '「巡洋艦戦隊」演習！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 320,
            title: '駆逐隊、特訓始め！'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは #320 に加えて、未特定の前提がある可能性を検証中です。'
  },
  {
    ...ChineseReference,
    questId: 353,
    questTitle: '「巡洋艦戦隊」演習！',
    prerequisites: [],
    reviewStatus: 'under-review',
    reviewNote: '中文KCWikiでは前提任務を未特定の検証待ちとして記載しています。'
  },
  {
    ...JapanesePracticeReference,
    questId: 372,
    questTitle: '水上艦「艦隊防空演習」を実施せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 348,
            title: '「精鋭軽巡」演習！'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは #348 に加えて、未特定の前提がある可能性を検証中です。'
  },
  {
    ...ChineseReference,
    questId: 372,
    questTitle: '水上艦「艦隊防空演習」を実施せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 348,
            title: '「精鋭軽巡」演習！'
          },
          {
            questId: 126,
            title: '航空水上打撃艦隊を編成せよ！'
          }
        ]
      }
    ],
    reviewNote: '中文KCWikiでは #348 と #126 を前提として記載しています。'
  },
  {
    ...JapanesePracticeReference,
    questId: 368,
    questTitle: '「十六駆」演習！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 224,
            title: '「西村艦隊」出撃せよ！'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは #224 に加えて、未特定の前提がある可能性を検証中です。'
  },
  {
    ...ChineseReference,
    questId: 368,
    questTitle: '「十六駆」演習！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 224,
            title: '「西村艦隊」出撃せよ！'
          }
        ]
      }
    ],
    reviewNote: '中文KCWikiでは #224 を前提として記載しています。'
  },
  {
    ...JapanesePracticeReference,
    questId: 373,
    questTitle: '「フランス艦隊」演習！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 358,
            title: '「Taffy Ⅲ」 This is a drill!'
          },
          {
            questId: 406,
            title: '第二次潜水艦派遣作戦'
          }
        ]
      }
    ],
    reviewNote: '日本語攻略Wikiでは #358 と #406 を前提として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 373,
    questTitle: '「フランス艦隊」演習！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 358,
            title: '「Taffy Ⅲ」 This is a drill!'
          },
          {
            questId: 406,
            title: '第二次潜水艦派遣作戦'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '中文KCWikiでは #358 と #406 の前提関係を検証待ちとして記載しています。'
  },
  {
    ...JapaneseExpeditionReference,
    questId: 438,
    questTitle: '南西諸島方面の海上護衛を強化せよ！',
    prerequisites: [],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは、2件の前提がある可能性を示していますが、いずれも未特定です。'
  },
  {
    ...ChineseReference,
    questId: 438,
    questTitle: '南西諸島方面の海上護衛を強化せよ！',
    prerequisites: [],
    reviewStatus: 'under-review',
    reviewNote: '中文KCWikiでは前提任務を未特定の検証待ちとして記載しています。'
  },
  {
    ...JapanesePracticeReference,
    questId: 375,
    questTitle: '「第三戦隊」第二小隊、演習開始！',
    prerequisites: [],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは、2件の前提がある可能性を示していますが、いずれも未特定です。'
  },
  {
    ...ChineseReference,
    questId: 375,
    questTitle: '「第三戦隊」第二小隊、演習開始！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 118,
            title: '「金剛」型による高速戦艦部隊を編成せよ！'
          },
          {
            questId: 223,
            title: '「第四戦隊」出撃せよ！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '中文KCWikiでは #118 と #223 の前提関係を検証待ちとして記載しています。'
  },
  {
    ...JapanesePracticeReference,
    questId: 345,
    questTitle: '演習ティータイム！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 322,
            title: '海防艦、演習始め！'
          },
          {
            questId: 343,
            title: '航空母艦演習'
          }
        ]
      }
    ],
    reviewNote: '日本語攻略Wikiでは #322 と #343 を前提として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 345,
    questTitle: '演習ティータイム！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 322,
            title: '海防艦、演習始め！'
          },
          {
            questId: 343,
            title: '航空母艦演習'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '中文KCWikiでは #322 と #343 の前提関係を検証待ちとして記載しています。'
  },
  {
    ...JapanesePracticeReference,
    questId: 346,
    questTitle: '最精鋭！主力オブ主力、演習開始！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 197,
            title: '主力オブ主力、精強「十駆」出撃準備ヨシ！'
          },
          {
            questId: 323,
            title: '最精鋭甲型駆逐艦、特訓始め！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '日本語攻略Wikiでは #197 と #323 の前提関係を検証中として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 346,
    questTitle: '最精鋭！主力オブ主力、演習開始！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 197,
            title: '主力オブ主力、精強「十駆」出撃準備ヨシ！'
          },
          {
            questId: 323,
            title: '最精鋭甲型駆逐艦、特訓始め！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '中文KCWikiでも #197 と #323 の前提関係は検証待ちです。'
  },
  {
    ...JapanesePracticeReference,
    questId: 355,
    questTitle: '精鋭「第十五駆逐隊」第一小隊演習！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 884,
            title: '最精鋭甲型駆逐艦、突入！敵中突破！'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは #884 に加えて、未特定の前提がある可能性を検証中です。'
  },
  {
    ...ChineseReference,
    questId: 355,
    questTitle: '精鋭「第十五駆逐隊」第一小隊演習！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 884,
            title: '最精鋭甲型駆逐艦、突入！敵中突破！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '中文KCWikiでは #884 の前提関係を検証待ちとして記載しています。'
  },
  {
    ...JapanesePracticeReference,
    questId: 377,
    questTitle: '「第二駆逐隊(後期編成)」、練度向上！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 1006,
            title: '「第二駆逐隊」抜錨！'
          },
          {
            questId: 1017,
            title: '「第二駆逐隊(後期編成)」、出撃せよ！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '日本語攻略Wikiでは #1006 と #1017 の前提関係を検証中として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 377,
    questTitle: '「第二駆逐隊(後期編成)」、練度向上！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 1006,
            title: '「第二駆逐隊」抜錨！'
          },
          {
            questId: 1017,
            title: '「第二駆逐隊(後期編成)」、出撃せよ！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '中文KCWikiでも #1006 と #1017 の前提関係は検証待ちです。'
  },
  {
    ...JapaneseReference,
    questId: 1005,
    questTitle: '精強「第七駆逐隊」緊急出動！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 198,
            title: '精強！「第七駆逐隊」抜錨準備せよ！'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは #198 に加えて、未特定の前提がある可能性を検証中です。'
  },
  {
    ...ChineseReference,
    questId: 1005,
    questTitle: '精強「第七駆逐隊」緊急出動！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 198,
            title: '精強！「第七駆逐隊」抜錨準備せよ！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '中文KCWikiでは #198 の前提関係を検証待ちとして記載しています。'
  },
  {
    ...JapanesePracticeReference,
    questId: 348,
    questTitle: '「精鋭軽巡」演習！',
    prerequisites: [],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは、2件の前提がある可能性を示していますが、いずれも未特定です。'
  },
  {
    ...ChineseReference,
    questId: 348,
    questTitle: '「精鋭軽巡」演習！',
    prerequisites: [],
    reviewStatus: 'under-review',
    reviewNote: '中文KCWikiでは前提任務を未特定の検証待ちとして記載しています。'
  },
  {
    ...JapaneseReference,
    questId: 948,
    questTitle: '機動部隊決戦',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 925,
            title: '改加賀型航空母艦「加賀改二」、抜錨！'
          },
          {
            questId: 947,
            title: 'AL作戦'
          }
        ]
      }
    ],
    prerequisitesComplete: false
  },
  {
    ...ChineseReference,
    questId: 948,
    questTitle: '機動部隊決戦',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 925,
            title: '改加賀型航空母艦「加賀改二」、抜錨！'
          },
          {
            questId: 947,
            title: 'AL作戦'
          }
        ]
      }
    ]
  },
  {
    ...JapanesePracticeReference,
    questId: 357,
    questTitle: '「大和型戦艦」第一戦隊演習、始め！',
    prerequisites: [
      {
        mode: 'all',
        quests: [{ questId: 343, title: '航空母艦演習' }]
      }
    ]
  },
  {
    ...ChineseReference,
    questId: 357,
    questTitle: '「大和型戦艦」第一戦隊演習、始め！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          { questId: 343, title: '航空母艦演習' },
          {
            questId: 610,
            title: '「大型艦建造」の準備！(その弐)'
          }
        ]
      }
    ]
  },
  {
    ...JapaneseModernizationReference,
    questId: 714,
    questTitle: '「駆逐艦」の改修工事を実施せよ！',
    prerequisites: [],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは、2件の前提がある可能性を示していますが、いずれも未特定です。'
  },
  {
    ...ChineseReference,
    questId: 714,
    questTitle: '「駆逐艦」の改修工事を実施せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 612,
            title: '輸送用ドラム缶の準備'
          },
          {
            questId: 701,
            title: 'はじめての「近代化改修」！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote:
      '中文KCWikiの改装一覧では #612 と #701 を前提として記載していますが、年常一覧側は前提を未特定の検証待ちとしており、ページ内で記載が一致していません。'
  },
  {
    ...JapaneseModernizationReference,
    questId: 715,
    questTitle: '続：「駆逐艦」の改修工事を実施せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 714,
            title: '「駆逐艦」の改修工事を実施せよ！'
          },
          {
            questId: 607,
            title: '装備「開発」集中強化！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '日本語攻略Wikiでは #714 と #607 の前提関係を検証中として記載しています。'
  },
  {
    ...ChineseReference,
    questId: 715,
    questTitle: '続：「駆逐艦」の改修工事を実施せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 714,
            title: '「駆逐艦」の改修工事を実施せよ！'
          },
          {
            questId: 607,
            title: '装備「開発」集中強化！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '中文KCWikiでも #714 と #607 の前提関係は検証待ちです。'
  },
  {
    ...JapaneseModernizationReference,
    questId: 716,
    questTitle: '「軽巡」級の改修工事を実施せよ！',
    prerequisites: [],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは、2件の前提がある可能性を示していますが、いずれも未特定です。'
  },
  {
    ...ChineseReference,
    questId: 716,
    questTitle: '「軽巡」級の改修工事を実施せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 612,
            title: '輸送用ドラム缶の準備'
          },
          {
            questId: 701,
            title: 'はじめての「近代化改修」！'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '中文KCWikiでは #612 と #701 を候補として記載していますが、前提関係は検証待ちです。'
  },
  {
    ...JapaneseModernizationReference,
    questId: 717,
    questTitle: '続：「軽巡」級の改修工事を実施せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 716,
            title: '「軽巡」級の改修工事を実施せよ！'
          }
        ]
      }
    ],
    prerequisitesComplete: false,
    reviewNote: '日本語攻略Wikiでは #716 に加えて、未特定の前提がある可能性を検証中です。'
  },
  {
    ...ChineseReference,
    questId: 717,
    questTitle: '続：「軽巡」級の改修工事を実施せよ！',
    prerequisites: [
      {
        mode: 'all',
        quests: [
          {
            questId: 716,
            title: '「軽巡」級の改修工事を実施せよ！'
          },
          {
            questId: 704,
            title: '「大型艦建造」の準備！(その壱)'
          }
        ]
      }
    ],
    reviewStatus: 'under-review',
    reviewNote: '中文KCWikiでは #716 と #704 を候補として記載していますが、前提関係は検証待ちです。'
  }
]

export const CuratedQuestClaims: readonly QuestCuratedClaim[] = [
  ...ReviewedPeriodicPrerequisites.flatMap((entry) => [
    claimForSource(entry, JapaneseReference),
    claimForSource(entry, ChineseReference)
  ]),
  ...ReviewedOneTimeSortiePrerequisites.flatMap((entry) => [
    claimForSource(entry, JapaneseOneTimeSortieReference),
    claimForSource(entry, ChineseOneTimeSortieReference)
  ]),
  ...ReviewedOneTimeGroupedPrerequisites.flatMap((entry) => [
    groupedClaimForSource(entry, JapaneseOneTimeSortieReference),
    groupedClaimForSource(entry, ChineseOneTimeSortieReference)
  ]),
  ...ReviewedExtendedPrerequisites.flatMap((entry) => [
    groupedClaimForSource(entry, extendedJapaneseReference(entry)),
    groupedClaimForSource(entry, ChineseReference)
  ]),
  ...DisputedQuestClaims
]

function prerequisiteReviewStatus(claim: QuestCuratedClaim): QuestPrerequisiteReviewStatus {
  if (claim.prerequisitesComplete === false) {
    return 'incomplete'
  }
  return claim.reviewStatus ?? 'verified'
}

function prerequisiteSignature(claim: QuestCuratedClaim): string {
  const groups = claim.prerequisites
    .map(
      (group) =>
        `${group.mode}:${group.quests
          .map((quest) => quest.questId)
          .sort((a, b) => a - b)
          .join(',')}`
    )
    .sort()
    .join('|')
  return `${prerequisiteReviewStatus(claim)}:${groups}`
}

function referenceFromClaim(claim: QuestCuratedClaim): QuestCuratedReference {
  return {
    source: claim.source,
    sourceLabel: claim.sourceLabel,
    url: claim.url,
    lastVerifiedAt: claim.lastVerifiedAt,
    dataVersion: claim.dataVersion
  }
}

function uniqueReferences(claims: readonly QuestCuratedClaim[]): QuestCuratedReference[] {
  return [...new Map(claims.map((claim) => [claim.source, referenceFromClaim(claim)])).values()]
}

function conflictDetailFromClaim(claim: QuestCuratedClaim): QuestCuratedConflictDetail {
  const reviewStatus = prerequisiteReviewStatus(claim)
  return {
    ...referenceFromClaim(claim),
    prerequisiteGroups: claim.prerequisites.map((group) => ({
      mode: group.mode,
      quests: group.quests.map((quest) => ({ ...quest }))
    })),
    prerequisitesComplete: reviewStatus !== 'incomplete',
    reviewStatus,
    reviewNote: claim.reviewNote
  }
}

export function resolveCuratedQuestKnowledge(
  claims: readonly QuestCuratedClaim[] = CuratedQuestClaims
): ReadonlyMap<number, QuestCuratedKnowledge> {
  const claimsByQuest = new Map<number, QuestCuratedClaim[]>()
  for (const claim of claims) {
    const entries = claimsByQuest.get(claim.questId) ?? []
    entries.push(claim)
    claimsByQuest.set(claim.questId, entries)
  }

  const result = new Map<number, QuestCuratedKnowledge>()
  for (const [questId, questClaims] of claimsByQuest) {
    const signatures = new Set(questClaims.map((claim) => prerequisiteSignature(claim)))
    const provenance = uniqueReferences(questClaims)
    const hasSourceDisagreement = signatures.size > 1
    const hasUnresolvedReview = questClaims.some(
      (claim) => prerequisiteReviewStatus(claim) !== 'verified'
    )
    const hasConflict = hasSourceDisagreement || hasUnresolvedReview
    const firstClaim = questClaims[0]

    result.set(questId, {
      questId,
      questTitle: firstClaim.questTitle,
      prerequisiteGroups: hasConflict
        ? []
        : firstClaim.prerequisites.map((group) => ({
            mode: group.mode,
            quests: group.quests.map((quest) => ({ ...quest })),
            provenance
          })),
      downstream: [],
      conflicts: hasConflict
        ? [
            {
              field: 'prerequisites',
              kind: hasSourceDisagreement ? 'source-disagreement' : 'unresolved-review',
              summary: hasSourceDisagreement
                ? '参照元によって前提任務の記述が一致しないため、自動判定には使用しません。'
                : '前提任務の記述が検証中または不完全なため、自動判定には使用しません。',
              provenance,
              details: questClaims.map(conflictDetailFromClaim)
            }
          ]
        : []
    })
  }

  for (const target of result.values()) {
    if (target.conflicts.length > 0) {
      continue
    }
    for (const group of target.prerequisiteGroups) {
      for (const prerequisite of group.quests) {
        const source =
          result.get(prerequisite.questId) ??
          ({
            questId: prerequisite.questId,
            questTitle: prerequisite.title,
            prerequisiteGroups: [],
            downstream: [],
            conflicts: []
          } satisfies QuestCuratedKnowledge)
        source.downstream.push({
          questId: target.questId,
          title: target.questTitle,
          prerequisiteMode: group.mode,
          provenance: group.provenance
        })
        result.set(prerequisite.questId, source)
      }
    }
  }

  return result
}

let CuratedQuestKnowledge = resolveCuratedQuestKnowledge()

/**
 * A signed update replaces every bundled source claim for the quest IDs it
 * contains. Passing null restores the bundled fallback.
 */
export function setCuratedQuestKnowledgeUpdate(update: QuestKnowledgeUpdate | null): void {
  if (update === null) {
    CuratedQuestKnowledge = resolveCuratedQuestKnowledge()
    return
  }

  const validated = validateQuestKnowledgeUpdate(update)
  const replacedQuestIds = new Set(validated.claims.map((claim) => claim.questId))
  CuratedQuestKnowledge = resolveCuratedQuestKnowledge([
    ...CuratedQuestClaims.filter((claim) => !replacedQuestIds.has(claim.questId)),
    ...validated.claims
  ])
}

export function getCuratedQuestKnowledge(questId: number): QuestCuratedKnowledge | undefined {
  return CuratedQuestKnowledge.get(questId)
}

export function listCuratedQuestKnowledge(): QuestCuratedKnowledge[] {
  return [...CuratedQuestKnowledge.values()].sort((a, b) => a.questId - b.questId)
}

export type QuestGoalStepStatus = 'claim' | 'active' | 'available' | 'not-shown'

export interface QuestGoalPlanStep {
  questId: number
  title: string
  status: QuestGoalStepStatus
  depth: number
  prerequisiteMode?: QuestPrerequisiteMode
  isTarget: boolean
}

export interface QuestGoalPlan {
  target: QuestCuratedQuestRef
  steps: QuestGoalPlanStep[]
  notShownCount: number
  conflictCount: number
  hasCycle: boolean
}

function questGoalStepStatus(
  questId: number,
  statusByQuest: ReadonlyMap<number, QuestGoalStepStatus>
): QuestGoalStepStatus {
  return statusByQuest.get(questId) ?? 'not-shown'
}

/**
 * 審査済みグラフだけを使い、前提から目標までを実行順に並べる。
 * 未表示は「未達成」と断定せず、現在の任務一覧で状態を確認できないことだけを示す。
 */
export function buildQuestGoalPlan(
  targetId: number,
  statusByQuest: ReadonlyMap<number, QuestGoalStepStatus> = new Map()
): QuestGoalPlan | undefined {
  const targetKnowledge = CuratedQuestKnowledge.get(targetId)
  if (!targetKnowledge) {
    return undefined
  }

  const steps: QuestGoalPlanStep[] = []
  const visited = new Set<number>()
  const visiting = new Set<number>()
  let conflictCount = 0
  let hasCycle = false

  const visit = (
    questId: number,
    title: string,
    depth: number,
    prerequisiteMode?: QuestPrerequisiteMode,
    isTarget = false
  ): void => {
    if (visited.has(questId)) {
      return
    }
    if (visiting.has(questId)) {
      hasCycle = true
      return
    }

    visiting.add(questId)
    const knowledge = CuratedQuestKnowledge.get(questId)
    if (knowledge) {
      conflictCount += knowledge.conflicts.length
      if (knowledge.conflicts.length === 0) {
        for (const group of knowledge.prerequisiteGroups) {
          for (const prerequisite of group.quests) {
            visit(prerequisite.questId, prerequisite.title, depth + 1, group.mode)
          }
        }
      }
    }
    visiting.delete(questId)
    visited.add(questId)
    steps.push({
      questId,
      title,
      status: questGoalStepStatus(questId, statusByQuest),
      depth,
      prerequisiteMode,
      isTarget
    })
  }

  visit(targetKnowledge.questId, targetKnowledge.questTitle, 0, undefined, true)

  return {
    target: {
      questId: targetKnowledge.questId,
      title: targetKnowledge.questTitle
    },
    steps,
    notShownCount: steps.filter((step) => step.status === 'not-shown').length,
    conflictCount,
    hasCycle
  }
}

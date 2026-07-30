# 任務攻略推薦ルート設計

最終更新日: 2026-07-31

## 目的

既存の任務指引は、審査済み前提任務、現在/全ルート、期限、任務枠、
装備・消耗品準備を、ローカル観測に基づいて説明できる。本設計はこれを壊さず、
「次にどの任務を、どの海域・編成候補で進めるか」を複数任務横断で組み立てる
**読み取り専用の攻略推薦ルート**へ拡張する。

推薦は操作命令ではなく、利用者が確認して実行する計画である。ゲームへの自動操作、
通信の変更、成功率の推測、未審査 Wiki 情報の本番取得は行わない。

## 現在の基線と不足

利用する既存基線:

- `buildQuestGoalPlan` による審査済み前提任務の順序付け
- `QuestGuideRecommendation` の readiness、期限、任務枠、装備・消耗品情報
- `QuestKnowledgeEvidence` と curated conflict による出典・確度・競合表示
- `QuestGuide.vue` の目標選択、現在/全ルート、6 ステップ折り畳み
- 署名済み地図・任務知識 bundle の検証済み起動時読込
- main / preload / renderer の分離と、renderer へ Node API を公開しない方針

不足しているもの:

- 複数の選択済み任務を同じ出撃・演習・遠征・工廠操作へまとめる計画
- 海域・ルート候補、編成条件、装備カテゴリ、陣形、制空条件の審査済み表現
- 資源、危険度、期限、任務枠、情報不足を同時に扱う決定的な順位付け
- 推薦理由、採用しなかった候補、欠損情報、失効情報を一つの監査可能な出力にする契約

## 絶対境界

1. 推薦エンジンは `src/common` の純粋関数とし、ネットワーク、IPC、DB 書込、
   現在時刻の暗黙参照を持たない。
2. ゲーム通信は既存の観測経路から得た正規化済みローカル snapshot だけを入力とする。
   `kcbrowser.ts`、`xhr-hook.ts`、`kcsapi_hook.ts` に要求・応答・状態を変更する処理を
   追加しない。
3. renderer は限定 preload から受け取った snapshot と検証済み知識だけを表示する。
   原始 API payload、Cookie、アカウント識別情報を外部へ送らない。
4. Wiki は保守時の根拠であり、本番アプリから直接取得しない。構造化知識は審査、
   fixture、schema 検証を通過した同梱データまたは署名済み bundle に限る。
5. 証拠不足、競合、失効、ローカルデータ欠損は「不明」として表示し、成功可能、
   最適、必須、確率などの断定へ変換しない。

## 推奨アーキテクチャ

### 1. 審査済み攻略知識

候補ファイル:

- `src/common/quest_strategy.ts`: 型、正規化、純粋な推薦
- `src/common/quest_strategy_knowledge.ts`: 同梱審査済み recipe
- `src/common/__tests__/quest_strategy.test.ts`: 決定性、降格、競合
- `src/renderer/src/common/quest-strategy-view.ts`: 表示専用変換
- `src/renderer/src/components/QuestStrategyRoute.vue`: 既存指引内の新セクション

```ts
export type StrategyConfidence = 'verified' | 'supported' | 'observed'
export type StrategyFreshness = 'current' | 'stale' | 'expired' | 'unknown'

export interface StrategyEvidence {
  source: 'official' | 'wikiwiki' | 'kcwiki' | 'bundled-definition'
  sourceLabel: string
  url?: string
  verifiedAt: string
  confidence: StrategyConfidence
  claim: string
}

export interface StrategyValidity {
  validFrom?: string
  expiresAt?: string
  gameVersion?: string
  eventId?: string
}

export interface QuestStrategyRecipe {
  recipeId: string
  revision: number
  questIds: string[]
  action: 'sortie' | 'exercise' | 'expedition' | 'arsenal' | 'supply'
  map?: {
    areaId: number
    mapNo: number
    routeLabels?: string[]
    targetNodes?: string[]
  }
  fleetConstraints?: FleetConstraint[]
  equipmentConstraints?: EquipmentConstraint[]
  formationOptions?: FormationOption[]
  airState?: AirStateGuidance
  resourceBand?: 'low' | 'medium' | 'high' | 'unknown'
  riskBand?: 'low' | 'medium' | 'high' | 'unknown'
  validity: StrategyValidity
  evidence: StrategyEvidence[]
  reviewStatus: 'approved' | 'conflict' | 'incomplete'
}
```

`routeLabels` は審査済みの人間向け経路候補であり、実際にその分岐へ到達すると保証しない。
艦名の完全一致だけに依存せず、艦種・カテゴリ・最低/最大数など既存 master data で
安定して判定できる制約を優先する。

### 2. ローカル観測入力

```ts
export interface StrategyLocalSnapshot {
  capturedAt: string
  activeQuestIds: string[]
  questProgress: Readonly<Record<string, QuestProgressSnapshot>>
  ships?: readonly StrategyShipSnapshot[]
  equipment?: readonly StrategyEquipmentSnapshot[]
  resources?: StrategyResourceSnapshot
  availableMaps?: readonly string[]
  fleetSlots?: number
  missing: StrategyInputKind[]
}

export interface StrategyPreferences {
  priority: 'deadline' | 'resource-saving' | 'risk-averse' | 'balanced'
  selectedQuestIds: string[]
  maxConcurrentQuests?: number
  allowStaleReference: boolean
}
```

snapshot は推薦呼出し前に正規化し、ソート順と時刻を明示的に固定する。
原始 payload、提督名、艦隊名、Cookie、サーバー情報は契約へ含めない。
利用者の preference はローカル設定だけに保存し、ゲーム側状態へ反映しない。

### 3. 推薦出力

```ts
export interface StrategyRoutePlan {
  planVersion: 1
  generatedAt: string
  inputFingerprint: string
  knowledgeVersion: string
  steps: StrategyRouteStep[]
  alternatives: StrategyAlternative[]
  warnings: StrategyWarning[]
  blockedReasons: StrategyStopReason[]
}

export interface StrategyRouteStep {
  stepId: string
  recipeId: string
  coveredQuestIds: string[]
  action: QuestStrategyRecipe['action']
  checks: StrategyCheckResult[]
  score: StrategyScoreBreakdown
  explanation: StrategyExplanation[]
  evidence: StrategyEvidence[]
}
```

`inputFingerprint` は正規化済み非識別入力の hash とし、同じ knowledge、snapshot、
preference、`generatedAt` なら同じ出力になることを fixture で保証する。

## 推薦アルゴリズム

### ハード制約

候補を順位付けする前に、次を満たさない recipe を除外または明示的に blocked とする。

1. `reviewStatus !== 'approved'`
2. 証拠がない、または全証拠が `expired`
3. 対象任務が前提ルート上で未解放
4. 必須海域がローカルで未開放と確認できる
5. 必須艦種・隻数・装備カテゴリを満たさないことがローカルで確認できる
6. 同時受注が必要な任務が任務枠へ入らない

データがない場合は不適合と決めず、`unknown` として候補を残し、利用者確認を必須にする。
イベント recipe の `expiresAt` 超過は、設定にかかわらず推薦対象から除外する。
前提任務の `any` group は一つを暗黙選択したり全件必須へ変換したりせず、候補ごとの
独立した alternative plan として保持する。選択理由と未選択分岐も出力へ残す。

### スコア

整数のみで計算し、同点は `recipeId`、海域 key、任務 ID の辞書順で解消する。

```text
score =
  coCompletion * 40
  + deadlineUrgency * 30
  + prerequisiteProgress * 20
  + readiness * 20
  - resourceCost * preferenceResourceWeight
  - risk * preferenceRiskWeight
  - unknownInputCount * 8
  - staleEvidenceCount * 12
```

初期版の重みは version 付き定数とし、利用者が選ぶのは 4 つの preset だけとする。
自由入力の重みや学習型順位付けは、実利用 fixture と説明可能性が揃うまで導入しない。

### 説明と降格

各候補は次を必ず出力する。

- 推薦された理由と、同時に進む任務
- 満たした hard check、未確認 check、満たせない check
- score の項目別内訳
- 根拠 URL、確認日、確度、新鮮度
- 次点候補との差
- データ不足時に利用者が確認する具体項目

艦隊・装備情報が欠ける場合は「海域と任務の組合せ候補」まで、地図知識が欠ける場合は
既存の「前提任務ルート」まで段階的に降格する。既存表示を空に置き換えない。

## MVP と非目標

### MVP

- 通常海域を対象に、2～5 件の選択任務を出撃単位へまとめる
- 審査済み recipe に限り、海域、対象ノード/ルート表記、艦種/隻数、
  装備カテゴリ、陣形候補、制空ガイダンスを表示する
- 期限、任務枠、準備状況、資源帯、危険帯、証拠新鮮度で決定的に順位付けする
- 既存 `QuestGuide.vue` の目標ルート直下に opt-in の攻略ルートセクションを追加する
- 入力不足、競合、失効時の降格と説明を必須にする

### MVP の非目標

- 戦闘勝率、ドロップ率、必要周回数、資源消費量の数値予測
- 装備の自動最適化、個艦指定の自動編成、基地航空隊シミュレーション
- イベント海域の即時追従、リアルタイム Wiki scraping
- ゲームの自動クリック、出撃、補給、編成変更
- クラウド推薦、アカウントデータの外部送信

## 8 週間の実装ルート

| 週 | 作業 | 依存 | 産物・受け入れ | 停止条件 |
| --- | --- | --- | --- | --- |
| 1 | 契約と fixture を固定 | 本設計 | 型、schema、通常海域 3 件の approved fixture、競合・失効 fixture。正規化と schema test が通る | 艦種・装備カテゴリを既存 master で安定照合できない |
| 2 | 純粋な候補生成 | 週 1 | 選択任務、前提、任務枠、海域解放から候補を列挙。順序を入れ替えた入力で同一出力 | 未審査 claim を hard constraint に使う必要が生じる |
| 3 | 決定的順位付けと説明 | 週 2 | preset、整数 score、tie-break、alternatives、blocked reason。golden test を固定 | 同一入力で出力が変わる、または理由を再構成できない |
| 4 | 欠損・失効・競合の降格 | 週 3 | snapshot 欠損 matrix、stale 警告、expired 除外、既存ルート fallback | 欠損を不適合や準備完了と誤判定する |
| 5 | Vue 表示統合 | 週 4 | `QuestGuide.vue` 内の opt-in セクション、score 内訳、証拠、次点、確認項目。既存 current/all と 6 step 表示を回帰 | 既存目標ルートの表示・保存状態が変わる |
| 6 | 複数任務 co-completion | 週 5 | 2～5 任務の set-cover 型候補比較、任務枠提案、重複出撃削減の説明 | 組合せ上限を超えて UI または計算時間が不安定になる |
| 7 | 署名 bundle と smoke | 週 6 | 攻略 schema を既存検証済み bundle へ追加、未知 version 拒否、同梱 fallback、production Electron smoke | #29 未決定を理由に本番 endpoint や鍵を仮定する必要がある |
| 8 | 受け入れと限定公開判断 | 週 7 | 合成 snapshot の E2E、実アカウント読み取り専用確認手順、監査 checklist、機能 flag の公開判断 | 通信変更、個人情報出力、誤断定、既存指引の退行が 1 件でもある |

週 1～4 は #29 の本番運用決定に依存せず、同梱 fixture で進める。週 7 も正式 URL や鍵を
要求せず、既存の一時鍵・loopback smoke で統合可能にする。本番配布は #29 完了後の別ゲートとする。

## テストと受け入れ

### 単体・fixture

- 入力配列順、object key 順、locale が変わっても plan の意味と順位が変わらない
- conflict / incomplete recipe は自動推薦されない
- stale は警告と減点、expired は除外される
- 艦隊・装備・資源・地図の各欠損と複合欠損が正しい fallback を返す
- 同時受注数と任務枠、期限、前提未完了が hard check に反映される
- 同点 tie-break と `inputFingerprint` が固定される
- 既存 `buildQuestGoalPlan` の全 fixture がそのまま通る

### renderer / smoke

- current/all、検索、6 step 折り畳み、証拠表示、locale 切替の回帰
- 攻略セクション非表示時は既存 UI と同じ
- production Electron の合成 snapshot で、原始 API payload や識別情報を DOM、
  log、summary に出さない
- 署名済み bundle の unknown field/version、改ざん、rollback を拒否し、
  同梱知識へ安全に fallback する
- game webview、request、response、headers、body、session に書込がないことを
  専用監査と既存 smoke で確認する

## Early-stop マトリクス

| リスク | 検出 | 即時動作 | 再開条件 |
| --- | --- | --- | --- |
| ゲーム通信へ影響 | main/preload diff、smoke、review | 実装と公開を停止 | 通信 bytes/semantics 非変更を独立確認 |
| 誤った攻略断定 | conflict/expired fixture、文言 review | recipe を blocked に降格 | 二系統または一次情報で再審査 |
| 活動情報の失効 | `expiresAt`、event ID 不一致 | 自動推薦から除外 | 新 revision の審査と署名 |
| 個人情報露出 | snapshot schema、DOM/log audit | 機能 flag を無効化 | 非識別契約と smoke が通過 |
| #29 未決定 | 正式 URL/鍵が必要になる | 同梱データだけで継続 | 所有者の運用決定と staging 受け入れ |
| 計算量増大 | 5 任務 fixture の時間上限 | 組合せを 5 件・候補上限で打切り | bounded algorithm の証明と計測 |
| 既存指引退行 | goal route regression | 新セクションを無効化 | 既存全 fixture と renderer test 通過 |

## 所有者判断と推奨初期値

1. **MVP 範囲**: 任務単位の実行計画と審査済み海域 guidance までを推奨する。
   戦闘 optimizer は根拠・鮮度・検証負担が大きいため後段とする。
2. **UI**: 別 workspace panel ではなく、既存任務指引内の opt-in セクションを推奨する。
   目標ルートとの文脈を維持し、既存利用者へ影響しない。
3. **重み**: `balanced` を既定とし、version 付き 4 preset のみを推奨する。
   自由重みは結果の説明と受け入れを難しくする。
4. **時効**: 通常海域は `verifiedAt` から 180 日で stale、イベントは必須
   `expiresAt` 超過で expired を推奨する。stale は表示可能だが自動上位推薦を避ける。
5. **利用者 override**: preference と明示的な recipe 非表示だけをローカル保存する。
   審査済み知識や evidence 自体を利用者操作で verified に昇格させない。
6. **公開順**: 同梱 fixture で MVP を完成させ、#29 の正式運用決定後に署名更新を有効化する。

## Web Pro 相談の扱い

2026-07-31 に公開 Git の精確な commit
`a26abe145e708371d50828c25b28b178829783f3` を対象として、ChatGPT Web の
`Pro` 表示セッションへ 9 ファイルの取得証拠、8 週間計画、契約、算法、
early-stop、所有者判断のレビューを依頼した。

Web 側の助言は設計入力に限り、ローカル `AGENTS.md`、実コード、テスト結果、
利用者が指定した範囲を上書きしない。モデル UI は `Pro` を表示したが、
バックエンドのモデルまたは routing を独立検証する証拠としては扱わない。
会話 URL は
`https://chatgpt.com/c/6a6b756d-32e8-83ee-92c6-b8bcb9cd5dc5`。
9 パスの固定 ref 取得成功と、MVP を審査済み template 駆動の任務実行計画へ
限定する中間結論は確認した。完全な A～H 回答は本設計保存時点で
`Pro 思考中` のため、完了済みの審査証拠としては扱わない。

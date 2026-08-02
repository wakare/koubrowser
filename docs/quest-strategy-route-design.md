# 任務攻略推薦ルート設計

最終更新日: 2026-08-03

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

## 実装進捗

2026-07-31 時点で 8 週間ルートの実装を完了し、公開判断だけを独立した
実アカウント受け入れゲートとして残した。

- `quest_strategy.ts` に version 1 の recipe、非識別 snapshot、preference、plan 契約を追加
- recipe と snapshot は未知フィールドを拒否し、ISO timestamp、HTTPS 根拠 URL、
  通常海域 key、重複 ID を厳格に検証
- approved、有効な根拠、有効期間、期限、前提、海域、艦種、装備カテゴリ、
  任務枠を hard check として監査可能な形で出力
- 欠損したローカル情報は `unknown` のまま候補を残し、失効情報は必ず除外
- 整数 score、固定 tie-break、入力 fingerprint、`any` 前提の独立 alternative を実装
- 合成 fixture と production 整合性テストで決定性、降格、失効、競合、
  preference、任務定義との map/rank/count 一致を検証
- Wiki の現行海域・定期任務ページをレビューし、通常海域 29 recipe を同梱
- 既存任務指引内へ既定非表示の opt-in UI、score 内訳、次点、確認事項、
  recipe 非表示、実行要約を追加
- 1～5 任務を最大 512 recipe から限界被覆で選ぶ bounded set-cover と性能 fixture を追加。
  1 件は単独ルート、2～5 件は co-completion の対象とする
- 攻略 schema を署名済み任務知識 bundle へ統合し、未知 field/version を拒否、
  検証失敗時は同梱知識へ fallback
- production Electron の署名 update smoke で攻略 version、privacy、横 overflow、
  UI 状態復元を検証

| recipe                                  | 同時進行対象          | 審査根拠                                                                                                       |
| --------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `normal-1-5-periodic-asw`               | 261 / 265 / 893       | [1-5](https://wikiwiki.jp/kancolle/鎮守府海域/1-5)、[定期出撃任務](https://wikiwiki.jp/kancolle/任務/出撃定期) |
| `normal-4-2-western-periodic`           | 229 / 264 / 845       | [4-2](https://wikiwiki.jp/kancolle/西方海域/4-2)、[定期出撃任務](https://wikiwiki.jp/kancolle/任務/出撃定期)   |
| `normal-1-4-light-fleet-periodic`       | 257 / 280 / 284       | [1-4](https://wikiwiki.jp/kancolle/鎮守府海域/1-4)、[定期出撃任務](https://wikiwiki.jp/kancolle/任務/出撃定期) |
| `normal-1-2-logistics-line-periodic`    | 280                   | [1-2](https://wikiwiki.jp/kancolle/鎮守府海域/1-2)、[舰娘百科 1-2](https://zh.kcwiki.cn/wiki/1-2)              |
| `normal-1-3-carrier-logistics-periodic` | 280 / 894             | [1-3](https://wikiwiki.jp/kancolle/鎮守府海域/1-3)、[舰娘百科 1-3](https://zh.kcwiki.cn/wiki/1-3)              |
| `normal-1-4-carrier-periodic`           | 280 / 284 / 894       | [1-4](https://wikiwiki.jp/kancolle/鎮守府海域/1-4)、[舰娘百科 1-4](https://zh.kcwiki.cn/wiki/1-4)              |
| `normal-2-1-southwest-periodic`         | 226 / 280 / 284 / 894 | [2-1](https://wikiwiki.jp/kancolle/南西諸島海域/2-1)、[舰娘百科 2-1](https://zh.kcwiki.cn/wiki/2-1)            |
| `normal-2-2-carrier-southwest-periodic` | 284 / 894             | [2-2](https://wikiwiki.jp/kancolle/南西諸島海域/2-2)、[舰娘百科 2-2](https://zh.kcwiki.cn/wiki/2-2)            |
| `normal-2-3-carrier-southwest-periodic` | 284 / 894             | [2-3](https://wikiwiki.jp/kancolle/南西諸島海域/2-3)、[舰娘百科 2-3](https://zh.kcwiki.cn/wiki/2-3)            |
| `normal-2-4-okinoshima-periodic`        | 226 / 822 / 854       | [2-4](https://wikiwiki.jp/kancolle/南西諸島海域/2-4)、[舰娘百科 2-4](https://zh.kcwiki.cn/wiki/2-4)            |
| `normal-2-5-surface-counterattack-monthly` | 266                 | [2-5](https://wikiwiki.jp/kancolle/南西諸島海域/2-5)、[舰娘百科 2-5](https://zh.kcwiki.cn/wiki/2-5)            |
| `normal-1-6-transport-quarterly`        | 861                   | [1-6](https://wikiwiki.jp/kancolle/鎮守府海域/1-6)、[舰娘百科 1-6](https://zh.kcwiki.cn/wiki/1-6)              |
| `normal-6-3-aerial-recon-quarterly`     | 854 / 862             | [6-3](https://wikiwiki.jp/kancolle/中部海域/6-3)、[舰娘百科 6-3](https://zh.kcwiki.cn/wiki/中部海域/6-3)       |
| `normal-6-1-submarine-monthly`          | 256 / 854             | [6-1](https://wikiwiki.jp/kancolle/中部海域/6-1)、[舰娘百科 6-1](https://zh.kcwiki.cn/wiki/中部海域/6-1)       |
| `normal-6-4-z-operation-quarterly`      | 854                   | [6-4](https://wikiwiki.jp/kancolle/中部海域/6-4)、[舰娘百科 6-4](https://zh.kcwiki.cn/wiki/中部海域/6-4)       |
| `normal-5-5-z-operation-later-quarterly` | 872                  | [5-5](https://wikiwiki.jp/kancolle/南方海域/5-5)、[舰娘百科 5-5](https://zh.kcwiki.cn/wiki/5-5)                |
| `normal-6-2-z-operation-later-quarterly` | 872                  | [6-2](https://wikiwiki.jp/kancolle/中部海域/6-2)、[舰娘百科 6-2](https://zh.kcwiki.cn/wiki/6-2)                |
| `normal-6-5-z-operation-later-quarterly` | 872                  | [6-5](https://wikiwiki.jp/kancolle/中部海域/6-5)、[舰娘百科 6-5](https://zh.kcwiki.cn/wiki/中部海域/6-5)       |
| `normal-3-1-northern-quarterly`         | 873                   | [3-1](https://wikiwiki.jp/kancolle/北方海域/3-1)、[舰娘百科 3-1](https://zh.kcwiki.cn/wiki/3-1)                |
| `normal-3-2-northern-quarterly`         | 873                   | [3-2](https://wikiwiki.jp/kancolle/北方海域/3-2)、[舰娘百科 3-2](https://zh.kcwiki.cn/wiki/3-2)                |
| `normal-3-3-northern-weekly`            | 241 / 873             | [3-3](https://wikiwiki.jp/kancolle/北方海域/3-3)、[舰娘百科 3-3](https://zh.kcwiki.cn/wiki/3-3)                |
| `normal-4-1-western-quarterly`          | 845                   | [4-1](https://wikiwiki.jp/kancolle/西方海域/4-1)、[舰娘百科 4-1](https://zh.kcwiki.cn/wiki/西方海域/4-1)       |
| `normal-4-3-western-quarterly`          | 845                   | [4-3](https://wikiwiki.jp/kancolle/西方海域/4-3)、[舰娘百科 4-3](https://zh.kcwiki.cn/wiki/西方海域/4-3)       |
| `normal-4-4-western-quarterly`          | 242 / 845             | [4-4](https://wikiwiki.jp/kancolle/西方海域/4-4)、[舰娘百科 4-4](https://zh.kcwiki.cn/wiki/西方海域/4-4)       |
| `normal-5-2-coral-weekly`               | 243                   | [5-2](https://wikiwiki.jp/kancolle/南方海域/5-2)、[舰娘百科 5-2](https://zh.kcwiki.cn/wiki/5-2)                |
| `normal-4-5-western-quarterly`          | 845                   | [4-5](https://wikiwiki.jp/kancolle/西方海域/4-5)、[舰娘百科 4-5](https://zh.kcwiki.cn/wiki/4-5)                |
| `normal-7-1-anchorage-quarterly`        | 893                   | [7-1](https://wikiwiki.jp/kancolle/南西海域/7-1)、[舰娘百科 7-1](https://zh.kcwiki.cn/wiki/7-1)                |
| `normal-7-2-g-anchorage-quarterly`      | 893                   | [7-2](https://wikiwiki.jp/kancolle/南西海域/7-2)、[舰娘百科 7-2](https://zh.kcwiki.cn/wiki/南西海域/7-2)       |
| `normal-7-2-m-anchorage-quarterly`      | 872 / 893             | [7-2](https://wikiwiki.jp/kancolle/南西海域/7-2)、[舰娘百科 7-2](https://zh.kcwiki.cn/wiki/南西海域/7-2)       |

根拠ごとに再審査期限と有効期限を設定し、新規追加分は 2026-11-02 / 2027-02-02 とした。
再審査期限後は stale penalty と警告を付け、有効期限後は推薦から除外する。

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

## 現行 planner の製品境界

`QuestStrategyRoute` が現在扱う利用者作業は、visible non-claim の通常海域出撃任務から、
同じ出撃で進められる 1～5 件をまとめ、次の海域、同時進行理由、受注と準備の確認事項を
示すことである。coverage inventory やすべての任務種別を一覧することを主目的にしない。

- 主選択候補は `ApiQuestCategory.syutugeki` に限定する。
- 自動選択は完全な `route-ready` bundle だけを選ぶ。単一海域 recipe の共同達成に加え、
  multi-stage 任務は最大5海域の stage-aware bundle として選び、完了できない組合せを
  route-ready に昇格しない。
- 審査済み partial は明示的な手動選択だけを許可する。
- objective-only、conflicted、knowledge-insufficient、withdrawn は折り畳んだ診断とし、
  route coverage に数えない。
- 演習、遠征、工廠、編成などの generic fallback は既存 `QuestGuide` に残す。将来それらを
  計画する場合は通常海域 recipe を流用せず、別の plan model と evidence 契約を定義する。
- 実アカウント受け入れ、Issue #29 と独立した release 判断が揃うまで機能は既定非表示とする。

### 現在の actionability baseline

primary denominator 27 件に対し、現行の審査済み 29 route unit が任務全体を完了できるのは
226、229、241、242、243、256、257、261、264、265、266、280、284、822、845、854、861、862、872、873、893、894 の 22 件（81.48%）である。partial は
0 件で、残る 5 件には route unit がない。この値は全利用者の表示任務に
対する命中率ではなく、canonical recurring normal-sortie inventory 上のデータ充足率である。

1-2、1-3、1-4、2-1、2-2、2-3 の組み合わせにより、#280、#284、#894 は各 stage を失わずに
複数海域の順序付き計画として表示できる。V2 planner は任務 ID 単位ではなく stage 単位で
限界被覆を計算し、最大5海域の範囲で完了できない残り stage を明示する。authoring manifest の
approved map template、canonical objective fact、evidence URL と runtime recipe が一致しない場合、
compiler は生成を停止する。

2-4 は #822 のボスS勝利2回と #226 の南西諸島勝利を同時進行できる。航空巡洋艦1・
軽巡洋艦1・駆逐艦4による B-G-H-L-P 固定を採用し、Lの航空優勢境界84と軽量編成の
ボス火力不足を明示する。経路固定だけを成功保証へ読み替えず、近代化改修、制空余裕、
損傷状態を確認してから出撃する高リスク候補として扱う。

#266 は駆逐艦旗艦・駆逐艦4・軽巡洋艦1・重巡洋艦1で2-5のOボスS勝利を取る月次計画として
表示する。航空巡洋艦は重巡洋艦の代用にならないことを艦種IDで機械検証し、B-F-E-I-O、
分岐点係数1の索敵値34以上、可能な場合の航空優勢42を確認事項にする。索敵装備、制空、
夜戦連撃を同時に満たす負担と軽量艦隊の道中撤退リスクを保持し、到達やS勝利を保証しない。

4-1、4-2、4-3、4-4、4-5 の組み合わせでは #845 を5段階の順序付き計画として完了できる。
4-3 の H からボスへの分岐はランダム、4-5 は対潜・水上・対地の複合準備が必要という制約を
route action と risk に保持し、固定到達や低難度であるかのようには表示しない。

#873 は3-1、3-2、3-3を各A勝利以上で進める3段階の北方警備計画として表示する。3-1と3-3は
正規空母系1・軽空母1・重巡級1・軽巡1・駆逐2を共通編成とし、3-2だけ軽巡1・駆逐5へ切り替える。
3-2は高速+統一でもC-E/C-Gの分岐があり、通常高速ではHを経由する場合があるため、固定最短とは
表示しない。3-3は既存#241と同時進行できる。

#861 は補給艦2・駆逐4で1-6のNへ2回到達する単段階計画として表示する。A-E-G-F-B-Nを
候補にするが、GからFは固定ではなくKへ逸れる場合があるため、その場合は撤退して再出撃する。
補給艦の改装状態による艦種差、F航空戦への対空準備、各戦闘後の損傷確認をactionに残し、
到達保証や大破進撃を示唆しない。

#862 は水母2・軽巡3・駆逐1で6-3のJボスA勝利以上を2回取る単段階計画として表示する。
Aの能動分岐でCを選ぶA-C-E-F-H-Jを採用し、分岐点係数3の索敵値38以上に余裕を持たせる。
敵航空戦力はないが、道中の対潜戦と水雷戦、ボス夜戦を分けて準備し、4戦編成の高い損傷リスクを
保持する。

#256 は正規空母系1・雷巡1・軽巡1・潜水艦3で6-1のKボスS勝利を3回取る月次計画として
表示する。C-F-G-H-Kを候補にするが、潜水母艦を含まないためGから約15%でIへ逸れる可能性を
明示し、完全固定とは扱わない。分岐点係数4の索敵値36以上、Kの航空優勢126以上、単縦陣、
各戦闘後の損傷確認をactionに残し、高コスト・高リスク候補として扱う。

#854 は2-4、6-1、6-3で各A勝利以上、6-4でS勝利を取る4段階のZ作戦前段計画として表示する。
前半3海域は既存の#822、#256、#862向けrecipeへstage contributionを追加し、6-4は軽巡旗艦・
高速戦艦1・航空巡洋艦1・駆逐艦3の全高速編成によるB-D-C-F-Nを採用する。Nボスは陸上型を
含むため対地装備を分散し、行動半径5以上の基地航空隊を集中する。航空隊を利用できない状態、
対地装備不足、道中大破を成功可能と読み替えず、高コスト・高リスクの確認事項として残す。

#872 は7-2第二ゲージM、5-5、6-2、6-5で各S勝利を取る4段階のZ作戦後段計画として表示する。
7-2は既存#893のM向け高速空母機動recipeを共同利用する。5-5はB-K-P-Sの重量編成とし、
ボス潜水艦への対潜準備、支援艦隊、ゲージ破壊前後の敵編成差を明示する。6-2は
C-E-J-Kの索敵・航空優勢、6-5は航空戦艦2・航空巡洋艦1・軽巡1・駆逐2のB-F-I-J-Mと
行動半径5以上の基地航空隊2部隊を確認事項にする。4海域とも高コスト・高リスクであり、
経路候補や制空目安を成功保証へ読み替えない。

#241、#242、#243 の週次チェーンは、3-3 の A-C-G-M、4-4 の A-E-I-K、5-2 の
B-C-E-F-O を一つの順序付き計画として表示する。#241 は正規空母系1・軽空母1・重巡級1・
軽巡1・駆逐2で北方海域のB勝利以上を5回、#242 は既存4-4編成を再利用してボス勝利、#243 は
正規空母系2・戦艦級2・重巡級2でボスS勝利を2回とする。3-3のうずしお電探、5-2の
出撃時制空値200以上と分岐点係数2の索敵値71以上を確認事項として残し、ローカル観測値が
ない場合に達成可能と断定しない。

1-5、7-1、7-2第一ゲージG、7-2第二ゲージMの組み合わせでは #893 を4段階の順序付き計画として
完了できる。7-2は同一海域に二つの対象格があるため、recipe の `targetCellIds` と canonical
objective の数値セルIDを完全一致させる。これによりG向けの対潜・水上混成編成がM段階へ、
またはM向けの高速空母機動編成がG段階へ誤って寄与することを防ぐ。M段階は当月の第一ゲージ
破壊後に進める解放順序も action に保持する。

#257 は canonical の6隻、軽巡旗艦、軽巡・駆逐限定、軽巡3隻以下という条件を、recipe の
`flagshipTypeIds`、`allowedShipTypeIds`、艦種別の上下限で機械検証する。推奨編成はその安全な
部分集合である軽巡1〜2・駆逐4〜5とし、駆逐4によるJ-Lボス固定を保つ。いずれかの hard
constraint が欠けた recipe は引き続き `route-unreviewed` へ fail closed する。

そのため本変更では、件数を増やすために未審査 Wiki 情報を取り込まず、まず route-ready
だけを自動選択する UI と authority を固定する。次のデータ pilot は、代表 snapshot で
zero-ready の原因を記録し、author と approver を分離できる場合に限り、小さな審査単位で
追加する。81.48% をもって既定有効化や実用カバレッジ達成とは判断しない。

## 推奨アーキテクチャ

### 1. 審査済み攻略知識

実装済みファイル:

- `src/common/quest_strategy.ts`: 型、正規化、純粋な推薦
- `src/common/quest_strategy_knowledge.ts`: version 付き同梱 recipe と厳格な bundle 検証
- `src/common/__tests__/quest_strategy.test.ts`: 決定性、降格、競合

表示統合ファイル:

- `src/renderer/src/common/quest-strategy-view.ts`: 表示専用変換
- `src/renderer/src/components/QuestStrategyRoute.vue`: 既存指引内の新セクション

```ts
export type StrategyConfidence = 'verified' | 'supported'

export interface StrategyEvidence {
  sourceId: string
  sourceLabel: string
  url: string
  reviewedAt: string
  validUntil?: string
  confidence: StrategyConfidence
  summary: string
}

export interface QuestStrategyRecipe {
  schemaVersion: 1
  id: string
  revision: number
  status: 'approved' | 'draft' | 'withdrawn'
  questIds: number[]
  objectives: StrategyQuestObjective[]
  mapKey: string
  routeLabels: string[]
  targetNodes: string[]
  fleet: StrategyFleetGuidance
  equipmentTypeConstraints: StrategyEquipmentTypeConstraint[]
  formations: StrategyFormation[]
  airState?: AirStateGuidance
  cost: 'low' | 'medium' | 'high'
  risk: 'low' | 'medium' | 'high'
  validity: StrategyValidity
  evidence: StrategyEvidence[]
  prerequisiteAlternative?: StrategyPrerequisiteAlternative
}
```

`routeLabels` は審査済みの人間向け経路候補であり、実際にその分岐へ到達すると保証しない。
艦名の完全一致だけに依存せず、艦種・カテゴリ・最低/最大数など既存 master data で
安定して判定できる制約を優先する。

### 2. ローカル観測入力

```ts
export interface StrategyLocalSnapshot {
  schemaVersion: 1
  capturedAt: string
  selectedQuestIds: number[]
  quests: StrategyQuestSnapshot[]
  mapAvailability: Record<string, 'available' | 'unavailable' | 'unknown'>
  shipTypeCounts?: Record<string, number>
  equipmentTypeCounts?: Record<string, number>
  questCapacity?: { active: number; maximum: number }
}

export interface StrategyPreferences {
  preset: 'deadline' | 'resource-saving' | 'risk-averse' | 'balanced'
  maximumRoutes: number
}
```

snapshot は推薦呼出し前に正規化し、ソート順と時刻を明示的に固定する。
原始 payload、提督名、艦隊名、Cookie、サーバー情報は契約へ含めない。
利用者の preference はローカル設定だけに保存し、ゲーム側状態へ反映しない。

### 3. 推薦出力

```ts
export interface StrategyRoutePlan {
  schemaVersion: 1
  generatedAt: string
  inputFingerprint: string
  knowledgeVersion: string
  steps: StrategyRouteStep[]
  alternatives: StrategyRouteStep[]
  blocked: StrategyBlockedCandidate[]
  warnings: string[]
}

export interface StrategyRouteStep {
  recipeId: string
  recipeRevision: number
  coveredQuestIds: number[]
  objectives: StrategyQuestObjective[]
  checks: StrategyHardCheck[]
  score: StrategyScoreBreakdown
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

- 通常海域を対象に、1～5 件の選択任務を出撃単位へまとめる。
  1 件は単独ルート、2～5 件は co-completion として扱う
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

| 週  | 作業                   | 依存   | 産物・受け入れ                                                                                                   | 停止条件                                                      |
| --- | ---------------------- | ------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | 契約と fixture を固定  | 本設計 | 型、schema、通常海域 3 件の approved fixture、競合・失効 fixture。正規化と schema test が通る                    | 艦種・装備カテゴリを既存 master で安定照合できない            |
| 2   | 純粋な候補生成         | 週 1   | 選択任務、前提、任務枠、海域解放から候補を列挙。順序を入れ替えた入力で同一出力                                   | 未審査 claim を hard constraint に使う必要が生じる            |
| 3   | 決定的順位付けと説明   | 週 2   | preset、整数 score、tie-break、alternatives、blocked reason。golden test を固定                                  | 同一入力で出力が変わる、または理由を再構成できない            |
| 4   | 欠損・失効・競合の降格 | 週 3   | snapshot 欠損 matrix、stale 警告、expired 除外、既存ルート fallback                                              | 欠損を不適合や準備完了と誤判定する                            |
| 5   | Vue 表示統合           | 週 4   | `QuestGuide.vue` 内の opt-in セクション、score 内訳、証拠、次点、確認項目。既存 current/all と 6 step 表示を回帰 | 既存目標ルートの表示・保存状態が変わる                        |
| 6   | 複数任務 co-completion | 週 5   | 1～5 任務の set-cover 型候補比較。1 件は単独ルート、2～5 件は任務枠提案と重複出撃削減を説明                      | 組合せ上限を超えて UI または計算時間が不安定になる            |
| 7   | 署名 bundle と smoke   | 週 6   | 攻略 schema を既存検証済み bundle へ追加、未知 version 拒否、同梱 fallback、production Electron smoke            | #29 未決定を理由に本番 endpoint や鍵を仮定する必要がある      |
| 8   | 受け入れと限定公開判断 | 週 7   | 合成 snapshot の E2E、実アカウント読み取り専用確認手順、監査 checklist、機能 flag の公開判断                     | 通信変更、個人情報出力、誤断定、既存指引の退行が 1 件でもある |

週 1～4 は #29 の本番運用決定に依存せず、同梱 fixture で進める。週 7 も正式 URL や鍵を
要求せず、既存の一時鍵・loopback smoke で統合可能にする。本番配布は #29 完了後の別ゲートとする。

実装と受け入れ証拠は
[`quest-strategy-route-acceptance.md`](quest-strategy-route-acceptance.md) に固定する。

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

| リスク           | 検出                                  | 即時動作                        | 再開条件                              |
| ---------------- | ------------------------------------- | ------------------------------- | ------------------------------------- |
| ゲーム通信へ影響 | main/preload diff、smoke、review      | 実装と公開を停止                | 通信 bytes/semantics 非変更を独立確認 |
| 誤った攻略断定   | conflict/expired fixture、文言 review | recipe を blocked に降格        | 二系統または一次情報で再審査          |
| 活動情報の失効   | `expiresAt`、event ID 不一致          | 自動推薦から除外                | 新 revision の審査と署名              |
| 個人情報露出     | snapshot schema、DOM/log audit        | 機能 flag を無効化              | 非識別契約と smoke が通過             |
| #29 未決定       | 正式 URL/鍵が必要になる               | 同梱データだけで継続            | 所有者の運用決定と staging 受け入れ   |
| 計算量増大       | 5 任務 fixture の時間上限             | 組合せを 5 件・候補上限で打切り | bounded algorithm の証明と計測        |
| 既存指引退行     | goal route regression                 | 新セクションを無効化            | 既存全 fixture と renderer test 通過  |

## 所有者判断と推奨初期値

1. **MVP 範囲**: 任務単位の実行計画と審査済み海域 guidance までを推奨する。
   戦闘 optimizer は根拠・鮮度・検証負担が大きいため後段とする。
2. **UI**: 別 workspace panel ではなく、既存任務指引内の opt-in セクションを推奨する。
   目標ルートとの文脈を維持し、既存利用者へ影響しない。
3. **重み**: `balanced` を既定とし、version 付き 4 preset のみを推奨する。
   自由重みは結果の説明と受け入れを難しくする。
4. **時効**: 通常海域は 90 日で再審査、365 日で hard expiry とする。stale は表示可能だが
   自動上位推薦を避け、hard expiry 後は自動推薦から除外する。
5. **利用者 override**: preference と明示的な recipe 非表示だけをローカル保存する。
   審査済み知識や evidence 自体を利用者操作で verified に昇格させない。
6. **公開順**: 同梱 fixture で MVP を完成させ、#29 の正式運用決定後に署名更新を有効化する。

## Web Pro 相談の扱い

2026-07-31 に公開 Git の精確な commit
`a26abe145e708371d50828c25b28b178829783f3` を対象として、ChatGPT Web の
`Pro` 表示セッションへ 9 ファイルの取得証拠、8 週間計画、契約、算法、
early-stop、所有者判断のレビューを依頼した。この回答を設計へ反映した後、
実装済み commit `abb417d89570e3cc4cc996aab3d618ecbab70914` の 10 ファイルを
同じ会話で再取得させ、release gate の観点で最終レビューした。

Web 側の助言は設計入力に限り、ローカル `AGENTS.md`、実コード、テスト結果、
利用者が指定した範囲を上書きしない。モデル UI は `Pro` を表示したが、
バックエンドのモデルまたは routing を独立検証する証拠としては扱わない。
会話 URL は
`https://chatgpt.com/c/6a6b756d-32e8-83ee-92c6-b8bcb9cd5dc5`。
最初の 9 パスは固定 ref で取得成功した。最終レビューでは 8 パスを完全取得し、
巨大な `QuestGuide.vue` と smoke script は関連部分だけ取得したため、この 2 パスは
部分取得として扱う。

最終回答は P0 を報告せず、canonical snapshot の配列・record key 順、
host locale に依存しない comparator、進捗文書の更新を狭い P1 として指摘した。
ローカル再監査で、未読込の艦船・装備 inventory を空集合として不適合判定しない
adapter guard も追加した。任務枠は recipe ごとの同時受注制約であり、別 step 間で
順次入れ替えられるため、全 step の合計を hard constraint にはしない。

UI と回答本文はそれぞれ `Pro`、`GPT-5.6 Pro` を表示・自己申告したが、
バックエンド routing と fallback の独立証明は提供されなかった。したがって証拠分類は
`UI_PRO_AND_SELF_REPORT_PRO_ROUTE_UNVERIFIED` とし、助言はローカルの型検査、
unit test、production smoke、只読監査を通過した範囲だけ採用する。

同日、画面上の候補一覧が情報不足表示で埋まり、行動可能な推薦が見えない問題について、
実装済み commit `828b5fa0d875d19ededc809c101f8d0a159ba4da` の 10 ファイルを別の
ChatGPT Web Pro 会話で精確に取得させ、製品目的から再レビューした。提案された
「通常海域出撃 planner への限定」「完全 route-ready 一組だけの自動選択」「partial は
手動」「診断は折り畳み」「localStorage v2 migration」「実アカウント受け入れまで既定
非表示」を採用した。10 パスは取得成功し、大きなファイルは分割取得された。
会話 URL は
`https://chatgpt.com/c/6a6ca06d-5e34-83ee-950e-0e977caa1154`。
この会話も UI と自己申告は Pro だったが routing attestation は得られなかったため、
証拠分類は同じく `UI_PRO_AND_SELF_REPORT_PRO_ROUTE_UNVERIFIED` とする。

## Coverage expansion contract

実用カバレッジの拡張は、手書き combination recipe の大量追加ではなく、
authoring schema から既存 runtime v1 へ無損失でコンパイルする方式で進める。
分母、状態、審査、freshness、withdrawal、停止条件は
[`quest-strategy-coverage-contract.md`](quest-strategy-coverage-contract.md) に固定する。
機械受け入れ条件は
[`quest-strategy-coverage-acceptance.md`](quest-strategy-coverage-acceptance.md) に固定する。

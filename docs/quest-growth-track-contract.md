# 新人向け成長トラック authoring 契約

最終更新日: 2026-08-01

Task ID: `QGROWTH-R5_Existing_Observation_Context`

Status: `EXISTING_OBSERVATION_CONTEXT_IMPLEMENTED_ROUTE_OUTPUT_BLOCKED`

## モデル境界

`QuestRouteUnit` と `GrowthMilestone` は並列モデルとする。

| Concern          | QuestRouteUnit                                      | GrowthMilestone                                |
| ---------------- | --------------------------------------------------- | ---------------------------------------------- |
| Question         | active quest の exact stage をどの route で進めるか | アカウントが次に補う能力は何か                 |
| Unit             | `questId + stageIndex + map + result + count`       | 安全、解放、経験、資源、能力、EO、活動準備     |
| Coverage         | 全 required stage が揃うまで complete ではない      | 部分進捗を許すが quest coverage へ変換しない   |
| Map guidance     | 審査済み route template が所有する                  | `routeId` を参照し、編成を複製しない           |
| Editorial advice | route-ready に混ぜない                              | `editorial-community` と明示し条件付き表示する |
| Unknown          | 自動 route へ昇格しない                             | 必ず非空 fallback へ降格する                   |

GrowthMilestone から QuestRouteUnit への参照は一方向とする。`manual-partial` は残り stage を
隠さず、`route-ready-only` だけを自動実行候補として扱う。

## 現在の固定境界

Wave 1 は authoring と audit artifact、Wave 2 は pure fallback evaluator、Wave 3 は read-only
snapshot adapter、Wave 4 は read-only fallback UI を固定した。現 Wave は新しい観測を追加せず、
利用者が現在画面で選んだ資源方針と成長重点を evaluator context へ渡すところまでを許可する。

```text
evidence-ledger.json ──────┐
milestone-candidates.json ─┼─ strict validation
observability-map.json ────┤          │
decision-rubrics.json ─────┤          ├─ source-manifest.json
synthetic fixtures ────────┘          │
                                      └─ conflict-and-gap-report.json
```

次は生成・接続しない。

- route-knowledge production runtime bundle
- network fetcher
- real-account fixture
- concrete route output
- snapshot persistence / export

## Evidence gate

claim は URL、title、site、language、分類、可読性、独立性、supported claim、更新・確認・再審査・
失効日、currentness risk、注意事項を持つ。

自動推薦候補に必要な最低条件:

1. `promotionStatus = candidate`
2. `confidence != insufficient`
3. `independently-readable + independent` が二件以上
4. 未解決 contradiction がない

`prompt-supplied-observation`、`unreadable`、`derivative`、`same-editorial-ecosystem` は、URL と
調査価値を保持しても二件の独立証拠へ数えない。

## Milestone gate

各 milestone は次を必須にする。

- goal と rationale
- deterministic / editorial / mixed の区分
- required observables
- prerequisite と trigger の unknown policy
- now / next / longTerm / fallback
- benefit、cost、risk、stop condition
- exact `questId + stageIndex` の任意参照
- evidence claim refs
- confidence、reviewBy、validUntil
- author / approver 分離

`approved` は approver と reviewedAt を必須とし、author と approver が同じ場合は validation を
失敗させる。現行8件と対応する8 rubric の現在の意味は project owner が 2026-08-01 に承認した。
最初の承認は pure fallback evaluator、その後の承認は匿名 read-only local snapshot adapter、さらに
fallback UI 接続までを許可する。runtime route、snapshot 保存・外送、または route eligibility は
承認しない。
29 observable の local source は監査済みだが、complete 19、partial 8、unavailable 2 であり、
監査・意味承認・adapter 実装の完了は runtime 利用可能を意味しない。

exact commit `55a7151c5b63a40453ffb55eccef49b6cbd5a7f9` に対する external advisory review は、
2 rubric を authoring/future restricted fallback として `APPROVE`、6 rubric を `REVISE`、runtime
candidate を0件と判定した。6件は revision 2 へ修正済みで、その後 project owner が全8件の現在の
意味を承認した。observable の `partial` / `unavailable` と `fallback-only` / `blocked` は変更せず、
runtime candidate は0件のままとする。

## Pure fallback evaluator gate

`src/common/quest_growth_evaluator.ts` は I/O、clock、local account state、renderer、Electron、network
に依存しない決定的な関数とする。許可する結果は次の2種類だけである。

- `manual-check`: ユーザーが確認・選択する非実行チェック
- `data-acquisition`: 不足・古い・利用不能な入力を確認する手順

結果型には executable suggestion、`routeId`、route steps、sortie/map recommendation を設けない。
rubric と observable の参照は contract trace であり route lineage ではない。unknown、stale、invalid、
unavailable は fail closed とし、invalid input は evaluator boundary で拒否する。

## Read-only local snapshot adapter gate

`src/renderer/src/common/quest-growth-snapshot.ts` は既存 `SvData` だけを同期的に読み取り、10個の
fallback evaluator input へ匿名集約する。ship / equipment instance ID、member ID、nickname、raw
payload は結果型に持たず、I/O、local DB query、保存、外送、network、game communication を行わない。

未ロード状態は `unknown`、演習残数と event overlay は常に `unavailable` とする。resource は自動
band 化せず測定値だけを保持する。route lineage 延期中のため EO の `reviewedRouteKnowledge` は adapter
で常に `false` とし、具体的 route を生成できない状態を維持する。

`resourcePosture` と `focus` は renderer の一時 state とし、localStorage、DB、設定ファイルへ保存せず、
外送もしない。選択は対象 observable の確認順と user-declared context だけを変更する。審査済み rule、
formula、route knowledge を選択から生成せず、`reviewedRouteKnowledge` は引き続き常に `false` とする。

## Unknown と fallback

unknown state でも空画面にしない。現在の fallback UI は最低限次を表示する。

### 今やること

状態不足時は、補給、損傷、入渠、素材安全を確認し、演習画面または現在の遠征編成を確認する
data-acquisition step を案内する。履歴上の成功だけで現在実行可能とせず、具体的出撃 route を断定
しない。

### 次にやること

反潜、制空、索敵、輸送のカテゴリ存在・不在を事実として表示し、ユーザーが次に確認するカテゴリを
一つ選ぶ。審査済みの対象別 rule がない限り、不在カテゴリを攻略上の不足とは断定しない。能力を
観測できない場合は演習画面の確認と可視の解放任務へ戻る。

### 長期目標

通常海域と解放済み EO を長期候補として表示し、勲章・設計図と活動準備へつながる資源循環を示す。
EO の攻略可能性は、審査済み route と現在の安全・資源・能力・時間条件が揃うまで断定しない。

## Synthetic fixtures

Wave 2 の pure evaluator を先に拘束するため、次の匿名 fixture を固定する。

- `unknown-state`
- `early-maps-only`
- `asw-missing`
- `resource-conservation-posture`
- `map-rich-equipment-poor`
- `event-active-not-ready`

fixture は account identifier と raw payload を禁止し、非空 fallback を要求する。実アカウントの
coverage 推定には使用しない。各 observable は evaluator input と同じ構造を持ち、期待する
`manual-check` / `data-acquisition` を明記する。審査されていない resource band、取得不能な演習残数、
未審査 event overlay の有効扱いを fixture 内でも禁止する。

## Stop matrix

| Condition                                                | Action                       | Runtime promotion            |
| -------------------------------------------------------- | ---------------------------- | ---------------------------- |
| source unreadable / prompt only                          | URL を保持し、内容を補わない | blocked                      |
| readable source が一件                                   | conditional editorial へ降格 | blocked for automatic action |
| 同じ上流の転載                                           | derivative と記録            | independent count へ含めない |
| hard mechanic conflict                                   | conflict report を生成       | blocked                      |
| observable 未監査                                        | checklist / fallback         | blocked                      |
| quest partial stage                                      | remaining stage を表示       | complete と表現しない        |
| evidence expired                                         | hide or downgrade            | blocked                      |
| event end 不明                                           | reviewBy を最大一週間にする  | short-lived editorial only   |
| runtime scraping / account upload / communication change | 方案を拒否                   | permanently blocked          |
| fallback empty                                           | contract failure             | blocked                      |

## Generated artifact identity

`source-manifest.json` は evidence、milestone、observability authoring file と各 fixture の SHA-256
digest を記録する。
`auditedBaseCommit` は調査時に固定した repository base であり、生成ファイル自身を含む commit と
偽らない。authoring data を release へ昇格する場合は、release record 側で実際の publish commit、
compiler version、input digest、output digest を固定する。

既存 quest strategy generated artifacts が `0505bc...` を source commit として保持する問題は、
本データで上書きしない。route lineage は project owner の判断により延期し、
`QUEST_STRATEGY_LINEAGE_DEFERRED_NO_ROUTE_OUTPUT` として downstream stop に残す。延期中は pure
evaluator、adapter、UI のいずれからも具体的 route を出力してはならない。

## 予定する完了順序

現行の作業順を変えず、具体的な攻略 route は審査工程を経た後段へ追加する。

1. `R4 Readonly Fallback UI`: 匿名 snapshot の `manual-check` / `data-acquisition` を、
   情報不足と次の確認行動として renderer に表示する。具体的 route は表示しない。
2. `R5 Existing-Observation Context`: 新しい通信観測を追加せず、既存 local state と利用者選択で
   判定できる context を増やす。資源方針と成長重点の session-only 選択を実装済み。
3. `R6 Reviewed Route Lineage`: 中日コミュニティの複数資料を route 単位で交差確認し、参照元、
   確認日、game version、適用条件、失効条件を固定する。
4. `R7 Reviewed Concrete Route UI`: lineage と適用条件を満たす route だけを具体的な海域、編成、
   装備、分岐条件として表示する。未審査・失効・条件不明は引き続き fail closed とする。

`R6` と `R7` の実装開始には、route lineage schema と runtime eligibility gate の追加承認を必要とする。

## Commands

```bash
npm run data:quest-growth:compile
npm run data:quest-growth:verify
```

`compile` は source manifest と conflict/gap report を決定的に生成する。`verify` は checked-in artifact
との byte equality を確認する。observability audit の path、policy、全 predicate coverage も compiler
が検証する。

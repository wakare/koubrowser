# 新人向け成長トラック authoring 契約

最終更新日: 2026-08-01

Task ID: `QGROWTH-R1_Evidence_Ledger_and_Milestone_Contract`

Status: `AUTHORING_AND_OBSERVABILITY_AUDITED_RUNTIME_BLOCKED`

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

## Wave 1 の固定境界

本 Wave は authoring と audit artifact だけを作る。

```text
evidence-ledger.json ──────┐
milestone-candidates.json ─┼─ strict validation
observability-map.json ────┤          │
synthetic fixtures ────────┘          ├─ source-manifest.json
                                      └─ conflict-and-gap-report.json
```

次は生成しない。

- production runtime bundle
- account snapshot evaluator
- renderer UI
- network fetcher
- real-account fixture

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
失敗させる。現行8件はすべて `draft` である。29 observable の local source は監査済みだが、
complete 18、partial 9、unavailable 2 であり、監査完了は runtime 利用可能を意味しない。

## Unknown と fallback

unknown state でも空画面にしない。将来の UI は最低限次を表示する。

### 今やること

状態不足時は、補給、損傷、入渠、素材安全の確認、利用可能な演習、成功確認済み遠征を案内し、
具体的出撃 route を断定しない。

### 次にやること

反潜、制空、索敵、輸送のうち、ローカルに確認できる不足カテゴリを一つ示す。能力を観測できない
場合は演習と可視の解放任務へ戻る。

### 長期目標

通常海域と攻略可能な EO を段階的に開放し、勲章・設計図と活動準備へつながる資源循環を作る。

## Synthetic fixtures

Wave 2 の pure evaluator を先に拘束するため、次の匿名 fixture を固定する。

- `unknown-state`
- `early-maps-only`
- `asw-missing`
- `resource-low`
- `map-rich-equipment-poor`
- `event-active-not-ready`

fixture は account identifier と raw payload を禁止し、非空 fallback を要求する。実アカウントの
coverage 推定には使用しない。

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
本データで上書きしない。`QUEST_STRATEGY_LINEAGE_GATE_UNRESOLVED` として downstream stop に残す。

## Commands

```bash
npm run data:quest-growth:compile
npm run data:quest-growth:verify
```

`compile` は source manifest と conflict/gap report を決定的に生成する。`verify` は checked-in artifact
との byte equality を確認する。observability audit の path、policy、全 predicate coverage も compiler
が検証する。

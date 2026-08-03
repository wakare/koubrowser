# 任務攻略カバレッジ契約

最終更新日: 2026-08-03

Task ID: `QSTRAT-COV-001_Coverage_Contract_and_Manifest_Freeze`

Status: `CONTRACT_FROZEN_RUNTIME_V2_ADOPTED`

2026-07-31 の inventory で runtime v2 の独立判断条件を満たした。denominator、
freshness、review、privacy、fallback の契約は維持し、runtime 出力と compilation mode は
policy revision 2 で stage-aware v2 へ移行する。判断記録は
[`quest-strategy-runtime-v2-decision.md`](quest-strategy-runtime-v2-decision.md) を参照。
inventory report の `runtimeV2Reasons` は判断を開始した当時の閾値証拠として保持し、
`runtimeV2Decision` は現在の policy と一致する `RUNTIME_V2_ADOPTED` とする。

## 目的

攻略推薦の実用カバレッジを、手書き combination recipe の数ではなく、版管理された
任務 objective、通常海域 route template、組合せ規則と審査履歴から構築する。
authoring データはオフラインでのみ作成・審査し、無損失で表現できる項目だけを既存
runtime schema v1 へ決定的にコンパイルする。

この契約はデータ公開、Issue #29 の解除、機能の既定有効化を承認しない。

## 固定する境界

```text
getQuestStuff / QuestGuide / curated QuestKnowledge
  -> QuestStrategyAuthoring/2alpha
  -> strict DQ / conflict / freshness validation
  -> deterministic lossless compiler
  -> existing QuestStrategyKnowledgeBundle schemaVersion 1
  -> existing signature, fallback and read-only runtime
```

- 旧 runtime bundle schema v1 は移行入力としてのみ保持する。
- runtime v2 は exact stage contribution を持ち、v1 validator を緩和しない。
- authoring compiler は `approved` だけを route-ready 入力にする。
- hard fact が `unknown` の場合は combination を拒否するが、事実ベースの fallback 表示は
  拒否しない。
- multi-stage objective の partial route は stage contribution としてだけ出力し、全 stage が
  揃うまで任務全体を covered としない。
- route signature 単位で集約し、quest power set を生成しない。
- 512 recipe 超過は hard failure とし、切り捨てない。
- runtime Wiki scraping、アカウントデータ外送、ゲーム通信変更、自動操作を行わない。

機械可読の固定値は
[`../knowledge/quest-strategy/coverage-policy.json`](../knowledge/quest-strategy/coverage-policy.json)
に置く。

## 選択任務契約

- 選択数は `1..5`。
- 1 件は単独の攻略ルートとして扱う。
- 2～5 件では co-completion と route setup の統合効果を計算する。
- 選択数を増やしても、未審査・競合・失効・withdrawn の知識を推薦へ昇格させない。

これは実コードと unit fixture の既存挙動を正式化し、旧文書の「2～5」との矛盾を解消する。

## Coverage denominator

### Primary

ID: `QSTRAT_RECURRING_NORMAL_SORTIE_V1`

同一 catalog revision 上で次をすべて満たす任務を 1 件として数える。

- cadence が daily / weekly / monthly / quarterly
- 構造化された sortie objective がある
- objective に通常海域が 1 つ以上含まれる
- event / limited / invalid ではない
- multi-stage 任務は全 stage を表現できる場合だけ route-covered とする

### Runtime snapshot

`Primary ∩ visible recommendation ∩ status != claim`

### Fallback

ID: `QSTRAT_VISIBLE_NON_CLAIM`

すべての visible non-claim recommendation を対象にする。route を生成できなくても、既存
QuestGuide の cadence、deadline、map、readiness、装備・消耗品、curated conflict を使い、
不足理由を明示する。

この fallback denominator は、既存 `QuestGuide` で情報の欠損を隠さないための契約であり、
`QuestStrategyRoute` の主選択候補、route coverage、または自動推薦への昇格条件ではない。
通常海域 planner の選択候補は visible non-claim の `ApiQuestCategory.syutugeki` に限定し、
完全 route の自動選択は `route-ready` だけに許可する。

単一アカウントの snapshot は regression fixture としてのみ使用し、母集団の coverage
推定には使わない。

## Coverage status

- `route-ready`
- `objective-only`
- `route-unreviewed`
- `conflicted`
- `unsupported-v1-multi-stage`
- `knowledge-insufficient`
- `withdrawn`

`route-ready` だけが planner の自動 route 候補になる。他の状態は事実表示へ降格し、
完全な攻略、成功、最適、必須であると表現しない。

## 品質、freshness、withdrawal

- author と approver は分離する。
- extractor/importer は `draft` だけを生成できる。
- 通常海域知識は 90 日で再審査し、365 日で hard expiry とする。
- hard evidence conflict は compilation を停止する。
- withdrawal は target revision と依存 recipe を追跡し、coverage delta を出力する。
- withdrawn、conflicted、insufficient、expired は runtime bundle に含めない。
- canonical objective から生成できる map/rank/count を strategy 側で手書き複製しない。

## Runtime v2 の独立判断条件

inventory 後、次のいずれかを満たした場合は v1 拡張を停止し、別 task で runtime v2 を
判断する。

- `v1_lossless_coverage < 80%`
- `unsupported_v1_multi_stage_ratio > 20%`
- `compiled_recipe_count > 512`
- lossy recipe なしでは primary snapshot の zero-hit を解消できない

80% / 20% は inventory 前の暫定停止閾値であり、coverage 実績の推測ではない。
denominator と inventory を固定した後に変更する場合は policy revision を上げる。

## Identity と再現性

各 compiled recipe は次を逆引きできなければならない。

```text
recipeId
  -> compilerVersion
  -> source manifest digest
  -> route template revision
  -> composability rule revision
  -> quest objective fact revision
  -> canonical source commit
  -> evidence review
```

同一意味の入力は、配列順・object key 順・host locale にかかわらず同じ output digest を
生成する。compiler は source digest、output digest、unsupported report、
withdrawal dependency report を出力する。

## 実行順

1. 本契約、policy、schema、機械 gate を固定する。
2. canonical fact inventory と v1-lossless report を生成する。
3. 審査済み pilot を作る。
4. deterministic stage-aware v2 compiler を実装する。
5. honest fallback と zero-hit regression を renderer に統合する。
6. local acceptance、production smoke、Windows installer を生成する。

本 task では 2 以降を実装せず、未審査の task fact、map template、recipe を追加しない。

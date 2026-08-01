# 新人成長ルート R7 pilot content 判断 packet

最終更新日: 2026-08-02

Task ID: `QGROWTH-R7-1_PILOT_CONTENT_AUTHORIZATION_PACKET`

Status: `CONTENT_AUTHORING_AUTHORIZED_DRAFT_ONLY`

## 目的

承認済み R7 schema を使って具体的攻略を作り始める前に、初期 authoring の件数、対象、証拠、
review 境界を固定する。project owner は固定摘要を承認し、選択済み2 family に各1件の
`draft` route を authoring した。renderer と runtime publication は引き続き未承認である。

machine-readable request は
[`r7-pilot-content-authorization-request.json`](../knowledge/quest-growth/decisions/r7-pilot-content-authorization-request.json)、
compiler report は
[`r7-pilot-content-authorization-report.json`](../knowledge/quest-growth/generated/r7-pilot-content-authorization-report.json)
とする。

## 固定した authoring 境界

- 対象 family は `expedition-resource-periodic-loop` と `anti-submarine-foundation` の2件だけ。
- route artifact は合計最大2件、各 family 最大1件。
- この gate で作成できる status は `draft` まで。
- `reviewed-concrete-route` への昇格は route 単位の別 semantic-digest approval を必要とする。
- 各 route は R6 lineage revision、route unit revision、semantic digest に固定する。
- concrete segment は claim、独立 editorial group、source digest を記録する。
- hard mechanic は読める独立 editorial group を2件以上必要とする。
- unknown、conflict、expiry は必ず非空 fallback へ落とす。

## 承認後も許可しない内容

- 選択外 family の content
- 独立 route approval なしの `reviewed` status
- renderer integration
- real-account acceptance
- runtime publication
- default enablement
- 自動操作、ゲーム通信変更、runtime Web scraping、account data export

したがって、この gate を承認してもアプリ画面に具体的 route は出ず、配布 runtime にも入らない。

## 固定摘要

- request semantic digest:
  `sha256:d2c474af9b09a959cb9e9a1532ba954e1f11da8669feb2fc5049421715a972fc`
- gate semantic digest:
  `sha256:2b0276b3f43adb54d4cce3fb831150872cc39d211fb9d87410957f08d1e434f3`
- current route artifact count: `2`（いずれも `draft`）
- runtime eligible count: `0`
- publication authorization: `R7_NOT_AUTHORIZED`

承認記録:

> 批准固定摘要 `sha256:d2c474af9b09a959cb9e9a1532ba954e1f11da8669feb2fc5049421715a972fc`
> 对应的 `r7-pilot-content-authoring`。仅允许为远征/资源循环与基础对潜各编写最多1条、合计最多2条
> draft route，并按固定的 R6 lineage、证据和独立审查规则执行。不授权 reviewed 状态、renderer、
> 实账号验收、runtime publication、默认启用或其他 route family。

## Fail-closed 条件

- 承認時点の request、schema、空 catalog、R6 approval packet の digest を approval basis として保持する。
- route count、family、status が承認境界を超えた場合は compile error とする。
- hard mechanic の独立 evidence が2 group 未満なら draft を生成しない。
- route author と approver が同一なら reviewed へ昇格できない。
- renderer gate が承認されるまでは catalog の draft をアプリ画面や runtime bundle へ接続しない。

## Authoring 済み pilot

- 遠征05「海上護衛任務」資源ループ: 日文 Wiki と舰娘百科の成功条件・所要時間・報酬を
  交差確認し、編成差分は軽巡1＋駆逐/海防3の保守的な共通条件にした。
- 1-5 3戦撤退・基礎対潜練習: 現行 1-5 分岐情報と独立した初心者向け攻略を照合し、
  `ADE/ADF`、3戦すべて単横陣、E/F後撤退、司令部Lvと先制対潜の manual gate を残した。

具体的 source snapshot は
[`evidence-snapshots.json`](../knowledge/quest-growth/r7/evidence-snapshots.json)、draft 本体は
[`route-catalog.json`](../knowledge/quest-growth/r7/route-catalog.json) に記録する。route author と
将来の approver は別 identity とし、現時点の route review fields は null のままである。

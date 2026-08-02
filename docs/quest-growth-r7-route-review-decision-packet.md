# 新人成長ルート R7 route review 判断 packet

最終更新日: 2026-08-02

Task ID: `QGROWTH-R7-2_PILOT_ROUTE_REVIEW_PACKET`

Status: `PILOT_ROUTE_AUTHORING_REVIEW_APPROVED`

## 目的

authoring 済みの2件の pilot draft を、内容、R6 lineage、具体的 evidence、currentness に固定し、
`reviewed` へ昇格できるかを project owner が独立判断するための decision-only packet とする。
project owner は 2026-08-02 に固定摘要どおり2件の authoring review を承認した。
この承認は renderer、実アカウント受入、runtime publication、default enablement のいずれも許可しない。

machine-readable request は
[`r7-pilot-route-review-request.json`](../knowledge/quest-growth/decisions/r7-pilot-route-review-request.json)、
compiler report は
[`r7-pilot-route-review-report.json`](../knowledge/quest-growth/generated/r7-pilot-route-review-report.json)
とする。

## 審査対象

1. 遠征05「海上護衛任務」資源ループ（手動確認）
   - route semantic digest:
     `sha256:05e4cdbbcbdbf7a781ba73bbe1bb3498cc7c0bab6985fef4b1cae6173acda55a`
   - R6 lineage digest:
     `sha256:5b94ab240c29f314f5a8abb83b7afa6a8ef1eacfca0d6e1311aff9ea673c5eaa`
   - independent evidence groups: `group:wikiwiki-ja`, `group:kcwiki-zh`
   - reviewBy: `2026-10-30T00:00:00.000Z`
2. 1-5 3戦撤退・基礎対潜練習（手動確認）
   - route semantic digest:
     `sha256:9b675d5c8a33b3ec974c678a3f258200324222f1e7bec1c2b2ba5e4c3512e78d`
   - R6 lineage digest:
     `sha256:563da2a96f2f4b4dbe2324939e8f5f9f3182a7bfd2b738503510342971878951`
   - independent evidence groups: `group:wikiwiki-ja`, `group:zekamashi`
   - reviewBy: `2026-09-30T00:00:00.000Z`

両 route の author は `codex-r7-pilot-author` である。approver は別 identity の
`project-owner` でなければならない。

## 固定摘要

- packet semantic digest:
  `sha256:7a3ef3fc63abbad4db8ed8d3368e9f6279a40f279363600c5e97c1d00d7631c3`
- pre-approval request raw digest:
  `sha256:78800c192174f80edb634841deefc7c64724c798084225ee6d106d67ad530752`
- recorded approval request digest:
  `sha256:fcf0710d84e65579de441443ea171751c4623e3dd18f410e5903291d166cf308`
- review target count: `2`
- current reviewed route count: `2`
- runtime eligible count: `0`
- publication authorization: `R7_NOT_AUTHORIZED`

承認記録:

> 批准固定摘要 `sha256:7a3ef3fc63abbad4db8ed8d3368e9f6279a40f279363600c5e97c1d00d7631c3`
> 对应的两条 R7 pilot route authoring review，并分别绑定路线摘要
> `sha256:05e4cdbbcbdbf7a781ba73bbe1bb3498cc7c0bab6985fef4b1cae6173acda55a` 与
> `sha256:9b675d5c8a33b3ec974c678a3f258200324222f1e7bec1c2b2ba5e4c3512e78d`。
> 仅授权将这两条路线从 draft 升为 reviewed；不授权修改路线内容、renderer、实账号验收、
> runtime publication、默认启用或其他 route family。

## Fail-closed 条件

- route 内容变更后 semantic digest 不一致，必须重新 authoring 和审查。
- route、packet author 与 approver 不能是同一 identity。
- lineage revision/digest 或 evidence source/group/digest 改变时，本 packet 失效。
- reviewBy 到期或 currentness window 无效时，不得升为 `reviewed`。
- catalog 中の2 route は固定摘要と一致する場合だけ `reviewed` を維持できる。
- route review 承認後も、renderer と runtime publication は後続の独立 gate を必要とする。

# 新人成長ルート R7 renderer integration 判断 packet

最終更新日: 2026-08-02

Task ID: `QGROWTH-R7-3_RENDERER_OPT_IN_DECISION_PACKET`

Status: `OWNER_DECISION_REQUIRED_RENDERER_INTEGRATION_NOT_AUTHORIZED`

## 目的

承認済みの2 route を「成長攻略チェック」に表示する実装範囲を、UI 実装前に固定する。
本 packet の生成だけでは renderer integration を許可せず、画面、runtime bundle、既定値を変更しない。

machine-readable request は
[`r7-renderer-integration-request.json`](../knowledge/quest-growth/decisions/r7-renderer-integration-request.json)、
compiler report は
[`r7-renderer-integration-report.json`](../knowledge/quest-growth/generated/r7-renderer-integration-report.json)
とする。

## 対象 route と focus

1. `resources`
   - 遠征05「海上護衛任務」資源ループ（手動確認）
   - route digest:
     `sha256:05e4cdbbcbdbf7a781ba73bbe1bb3498cc7c0bab6985fef4b1cae6173acda55a`
2. `asw`
   - 1-5 3戦撤退・基礎対潜練習（手動確認）
   - route digest:
     `sha256:9b675d5c8a33b3ec974c678a3f258200324222f1e7bec1c2b2ba5e4c3512e78d`

対象はこの2件までとし、どちらも `manual-check-route` として扱う。選択中の focus に一致しない route、
focus 未選択、3件目、未審査 route は表示対象にしない。

## UI 契約

- 既存の `QuestGrowthCheck.vue` 内に分離した route section を置く。
- section は初期状態で閉じ、利用者が明示的に展開した場合だけ内容を表示する。
- 展開状態と route 選択は保存しない。再表示時は閉じた状態へ戻す。
- title、summary、適用条件 checklist、艦隊・装備条件、分岐条件、手動手順、fallback、
  review currentness だけを表示対象とする。
- `reviewed route`、`manual confirmation required`、`selected focus candidate` を明示する。
- ローカル情報が不足していても route の適用可否を推測せず、人工確認 checklist として表示する。
- 既存の成長確認項目と非 route fallback は常に利用可能なまま残す。

次の断定は禁止する。

- 現在のアカウントで攻略可能
- 現在すぐ実行可能
- 最適 route
- 成功保証
- すべての適用条件を満たしている

## Fail-closed 条件

次の場合、具体的 route を隠して既存 fallback または知識再審査案内へ戻す。

- status が `reviewed` ではない
- route semantic digest が固定摘要と一致しない
- approver、reviewedAt、approvalDigest が無効
- `reviewBy` または `validUntil` に到達
- focus が未選択または route family と不一致
- output class が未対応
- route 件数が2件を超える

## 実装・受入境界

- production 変更は `src/common` と `src/renderer` に限定する。
- `src/main`、`src/preload`、新規 bridge、DB、network、storage を追加しない。
- game communication、game action、raw account data を route model から参照しない。
- layout、filter、expiry、digest mismatch は匿名 synthetic fixture だけで検証する。
- 実アカウント受入、runtime publication、default enablement は後続 gate のままにする。

## 固定摘要

- renderer request semantic digest:
  `sha256:840a73bb1f72683756774b2a5e4403d0f91dc23410a67f4c5ed5dc417bb98363`
- request raw digest:
  `sha256:4401e1a28de114cef4cd583e26d105e30bb1b600d1c59d8775545588822383b7`
- renderer gate semantic digest:
  `sha256:c2f7ce617eaaf00bb8aded393734af42bbe75a8d3a9480ea31f4b31a7f1f6be3`
- reviewed route count: `2`
- renderer eligible route count: `0`
- runtime eligible count: `0`
- publication authorization: `R7_NOT_AUTHORIZED`

承認する場合の推奨文面:

> 批准固定摘要 `sha256:840a73bb1f72683756774b2a5e4403d0f91dc23410a67f4c5ed5dc417bb98363`
> 对应的 `r7-renderer-opt-in-integration`。仅授权在“成长攻略检查”内实现上述两条 reviewed route
> 的默认关闭、会话内不持久化、按 `resources` / `asw` focus 过滤的人工确认展示，并仅使用匿名
> synthetic fixtures 验证。不得修改路线内容，不授权 main/preload/网络/数据库/存储依赖、实账号验收、
> runtime publication、默认启用或其他 route family。

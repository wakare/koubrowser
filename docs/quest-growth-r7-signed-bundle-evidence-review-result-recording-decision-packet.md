# 新人成長ルート R7 signed bundle evidence review result recording 判断 packet

最終更新日: 2026-08-02

Task ID: `QGROWTH-R7-SIGNED-BUNDLE-EVIDENCE-REVIEW-RESULT-RECORDING`

Status: `OWNER_DECISION_REQUIRED_R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_RESULT_RECORDING`

## 目的

既に1回だけ完了した offline / read-only review の脱敏 PASS 結果を、再実行や入力再読込を行わず、
governance record として1件だけ保存できるかを project owner が判断する。前 gate は結果保存を禁止していたため、
本 packet 自体は結果値を保存せず、保存可能な field と変更可能な path だけを固定する。

machine-readable request は
[`r7-signed-bundle-evidence-review-result-recording-request.json`](../knowledge/quest-growth/decisions/r7-signed-bundle-evidence-review-result-recording-request.json)、
compiler report は
[`r7-signed-bundle-evidence-review-result-recording-report.json`](../knowledge/quest-growth/generated/r7-signed-bundle-evidence-review-result-recording-report.json)
とする。

## 承認後に許可すること

- 既に観測済みの review 結果を1件だけ記録する。
- 保存する値は既存 strict schema の公開10 field だけとする。
- 更新可能な repository path は request、生成 report、source manifest、conflict report の4件だけとする。
- `redactedAcceptanceStatus` は `review-passed` でなければならない。

承認後も signed bundle directory と public key file は読み直さず、review harness を再実行しない。

## 保存可能な10 field

1. `dataVersion`
2. `publishedAt`
3. `manifestSha256`
4. `questKnowledgeSha256`
5. `publicKeySha256`
6. `fileCount`
7. `payloadBytes`
8. `routeCount`
9. `requiredCheckCount`
10. `redactedAcceptanceStatus`

private key、passphrase、credential、public key bytes、signature bytes、bundle bytes、path、URL、raw log、
screenshot、account data は保存しない。

## 固定境界

- completed execution count: `1`
- maximum record count: `1`
- route count: `2`
- allowed evidence field count: `10`
- prohibited field count: `15`
- authorized repository path count: `4`
- required check count: `10`
- runtime eligible count: `0`
- execution rerun / input reread: 不可
- staging acceptance / runtime publication / default enablement: 不可
- installer build: 不要

## 固定摘要

- semantic digest:
  `sha256:2f0dd74cbb96f119f89bd048b54a6fc98e19a3dd3db95ef8cab69e227cfd555d`
- request raw digest:
  `sha256:16e507c8f914f16dfdd45d2a116c68c92362ba69451d53354217edcc273de0b7`
- prior execution semantic digest:
  `sha256:dad3d775d17865f0f8f78000af1adc8b1d204e0d820e483638cc0c202d10c177`

推奨承認文面:

> 批准固定摘要 `sha256:2f0dd74cbb96f119f89bd048b54a6fc98e19a3dd3db95ef8cab69e227cfd555d`
> 对应的 `r7-signed-bundle-evidence-review-result-recording` revision 1。仅授权将此前已完成的一次
> offline、read-only 审查所观察到的脱敏 PASS 结果记录一次，且只允许固定10个公开 evidence 字段和4个
> governance artifact path。不得重新运行 harness，不得重新读取 signed bundle 或 public key，不得保存 path、
> raw output、public key bytes、signature bytes、bundle bytes、URL、secret、credential、account data 或 screenshot。
> 必须保持 runtime eligible count 0、publication 与默认启用未授权；不授权 staging acceptance、runtime
> publication、default enablement、其他 route family、游戏通信修改或安装包构建。

## 承認後の次 gate

結果記録後も production release は自動許可されない。real HTTPS staging URL、trust configuration、release
record、staging acceptance、runtime publication、default enablement はそれぞれ別 gate とする。

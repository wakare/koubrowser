# 新人成長ルート R7 signed bundle evidence review execution 判断 packet

最終更新日: 2026-08-02

Task ID: `QGROWTH-R7-SIGNED-BUNDLE-EVIDENCE-REVIEW-EXECUTION`

Status: `OWNER_DECISION_REQUIRED_R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_EXECUTION`

## 目的

authoring 済みの固定 harness を変更せず、外部 release author が生成した signed bundle と Ed25519 公開鍵を
1回だけ offline / read-only で検証する execution gate を固定する。出力は承認済み10 field の脱敏 summary
だけとし、実 private key、passphrase、credential、URL、外部 endpoint、account data を扱わない。

machine-readable request は
[`r7-signed-bundle-evidence-review-execution-request.json`](../knowledge/quest-growth/decisions/r7-signed-bundle-evidence-review-execution-request.json)、
compiler report は
[`r7-signed-bundle-evidence-review-execution-report.json`](../knowledge/quest-growth/generated/r7-signed-bundle-evidence-review-execution-report.json)
とする。

## 固定入力

project owner は次の2つの local path を明示的に提供する。Codex は path を探索せず、診断や結果へ path を
出力しない。

1. public signed release bundle directory
2. public Ed25519 verification key file

入力に private key、passphrase、credential、account data が含まれる疑いがある場合は開始前に abort する。
URL 解決、download、staging / production endpoint への接続は行わない。

## 許可する1回限りの execution

- fixed harness digest:
  `sha256:2f8a916cb066840ce863fe6059fa04e05bd793bf3f47bf277162e399026d1554`
- result schema digest:
  `sha256:20fb4b269ca49b680f669cfa317222de0485a1e84a863979e009a1ddd8b25139`
- candidate: `r7.candidate.20260802.1`
- route count: `2`
- maximum executions: `1`
- mode: `single-offline-readonly-redacted-review`
- repository / bundle / public key mutation: 不可
- output / raw log / screenshot persistence: 不可

## 公開可能な結果

結果は `dataVersion`、`publishedAt`、`manifestSha256`、`questKnowledgeSha256`、`publicKeySha256`、
`fileCount`、`payloadBytes`、`routeCount`、`requiredCheckCount`、`redactedAcceptanceStatus` の10 field
だけとする。public key bytes、signature bytes、bundle bytes、path、URL、raw log は出力しない。

## 役割分離

1. `external-release-author`: signed bundle を外部で作成する。Codex は担当しない。
2. `independent-bundle-evidence-reviewer`: Codex は固定 harness の reviewer だけを担当できる。
3. `staging-acceptance-operator`: review 結果を後続 gate で扱う。今回の execution は担当しない。

3 role は別主体とし、reviewer は private key にアクセスしない。

## 必須10チェック

1. Ed25519 signature と全 file hash が既存 verifier を通過する。
2. growth route が固定2 reviewed route と完全一致する。
3. public key bytes を出力せず fingerprint を再計算する。
4. 結果が strict 10-field schema に一致する。
5. 禁止15 field が結果に存在しない。
6. offline / read-only で結果を保存しない。
7. release author、reviewer、staging operator が分離される。
8. secret、URL、account data にアクセスしない。
9. publication、default enablement、runtime eligibility を変更しない。
10. game communication 保護3 path の digest が不変である。

## Abort 条件

- owner が2つの入力 path を明示していない
- secret、credential または account data の疑いがある
- approval basis、signature、file hash、candidate、route binding の不一致
- network / URL 解決が必要
- 10 field だけの脱敏出力を保証できない
- input、repository、game state または game communication の mutation が必要

## 固定摘要

- semantic digest:
  `sha256:dad3d775d17865f0f8f78000af1adc8b1d204e0d820e483638cc0c202d10c177`
- request raw digest:
  `sha256:a3b90552a94601c2d7677da458dc228c7c8d38183fe2738c140c98c68522b131`
- maximum execution count: `1`
- required input count: `2`
- route count: `2`
- public evidence field count: `10`
- prohibited output field count: `15`
- required check count: `10`
- runtime eligible count: `0`

推奨承認文面:

> 批准固定摘要 `sha256:dad3d775d17865f0f8f78000af1adc8b1d204e0d820e483638cc0c202d10c177`
> 对应的 `r7-signed-bundle-evidence-review-execution` revision 1。仅授权 project owner 明确提供的 public signed
> bundle directory 与 public Ed25519 verification key file，沿用固定 harness 执行最多1次 offline、read-only、
> 脱敏审查，并仅输出固定10个公开 evidence 字段。Codex 仅可作为 independent reviewer，不得处理 private key、
> passphrase、credential、account data，不得输出或保存 path、public key bytes、signature bytes、bundle bytes、
> raw log 或 screenshot，不得访问 URL 或外部 endpoint，不得修改 bundle、repository、game state 或游戏通信。
> 不授权 staging acceptance、runtime publication、default enablement、其他 route family 或安装包构建。

## 批准后仍需 owner 提供

批准固定摘要不等于输入可用。执行前 project owner 仍需明确提供上述2个 local path，并确认它们是可公开审查的
release artifact，不含任何 private key、passphrase、credential 或 account data。

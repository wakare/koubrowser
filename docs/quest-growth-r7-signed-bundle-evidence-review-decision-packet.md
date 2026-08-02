# 新人成長ルート R7 signed bundle evidence review authoring 判断 packet

最終更新日: 2026-08-02

Task ID: `QGROWTH-R7-SIGNED-BUNDLE-EVIDENCE-REVIEW-AUTHORING`

Status: `R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_AUTHORED_REAL_REVIEW_NOT_AUTHORIZED`

## 目的

承認済み staging evidence contract の次段として、実際の signed bundle を審査する前に、署名・file hash・
固定2 route・公開 fingerprint を offline で検証し、脱敏済み10 field だけを返す review harness の authoring
範囲を固定する。本 gate は匿名・一時的な synthetic Ed25519 fixture だけを許可申請し、実 bundle、実公開鍵、
秘密鍵、URL、外部 endpoint、staging acceptance または publication の実行を許可しない。

machine-readable request は
[`r7-signed-bundle-evidence-review-authoring-request.json`](../knowledge/quest-growth/decisions/r7-signed-bundle-evidence-review-authoring-request.json)、
compiler report は
[`r7-signed-bundle-evidence-review-authoring-report.json`](../knowledge/quest-growth/generated/r7-signed-bundle-evidence-review-authoring-report.json)
とする。

## 承認根拠

- staging evidence semantic digest:
  `sha256:17bb4894a614e0f07157a3aa38a956d3d86b586a134fb2e301a249da4e4b63b3`
- staging evidence status: `R7_STAGING_EVIDENCE_AUTHORED_REAL_EVIDENCE_NOT_AUTHORIZED`
- candidate version: `r7.candidate.20260802.1`
- candidate canonical digest:
  `sha256:6f1c952ba5030a46e6cf437d740991e5a5eb99cae337cab6db2d1fcf77636a8c`
- candidate review: `approved`
- existing bundle author / verifier と release record author / verifier の digest を固定
- route count: `2`
- runtime eligible count: `0`

## 申請する authoring

変更可能 path は次の4件だけとする。

1. `knowledge/quest-growth/r7/signed-bundle-evidence-review.schema.json`
2. `knowledge/quest-growth/r7/fixtures/signed-bundle-evidence-review-anonymous.json`
3. `scripts/quest-growth-r7-signed-bundle-evidence-review.js`
4. `src/common/__tests__/quest_growth_signed_bundle_evidence_review.test.ts`

review harness は既存の Ed25519 bundle verifier を再利用し、匿名 fixture では test 中だけ一時的な synthetic
key pair と signed bundle を作る。private key を永続化せず、network API を持たず、結果に path、URL、public
key bytes、signature bytes または raw log を含めない。

## 許可する公開 evidence

出力は次の10 field だけとする。

- `dataVersion`
- `publishedAt`
- `manifestSha256`
- `questKnowledgeSha256`
- `publicKeySha256`
- `fileCount`
- `payloadBytes`
- `routeCount`
- `requiredCheckCount`
- `redactedAcceptanceStatus`

## 禁止する出力

private key、passphrase、credential、token、public key bytes、manifest / staging / production URL、local path、
account data、personal identifier、raw log、screenshot、bundle bytes、signature bytes の15 field を schema と
validator で拒否する。

## 役割分離

1. `external-release-author`: 将来の別 execution gate で実 bundle を作る。Codex は担当しない。
2. `independent-bundle-evidence-reviewer`: private key に触れず bundle と公開鍵を offline 検証する。
3. `staging-acceptance-operator`: review 済み evidence だけを後続の staging gate で使う。

3 role は別主体とし、release author は自身の evidence を承認しない。

## 必須10チェック

1. strict result schema が未知 field を拒否する。
2. 既存 verifier で Ed25519 signature と全 file hash を検証する。
3. growth route が承認済み candidate の固定2 route と一致する。
4. public key bytes を出力せず fingerprint を再計算する。
5. 承認済み公開10 field だけを出力する。
6. secret、URL、path、account、personal、raw、signature field を拒否する。
7. release author、reviewer、staging operator を分離する。
8. offline / read-only で、raw log と local path を出力しない。
9. 実 review、publication、default enablement、runtime eligibility を許可しない。
10. game communication 保護3 path の digest が不変である。

## 停止条件

- authorized path の追加
- 実 signed bundle / 実公開鍵・fingerprint の使用
- 実 private key、passphrase、credential の処理
- 実 URL または外部 endpoint の使用
- staging acceptance、runtime publication、default enablement
- route content、production renderer / main / preload、ゲーム通信の変更
- installer build

## 固定摘要

- semantic digest:
  `sha256:eb599466cdcf580d6a4fabad4439a274ca483d5f1d6888f80f3d467ed4ce2080`
- request raw digest:
  `sha256:b986f449f838704b41f49743acf12c0596542816189e86e7332bf8fe42f26be7`
- authorized path count: `4`
- route count: `2`
- public evidence field count: `10`
- prohibited output field count: `15`
- required role count: `3`
- required check count: `10`
- runtime eligible count: `0`

## 承認・実装結果

project owner は semantic digest
`sha256:eb599466cdcf580d6a4fabad4439a274ca483d5f1d6888f80f3d467ed4ce2080` を明示承認した。
固定4 path は commit `948dcb772ba21cf6fbb127d9ce249a4006fd1f03` で実装し、匿名・一時的な
Ed25519 fixture による10 check と全1289 test は PASS した。authoring authorization は `consumed`、
runtime eligible count は0である。実 signed bundle、実公開鍵・fingerprint、秘密鍵、URL、外部 endpoint、
staging acceptance、runtime publication、default enablement は引き続き未承認である。

承認時の固定文面:

> 批准固定摘要 `sha256:eb599466cdcf580d6a4fabad4439a274ca483d5f1d6888f80f3d467ed4ce2080`
> 对应的 `r7-signed-bundle-evidence-review-authoring` revision 1。仅授权 packet 固定4个路径，为当前两条
> reviewed route 编写 strict result schema、offline review harness 和匿名 ephemeral Ed25519 signed fixture；
> 固定10个公开 evidence 字段、15个禁止输出字段、3个独立角色和10项检查。匿名测试私钥不得持久化，必须保持
> runtime eligible count 0、publication 与默认启用未授权。不得使用或审查真实 signed bundle、真实公钥或
> fingerprint，不得处理真实私钥、passphrase、credential，不得写入真实 URL、连接外部 endpoint、执行 staging
> acceptance、runtime publication、default enablement、其他 route family、游戏通信修改或安装包构建。

## 批准后仍需独立判断

1. project owner / external release author 提供 signed bundle 与公开键后的单次 offline 脱敏审查
2. 実在 HTTPS staging URL と release record review
3. 隔離 staging acceptance execution
4. production deployment / runtime publication
5. default enablement と installer release

# 新人成長ルート R7 staging evidence authoring 判断 packet

最終更新日: 2026-08-02

Task ID: `QGROWTH-R7-STAGING-EVIDENCE-AUTHORING`

Status: `R7_STAGING_EVIDENCE_AUTHORED_REAL_EVIDENCE_NOT_AUTHORIZED`

## 目的

承認済み staging configuration contract の次段として、将来の signed bundle review と HTTPS staging
acceptance に必要な公開 evidence、役割分離、脱敏出力を strict schema と匿名 fixture で固定する authoring
範囲を申請する。本 gate は evidence の形式だけを対象とし、鍵、署名、実在 URL、外部 endpoint、実際の
staging acceptance または runtime publication を許可しない。

machine-readable request は
[`r7-staging-evidence-authoring-request.json`](../knowledge/quest-growth/decisions/r7-staging-evidence-authoring-request.json)、
compiler report は
[`r7-staging-evidence-authoring-report.json`](../knowledge/quest-growth/generated/r7-staging-evidence-authoring-report.json)
とする。

## 承認根拠

- staging configuration semantic digest:
  `sha256:3873731e2d84a85dde4685da9625fe2e4ed072f41c0de8973fa5c94e7e8cec93`
- staging configuration status: `R7_STAGING_CONFIGURATION_AUTHORING_APPROVED`
- candidate version: `r7.candidate.20260802.1`
- candidate canonical digest:
  `sha256:6f1c952ba5030a46e6cf437d740991e5a5eb99cae337cab6db2d1fcf77636a8c`
- route count: `2`
- runtime eligible count: `0`
- publication / default enablement: `R7_NOT_AUTHORIZED`

## 申請する authoring

変更可能 path は次の4件だけとする。

1. `knowledge/quest-growth/r7/staging-evidence.schema.json`
2. `knowledge/quest-growth/r7/fixtures/staging-evidence-anonymous.json`
3. `scripts/quest-growth-r7-staging-evidence.js`
4. `src/common/__tests__/quest_growth_staging_evidence.test.ts`

schema と validator は固定 candidate、固定 staging configuration digest、固定2 route を必須にする。
匿名 fixture は reserved `.invalid` placeholder と synthetic SHA-256 値だけを使用し、外部接続を行わない。

## 許可する公開 evidence

次の10 field だけを evidence record に許す。

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

`publicKeySha256` は公開鍵 bytes ではなく fingerprint だけを表す。この gate の fixture 値は synthetic とし、
実際の fingerprint は別 gate まで使用しない。

## 禁止する evidence

private key、passphrase、credential、token、public key bytes、manifest URL、local path、account data、
personal identifier、raw log、screenshot を schema レベルで拒否する。

## 役割分離

次の3 role は別主体とする。

1. `external-release-author`: 将来の別 gate で審査済み入力から bundle を作成する主体
2. `independent-evidence-reviewer`: private key に触れず、公開 evidence を再計算する主体
3. `staging-acceptance-operator`: review 済み evidence だけを使って staging acceptance を行う主体

Codex は release author を引き受けず、private key / passphrase を扱わない。release author は自分で staging
publication を実行せず、reviewer と operator は private key にアクセスしない。

## 必須10チェック

1. strict schema が未知 field を拒否する。
2. evidence が承認済み candidate と staging configuration に結合される。
3. 固定2 reviewed route だけを受理する。
4. 許可済み公開 field だけを受理する。
5. secret、URL、path、account、personal field を拒否する。
6. 3 role が別主体である。
7. reviewer が private key なしで evidence を再計算する。
8. endpoint 表現は reserved `.invalid` placeholder だけである。
9. publication、default enablement、runtime eligibility を許可しない。
10. game communication 保護3 path の digest が不変である。

## 停止条件

実装中に次のいずれかが必要になった場合は停止する。

- authorized path の追加
- 実在 fingerprint、公開鍵、秘密鍵、passphrase、credential
- 実在 staging / production URL または外部接続
- signed bundle の生成
- staging acceptance の実行
- runtime publication または default enablement
- route content、renderer、main / preload production、ゲーム通信の変更
- installer build

## 固定摘要

- semantic digest:
  `sha256:17bb4894a614e0f07157a3aa38a956d3d86b586a134fb2e301a249da4e4b63b3`
- request raw digest:
  `sha256:36e1714c265cbf2f80e83f5dd1ac709024d0252df07f1cb78a3e6711046a96d0`
- authorized path count: `4`
- allowed public evidence field count: `10`
- prohibited evidence field count: `11`
- required role count: `3`
- required check count: `10`
- runtime eligible count: `0`

推奨承認文面:

> 批准固定摘要 `sha256:17bb4894a614e0f07157a3aa38a956d3d86b586a134fb2e301a249da4e4b63b3`
> 对应的 `r7-staging-evidence-authoring` revision 1。仅授权固定4个路径，为当前两条 reviewed route
> 编写严格 evidence schema、offline validator 和匿名 synthetic fixture，固定10个允许公开字段、11个禁止字段、
> 3个相互独立角色及10项验证；必须保持 runtime eligible count 0、默认关闭和 publication 未授权。
> 不得处理真实公钥/fingerprint、私钥、passphrase、credential，签名 bundle，写入真实 URL，连接外部
> staging/production endpoint，执行 staging acceptance、runtime publication、default enablement、其他 route
> family、游戏通信修改或安装包构建。

## 批准后仍需独立判断

project owner は固定摘要を明示承認し、固定4 path の最終実装を commit
`6082e74f8445953bd762ce1549565c819c03aca9` で完了した。strict schema、offline validator、匿名 synthetic
fixture の10 check は PASS し、authoring authorization は `consumed` となった。実鍵・fingerprint、実在 URL、
signed bundle、staging acceptance、runtime publication、default enablement は未承認で、runtime eligible count は
0のままである。

authoring と匿名 fixture PASS 後も、次を別 gate とする。

1. 実際の signed bundle と公開 fingerprint evidence review
2. 実在 HTTPS staging URL と release record review
3. 一回限りの隔離 staging acceptance execution
4. production deployment configuration
5. runtime publication execution
6. default enablement と installer release

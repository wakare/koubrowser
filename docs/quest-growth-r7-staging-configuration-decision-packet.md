# 新人成長ルート R7 staging configuration authoring 判断 packet

最終更新日: 2026-08-02

Task ID: `QGROWTH-R7-STAGING-CONFIGURATION-AUTHORING`

Status: `R7_STAGING_CONFIGURATION_AUTHORING_APPROVED`

## 目的

承認済みの未署名 candidate `r7.candidate.20260802.1` を、将来の HTTPS staging acceptance
へ安全に接続するための configuration schema、offline validator、匿名 fixture の境界を固定する。
この gate は staging configuration の設計審査だけを対象とし、鍵、署名済み bundle、実在 URL、外部
endpoint、runtime publication を扱わない。

machine-readable request は
[`r7-staging-configuration-authoring-request.json`](../knowledge/quest-growth/decisions/r7-staging-configuration-authoring-request.json)、
compiler report は
[`r7-staging-configuration-authoring-report.json`](../knowledge/quest-growth/generated/r7-staging-configuration-authoring-report.json)
とする。

## 固定 candidate

- candidate version: `r7.candidate.20260802.1`
- candidate canonical digest:
  `sha256:6f1c952ba5030a46e6cf437d740991e5a5eb99cae337cab6db2d1fcf77636a8c`
- candidate review semantic digest:
  `sha256:4e0d52638b60b90e2aec0bfdc9f9c2eaca500d4c32751245e649a5e43adac94c`
- route count: `2`
- route 1: `route:expedition-05-resource-loop:draft-1`
- route 2: `route:1-5-basic-asw-three-battle:draft-1`
- candidate review status: `approved`
- runtime eligible count: `0`

## 起草済み artifact

project owner が許可した draft artifact は次の4件だけである。

1. `knowledge/quest-growth/r7/staging-configuration.schema.json`
2. `knowledge/quest-growth/r7/fixtures/staging-configuration-anonymous.json`
3. `scripts/quest-growth-r7-staging-configuration.js`
4. `src/common/__tests__/quest_growth_staging_configuration.test.ts`

implementation commit は `1ce9d17064f852c0c10b19d99bdc12bd7406d628` である。

## schema と匿名 fixture の境界

- JSON Schema draft 2020-12 を使用し、全 object を `additionalProperties: false` とする。
- route binding は固定2件、固定順序、固定 semantic digest、status `reviewed` だけを許す。
- URL は予約済み `.invalid` host
  `https://r7-staging.invalid/data/manifest.json` だけを fixture として許す。
- trust algorithm は contract label `Ed25519` だけを持つが、公開鍵、秘密鍵、fingerprint 値は持たない。
- key material と fingerprint は `absent-separate-gate-required` に固定する。
- external connection、publication、default enablement は `false`、runtime eligible count は `0` とする。
- renderer の状態は session-only、fallback は `bundled-opt-in-catalog` のままとする。

## 必須9チェック

1. strict schema が未知 field を拒否する。
2. 固定2 reviewed route 以外を拒否する。
3. candidate version と canonical digest の drift を拒否する。
4. `.invalid` placeholder 以外の URL を拒否する。
5. key material または fingerprint 値の追加を拒否する。
6. external connection または publication authorization を拒否する。
7. default enablement または runtime eligible count の増加を拒否する。
8. session-only と bundled fallback の変更を拒否する。
9. game communication 保護3 path の digest drift を拒否する。

draft validator test は `9/9`、full test は `1259/1259`、typecheck と既存 quest-growth compile check は
PASS した。

## 固定摘要

- semantic digest:
  `sha256:3873731e2d84a85dde4685da9625fe2e4ed072f41c0de8973fa5c94e7e8cec93`
- request raw digest:
  `sha256:b3281195221d8955c8e718903203562dcba15c41daa2e7702b903bc07bc48299`
- draft artifact count: `4`
- required check count: `9`
- route count: `2`
- runtime eligible count: `0`

推奨承認文面:

> 批准固定摘要 `sha256:3873731e2d84a85dde4685da9625fe2e4ed072f41c0de8973fa5c94e7e8cec93`
> 对应的 `r7-staging-configuration-authoring` revision 1。仅确认固定4个 draft artifact、两条
> reviewed route、严格 closed schema、保留域名 `.invalid` placeholder、无密钥匿名 fixture 和9项离线
> 验证，并允许将该 configuration authoring review 标记为 approved。必须保持默认关闭、session-only、
> bundled fallback 和 runtime eligible count 0；不得处理公钥或私钥、fingerprint 值、credential，
> 不得签名 bundle、写入真实 staging/production URL、连接外部 endpoint、执行 runtime publication、
> default enablement、其他 route family、游戏通信修改或安装包构建。

## 批准后仍需独立判断

本摘要获批也只批准 configuration contract，不批准真实 staging。以下事项必须分别固定证据并重新审批。

1. 公开键 fingerprint と別経路照合結果
2. 審査済み candidate bytes と一致する署名済み bundle
3. credential を含まない実在 HTTPS staging URL
4. release record と独立 bundle review
5. 隔離 profile の HTTPS staging acceptance 実行
6. runtime publication execution
7. production URL / public key の正式組み込み
8. default enablement と installer release

project owner は `2026-08-02T11:48:01.276Z` に semantic digest
`sha256:3873731e2d84a85dde4685da9625fe2e4ed072f41c0de8973fa5c94e7e8cec93` を明示承認した。
configuration authoring review は `approved` とするが、鍵、署名、実在 URL、外部 endpoint、runtime
publication、default enablement、installer build は引き続き未承認である。

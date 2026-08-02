# 新人成長ルート R7 publication candidate review authoring 判断 packet

最終更新日: 2026-08-02

Task ID: `QGROWTH-R7-PUBLICATION-CANDIDATE-REVIEW-AUTHORING`

Status: `R7_PUBLICATION_CANDIDATE_REVIEW_APPROVED`

## 目的

匿名検証済みの runtime publication authoring から、固定2 route を参照する canonical candidate payload と
独立 review record を作成する範囲を固定する。この gate は署名前の内容審査だけを対象とする。
schema token `R7_RUNTIME_SIGNED_CANDIDATE` は既存 validator との互換識別子であり、署名済み・公開許可済みを
意味しない。

machine-readable request は
[`r7-publication-candidate-review-request.json`](../knowledge/quest-growth/decisions/r7-publication-candidate-review-request.json)、
compiler report は
[`r7-publication-candidate-review-report.json`](../knowledge/quest-growth/generated/r7-publication-candidate-review-report.json)
とする。

## 承認根拠

- audited base commit: `d96d5d20f9fa3f3cb37eb6ceceeef5c466003502`
- runtime authoring semantic digest:
  `sha256:580d7002173588b74d1e6327adf4235a20eeb12477d43689a9599adb86b42104`
- runtime authoring status: `R7_RUNTIME_PUBLICATION_AUTHORING_IMPLEMENTED_ANONYMOUSLY_VERIFIED`
- implementation commit: `221a1643730ba6da4dee831602ea7c06682f4632`
- candidate route count: `2`
- runtime eligible count: `0`
- publication / default enablement: `R7_NOT_AUTHORIZED`

## 許可を申請する authoring

候補 version `r7.candidate.20260802.1` に、次の2 binding をいずれも `reviewed` として固定する。

1. `route:expedition-05-resource-loop:draft-1` —
   `sha256:05e4cdbbcbdbf7a781ba73bbe1bb3498cc7c0bab6985fef4b1cae6173acda55a`
2. `route:1-5-basic-asw-three-battle:draft-1` —
   `sha256:9b675d5c8a33b3ec974c678a3f258200324222f1e7bec1c2b2ba5e4c3512e78d`

変更可能 path は次の4件だけとする。

1. `knowledge/quest-growth/r7/runtime-publication-candidate.json`
2. `knowledge/quest-growth/reviews/r7-runtime-publication-candidate-review.json`
3. `scripts/quest-growth-r7-publication-candidate.js`
4. `src/common/__tests__/quest_growth_publication_candidate.test.ts`

authoring では strict schema、canonical digest、route digest/currentness、author と reviewer の分離を検査する。
reviewer role は `project-owner` とし、candidate の最終 approval は生成後の別固定摘要に分離する。

## 明示的に許可しないもの

- bundle/manifest 署名、秘密鍵・credential の処理
- production manifest または payload の生成
- production URL、公鍵、fingerprint、distribution endpoint の設定・接続
- runtime publication、default enablement、installer publication
- route content、withdrawal status、他 route family の変更
- 実アカウント実行、ゲーム通信変更、自動ゲーム操作

## 固定摘要

- semantic digest:
  `sha256:bc9d096f70338ad46de385ca9b1855d291956a8c6984748a7843836616244d33`
- request raw digest:
  `sha256:c81cc0e345169cd0ed2e43bfa56478178fdab31a4c4eaaf625bd94ab6b3700e9`
- candidate route count: `2`
- authorized path count: `4`
- independent check count: `8`
- signature mode: `none-canonical-payload-only`
- runtime eligible count: `0`

推奨承認文面:

> 批准固定摘要 `sha256:bc9d096f70338ad46de385ca9b1855d291956a8c6984748a7843836616244d33`
> 对应的 `r7-publication-candidate-review-authoring` revision 1。仅授权 packet 固定的4个路径，
> 为固定两条 reviewed route 生成未签名 canonical candidate payload、严格 validator 与独立 review record；
> candidate version 固定为 `r7.candidate.20260802.1`，route 内容、digest 和 status 不得修改，最终 review
> approval 必须另用固定摘要。不授权 bundle/manifest 签名、私钥或凭据处理、production payload/URL/公钥、
> 真实分发端点、runtime publication、默认启用、实账号执行、其他 route family、游戏通信修改或安装包发布。

## 批准后仍需独立判断

1. candidate payload 与独立 review result 的固定摘要 approval
2. staging/production manifest URL、公鍵、fingerprint と HTTPS acceptance
3. bundle signing と runtime publication execution
4. default enablement release decision

project owner は `2026-08-02T10:53:39.949Z` に semantic digest
`sha256:bc9d096f70338ad46de385ca9b1855d291956a8c6984748a7843836616244d33` を明示承認した。
固定4 path の未署名 candidate と独立 review record authoring だけが authorized であり、署名、production
payload、runtime publication、default enablement、installer publication は未承認である。

## authoring result と owner review 摘要

- implementation commit: `14a60d18801ace55fc6334496f87bfccd85ce48d`
- candidate canonical digest:
  `sha256:6f1c952ba5030a46e6cf437d740991e5a5eb99cae337cab6db2d1fcf77636a8c`
- independent review semantic digest:
  `sha256:4e0d52638b60b90e2aec0bfdc9f9c2eaca500d4c32751245e649a5e43adac94c`
- candidate route count: `2`
- required check count: `8`
- candidate validator tests: `8`
- full tests: `1245`
- signature mode: `none-canonical-payload-only`
- review status: `approved`

次の owner review 推奨承認文面:

> 批准固定 candidate review 摘要
> `sha256:4e0d52638b60b90e2aec0bfdc9f9c2eaca500d4c32751245e649a5e43adac94c`
> 对应的 `r7-runtime-publication-candidate` version `r7.candidate.20260802.1`。确认 candidate 仅包含固定
> 两条 reviewed route、8项审查证据及未签名 canonical payload，并允许将独立 review record 标记为
> approved。仅授权 review decision 记录；不授权 bundle/manifest 签名、私钥或凭据处理、production
> payload/URL/公钥、真实分发端点、runtime publication、默认启用、其他 route family、游戏通信修改或安装包发布。

project owner は `2026-08-02T11:21:02.178Z` に review semantic digest
`sha256:4e0d52638b60b90e2aec0bfdc9f9c2eaca500d4c32751245e649a5e43adac94c` を明示承認し、
review decision commit `9f1e66e0589873f8d8dc5ed176c3de96b9d021f8` で独立 review record を
`approved` にした。candidate file と canonical digest は不変である。署名、production payload、runtime
publication、default enablement、installer publication は引き続き未承認である。

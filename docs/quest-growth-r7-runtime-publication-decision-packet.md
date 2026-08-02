# 新人成長ルート R7 runtime publication authoring 判断 packet

最終更新日: 2026-08-02

Task ID: `QGROWTH-R7-RUNTIME-PUBLICATION-AUTHORING`

Status: `R7_RUNTIME_PUBLICATION_AUTHORING_IMPLEMENTED_ANONYMOUSLY_VERIFIED`

## 目的

実アカウント只読受入で PASS した2件の reviewed route を、既存の Ed25519 署名データ更新経路へ
接続するための schema、validator、session-only renderer bridge と匿名 signed fixture の authoring 範囲を
固定する。本 packet は実装準備だけを申請し、実際の runtime publication、正式配布 URL / 公開鍵、
default enablement、秘密鍵処理を許可しない。

machine-readable request は
[`r7-runtime-publication-authoring-request.json`](../knowledge/quest-growth/decisions/r7-runtime-publication-authoring-request.json)、
compiler report は
[`r7-runtime-publication-authoring-report.json`](../knowledge/quest-growth/generated/r7-runtime-publication-authoring-report.json)
とする。

## 承認根拠

- audited base commit: `ae08aca3974d3ccdf19ed4690855caa815e87b45`
- real-account acceptance: `REAL_ACCOUNT_READONLY_ACCEPTANCE_PASSED`
- accepted semantic digest:
  `sha256:497bc51162e26ac696db7219bc876ff56dd0bbfd932e5dddec89a5460a405930`
- accepted route count: `2`
- current runtime eligible count: `0`
- current publication / default enablement: `R7_NOT_AUTHORIZED`
- existing data-update deployment: disabled until a separately reviewed production URL, public key and fingerprint exist

## 許可を申請する変更

既存の署名済み `quest/knowledge.json` payload に、versioned growth route catalog を追加できるようにする。
outer envelope、hash、signature、HTTPS origin、version anti-rollback は既存 data-update contract を再利用する。

- fixed reviewed route digest 2件だけを受理する
- draft、expired、withdrawn、unknown version / field、digest mismatch を fail closed する
- 検証済み catalog だけを既存 session-only selector へ渡す
- route update がない、または active pointer / payload が壊れている場合は bundled opt-in catalog へ戻す
- withdrawal は、より新しい署名済み bundle で route を隠し、knowledge review required を表示する
- 匿名 signed data-update fixture で install、restart、withdrawal、fallback を確認する

変更可能 path は次の9件だけとする。

1. `src/common/quest_growth_reviewed_routes.ts`
2. `src/common/quest_knowledge_update.ts`
3. `src/renderer/src/stream.ts`
4. `scripts/create-data-update-bundle.js`
5. `scripts/electron-smoke.js`
6. `src/common/__tests__/quest_growth_reviewed_routes.test.ts`
7. `src/common/__tests__/quest_knowledge_update.test.ts`
8. `src/main/__tests__/data-update.test.ts`
9. `src/main/__tests__/electron-smoke-script.test.ts`

## rollback と停止条件

この authoring では account state を変更しない。無効な署名、hash、schema、route digest は active route
update として採用しない。旧版へ戻すのではなく、既存 anti-rollback を維持したまま bundled opt-in catalog
または knowledge-review-required fallback を使う。正式な配布切り替えと撤回 bundle の発行は後続の独立判断とする。

次のいずれかが起きた場合は実装を停止する。

- authorized path の追加が必要になる
- main / preload production code またはゲーム通信の変更が必要になる
- route content、表示文言、layout の変更が必要になる
- production URL / public key、秘密鍵、credential が必要になる
- 匿名 fixture ではなく実アカウントや外部 endpoint が必要になる
- current 2 route 以外を含める必要が生じる

## 固定摘要

- semantic digest:
  `sha256:580d7002173588b74d1e6327adf4235a20eeb12477d43689a9599adb86b42104`
- request raw digest:
  `sha256:6f18a9ba21dab278b296d6d0d84cfb2e097e36d95da486ea7829ad4490d30208`
- maximum route count: `2`
- authorized path count: `9`
- required check count: `8`
- runtime eligible count before approval: `0`

推奨承認文面:

> 批准固定摘要 `sha256:580d7002173588b74d1e6327adf4235a20eeb12477d43689a9599adb86b42104`
> 对应的 `r7-runtime-publication-authoring` revision 1。仅授权 packet 固定的9个路径，为原两条 reviewed
> route 接入现有 Ed25519 签名数据更新链，完成严格 schema/validator、session-only renderer bridge、
> bundled fallback、signed withdrawal 与匿名 fixture 验证；路线内容、布局和文案保持不变。不得配置正式
> URL/公钥、处理私钥或凭据、连接真实分发端点、执行实账号验收、修改 main/preload production 或游戏通信；
> 不授权实际 runtime publication、默认启用、其他 route family 或安装包发布。

## 批准后仍需独立判断

authoring 与匿名 fixture PASS 只产生 publication candidate evidence。以下内容仍需新的固定摘要批准。

1. reviewed signed candidate bundle 与独立审查结果
2. production manifest URL、public key、fingerprint 与 HTTPS staging acceptance
3. runtime publication 执行
4. default enablement release decision

project owner は `2026-08-02T10:05:55.362Z` に semantic digest
`sha256:580d7002173588b74d1e6327adf4235a20eeb12477d43689a9599adb86b42104` を明示承認した。
固定9 path の実装は commit `221a1643730ba6da4dee831602ea7c06682f4632` に限定し、typecheck、
84件の targeted test、1234件の full test、production build、匿名 Ed25519 Electron smoke を通過した。
1件の reviewed binding、1件の signed withdrawal、bundled fallback と session-only state を確認済みである。
implementation authorization は `consumed` としたが、runtime eligible count は0のままであり、実際の
publication、production URL / public key、default enablement、installer build は未実施・未承認である。

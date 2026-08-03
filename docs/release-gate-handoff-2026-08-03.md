# 2026-08-03 リリース門禁引き継ぎ

## 目的

攻略推薦に関する実装済み状態と、外部条件または project owner の判断が必要な残作業を一か所に固定する。
本書は decision packet の索引であり、production URL、鍵、外部接続、publication、default enablement の
権限を付与しない。

## 現在の検証済み状態

### 任務攻略推薦ルート

- audited implementation commit: `f809ffe659091def7e4e009bb77cb4bb6d846b53`
- canonical recurring normal-sortie: 27 fact
- reviewed route unit: 39
- exact stage contribution: 60
- rejected objective: 0
- inventory data coverage: 27/27（100%）
- UI: default disabled、explicit opt-in、既存任務指引 fallback
- quest strategy 固有の実アカウント最終表示確認: pending

100% は固定 inventory に構造化 route が存在する割合であり、実利用者の保有艦・装備・資源・海域解放、
到達率、勝率または最適性を証明しない。

### 成長攻略 R7 / R8

- R7 fixed reviewed route: 2（遠征05資源循環、1-5基礎対潜）
- R7 real-account read-only acceptance: PASS、checked route 2
- R7 signed bundle evidence review result: recorded、redacted field 10、record 1
- R8 bundled opt-in route: 4（1-5 EO、2-1水上・航空、第2～第4艦隊解放、演習・改造・近代化）
- runtime eligible count: 0
- runtime publication / default enablement: not authorized

R7 の signed candidate は固定2 routeだけを対象とし、R8の4 routeおよび任務攻略推薦の39 routeを含まない。

### Issue #29 data update deployment

`src/main/data-update-deployment.ts` の bundled trust configuration は次の安全な未設定状態を維持する。

- `manifestUrl`: undefined
- `publicKey`: undefined
- `publicKeySha256`: undefined
- production environment override: rejected

## 承認なしで継続できる検証

以下は秘密情報、実在 endpoint、実アカウントまたは外部 publication を使用しない。

```powershell
npm run data:quest-strategy:inventory:verify
npm run data:quest-strategy:pilot:verify
npm run data:quest-strategy:compile:verify
npm run data:quest-growth:verify
npm run check:l10n
npm run typecheck
npm run test
npm run smoke:data-update
```

これらが PASS しても、下記 gate は解除されない。

### 2026-08-03 offline preflight

上記の strategy inventory / authoring / compiler、growth compiler、localization、typecheck、全 test と
production synthetic `smoke:data-update` は PASS した。data-update smoke は一時鍵と隔離 profileだけを使い、
実在 URL、production public key、credential、実アカウント、ゲーム通信変更を使用していない。

## 最後にまとめて判断する項目

### 現在の approval snapshot

| gate | request revision / SHA-256 | current state | owner input |
| --- | --- | --- | --- |
| 任務攻略推薦 実アカウント表示 | revision 2 / `sha256:0cc487a762987688d5cf85241c32eaae17c390e84fc662258af3f0128c6cfb67` | execution `not-authorized` | owner manual login、GAME START 1回、目視5項目 |
| #29 production trust configuration authoring | revision 2 / `sha256:abe9755751637d080af15c0683441449dcc15ddb62c452e090f4a2002c9b1827` | implementation `not-authorized` | 公開URL、公鍵、独立fingerprint、3 role、key運用記録 |

これ以前に提示した revision 1 digest は superseded とし、承認に使用しない。後続の release record、
HTTPS staging acceptance、runtime publication、default enablement は、上記 production input と前段結果が
存在しないため、現時点で実行可能な固定摘要を作らない。

### A. 任務攻略推薦の実アカウント最終表示

1. owner がログインと `GAME START` を手動で行う。
2. screenshot を保存しない専用 `npm run smoke:accept:quest-strategy` の読み取り専用検査と
   目視5項目を実行する。
3. page、panel、filter、window state を復元し、ゲーム操作と通信変更がないことを確認する。

この gate は R7 成長攻略2 routeの既存PASSとは別である。

実行範囲と禁止事項は
[`quest-strategy-real-account-acceptance-decision-packet.md`](quest-strategy-real-account-acceptance-decision-packet.md)
に固定した。machine-readable request SHA-256 は
`sha256:0cc487a762987688d5cf85241c32eaae17c390e84fc662258af3f0128c6cfb67` であり、
現在の execution authorization は `not-authorized` である。

### B. #29 の実在 production input

1. credential を含まない HTTPS manifest URL
2. Ed25519 public key と別経路で照合した SHA-256 fingerprint
3. release author、independent reviewer、staging operator の実担当者
4. private key と passphrase の分離保管、独立backup 2件、rotation / recovery周期、incident連絡先
5. approved candidate bytes と一致する signed bundle

private key、passphrase、credential はリポジトリ、チャット、ログ、decision record に保存しない。

最初の authoring gate は
[`data-update-production-trust-configuration-decision-packet.md`](data-update-production-trust-configuration-decision-packet.md)
に固定した。machine-readable request SHA-256 は
`sha256:abe9755751637d080af15c0683441449dcc15ddb62c452e090f4a2002c9b1827` であり、
現在の implementation authorization は `not-authorized` である。公開入力5件が揃っても、
外部接続、署名、staging acceptance、publication、default enablement は別 gate とする。
URL、公鍵、fingerprint の三つは、production code を変更する前に
`npm run data:trust:verify` でネットワーク接続なしに照合できる。

### C. 実行 gate の順序

1. production trust configuration authoring
2. release record の作成と独立再検証
3. 一回限りの隔離 HTTPS staging acceptance
4. runtime publication execution
5. production URL / public key の正式組み込み
6. default enablement と installer release の独立判断

後段の承認は前段を暗黙に承認しない。失敗時は bundled fallback、default disabled、runtime eligible count 0へ
fail closedする。

## 後続だが今回まとめない項目

- #18: 第2言語、翻訳review体制、暗号化transfer、実アカウントrestore / merge acceptance
- #38: 既存「甲ブラウザ → 74EO」で足りるか、構造化intake bridgeが必要かの利用形態判断
- #23 / #34: 需要発生まで凍結

## 非対象

- ゲームの自動操作
- ゲーム request / response / header / body / session の変更
- runtime web scraping
- account data、credential、private key の外部送信または保存
- 未審査 route の success / optimality claim

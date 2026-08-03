# 任務攻略推薦ルート受け入れ

最終更新日: 2026-08-03

## 現在の判断

攻略推薦ルートの MVP 実装は完了した。既存任務指引への影響を避けるため、機能は
`QuestStrategyFeatureDefaultEnabled = false` のままとし、利用者が任務画面で明示的に
開いた場合だけ表示する。

同梱知識と一時鍵・loopback 配布を使う統合は受け入れ済みである。正式な署名更新の
一般配布は、Issue #29 の配布 URL、組み込み公開鍵、鍵運用担当が決まるまで有効化しない。
実アカウント受け入れが未完了でも、既定値を `true` に変更しない。

## 自動受け入れ

```powershell
npm run check:l10n
npm run data:quest-strategy:contract:verify
npm run typecheck
npm run test
npm run build:bundle
npm run smoke:data-update
```

`smoke:data-update` は隔離 user data と合成ゲーム状態だけを使用する。実行ごとに一時
Ed25519 鍵で攻略 recipe を含む bundle を署名し、production Electron を再起動して
次を検査する。

- 署名済み攻略 version と recipe ID が main、preload、renderer の起動時経路で一致する
- 任務指引を opt-in で開き、攻略 component の知識 version が一致する
- 攻略 DOM に提督名、member ID、艦船 instance ID、API token 等がない
- component に横 overflow がない
- 最初の表示が「次の海域」または neutral な zero-ready state で、候補変更と監査詳細は
  折り畳まれている
- 検査後に攻略表示、任務 filter、workspace page を開始前の状態へ戻す
- 未知 field/version、改ざん、rollback、壊れた JSON は既存 bundle 検証で拒否する
- 選択任務、任務 snapshot、record key、recipe の入力順を変えても plan と fingerprint が
  同一で、文字列順位が host locale に依存しない
- 艦船または装備 inventory が未読込なら空集合として不適合にせず、確認事項へ降格する

2026-07-31 の production smoke は `smoke.strategy.1` と
`signed-smoke-route` を読み込み、privacy 検出 0、`clientWidth = scrollWidth = 268`
で通過した。

2026-08-03 の最終 authoring baseline は canonical recurring normal-sortie 27 fact に対して
39 route unit、60 stage contribution、rejected objective 0 である。27件すべてを完全な
stage-aware plan として構成でき、inventory data coverage は 100% となった。これは実利用者の
表示任務に対する命中率や成功率ではない。`QuestStrategyFeatureDefaultEnabled = false`、明示 opt-in、
既存指引 fallback、通信非変更の境界は維持する。実アカウントでの本ページ固有の最終表示確認は
引き続き未実施であり、下記 gate を自動的に解除しない。

## ゲーム通信の只読監査

攻略実装は `src/common` の純粋関数、検証済み知識 store、任務 renderer だけで構成する。
自動テスト `quest_strategy_readonly.test.ts` は main/preload import、`fetch`、
`XMLHttpRequest`、`ipcRenderer`、`webRequest`、`postMessage`、`session`、`webview`
を攻略実装から拒否する。

レビュー時は攻略モジュール開始直前の固定 commit `a26abe1` から、次の保護対象に
差分がないことも確認する。

```powershell
git diff --exit-code a26abe1...HEAD -- `
  src/main/kcbrowser.ts `
  src/preload/xhr-hook.ts `
  src/common/kcsapi_hook.ts
```

差分、game request/response/header/body/session への書込、外部送信、原始 API payload の
DOM/log/summary 出力が一つでもあれば FAIL とし、機能を有効化しない。

## 実アカウントの最終確認手順

この手順は DMM ログインと利用者の手動 GAME START が必要なため、開発者が代理で
資格情報を扱わない。開始前に通常の甲ブラウザを終了し、重要なローカルデータを
バックアップする。

```powershell
npm run build:bundle
npm run smoke:live
```

表示された隔離 smoke window で利用者がログインし、GAME START を一度押す。
スクリプトは既存の観測経路で game data が準備された後、任務指引と攻略ルートを開き、
知識 version、DOM privacy、横 overflow を検査して、攻略表示、filter、page、window
状態を復元する。ゲーム内の任務受注、編成、出撃、補給、装備変更は行わない。

利用者は画面上で次だけを確認する。

1. 攻略ルートが初期状態では閉じている。
2. 明示的に開くと、完全 route がある場合は次の海域と同時進行任務が最初に読め、
   候補変更、score 内訳、次点、診断は必要時だけ展開できる。
3. 欠損情報は「不明」または確認事項であり、成功・最適・必須と断定されない。
4. recipe を非表示・復元しても、既存の current/all 目標ルートは変わらない。
5. smoke 終了後、ゲーム側状態に操作結果がない。

実アカウントで一項目でも不一致があれば FAIL とし、既定値 `false` と同梱 fallback を
維持する。全項目 PASS と Issue #29 の運用承認が揃った後に限り、一般公開範囲を別 PR で
判断する。

## リリース門禁

| 門禁                         | 現在          | 解除条件                                                            |
| ---------------------------- | ------------- | ------------------------------------------------------------------- |
| 純粋関数・決定性・欠損降格   | PASS          | 全 unit fixture 継続通過                                            |
| 1～5 任務・最大 512 recipe   | PASS          | 1 件の単独ルートと 2～5 件の bounded co-completion fixture 継続通過 |
| 署名 schema・fallback        | PASS          | publisher/runtime/smoke 継続通過                                    |
| canonical 27 fact の route coverage | PASS    | 39 route / 60 stage contribution / rejected 0 を継続検証             |
| production 合成 E2E・privacy | PASS          | `smoke:data-update` 継続通過                                        |
| ゲーム通信非変更             | PASS          | 攻略基点以降の保護 3 ファイル差分 0、只読テスト通過                 |
| 実アカウント表示確認         | PENDING OWNER | 上記 `smoke:live` と目視 5 項目 PASS                                |
| Issue #29 正式配布運用       | FROZEN        | URL、公開鍵、担当、staging 審査を Owner 承認                        |
| 機能の既定有効化             | BLOCKED       | 前二項と独立リリース判断                                            |

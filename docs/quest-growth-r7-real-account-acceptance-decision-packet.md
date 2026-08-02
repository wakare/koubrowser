# 新人成長ルート R7 実アカウント只読受入判断 packet

最終更新日: 2026-08-02

Task ID: `QGROWTH-R7-4_REAL_ACCOUNT_READONLY_ACCEPTANCE_PACKET`

Status: `OWNER_DECISION_REQUIRED_REAL_ACCOUNT_ACCEPTANCE`

## 目的

承認済み renderer に表示される2件の reviewed route を、project owner の手動ログイン後に
只読で確認する範囲を固定する。この packet は受入実行の承認を求める decision-only artifact であり、
実アカウント受入そのものはまだ実行していない。

machine-readable request は
[`r7-real-account-acceptance-request.json`](../knowledge/quest-growth/decisions/r7-real-account-acceptance-request.json)、
compiler report は
[`r7-real-account-acceptance-report.json`](../knowledge/quest-growth/generated/r7-real-account-acceptance-report.json)
とする。

## 対象

対象は renderer gate で承認済みの次の2件だけとする。

1. `resources`: 遠征05「海上護衛任務」資源ループ
   - `sha256:05e4cdbbcbdbf7a781ba73bbe1bb3498cc7c0bab6985fef4b1cae6173acda55a`
2. `asw`: 1-5 3戦撤退・基礎対潜練習
   - `sha256:9b675d5c8a33b3ec974c678a3f258200324222f1e7bec1c2b2ba5e4c3512e78d`

route 内容の変更、3件目、他 family、runtime bundle は対象外とする。

## 権限分離

project owner だけが次を行う。

- 通常の甲ブラウザを閉じ、必要なローカルバックアップを確認する。
- 認証情報を入力し、ログインを完了する。
- `GAME START` を1回だけ押す。
- 下記5項目を画面上で確認する。

Codex はログイン完了を待ち、固定 commit の harness で DOM と寸法を只読検査し、脱敏済みの
PASS / FAIL だけを出力する。認証情報を扱わず、`GAME START` を押さず、ゲーム内操作をしない。

## owner が確認する5項目

1. route section は初期状態で閉じている。
2. `resources` と `asw` は、それぞれ固定済みの reviewed route 1件だけを表示する。
3. 表示は「手動確認必須」であり、現在実行可能、最適、成功保証とは断定しない。
4. 既存の任務指引、現在/全 route、情報不足 fallback は引き続き利用できる。
5. 検査後に任務 filter、workspace page、panel、window と route の閉状態が復元され、ゲーム側の
   任務受注、編成、出撃、遠征、補給、装備状態に操作結果がない。

## 実行前 gate

承認後も次がすべて PASS するまで実アカウント session を開始しない。

```powershell
npm run typecheck
npm run test
npm run data:quest-growth:verify
npm run smoke:data-update
```

さらに、implementation base `804cf1bc180240b67e2f1d2f51443f4bd5399f2d` に固定した route、
renderer、harness、ゲーム通信保護3ファイルの digest を compiler で照合する。通常の甲ブラウザが
終了しており、owner がバックアップを確認したことも開始条件とする。

## 承認後の受入コマンド

実行時は screenshot directory を指定しない。

```powershell
node scripts/electron-smoke.js --manual-game-start --workspace-pages --task-guide `
  --wide-workspace --summary --timeout 300000 --total-timeout 900000
```

匿名 signed fixture では resource fact を正確に1件、実アカウントでは1件以上として検査する。
件数差だけで正しい実アカウント表示を誤って FAIL にしない。

## 脱敏 evidence

保存・報告できるのは fixed commit、knowledge version、route ID / digest、focus と route 件数、
boolean check、client / scroll 寸法、脱敏 error code、開始・終了時刻だけとする。

次は保存・報告しない。

- 認証情報、Cookie、API token
- member ID、提督名、server ID
- 艦娘・装備 instance ID
- raw API payload、raw DOM、raw log
- 未脱敏 screenshot、account snapshot

screenshot capture、raw log retention、account data export はすべて禁止する。

## abort / restore

認証情報や `GAME START` 操作を Codex に求める場合、digest 不一致、route の失効・撤回、ゲーム操作が
必要になった場合、未脱敏情報を書き出す可能性がある場合、UI 状態を復元できない場合は直ちに中止する。

中止・成功のどちらでも、任務 filter、workspace page、panel、window bounds、route section の閉状態を
復元する。復元のためにゲーム側状態を変更してはならない。

## 固定摘要

- acceptance request semantic digest:
  `sha256:4518ded2c385593aa8fa046798b03f1c85f9ae2d18b51fed2fff467aa67cc5fe`
- request raw digest:
  `sha256:9898f9b616405d96cb066450d504d07dcb6ddca3533b6fb5efffe4c681545245`
- gate semantic digest:
  `sha256:9217b655328ce8a1c4e0558c744b7eb6fb35f1226331d1b3960ad3055c66ffdb`
- route count: `2`
- required checks: `12`
- actual acceptance status: `not-run`
- runtime eligible count: `0`
- publication authorization: `R7_NOT_AUTHORIZED`
- default enablement authorization: `R7_NOT_AUTHORIZED`

推奨承認文面:

> 批准固定摘要 `sha256:4518ded2c385593aa8fa046798b03f1c85f9ae2d18b51fed2fff467aa67cc5fe`
> 对应的 `r7-real-account-readonly-acceptance`。仅授权 project owner 手动处理登录并点击一次
> `GAME START` 后，对 packet 固定的两条 reviewed route 执行一次只读、脱敏验收；Codex 仅可运行固定
> harness、检查 DOM/布局并输出脱敏 PASS/FAIL，必须恢复页面状态。不得处理凭据、点击 GAME START、
> 执行游戏操作、修改游戏通信、保存截图/raw log/account snapshot、修改路线内容；不授权 runtime
> publication、默认启用或其他 route family。

## 当前结论

packet 与 validator 已完成，但 gate 仍为 `not-authorized`，`executionAuthorization` 仍为
`not-authorized`，`actualAcceptanceStatus` 为 `not-run`。收到上述固定摘要的明确批准前，不执行
实账号验收。

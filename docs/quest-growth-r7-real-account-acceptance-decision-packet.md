# 新人成長ルート R7 実アカウント只読受入判断 packet

最終更新日: 2026-08-02

Task ID: `QGROWTH-R7-4_REAL_ACCOUNT_READONLY_ACCEPTANCE_PACKET`

Status: `OWNER_DECISION_REQUIRED_REAL_ACCOUNT_ACCEPTANCE_HARNESS_AMENDMENT`

## 目的

承認済み renderer に表示される2件の reviewed route を、project owner の手動ログイン後に
只読で確認する範囲を固定する。project owner は 2026-08-02 に revision 1 の固定摘要どおり
受入実行を承認した。最初の実行は account data ready 後、ユーザーが非表示にした任務 page を
revision 1 harness が開けず、route 検査前に fail closed した。revision 2 はこの layout 互換性と
固定12 check の検査漏れだけを補う。gate の承認は維持するが、revision 2 の実行は再承認まで
`not-authorized` とする。

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

## revision 1 の実行結果

- result: `blocked-before-route-inspection`
- reason: `TASK_WORKSPACE_PAGE_NOT_VISIBLE`
- account data ready: `true`
- route inspection started: `false`
- owner の `GAME START` 後のゲーム操作: `false`
- screenshot / raw log / account snapshot retention: `false`
- 実行プロセスは終了済み

## revision 2 harness amendment

production code と route 内容は変更せず、固定 harness に次の3点だけを追加する。

1. 非表示の `secondary-tasks` page / `questguide` panel を一時的に復元し、検査後に元の
   非表示状態、active page、editor、scroll へ戻す。
2. `resources` と `asw` の両方について1件の固定 reviewed route 全表示文言、manual label、
   route semantic digest と layout を検査し、`unset` では route 0件と fallback を検査する。
3. focus / route details の操作が local storage を変更しないことを確認し、元の session state に戻す。

匿名 signed data-update + hidden-layout fixture では、2 route、fallback、session-only、page / panel / active-page
復元がすべて PASS した。

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
  `sha256:44e83fc978c1f951c20a8669083c91ca60c73d62bd6ec17a0901e63bb9edc57e`
- request raw digest:
  `sha256:c93a7c03e6afe77f272852dcaf32ad342e61f2cb7c2b7e8f9f8f125c631f0380`
- revision 1 approved semantic digest:
  `sha256:4518ded2c385593aa8fa046798b03f1c85f9ae2d18b51fed2fff467aa67cc5fe`
- revision 2 smoke harness digest:
  `sha256:38cf695bf354cc16e589621efc9fd2c2634c0de0e6291feb39a502e56795c537`
- gate semantic digest:
  `sha256:9217b655328ce8a1c4e0558c744b7eb6fb35f1226331d1b3960ad3055c66ffdb`
- route count: `2`
- required checks: `12`
- actual acceptance status: `blocked-before-route-inspection`
- runtime eligible count: `0`
- publication authorization: `R7_NOT_AUTHORIZED`
- default enablement authorization: `R7_NOT_AUTHORIZED`

推奨承認文面:

> 批准修订固定摘要 `sha256:44e83fc978c1f951c20a8669083c91ca60c73d62bd6ec17a0901e63bb9edc57e`
> 对应的 `r7-real-account-readonly-acceptance` revision 2 harness amendment。仅允许在原已批准的
> 两条 reviewed route 只读验收中，临时恢复被隐藏的任务页/面板并原状还原，完整检查
> resources、asw、unset fallback 和 session-only 状态；仅授权再执行一次原范围的只读、
> 脱敏验收。其余边界不变：Codex 不得处理凭据、点击 GAME START、执行游戏操作、修改游戏通信、
> 保存截图/raw log/account snapshot、修改路线或 production code；不授权 runtime publication、
> 默认启用或其他 route family。

## 承認結果と現在の結論

revision 1 の gate 承認は記録済みだが、revision 2 の `executionAuthorization` は
`not-authorized` である。修訂固定摘要への project owner の明示承認なしに実アカウント
session を再開しない。runtime publication、default enablement、他 family は未承認のままである。

# 新人成長ルート R7 実アカウント只読受入判断 packet

最終更新日: 2026-08-02

Task ID: `QGROWTH-R7-4_REAL_ACCOUNT_READONLY_ACCEPTANCE_PACKET`

Status: `REAL_ACCOUNT_READONLY_ACCEPTANCE_REVISION_6_AUTHORIZED_NOT_RUN`

## 目的

承認済み renderer に表示される2件の reviewed route を、project owner の手動ログイン後に
只読で確認する範囲を固定する。project owner は 2026-08-02 に revision 1 の固定摘要どおり
受入実行を承認した。最初の実行は account data ready 後、ユーザーが非表示にした任務 page を
revision 1 harness が開けず、route 検査前に fail closed した。revision 2 はこの layout 互換性と
固定12 check の検査漏れだけを補う。gate の承認は維持するが、revision 2 の実行は再承認まで
`not-authorized` とした。project owner は固定摘要を明示承認し、revision 2 の実行は
`authorized` とした。再試行は account data ready 後、tall layout で task page を解決できず、
route 検査前に再び fail closed した。この1回分の実行承認は消費済みである。
revision 3 は tall / compact layout の表示先を判定する harness 修訂だけを固定し、実アカウントの
追加実行を承認したが、owner manual login window 内に account data が ready にならず fail closed した。
revision 4 は同じ harness と同じ2 route の1回限りの再試行だけを再承認対象とする。
revision 5 は project owner が固定摘要どおり authoring を承認し、専用 route-panel size check と
匿名 signed custom-layout fixture を実装した。fixture は2 route、unset fallback、custom page の
名称・順序・可視性、active page、filter、editor、window bounds の復元を確認して PASS した。
revision 6 はこの固定 harness と同じ2 route を使う1回限りの只読再試行だけを承認対象とする。

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

## revision 2 の実行結果

- result: `fail-closed`
- stage: `task-page-resolution-before-route-inspection`
- reason: `SECONDARY_TASK_PAGE_OMITTED_BY_TALL_LAYOUT`
- account data ready: `true`
- route inspection started: `false`
- checked route count: `0`
- owner の `GAME START` 後のゲーム操作: `false`
- screenshot / raw log / account export: `false`
- page / filter / panel / window state restored: `true`
- 実行プロセスは終了済み

source 確認の結果、`secondary-tasks` は `compactHeightOnly` である。live 窓は高さ
1408 px だったため、page の persisted `visible` は `true` のまま tab からだけ省かれた。
revision 2 が参照する hidden page list は persisted `visible=false` の page だけを含むため、復元対象を
見つけられなかった。

## revision 3 harness amendment

revision 2 の検査範囲、route binding、evidence / restore / abort 条件は変更しない。固定 harness に
次の4点だけを追加する。

1. primary workspace が表示される tall layout では `primary-overview` の `questguide` を検査する。
2. primary workspace が表示されない compact layout では `secondary-tasks` を使い、非表示なら
   一時復元後に原状へ戻す。
3. timeout diagnostic に panel text を含めず、panel name、visibility、client / scroll width だけにする。
4. 匿名 signed fixture で compact-hidden と tall-primary を別々検査する。

両 fixture とも `resources`、`asw`、`unset` fallback、session-only、元の page / panel / window 状態の
復元を含めて PASS した。tall fixture では client `1920 x 1200`、workspace area
`primary`、page `primary-overview`、secondary task tab omitted を確認した。

## 実行前 gate

承認後も次がすべて PASS するまで実アカウント session を開始しない。

```powershell
npm run typecheck
npm run test
npm run data:quest-growth:verify
npm run smoke:data-update
```

さらに、harness implementation commit `5a220292cee3a595b7121712e45f7fac3a95bdc0` に固定した route、
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
  `sha256:bfcc5f3e72fe4969d322a3dab09ec3c7783ab37374e98d483be187691572daa6`
- request raw digest:
  `sha256:af125f870e66109b3c80ee52706bf2c6c7a36d5baefa80b95075d5d01f068d6f`
- revision 5 approved semantic digest:
  `sha256:4914e3ab307c85db7d862700c587ce73c7b93950e6a441999dc860479c577402`
- revision 4 approved semantic digest:
  `sha256:8fec2825a32362949041fd2c13c3aadca9bd900988f4f829b8eff4af6d92820c`
- revision 3 approved semantic digest:
  `sha256:68793574113a951707da8937207e601fdac759bdd6ff9e52fa27dab9090a0945`
- approved revision 2 request raw digest:
  `sha256:409132e26bd5b131da0049d715408438a13bd59c028eca6dea2dea48d899f446`
- executed revision 2 request raw digest:
  `sha256:afbb49115286691761c8d3be4842832887e2d447676f2c00b6f33fb552d76c35`
- revision 1 approved semantic digest:
  `sha256:4518ded2c385593aa8fa046798b03f1c85f9ae2d18b51fed2fff467aa67cc5fe`
- revision 2 smoke harness digest:
  `sha256:38cf695bf354cc16e589621efc9fd2c2634c0de0e6291feb39a502e56795c537`
- revision 3 smoke harness digest:
  `sha256:b334b4ef74f8ce6a29a6ccdfbcbb825df832dbedb28eefccd8eb7982af61bf3a`
- gate semantic digest:
  `sha256:9217b655328ce8a1c4e0558c744b7eb6fb35f1226331d1b3960ad3055c66ffdb`
- route count: `2`
- required checks: `12`
- prior acceptance status: `blocked-before-route-inspection`
- revision 2 acceptance status: `fail-closed`
- revision 2 execution authorization: `consumed`
- revision 3 execution authorization: `consumed`
- revision 3 acceptance status: `fail-closed`
- revision 3 reason: `MANUAL_LOGIN_TIMEOUT_BEFORE_ACCOUNT_DATA`
- revision 3 account data ready: `false`
- revision 3 checked route count: `0`
- revision 4 execution authorization: `consumed`
- revision 4 acceptance status: `fail-closed`
- revision 4 reason: `SURFACE_RESPONSIVE_WORKSPACE_MODE_TIMEOUT`
- revision 4 account data ready: `true`
- revision 4 checked route count: `2`
- revision 4 maximum executions: `1`
- revision 4 harness changes authorized: `false`
- revision 5 harness amendment authoring: `approved-and-implemented`
- revision 5 authorized path count: `2`
- revision 5 anonymous custom-layout fixture required: `true`
- revision 5 real-account execution authorization: `not-authorized`
- revision 5 implementation commit: `5a220292cee3a595b7121712e45f7fac3a95bdc0`
- revision 5 smoke harness digest:
  `sha256:f2c35818aa8cb41d43fee52a5bd6582cdec2344d5ebf4b8f31aee3ae48775400`
- revision 5 anonymous signed custom-layout fixture: `PASS`
- revision 6 maximum executions: `1`
- revision 6 execution authorization: `authorized`
- runtime eligible count: `0`
- publication authorization: `R7_NOT_AUTHORIZED`
- default enablement authorization: `R7_NOT_AUTHORIZED`

推奨承認文面:

> 批准固定摘要 `sha256:bfcc5f3e72fe4969d322a3dab09ec3c7783ab37374e98d483be187691572daa6`
> 对应的 `r7-real-account-readonly-acceptance` revision 6 retry。仅授权沿用 implementation commit
> `5a220292cee3a595b7121712e45f7fac3a95bdc0`、harness digest
> `sha256:f2c35818aa8cb41d43fee52a5bd6582cdec2344d5ebf4b8f31aee3ae48775400`，对固定的两条
> reviewed route 再执行一次原范围的只读、脱敏验收；project owner 必须手动处理登录并只点击一次
> GAME START。Codex 不得处理凭据、点击 GAME START、执行游戏操作、修改游戏通信、保存截图/raw log/
> account snapshot、修改 harness、production code 或路线；不授权 runtime publication、默认启用或其他 route family。

## 承認結果と現在の結論

project owner は revision 2 修訂固定摘要を明示承認し、1回の再試行は fail closed で終了した。
revision 3 は匿名 fixture まで完了し、project owner は固定摘要を明示承認した。固定 harness は
DMM login page で account data を待機したが、5分以内に login / GAME START が完了せず、route 検査前に
fail closed した。`executionAuthorization` は `consumed` であり、新しい固定摘要の承認なしに再実行しない。
runtime publication、default enablement、他 family は未承認のままである。

## revision 4 retry request

revision 4 は harness、production code、route content を変更しない。revision 3 と同じ layout-aware harness、
同じ2件の reviewed route、同じ5分の owner manual login window を使用する1回限りの再試行だけを申請する。
project owner は本 packet の固定摘要を明示承認した。account data は ready となり、固定2 route と unset fallback の
検査は完了したが、その後の汎用 `--wide-workspace` surface layout sweep が user-customized page labels と既定 label の
一致を待って timeout した。全12 check を完了できなかったため全体は fail closed、execution authorization は
`consumed` とする。新しい固定摘要の承認なしに再実行または harness 修正をしない。

## revision 5 proposed harness amendment

revision 5 は実アカウント実行を許可せず、次の harness authoring と匿名 fixture だけを申請する。

- 実アカウント route acceptance から汎用 `--wide-workspace` exact-label sweep を分離する
- 現在サイズと1つの制御サイズで route panel の横 overflow だけを専用検査する
- user-customized page label、順序、可視性、active page、window bounds を保存・復元する
- timeout diagnostic は名称、真偽値、client / scroll 寸法だけに脱敏する
- anonymous signed custom-layout fixture で復元と fail-closed 条件を検証する

変更可能な path は `scripts/electron-smoke.js` と
`src/main/__tests__/electron-smoke-script.test.ts` の2件だけとする。production code、route content、
実アカウント再実行、runtime publication、default enablement は許可しない。

project owner は revision 5 の固定摘要を承認した。implementation commit は
`5a220292cee3a595b7121712e45f7fac3a95bdc0`、smoke harness digest は
`sha256:f2c35818aa8cb41d43fee52a5bd6582cdec2344d5ebf4b8f31aee3ae48775400` である。
匿名 signed custom-layout fixture は current `1316 x 632` と controlled `1600 x 800` の両方で
2 route と unset fallback の横 overflow がなく、custom page と window state の復元を確認して PASS した。

## revision 6 retry request

revision 6 は revision 5 で固定・検証した harness を変更せず、同じ2 reviewed route に対する
1回限りの只読・脱敏実アカウント再試行だけを申請する。汎用 `--wide-workspace` regression は実行せず、
現在サイズと1つの controlled size だけを検査する。project owner は semantic digest
`sha256:bfcc5f3e72fe4969d322a3dab09ec3c7783ab37374e98d483be187691572daa6` を明示承認し、
execution authorization は `authorized` とした。

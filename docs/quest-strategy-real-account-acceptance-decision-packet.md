# 任務攻略推薦 実アカウント表示受入 decision packet

最終更新日: 2026-08-03

Status: `OWNER_DECISION_REQUIRED`

## 目的

任務攻略推薦39 route の実アカウント表示 gate を、既に PASS した成長攻略 R7 の2 route 受入と
混同せず、1回限り・只読・脱敏・screenshot なしで判断できるように固定する。本 packet の作成は
実行権限、runtime publication、default enablement または installer publication を付与しない。

machine-readable request は
[`real-account-display-acceptance-request.json`](../knowledge/quest-strategy/decisions/real-account-display-acceptance-request.json)
とする。

## 固定された実行範囲

- command: `npm run smoke:accept:quest-strategy`
- maximum executions: 1
- owner が資格情報を扱い、ログイン後に `GAME START` を1回だけ押す
- Codex は task guide、route DOM、privacy、current / controlled size の横 overflow を只読検査する
- 任務 filter、workspace page、panel、route visibility、window bounds を復元する
- screenshot、raw log、account snapshot を保存しない
- ゲーム内の任務受注、編成、出撃、遠征、補給、装備変更を行わない
- game request / response / header / body / session を変更しない

## owner が目視する5項目

1. 攻略 route は初期状態で閉じている。
2. 明示的に開くと、完全 route がある場合は次の海域と同時進行任務が先に読める。
3. 候補変更、score 内訳、次点、診断は初期状態で折り畳まれている。
4. 欠損情報は「不明」または確認事項で、成功・最適・必須を断定しない。
5. 終了後に画面状態が復元され、ゲーム側状態に操作結果がない。

## 承認しても解除されない gate

- production code / harness / route content の変更
- runtime publication
- default enablement
- production URL / public key の組み込み
- installer publication
- ゲーム操作またはゲーム通信変更

## 承認文面

固定摘要を確認した後、次の形で1回の実行だけを承認する。

> 批准固定摘要对应的 `quest-strategy-real-account-display-acceptance` revision 2。仅授权运行一次
> `npm run smoke:accept:quest-strategy`，由 project owner 手动处理登录并只点击一次 GAME START；
> Codex 仅可执行固定 digest preflight、只读检查 task guide/route DOM/布局、输出脱敏 PASS/FAIL 并恢复
> 页面、筛选、面板、路线显示及窗口状态。不得处理凭据、点击 GAME START、执行游戏操作、修改游戏通信，
> 不得保存 screenshot/raw log/account snapshot，不授权修改 production/harness/route、runtime publication、
> default enablement 或 installer publication。

固定摘要:

- request SHA-256:
  `sha256:0cc487a762987688d5cf85241c32eaae17c390e84fc662258af3f0128c6cfb67`
- revision 2 only refreshes the `package.json` digest after adding the unrelated offline
  production trust input verifier; the acceptance command and scope are unchanged
- execution authorization: `not-authorized`
- maximum executions: `1`
- screenshot / raw log / account snapshot: prohibited

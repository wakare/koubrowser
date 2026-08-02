# R7 route panel responsive fix decision packet

## 現在の結論

revision 6 の只読・脱敏実アカウント受入は、route content の詳細検査前に fail closed した。
固定された diagnostic は quest growth container の client width `221`、scroll width `257` である。
これは route knowledge の不足ではなく、狭い workspace container 内の renderer layout defect である。

root cause は `QuestGrowthCheck.vue` の responsive collapse が viewport width `760px` だけを参照している点にある。
実際の window は `2576px` であるため media query は発火せず、幅 `221px` の workspace column 内でも
header counts、context grid、route header / badges が横並びの minimum を維持して overflow した。

## 申請する authoring 範囲

gate は `r7-route-panel-responsive-fix-authoring`、revision 1 とする。変更可能な path は次の4件だけである。

- `src/renderer/src/components/QuestGrowthCheck.vue`
- `src/renderer/src/components/__tests__/QuestGrowthCheck.test.ts`
- `scripts/electron-smoke.js`
- `src/main/__tests__/electron-smoke-script.test.ts`

実装内容は component inline-size containment、container-aware な narrow layout、header / counts / controls /
badges の wrap、既存 wide layout の維持、匿名 signed fixture による `221px` regression に限定する。

## 必須 verification

- route section が閉じた状態で `221px` に横 overflow がない
- resources reviewed route を開いた状態で横 overflow がない
- asw reviewed route を開いた状態で横 overflow がない
- unset fallback で横 overflow がない
- session-only focus / resource posture の semantics が変わらない
- wide container layout が変わらない
- typecheck と全 test が PASS
- ゲーム通信保護3ファイルの digest が不変

許容する overflow tolerance は `1px` とする。fixture は匿名 signed data のみを使い、実アカウントは使わない。

## 明示的に未承認の範囲

本 gate は production renderer の responsive authoring と匿名 fixture だけを承認対象とする。次は未承認である。

- 実アカウント受入の再実行
- route content、local fact semantics、翻訳の変更
- Electron main / preload production code の変更
- ゲーム通信またはゲーム操作の変更
- screenshot、raw log、account snapshot の保存
- runtime publication、default enablement、他 route family
- installer build（本 authoring gate では feature delivery 未完了のため実行しない）

実装と匿名検証が完了した後は implementation commit と新しい component / harness digest を固定し、
実アカウント retry は別の固定摘要で改めて承認を受ける。

## 固定摘要

- semantic digest:
  `sha256:3b7c6d8b5806cb5c0e850d3a197d9f276d49a90a55cdf75a3a3d03ee031f1e43`
- request raw digest:
  `sha256:2a7b1567a717a9f732f3a2556a02e47cae37a9c5853a96bc2bc17255cabff73e`
- audited base commit: `9305994c9a5c92a6818071c372e68ae8bd69310e`
- revision 6 acceptance semantic digest:
  `sha256:bfcc5f3e72fe4969d322a3dab09ec3c7783ab37374e98d483be187691572daa6`
- revision 6 acceptance report digest:
  `sha256:9160340cfacd68dad68e2232b73166404eccd64b0227064b63ace06b657ea197`
- current component digest:
  `sha256:c50c847d7b392759d94f65a8dd8bbaea8a047b1d12b5f4a5f6f308cded1e9947`
- fixed harness digest:
  `sha256:f2c35818aa8cb41d43fee52a5bd6582cdec2344d5ebf4b8f31aee3ae48775400`
- authorized path count: `4`
- required check count: `8`
- real-account execution authorization: `R7_NOT_AUTHORIZED`
- runtime eligible count: `0`

推奨承認文面:

> 批准固定摘要 `sha256:3b7c6d8b5806cb5c0e850d3a197d9f276d49a90a55cdf75a3a3d03ee031f1e43`
> 对应的 `r7-route-panel-responsive-fix-authoring` revision 1。仅授权 packet 固定的4个路径，将
> `QuestGrowthCheck` 改为容器感知的窄列布局，并用匿名 signed fixture 验证 `221px` 下 resources、asw、unset
> 及关闭状态的横向溢出；必须保持 wide layout、session-only 语义、路线内容和游戏通信不变。不授权实账号验收、
> renderer 以外的 production code、路线/本地事实/翻译修改、runtime publication、默认启用或其他 route family。


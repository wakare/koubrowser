# 任務攻略カバレッジ契約受け入れ

最終更新日: 2026-07-31

## 自動検証

```powershell
npm run data:quest-strategy:contract:verify
npm run typecheck
npm run test
```

`data:quest-strategy:contract:verify` は checked-in policy と authoring schema を検証する。
unit fixture は author/approver 分離、unknown hard fact の拒否、512 hard limit、
`1..5` 選択契約、非識別 coverage snapshot と zero-hit gate を検証する。

## 必須 gate

| Gate             | PASS                                                      | FAIL / 降格                                 |
| ---------------- | --------------------------------------------------------- | ------------------------------------------- |
| selection        | 1～5 件。1 件は単独、2～5 件は co-completion              | 0 件または 6 件以上は INVALID               |
| classification   | primary denominator の 100% が単一 status を持つ          | 未分類は INSUFFICIENT                       |
| fallback display | visible non-claim の 100% に route または fallback がある | 非空 source で 0 表示は FAIL                |
| route coverage   | primary の暫定 80% 以上                                   | inventory 前は割合を確定値として報告しない  |
| evidence         | approved、独立 review、未失効                             | conflict は FAIL、単源未審査は INSUFFICIENT |
| compilation      | lossless、deterministic、512 以下                         | lossy、hash mismatch、512 超過は FAIL       |
| withdrawal       | target と全 dependent を除外                              | withdrawn が eligible なら FAIL             |
| privacy          | 禁止識別情報 0                                            | 1 件でも INVALID                            |
| communication    | 保護 3 ファイル差分 0                                     | 差分があれば FAIL                           |

PASS は次のローカル段階へ進めることだけを意味し、配布や既定有効化を承認しない。

## Zero-hit の機械判定

```text
if visibleNonClaimCount > 0
and routeReadyCount + fallbackEntryCount == 0:
  FAIL_EMPTY_STRATEGY_WITH_NONEMPTY_SOURCE

if primaryEligibleVisibleCount > 0
and routeReadyCount == 0:
  FAIL_PRIMARY_DENOMINATOR_ZERO_HIT

if routeReadyCount + fallbackEntryCount != visibleNonClaimCount:
  FAIL_INCOMPLETE_FALLBACK_COVERAGE
```

既知の脱敏 aggregate `visible=105 / routeReady=0 / fallback=0` は
`FAIL_EMPTY_STRATEGY_WITH_NONEMPTY_SOURCE` と
`FAIL_INCOMPLETE_FALLBACK_COVERAGE` を必ず返す。

この fixture には account ID、Cookie、token、raw payload、艦船・装備 instance ID、
private quest title を含めない。105 件という一つの snapshot から母集団 coverage を
推定してはならない。

## 本 task の完了条件

- coverage policy が固定 ID と revision を持つ
- authoring schema が runtime v1 と分離される
- `1..5` 選択契約が既存設計・受け入れと一致する
- primary/fallback denominator と status が機械可読である
- freshness、conflict、withdrawal、runtime v2 stop trigger が機械可読である
- zero-hit fixture が機械的に FAIL する
- 未審査 task fact、map template、recipe を追加していない
- protected communication path を変更していない

本 task は feature delivery ではなく contract wave であるため、Windows installer は
生成しない。後続の coverage UI/compiler feature が完了した時点で `npm run build:win`
を実行する。

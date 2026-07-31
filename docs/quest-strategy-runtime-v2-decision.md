# 任務攻略 runtime v2 決定記録

最終更新日: 2026-07-31

Task ID: `QSTRAT-RV2-001_Stage_Aware_Runtime`

Status: `ACCEPTED_FOR_IMPLEMENTATION`

## 決定理由

`QSTRAT-COV-001` の canonical inventory は、周期出撃任務 39 件のうち primary
denominator を 27 件に固定した。既存 runtime schema v1 で無損失に表現できるのは
12 件（44.44%）、multi-stage は 10 件（37.03%）だった。

これは coverage policy の停止条件を両方満たす。

- `v1_lossless_coverage < 80%`
- `unsupported_v1_multi_stage_ratio > 20%`

また既存 3 recipe は、任務 280、284、845、893 の一部海域だけを含みながら、任務全体を
covered として扱っていた。v1 recipe の追加だけでは、この誤差を解消できない。

根拠となる機械可読レポート:

- `knowledge/quest-strategy/generated/v1-lossless-report.json`
- `knowledge/quest-strategy/generated/conflict-and-gap-report.json`

## 採用するモデル

runtime v2 は quest 単位の recipe coverage ではなく、次の stage graph を使う。

```text
quest objective
  -> required stage 0..n
     -> allowed target map / result / count

reviewed route unit
  -> contribution to one or more exact stages

selected route units
  -> union of contributed stages
  -> all required stages present: route-ready
  -> some stages present: route-unreviewed / partial
  -> no reviewed route: objective-only fallback
```

複数海域の意味も区別する。

- `max` が 1 要素なら、複数 map は 1 stage の代替対象。
- `max` と map の要素数が同じなら、各 map は独立した必須 stage。
- 対応関係が不明な場合は `knowledge-insufficient` とし、推測しない。

## runtime 契約

- route unit は `questId` だけでなく `stageIndex` を明示する。
- route unit が objective の map / result / count と一致しない場合は contribution を拒否する。
- hard fleet constraint を schema が無損失に保持できない場合は complete coverage に数えない。
- multi-stage 任務は全 stage が揃うまで covered に数えない。
- partial route は表示してよいが、「一部の海域のみ」と残り stage を明示する。
- route がない visible non-claim 任務にも objective-only / knowledge-insufficient fallback を出す。
- claim 状態は planner の選択対象から除外する。
- 旧 v1 bundle は移行入力としてのみ読み、v2 audit を通過しない complete coverage を降格する。

## authoring / compiler 契約

- canonical quest fact と reviewed map template を別に管理する。
- compiler は route template と exact stage contribution を結合する。
- 同じ route signature の contribution だけを集約する。
- unknown hard fact、conflict、expired、withdrawn は route-ready へ昇格しない。
- manifest は source digest、compiler version、output digest、unsupported、withdrawal dependency
  を含む。

## UI 契約

選択候補は「recipe 登録済み任務」ではなく、すべての visible non-claim 任務とする。
各候補と結果に次の coverage status を表示する。

- `route-ready`
- `objective-only`
- `route-unreviewed`
- `conflicted`
- `unsupported-v1-multi-stage`
- `knowledge-insufficient`
- `withdrawn`

完全 route がないことと、任務の目標事実がないことを同じ空表示にしない。

## 非目標

- 艦これサーバーへの request / response 変更
- ゲーム操作の自動化
- runtime Wiki scraping
- account data の外送
- 未審査知識による成功率、最適性、必須編成の断定

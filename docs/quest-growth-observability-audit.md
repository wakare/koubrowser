# 新人向け成長トラック local observability audit

最終更新日: 2026-08-01

Task ID: `QGROWTH-R1A_Local_Observability_Audit`

Status: `AUDITED_WITH_GAPS_RUNTIME_BLOCKED`

## 結論

既存のローカル read-only state だけで、29 observable の取得経路を監査した。

- complete: 19
- partial: 8
- unavailable: 2
- 新規 communication hook: 0
- account snapshot の外送: 0
- runtime 推薦へ昇格: 0

監査が未実施なのではなく、取得できる範囲と不足が確定した状態である。詳細な path、symbol、
導出、制限、unknown fallback は
[`observability-map.json`](../knowledge/quest-growth/authoring/observability-map.json) に固定する。

## 既存状態で完全に取得できるもの

次は renderer の既存 `SvData`、任務 cache、または既存 local DB query から匿名集約できる。

- 艦隊の損傷・補給、入渠枠、解放艦隊数
- 解放済み・成功確認済み遠征
- 艦娘の練度帯、艦種別練度帯、改造可能状態、通常近代化改修の不足
- 受注中任務 ID、解放済み通常海域
- 対潜・航空・索敵装備カテゴリ数
- 勲章・改装設計図数、設計図を要求する改造需要
- 既存 EO catalog と mapinfo を組み合わせた解放済み EO

これらも raw 艦隊一覧を保存せず、count、band、warning の集約値だけを evaluator input とする。

## 部分的にしか取得できないもの

| Observable                        | 既存入力                          | 未解決部分                               |
| --------------------------------- | --------------------------------- | ---------------------------------------- |
| `modernization.material-summary`  | lock、艦種、近代化改修上昇値      | 希少艦・任務艦・重要艦を素材にしてよいか |
| `fleet.safety-state`              | 損傷、補給、入渠、素材候補        | 素材安全を自動断定できない               |
| `quest.visible-chain`             | live/cache 任務、curated relation | 全 tab と未登録 prerequisite             |
| `resources.bands`                 | 現在資源、local trend             | low/medium/high の審査済み閾値           |
| `ships.asw-capable-summary`       | 艦種、練度、対潜値、装備          | 海域・mechanic 別の十分な閾値            |
| `capability.surface-air-los-gaps` | 艦種、航空、索敵カテゴリ          | 審査済み gap rubric                      |
| `maps.eo-affordability`           | EO、資源、損傷、能力              | EO 別の route と負担条件                 |
| `capability.breadth-summary`      | 匿名の艦種・練度・装備・資源集約  | evergreen breadth rubric                 |

partial は推測で埋めない。将来の三カード UI では測定値と manual check を表示し、自動行動可能とは
表現しない。

## 現在取得できないもの

### `practice.available-count`

`ApiBasic` の累計演習数と直近演習結果は存在するが、現在の更新枠に残る相手数は確定できない。
新しい通信観測は追加せず、「演習画面を確認」と表示する。

### `event.overlay-status`

`SvData.inEvent` はイベント海域の存在しか表さず、攻略 overlay の版、審査、失効日は表さない。
署名済み・versioned・expiring な local overlay が作られるまでイベント固有推薦を block する。

## Milestone への影響

| Milestone                     | 主な local blocker                |
| ----------------------------- | --------------------------------- |
| safety executable             | 素材艦の安全性                    |
| system/fleet unlock           | 任務 chain coverage               |
| experience/modernization loop | 残り演習数                        |
| resource/periodic loop        | 資源 band 閾値                    |
| anti-submarine foundation     | map/mechanic 別 ASW readiness     |
| surface/air/LOS foundation    | gap rubric                        |
| normal map/EO/blueprint loop  | EO catalog と affordability       |
| event readiness overlay       | overlay package と breadth rubric |

したがって8 milestone は独立 approver に加えて、各 blocker の authoring が終わるまで runtime
promotion しない。unknown 時の fallback は全 observable で非空とする。

## 通信・プライバシー境界

- `src/main/kcbrowser.ts`、`src/preload/xhr-hook.ts`、`src/common/kcsapi_hook.ts` を変更しない。
- 新しい API 観測、runtime scraping、Cookie 利用を行わない。
- member ID、nickname、raw payload、完全な艦隊 snapshot を入力 artifact にしない。
- local DB を使う場合も既存 `queryDb` の read-only projection から匿名集約し、履歴明細を UI へ
  流さない。

## 次の実装 gate

pure evaluator を作る前に、次を満たす。

1. 8 partial observable の判断境界を `decision-rubrics.json` で独立審査する。
2. 2 unavailable observable は新規観測で補わず、manual fallback を evaluator test に固定する。
3. milestone と rubric を独立 approver が承認する。
4. quest strategy lineage gap を解決または明示的に受理する。

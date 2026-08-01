# 新人向け成長トラック調査

最終更新日: 2026-08-01

Task ID: `QGROWTH-R6_Route_Lineage_Authoring`

Status: `R6_AUTHORING_IMPLEMENTED_R7_NOT_AUTHORIZED`

## 目的

既存の任務攻略ルートは「選択した出撃任務の exact stage を、どの通常海域 route で進めるか」
を扱う。新人が必要とする「今何をすべきか、次に何が不足するか、長期的に何を整えるか」は、
演習、遠征、改造、近代化改修、装備、資源、EO、活動準備まで横断するため、同じ coverage
モデルへ入れない。

本調査は中国語・日本語コミュニティ資料を比較し、ローカル・オフライン・監査可能な
`GrowthMilestone` 候補を作る。Web Pro の助言は設計入力として利用したが、採用する資料は
Codex 側でも取得可否と主張範囲を再確認した。

- Web Pro discussion: https://chatgpt.com/c/WEB:fe82dda2-5e1b-42a5-8d4a-b4578ec291a4
- R6 Web Pro review: https://chatgpt.com/c/WEB:ad2e8942-0cfa-4225-b405-a13bee6bcda8
- audited repository base: `33abf8ff2534deaa7ce12007c001e1e1ea18837f`
- R6 audited repository base: `6b52e143af9fcab1dbb00b74f7e89bcf695e5e38`

両 Web Pro review の画面は Pro を示した。R6 の回答は `GPT-5.6 Pro` と自己申告したが、backend
route と no-fallback は証明できないため、分類は
`UI_PRO_AND_SELF_REPORT_PRO_ROUTE_UNVERIFIED / ROUTING_ATTESTATION_UNAVAILABLE` とする。モデル名や
応答時間を攻略 evidence として扱わない。

## 調査方法

hard mechanic は原則として、独立して読める二つ以上の資料を要求する。可能な場合は中国語と
日本語を一つずつ含める。同一 Wiki 内の複数ページ、明示的な転載、同じ上流資料を参照する
ページは自動的に独立資料として二重計上しない。

資料を次の三種類に分ける。

- `mechanic`: 交換条件、改造と近代化改修、遠征成功条件などの確定的仕様。
- `editorial`: 練度上げ場所、育成優先度、活動準備などアカウント条件に依存する助言。
- `historical`: 現在の自動推薦へ昇格させない過去環境の記録。

取得状態も分離する。

- `independently-readable`: 調査環境で本文を読み、主張範囲を確認した。
- `prompt-supplied-observation`: 利用者が許可したブラウザでは見えたが、独立取得できなかった。
- `unreadable`: URL は保持するが内容を補完しない。

## 主な資料

| Language | Source                                    | State                        | Supported scope                              |
| -------- | ----------------------------------------- | ---------------------------- | -------------------------------------------- |
| zh-CN    | 舰娘百科 `攻略:练级指南`                  | readable, updated 2026-03-04 | 演習、条件付き 1-5 / 2-2、固定最適解を否定   |
| zh-CN    | 舰娘百科 `远征列表`                       | readable                     | 遠征開放、成功条件、資源循環                 |
| zh-CN    | 舰娘百科 `近代化改修`                     | readable                     | 改造後の通常改修値、例外、早期強化の利害     |
| zh-CN    | 舰娘百科 `勋章和设计图`                   | readable                     | EO、勲章4個と設計図1枚の交換                 |
| zh-CN    | NGA 通常海域 v3.0                         | browser observation only     | 1-1～7-5、定期任務、基礎、更新履歴の調査候補 |
| ja-JP    | `新米提督の手引き`                        | readable, updated 2026-05-18 | 演習、遠征、改造と近代化改修の基礎           |
| ja-JP    | 攻略 Wiki `遠征`                          | readable, updated 2026-07-21 | 開放、成功・大成功、報酬                     |
| ja-JP    | 攻略 Wiki `改装設計図`                    | readable, updated 2026-05-27 | 勲章と設計図の取得機構                       |
| ja-JP    | ぜかまし `初心者のレベリング`             | readable, updated 2024-05-23 | 条件付き 1-5 / 2-2 / 4-4 候補                |
| ja-JP    | よんごう `初心者・復帰勢向け艦隊運営方針` | readable, updated 2026-07-08 | 時間・資源・艦隊状況に合わせた段階的強化     |

全 URL、取得区分、更新日、review window、対応 claim は
[`evidence-ledger.json`](../knowledge/quest-growth/authoring/evidence-ledger.json) に固定する。

## 交差確認した結論

### 高 confidence の mechanic 候補

1. 演習は複数艦種の経験獲得に使え、演習損傷を入渠修理へ持ち越さない。
2. 遠征は資源循環の基礎だが、艦種、隻数、レベル、補給などの成功条件を満たす必要がある。
3. 通常の火力・雷装・対空・装甲の近代化改修値は改造後に引き継がれず、運、対潜、耐久には
   例外がある。
4. 勲章4個を改装設計図1枚へ交換でき、月次 EO などが定期取得源になる。

### 条件付き editorial 候補

1. 1-5、2-2、4-4 などは育成候補だが、司令部レベル、艦種、装備、資源、入渠余力で適否が
   変わる。
2. 育成、装備、任務、海域の順序は固定せず、現在の能力不足と利用者の目標で選ぶ。
3. 活動準備は艦種・装備・資源の幅を考慮するが、具体的必要数と活動 route は短期 overlay
   として別に審査する。

### 現時点で昇格しない内容

- NGA で観察した 2-1、2-2、1-5、3-3、4-4、5-2 の定期任務組合せ。
- 全新人に共通する最適練度上げ海域。
- 固定装備数、固定艦娘育成順、改装設計図の絶対優先順位。
- 追加艦隊解放の完全な quest ID / prerequisite chain。
- 活動固有の札、特効、難易度、必要数を evergreen knowledge にすること。

## 成長構造

単一の地図順ではなく、次の依存関係を持つ成長 DAG とする。

```text
安全確認
  ├─ 艦隊・遠征解放 ── 資源循環 ── 有益な周期任務
  ├─ 演習 ── 改造・近代化 ── 複数艦種の経験層
  └─ 通常海域 ── 能力不足の発見 ── 対潜 / 制空 / 索敵 / 輸送
                                      └─ EO ── 勲章 ── 設計図
                                                        └─ 活動準備
```

候補 milestone は次の8件とする。

1. 安全に実行できる状態。
2. 艦隊枠と遠征解放。
3. 演習・改造・近代化ループ。
4. 遠征・資源・周期任務ループ。
5. 基礎対潜。
6. 水上戦・制空・索敵の能力幅。
7. 通常海域・EO・改装設計図ループ。
8. 活動期だけ有効な短期 overlay。

8件の現在の意味は project owner が承認した。R6 では安全 gate を route family に含めず、残り6件を
非実行 route lineage として authoring した。活動 overlay も短期性が高いため pilot から除外する。
local observability gap と R7 publication block が残るため runtime へ含めない。

## R6 route family と証拠血縁

R6 pilot は次の6 family に限定する。

1. system / fleet unlock
2. experience / remodel / modernization
3. expedition / resource / periodic loop
4. anti-submarine foundation
5. surface / air / LoS foundation
6. normal map / EO / blueprint loop

独立性は URL 数ではなく claim 単位の editorial ecosystem で数える。同じ Wiki の複数ページは一つの
group、転載・同じ上流は一つの group とし、NGA の browser observation は調査候補として保持しても
独立可読 evidence に数えない。現 pilot は KCWiki、攻略 Wiki、ぜかまし、よんごうの5 group と16件の
claim support を記録する。各 route unit は具体的 route を持たず、policy / lineage / unit が draft の
間は `MANUAL_CHECK_ONLY` へ fail closed する。

## プライバシーとゲーム通信

- runtime Web scraping を行わない。
- Cookie、member ID、アカウント識別子、原始通信、完全な艦隊一覧を保存または外送しない。
- 既存のローカル読み取りで安全に得られる集約状態だけを将来の predicate 候補とする。
- `src/main/kcbrowser.ts`、`src/preload/xhr-hook.ts`、`src/common/kcsapi_hook.ts` の通信意味を
  変更しない。
- 自動出撃、自動編成、自動任務操作を行わない。

## Wave 2 判断結果

author / approver 分離と local observability audit は完了し、partial / unavailable は manual fallback
に固定した。R6 authoring と pure eligibility evaluator は追加したが、独立承認と R7 authorization は
未完了のため、引き続き具体的 route を返さない。

1. author と approver が分離している。
2. hard mechanic の claim に独立して読める資料が二つ以上ある。
3. 各 predicate の local observable audit で `complete` とされた入力だけを自動判定に使い、
   `partial` / `unavailable` は manual fallback に固定する。
4. unknown、conflicted、expired、partial の場合も三カードが空にならない。
5. quest strategy generated artifacts の `0505bc...` lineage gap は R6 の別 schema で上書きせず、
   R7 publication block として明示的に受理する。

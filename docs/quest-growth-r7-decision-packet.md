# 新人成長ルート R7 判断 packet

最終更新日: 2026-08-02

Task ID: `QGROWTH-R7-0_CONCRETE_ROUTE_DECISION_PACKET`

Status: `OWNER_DECISION_REQUIRED_R7_NOT_AUTHORIZED`

## 目的

R6 で承認済みの6 route family を、将来具体的な海域、編成、装備、分岐条件へ接続する前に、
R7 の許可範囲と順序を独立して決める。本 packet 自体は decision-only であり、具体的 route、
renderer 接続、実アカウント受け入れ、runtime publication を許可しない。

machine-readable request は
[`r7-authorization-request.json`](../knowledge/quest-growth/decisions/r7-authorization-request.json)、
compiler report は
[`r7-authorization-report.json`](../knowledge/quest-growth/generated/r7-authorization-report.json)
とする。

R6 basis は次に固定する。

- repository commit: `09a9ae0af19979f07a908ae93fc739c9600fb14c`
- R6 approval packet SHA-256:
  `9982237824796126a35a5490d7a7e39fec839552624b130f37f8b4ae75cf0164`
- R6 status: `R6_AUTHORING_APPROVED`
- publication authorization: `R7_NOT_AUTHORIZED`

## 分離する6 gate

1. `r7-schema-output-class`
   - 具体的 field を表現できる versioned schema の作成だけを許可する。
2. `r7-pilot-content-authoring`
   - 選定した family の具体的攻略内容を、独立 evidence review 後に authoring する。
3. `r7-renderer-opt-in-integration`
   - 審査済み route を利用者が明示的に開いた場合だけ表示する。
4. `r7-real-account-readonly-acceptance`
   - 利用者の手動ログインと GAME START 後に、脱敏した只読表示を確認する。
5. `r7-runtime-publication`
   - 署名、rollback、失効・撤回 gate を通った内容だけを runtime bundle へ含める。
6. `r7-default-enablement`
   - publication 後も、既定有効化は別の release 判断とする。

現在は6件すべて `not-authorized` である。前段の承認は後段の承認へ自動変換しない。

## 提案する output class

- `reviewed-concrete-route`: exact revision と evidence digest に固定された具体的 route。
- `manual-check-route`: route は審査済みだが、現在条件を利用者が確認する必要がある。
- `objective-only`: 目標事実だけを表示し、route を提示しない。
- `knowledge-insufficient`: evidence、式、適用条件が不足している。
- `withdrawn`: 失効、競合、撤回により利用できない。

具体的 field は `mapKey`、target node、fleet / equipment constraint、formation、air state、
branch condition、sortie instruction を想定する。各 field は versioned evidence を必要とし、unknown
を推測で補わない。

自動操作、ゲーム通信変更、runtime scraping、account data 外送、未審査の成功・最適性断定は、
R7 の承認状態に関係なく禁止する。

## 初期 pilot の提案

初期 family は最大2件とする。compiler は6 family をすべて候補表に保持し、owner が選ぶまで
`selectedInitialFamilies` を空に固定する。

| Family | R6 state | 提案 | 理由 |
| --- | --- | --- | --- |
| system / fleet unlock | `R7_CANDIDATE` | defer | 完全な任務前置 chain の curated coverage が不足 |
| experience / remodel / modernization | `MANUAL_CHECK_ONLY` | defer | 現在の残り演習機会を完全には観測できない |
| expedition / resource / periodic loop | `R7_CANDIDATE` | Wave A | 解放・履歴・受注状態を利用し、現在条件を manual gate にできる |
| anti-submarine foundation | `R7_CANDIDATE` | Wave A | 戦闘型 route の target rule と evidence gate を小さく検証できる |
| surface / air / LoS foundation | `R7_CANDIDATE` | defer | versioned formula と route variant が先に必要 |
| normal map / EO / blueprint loop | `R7_CANDIDATE` | defer | route と affordability の review window が短い |

推奨する Wave A は次の2件である。

- `expedition-resource-periodic-loop`
- `anti-submarine-foundation`

これは選択案であり、具体的攻略内容の承認ではない。

## 次に必要な owner 判断

最小の次段階は schema gate と pilot 選択だけを承認し、空 schema、validator、匿名 fixture までを
許可することとする。具体的 route authoring は次の独立判断まで開始しない。

承認する場合の推奨文面:

> `r7-authorization-report.json` の `r7-schema-output-class` gate semantic digest に固定して
> schema gate を承認し、初期 pilot として
> `expedition-resource-periodic-loop` と `anti-submarine-foundation` を選択する。
> 承認範囲は空の schema、validator、匿名 synthetic fixture までとする。具体的 route content、
> renderer integration、real-account acceptance、runtime publication、default enablement は承認しない。

別 family を選ぶ場合は、最大2件を route family ID で指定する。

## Fail-closed 条件

- R6 approval packet の digest が変わった場合は request を再作成する。
- authorization gate が owner review なしで変更された場合は compiler error とする。
- pilot candidate の R6 decision が generated report と一致しない場合は compiler error とする。
- concrete route artifact count と runtime eligible count は R7-0 では常に0とする。
- R6 authoring schema は引き続き concrete field を拒否する。

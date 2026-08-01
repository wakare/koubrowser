# 新人成長ルート R6 判断記録

最終更新日: 2026-08-02

Task ID: `QGROWTH-R6-1_INDEPENDENT_APPROVAL_PACKET`

Status: `R6_AUTHORING_APPROVED_R7_NOT_AUTHORIZED`

## 判断

project owner は 2026-08-01 に、次の順序で `R6 Reviewed Route Lineage` を進めることを
許可した。

- route lineage authoring schema
- claim-scoped evidence lineage と独立性 group
- fail-closed runtime eligibility gate
- non-actionable な pilot route family
- compiler、generated diagnostics、匿名 synthetic fixture

この判断は exact repository commit
`6b52e143af9fcab1dbb00b74f7e89bcf695e5e38` を planning baseline とする。
実際の authoring artifact は、その後の commit と digest を publication identity に記録する。

## 明示的に許可しないもの

- `R7 Reviewed Concrete Route UI`
- 具体的な海域、編成、装備、陣形、分岐、出撃手順の runtime 出力
- route runtime bundle または renderer 接続
- runtime Wiki fetch / scraping
- 新しいゲーム通信観測
- request、response、game state、server communication semantics の変更
- account data、raw payload、Cookie、member ID、nickname、instance ID の保存・外送

R6 の content review、schema validation、または authoring coverage は R7 の実装・公開承認へ
自動的に変換しない。R6 中の global publication authorization は常に
`R7_NOT_AUTHORIZED` とし、runtime eligible count は 0 に固定する。

## Web Pro advisory

ChatGPT Web の `Pro` 表示セッションで exact commit と中日コミュニティ資料の追加レビューを
行った。

- conversation: https://chatgpt.com/c/WEB:ad2e8942-0cfa-4225-b405-a13bee6bcda8
- requested exact files: 10
- exact retrieval: 9 success、1 failed
- failed requested path: `scripts/compile-quest-growth-data.js`
- locally verified actual path: `scripts/compile-quest-growth.js`

UI は account plan と composer に `Pro` を表示し、回答は `GPT-5.6 Pro` と自己申告したが、
authoritative backend route / fallback attestation は提供されなかった。分類は
`UI_PRO_AND_SELF_REPORT_PRO_ROUTE_UNVERIFIED` および
`ROUTING_ATTESTATION_UNAVAILABLE` とする。Web 回答は advisory であり、project owner の判断、
`AGENTS.md`、local source、compiler と test を上書きしない。

## 次の独立判断

R6 policy、pilot authoring revision、evidence lineage と generated digest の独立レビュー packet を
生成した。author と approver は分離し、承認は exact revision と canonical semantic digest に固定する。
承認対象と範囲は [`quest-growth-r6-approval-checklist.md`](quest-growth-r6-approval-checklist.md) に示す。
project owner は 2026-08-01T17:06:53.674Z に current semantic digest の policy 1件、lineage
6件、route unit 6件を R6 authoring review に限って承認した。
R6 完了後も、R7 schema、output class、real-account read-only acceptance、release enablement は
それぞれ独立した owner 判断を必要とする。

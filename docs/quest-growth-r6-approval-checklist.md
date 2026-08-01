# 新人成長ルート R6 独立承認チェックリスト

最終更新日: 2026-08-02

Task ID: `QGROWTH-R6-1_INDEPENDENT_APPROVAL_PACKET`

Status: `OWNER_DECISION_PENDING`

## 承認対象

承認対象の machine-readable identity は
[`route-approval-packet.json`](../knowledge/quest-growth/generated/route-approval-packet.json) とする。
packet は次の13項目を revision と canonical semantic SHA-256 に固定する。

- route eligibility policy: 1件
- route lineage: 6件
- non-actionable route unit: 6件
- evidence lineage raw digest: 1件（独立性 group 5件、claim support 16件）

semantic digest は top-level `status` と `review` だけを除外して計算する。したがって draft から
reviewed / approved への遷移と approver 記録では変化せず、目標、参照、観測、step category、
fallback、freshness、禁止 field などの意味が変われば一致しなくなる。

## Policy の確認事項

- hard mechanic / editorial は claim 単位で最低2 independent group を要求する。
- prompt-only、unreadable、reprint、same-editorial-ecosystem は独立 group に数えない。
- safety milestone は全 route unit の manual prerequisite とする。
- partial observable を automatic gate に使わず、unavailable observable も gate に使わない。
- author と approver を分離し、approved / reviewed 状態では semantic digest の完全一致を要求する。
- `steps`、`mapKey`、海域 node、具体的艦隊・艦娘・装備・陣形・航空状態・資源量・成功率を R6
  authoring field として拒否する。
- publication authorization は `R7_NOT_AUTHORIZED` のままとする。

## Lineage / unit の確認事項

次の6 family を1 lineage + 1 non-actionable unit ずつ審査する。

1. system / fleet unlock
2. experience / remodel / modernization
3. expedition / resource / periodic loop
4. anti-submarine foundation
5. surface / air / LoS foundation
6. normal map / EO / blueprint loop

各 unit は目標、適用条件、手動安全 gate、監査済み observable、抽象 step category、benefit、cost、
risk、stop condition、非空 fallback だけを持つ。具体的攻略 route や実行命令は持たない。

## この承認に含まれないもの

- R7 schema または concrete route UI
- route runtime publication / release enablement
- 具体的な海域、編成、装備、分岐、出撃手順
- real-account acceptance
- 新しい通信観測、runtime scraping、保存、外送

## Project owner の判断形式

承認する場合は、次の範囲を明記する。

> `route-approval-packet.json` の current semantic digest に固定された policy 1件、lineage 6件、
> route unit 6件を R6 authoring review として承認する。R7、runtime publication、real-account
> acceptance は承認しない。

修正する場合は policy、lineage ID、または route unit ID と変更内容を指定する。承認後に semantic
content を変更した場合は digest mismatch となり、再承認が必要になる。

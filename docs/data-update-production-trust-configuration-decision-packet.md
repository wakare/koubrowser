# Data update production trust configuration authoring decision packet

最終更新日: 2026-08-03

Status: `OWNER_DECISION_REQUIRED`

## 目的

Issue #29 の最初の production gate として、正式な manifest URL、Ed25519 public key、独立照合済み
fingerprint を固定 trust configuration へ同時に組み込む authoring 範囲だけを申請する。本 packet の
作成は production 値の書込、外部接続、bundle signing、staging acceptance、runtime publication、
default enablement または installer build / publication を許可しない。

machine-readable request は
[`production-trust-configuration-authoring-request.json`](../knowledge/data-update/decisions/production-trust-configuration-authoring-request.json)
とする。

## owner が事前に用意する公開情報

1. credential、userinfo、fragment を含まない正式 HTTPS manifest URL
2. Ed25519 DER SPKI Base64 public key
3. public key bytes を別経路で照合した SHA-256 fingerprint
4. release author、independent reviewer、staging operator の実担当者
5. key / passphrase 分離保管、独立 backup 2件、rotation / recovery、incident owner の運用記録

private key、passphrase、credential、token、authenticated URL、account data はチャットや repository に
提供しない。公開鍵、公開 fingerprint、credential-free URL は review 後に repository へ固定できる。

三つの公開入力は production code を変更する前に、次の command でオフライン照合する。この command は
URLへ接続せず、URL全文と公開鍵本文を出力しない。

```powershell
npm run data:trust:verify -- `
  --manifest-url <HTTPS_URL> `
  --public-key-file <PUBLIC_KEY_FILE> `
  --public-key-sha256 <INDEPENDENTLY_VERIFIED_SHA256>
```

## 承認対象の4 path

- `src/main/data-update-deployment.ts`
- `src/main/__tests__/data-update-deployment.test.ts`
- `docs/data-update.md`
- `docs/data-update-key-operations.md`

三つの trust value は同時設定し、partial / invalid / fingerprint mismatch は network access 前に
fail closed させる。production environment override の拒否を維持する。

## 承認しても実行しないこと

- 実在 endpoint への接続
- signed bundle または release record の生成・検証
- staging acceptance
- runtime publication / default enablement
- runtime eligible count の変更
- installer build / publication
- game communication の変更

## 承認文面

固定摘要と公開入力を別経路で確認した後、次の形で authoring だけを承認する。

> 批准固定摘要对应的 `data-update-production-trust-configuration-authoring` revision 2。仅授权在固定4个路径中，
> 将另行提供并独立核验的 credential-free HTTPS manifest URL、Ed25519 DER SPKI Base64 public key 和
> SHA-256 fingerprint 同时写入固定 trust configuration，并补充 fail-closed tests 与非秘密运维文档。
> 不得处理 private key、passphrase、credential、token、authenticated URL 或 account data，不得连接外部
> endpoint、签名或发布 bundle、执行 release record/staging acceptance/runtime publication/default enablement，
> 不得改变 runtime eligible count、构建/发布安装包或修改游戏通信。

固定摘要:

- request SHA-256:
  `sha256:abe9755751637d080af15c0683441449dcc15ddb62c452e090f4a2002c9b1827`
- revision 2 adds the offline no-network public-input verifier; no production input value is present and
  the four-path authoring scope is unchanged
- implementation authorization: `not-authorized`
- authorized path count: `4`
- required public input count: `5`
- runtime eligible count: `0`

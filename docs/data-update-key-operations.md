# データ更新署名鍵の運用

この文書は、甲ブラウザ用データ更新の Ed25519 秘密鍵を生成、保管、使用、バックアップ、
ローテーション、廃止する際の必須手順を定める。正式配布を始める前に、末尾の運用決定欄を
実名の担当者と実在する保管先で埋め、発行担当者とは別の審査者が承認する。

ゲーム、DMM、ユーザーアカウントの credential はこの運用に使用しない。署名鍵は
甲ブラウザ用データ bundle だけに使用し、アプリやゲームサーバーとの通信を変更する用途には
使用しない。

## 役割分離

1 回の正式リリースでは、少なくとも次の 2 役を別の人が担当する。

- **鍵管理・発行担当者**: 秘密鍵を解錠し、審査済み入力から bundle を作成する。
- **審査・配布担当者**: 公開鍵だけで bundle と配布審査記録を検証し、staging へ配置して
  HTTPS 受け入れを実行する。

発行担当者は自分が作成した bundle を単独で production に配置しない。審査担当者は
秘密鍵、秘密鍵の passphrase、復旧用バックアップへアクセスしない。配布先の credential
と秘密鍵も同じ保管場所へ置かない。

## 鍵の生成と保管

鍵は、OS と Node.js を更新済みの管理対象端末で、リポジトリや同期フォルダの外に生成する。
暗号化されていない秘密鍵を正式運用に使用しない。

```powershell
npm run data:key:generate -- `
  --private-key-output path/to/private-key.pem `
  --public-key-output path/to/public-key.txt `
  --private-key-passphrase-file path/to/temporary-passphrase.txt
```

事前に password manager などで生成した強い passphrase を、暗号化作業領域の 1 行の
一時ファイルへ安全に用意する。passphrase を command line、PowerShell history、
環境変数、issue、チャット、release record に記録しない。command は既存の出力を
上書きせず、AES-256-CBC で暗号化した PKCS#8 PEM と正規化した DER SPKI Base64
公開鍵を同時に作る。

秘密鍵と passphrase は別の管理境界に置く。推奨する最低条件は次のとおり。

- 秘密鍵は、管理対象の暗号化オフライン媒体または暗号化された専用保管庫に置く。
- passphrase は組織の password manager など、秘密鍵媒体とは別の保管先に置く。
- 日常利用端末、クラウド同期フォルダ、共有ドライブ、ソースリポジトリには置かない。
- 秘密鍵ファイル、passphrase ファイル、保管 directory に、発行担当者以外の読み取り権限を
  与えない。
- 正式鍵の fingerprint と生成日だけを非秘密の鍵台帳に記録する。秘密鍵 path や
  passphrase は記録しない。

現在の publisher は PEM ファイルをソフトウェアで読み込む。HSM や hardware token の
非 export 鍵を直接使用する機能はない。HSM を採用する場合は、正式鍵を生成する前に
publisher の外部署名対応を別タスクとして実装・審査する。

## 公開鍵と fingerprint

公開鍵は秘密ではないが、秘密鍵とは別経路で fingerprint を確認する。

```powershell
npm run data:key:inspect -- --public-key-file path/to/public-key.txt
```

発行担当者は正規化された公開鍵を渡し、審査担当者は別経路で受け取った 64 文字の
SHA-256 fingerprint と照合する。`src/main/data-update-deployment.ts` に固定する公開鍵と
fingerprint も、この出力と byte 単位で一致させる。

## バックアップと復旧試験

正式鍵は、暗号化したバックアップを 2 個以上作り、同じ障害、盗難、管理者アカウントで
同時に失われない場所へ分離する。passphrase の復旧手段も鍵媒体とは分離する。

少なくとも 6 か月ごと、および担当者・保管方式の変更後に、production へ接続しない隔離端末で
次を確認する。

1. バックアップと passphrase を、承認済みの 2 人が手順どおり取得できる。
2. 復元した鍵で使い捨て version の test bundle を署名できる。
3. publisher が表示する公開鍵 fingerprint が鍵台帳と一致する。
4. 別担当者が鍵台帳の公開鍵を使い、`data:bundle:verify` で test bundle を検証できる。
5. test bundle、作業用 passphrase ファイル、復元した一時コピーを暗号化作業領域ごと
   破棄し、試験日と成否だけを鍵台帳へ記録する。

復旧試験を通っていないバックアップは、正式配布の復旧手段として数えない。

## 署名作業

署名は、リポジトリ外の暗号化作業領域で行う。publisher に渡す passphrase ファイルは
1 行だけの一時ファイルとし、password manager などから安全に作成する。passphrase を
埋め込んだ `Set-Content`、`echo`、command line 引数は shell history に残り得るため使わない。

publisher は passphrase の command line 指定を提供しない。`--private-key-passphrase-file`
は実ファイルだけを受け付け、symlink、空ファイル、複数行、NUL、4 KiB を超える入力を拒否する。

```powershell
npm run data:bundle -- --version 2026.07.30.1 `
  --private-key path/to/private-key.pem `
  --private-key-passphrase-file path/to/temporary-passphrase.txt `
  --quest-knowledge docs/data-update-candidates/quest-knowledge-reviewed-v1.json `
  --output path/to/output
```

署名後は次の順で処理する。

1. 発行担当者が表示された公開鍵 fingerprint を鍵台帳と照合する。
2. passphrase ファイルと復号された一時コピーを、暗号化作業領域ごと閉じるか破棄する。
   SSD 上の通常削除を安全な消去とみなさない。
3. 公開可能な bundle、公開鍵、候補データだけを審査担当者へ渡す。
4. 審査担当者が `data:bundle:verify` を実行する。
5. 審査担当者が `data:release:record` で bundle、正式 URL、公開鍵 fingerprint、候補 bytes
   を 1 つの JSON 記録へ固定する。
6. 保存後の記録を `data:release:verify` で同じ公開証拠から独立して再検証する。
7. 同じ組み合わせだけを staging に配置し、`smoke:accept:data-update` を実行する。

秘密鍵、passphrase、秘密鍵 path、配布 credential、個人情報を bundle、審査記録、
CI artifact、公開ログへ含めない。

## 定期ローテーション

正式運用開始時にローテーション周期を決め、少なくとも次の場合は新しい鍵へ切り替える。

- 定めた有効期間へ到達する前。
- 鍵管理担当者、保管方式、管理組織が変わる。
- バックアップの所在やアクセス履歴を説明できない。
- 秘密鍵または passphrase の漏えいを疑う。

公開鍵はアプリへ固定されており、bundle だけでは trust root を変更できない。通常の
ローテーションは次の順を守る。

1. 新しい鍵を生成し、別経路で fingerprint を確認する。
2. 旧鍵・旧 bundle を保持したまま、新公開鍵と fingerprint を固定したアプリ版を作る。
3. 新アプリ版の自動テストと staging 受け入れを完了し、先に配布する。
4. 旧・新 bundle を `data:key:rotation:verify` で検証する。
5. 新アプリが十分に配布された後、新鍵で署名した bundle へ配布元を切り替える。
6. 旧鍵を廃止状態にし、必要な監査期間後に全コピーを破棄する。破棄日を鍵台帳へ記録する。

旧アプリは新鍵の bundle を受け入れず、検証済みキャッシュまたは同梱データを使う。この
安全側の動作を回避するために旧鍵で新 bundle を再署名しない。

## 紛失・漏えい時の対応

鍵の紛失、意図しないアクセス、端末侵害、passphrase 漏えい、所在不明のコピーを検知したら、
確証を待たず次を実施する。

1. データ更新の新規発行と staging/production 配置を停止する。
2. 影響する fingerprint、最後に確認済みの release record、検知時刻、影響期間を記録する。
   秘密値は incident ticket に貼らない。
3. 配布先 credential の侵害有無を別に確認し、必要なら無効化する。
4. 制御できる配布先では、最後に独立審査済みの bundle だけを維持する。配布先も侵害された
   場合は manifest を停止する。
5. 新しい管理境界で新鍵を生成し、新 fingerprint を固定した緊急アプリ版を作る。
6. 緊急アプリ版では旧鍵で検証済みのローカル cache も信頼されないこと、新 bundle または
   同梱データへ安全にフォールバックすることを確認する。
7. 新アプリ版を先に配布し、その後に新鍵の bundle を配置する。旧鍵で緊急 bundle を
   発行しない。
8. incident の原因、影響した release、利用者への告知要否、全コピーの廃止を記録する。

秘密鍵を失っただけで漏えいの証拠がない場合も、同じ鍵での発行は継続できない。バックアップの
復旧試験が成功しなければ、新アプリ版による trust root ローテーションを行う。

有効な旧鍵で署名された悪意ある bundle が既に有効化された可能性がある場合、配布元を止める
だけではローカル cache を無効化できない。新鍵を固定したアプリ版によって旧 cache の署名を
拒否させることを必須とする。

## 公開記録と秘密記録

公開リポジトリまたは release artifact に保持できるもの:

- 公開鍵と SHA-256 fingerprint
- 署名済み bundle
- `data:release:record` の JSON
- `data:bundle:verify`、`data:release:verify`、`data:key:rotation:verify`、staging acceptance の
  redacted summary

アクセス制限された鍵台帳だけに保持するもの:

- 鍵の状態（active、rotating、retired、compromised）
- 生成、復旧試験、ローテーション、破棄の日付
- 担当者と承認記録
- 保管媒体の資産 ID。ファイル path、passphrase、秘密鍵本体は記録しない。

## 正式運用前の決定欄

次の項目がすべて実在する値で承認されるまで、
`src/main/data-update-deployment.ts` の正式 trust config は未設定のままにする。

| 項目                         | 決定内容 |
| ---------------------------- | -------- |
| 鍵管理・発行担当者           | 未決定   |
| 審査・配布担当者             | 未決定   |
| 主秘密鍵の保管方式・資産 ID  | 未決定   |
| backup 1 の管理境界・資産 ID | 未決定   |
| backup 2 の管理境界・資産 ID | 未決定   |
| passphrase の別管理先        | 未決定   |
| ローテーション周期           | 未決定   |
| 復旧試験の周期と次回期限     | 未決定   |
| incident 連絡先              | 未決定   |
| 正式 manifest URL            | 未決定   |
| 正式公開鍵 fingerprint       | 未決定   |

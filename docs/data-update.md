# データ更新

Issue #29 の更新基盤として、地図 JSON と審査済み任務知識をアプリ本体の更新から分離できる。

## 信頼モデル

- マニフェスト全体を Ed25519 で署名する。
- 各ファイルのパス、サイズ、SHA-256 を署名対象に含める。
- 地図 JSON と任務知識 JSON の構造もインストール前と次回起動時に検証する。
- HTTPS を必須とし、マニフェストとデータファイルは同一オリジンに限定する。
- ダウンロード、署名、ハッシュ、JSON のいずれかが不正なら、現在の検証済みキャッシュまたはアプリ同梱データを使う。
- 新しいデータはバージョン別ディレクトリへ保存し、完全に検証した後に有効化する。実行中の Main/Worker 間でデータが混在しないよう、次回起動から使用する。

データ更新はゲームサーバーとの通信を読み書きせず、甲ブラウザ用の配布元とのみ通信する。

任務知識はコードではなく、参照元、確認日、前提任務、審査状態と、任意の審査済み
攻略 recipe だけを持つ宣言的 JSON に限定する。参照 URL は `wikiwiki.jp` または
`zh.kcwiki.cn` の HTTPS URL のみ許可し、未知のフィールド、未知の schema version、
重複した参照元、自己参照、不正な件数や文字列は拒否する。

`quest/knowledge.json` に含まれる任務 ID は、その ID の同梱済み参照情報をまとめて
置き換える。含まれない任務は同梱データを使い続ける。任意の `strategy` が存在する
場合は bundle 全体の署名・hash と攻略 schema の両方を検証してから置き換える。
ファイルがない場合や検証に失敗した場合、攻略知識も含めて同梱データへ
フォールバックする。

## 署名鍵

秘密鍵はリポジトリ外で生成し、暗号化して保管する。事前に password manager などで
生成した強い passphrase を、暗号化作業領域の 1 行の一時ファイルへ安全に用意する。

```powershell
npm run data:key:generate -- --private-key-output path/to/private-key.pem --public-key-output path/to/public-key.txt --private-key-passphrase-file path/to/temporary-passphrase.txt
```

秘密鍵、passphrase、トークン、配布環境の認証情報はリポジトリへ追加しない。
passphrase は command line や環境変数へ入れず、署名時だけ暗号化作業領域に置く 1 行の
一時ファイルを `--private-key-passphrase-file` で渡す。ファイルは symlink、空、
複数行、NUL、4 KiB 超を拒否する。
鍵生成 command は既存の出力を上書きせず、AES-256-CBC で暗号化した PKCS#8 PEM と
正規化した DER SPKI Base64 公開鍵を同時に作る。

```powershell
npm run data:bundle -- --version 2026.07.29.1 --private-key path/to/private-key.pem --private-key-passphrase-file path/to/temporary-passphrase.txt --output path/to/output
```

役割分離、鍵と passphrase の別保管、2 個以上の backup、復旧試験、署名作業、
ローテーション、漏えい時の順序は
[`data-update-key-operations.md`](data-update-key-operations.md) を正式運用前に承認する。

受け取った公開鍵ファイルは、bundle や秘密鍵へアクセスせずに正規化された DER SPKI
Base64 と SHA-256 指紋を確認できる。

```powershell
npm run data:key:inspect -- --public-key-file path/to/public-key.txt
```

inline で受け取った公開鍵を確認する場合は `--public-key '<DER SPKI base64 public key>'`
を使う。両方の指定、未知 option、重複 option、Ed25519 以外の鍵は拒否する。
表示された `KOU_DATA_UPDATE_PUBLIC_KEY` をアプリ設定候補に使い、
`KOU_DATA_UPDATE_PUBLIC_KEY_SHA256` は別経路で受け取った指紋と照合する。

## データパッケージ作成

空または存在しない出力先を指定する。

```powershell
npm run data:bundle -- --version 2026.07.29.1 --private-key path/to/private-key.pem --private-key-passphrase-file path/to/temporary-passphrase.txt --output path/to/output
```

審査済み任務知識も含める場合:

```powershell
npm run data:bundle -- --version 2026.07.29.1 --private-key path/to/private-key.pem --private-key-passphrase-file path/to/temporary-passphrase.txt --quest-knowledge path/to/knowledge.json --output path/to/output
```

任務知識ファイルの最小例:

```json
{
  "schemaVersion": 1,
  "claims": [
    {
      "source": "wikiwiki",
      "sourceLabel": "日本語攻略Wiki",
      "url": "https://wikiwiki.jp/kancolle/任務/出撃任務",
      "lastVerifiedAt": "2026-07-29",
      "dataVersion": "ページ確認 2026-07-29",
      "questId": 216,
      "questTitle": "敵艦隊主力を撃滅せよ！",
      "prerequisites": [
        {
          "mode": "all",
          "quests": [
            {
              "questId": 201,
              "title": "敵艦隊を撃破せよ！"
            }
          ]
        }
      ]
    }
  ]
}
```

攻略 recipe も同じ署名対象へ含める場合、最上位に `strategy` を追加し、その中へ
`schemaVersion`、知識 `version`、審査済み `recipes` を置く。`recipes` は 1～512 件に
限定し、各 recipe の未知フィールド、未知 schema、重複 ID、不正な evidence、
失効条件、艦種・装備・海域の型を publisher とアプリの両方で拒否する。完全な構造は
[`quest-strategy-route-design.md`](quest-strategy-route-design.md) を参照する。

再現可能な発行時刻を指定する場合:

```powershell
npm run data:bundle -- --version 2026.07.29.1 --published-at 2026-07-29T00:00:00.000Z --private-key path/to/private-key.pem --private-key-passphrase-file path/to/temporary-passphrase.txt --output path/to/output
```

出力される `manifest.json`、`map/`、任務知識を指定した場合の `quest/` を、同じ HTTPS オリジンで公開する。スクリプトが表示する `KOU_DATA_UPDATE_PUBLIC_KEY` は公開鍵であり、アプリ側の検証設定に使う。
同時に表示する `KOU_DATA_UPDATE_PUBLIC_KEY_SHA256` は DER SPKI bytes の SHA-256
（64 文字の小文字 hex）であり、公開鍵本体とは別の経路で発行担当者と審査者が照合する。

作成スクリプトは出力後に、公開鍵による署名、全ファイルのサイズと SHA-256、
クライアントと同じ地図・任務知識スキーマ、manifest にない余分なファイルがないことを
再検証する。クライアントが拒否する地図データは発行時点で拒否される。
CLI は宣言済み option だけを受け付け、未知 option と同じ option の重複指定を、
秘密鍵・入力データ・出力先へアクセスする前に拒否する。option 名の誤記や後勝ちの
上書きによって、意図と異なる bundle を発行しない。

## 初回の任務知識候補

[`data-update-candidates/quest-knowledge-reviewed-v1.json`](data-update-candidates/quest-knowledge-reviewed-v1.json)
は、内蔵任務知識から日本語攻略 Wiki と中文 KCWiki の 2 情報源が完全に一致し、
両方とも verified の task だけを出力した署名前候補である。未完了審査、単一情報源、
情報源間の不一致は含めない。

候補は次の command で決定的に再生成できる。既存 output の上書きは拒否する。

```powershell
npm run data:quest:export -- --output path/to/new-quest-knowledge-candidate.json
```

候補の選定条件、現在の件数、署名までの扱いは
[`data-update-candidates/README.md`](data-update-candidates/README.md) に記録する。
正式鍵と data version の決定後、この候補を `--quest-knowledge` に指定して bundle を
発行し、別担当者が候補 SHA-256 と署名済み bundle を確認する。

## 秘密鍵を使わないオフライン審査

発行担当者とは別の審査者が、bundle directory と公開鍵だけで配布物を検証できる。

```powershell
npm run data:bundle:verify -- --bundle path/to/output --public-key '<DER SPKI base64 public key>'
```

公開鍵をテキストファイルで受け渡す場合:

```powershell
npm run data:bundle:verify -- --bundle path/to/output --public-key-file path/to/public-key.txt
```

審査コマンドは manifest の厳格なスキーマと Ed25519 署名、列挙された全 payload の
サイズ・SHA-256・JSON スキーマを検査する。symlink、未知のファイル、manifest にない
審査メモなどが bundle directory に混入している場合も失敗する。秘密鍵や配布先への
アクセスは不要で、成功時は data version、発行時刻、ファイル数、payload byte 数、
任務知識の有無、検証に使った公開鍵の SHA-256 指紋だけを表示する。審査者は
発行時に別経路で受け取った指紋と一致することも確認する。
検証 CLI も未知 option と重複 option を処理前に拒否し、inline 公開鍵と公開鍵ファイルは
必ずどちらか一方だけを指定する。

## 配布審査記録

署名済み bundle、審査済み任務候補、公開鍵、配布予定 URL が同じ release を指すことを
staging 配置前に固定する。

```powershell
npm run data:release:record -- --bundle path/to/output --public-key-file path/to/public-key.txt --manifest-url https://updates.example/data/manifest.json --quest-candidate docs/data-update-candidates/quest-knowledge-reviewed-v1.json --output path/to/release-review.json
```

command は bundle 全体をオフライン検証し、bundle 内 `quest/knowledge.json` の size と
SHA-256 が指定候補の bytes と完全に一致することを必須とする。manifest URL は
credential と fragment のない HTTPS URL に限定する。output が既に存在する場合は
上書きしない。

記録には schema version、data version、発行時刻、配布 URL、公開鍵・manifest・任務候補
の SHA-256、ファイル数、payload bytes、地図数、claim 数だけを含める。秘密鍵、公開鍵本体、
ローカル path、reviewer の個人情報は含めない。発行担当者とは別の審査者がこの JSON と
`data:bundle:verify` の出力を保管し、同じ URL・公開鍵指紋を HTTPS staging 受け入れに使う。

保存または受け渡し後の審査記録は、同じ公開証拠から独立して再検証する。

```powershell
npm run data:release:verify -- --bundle path/to/output --public-key-file path/to/public-key.txt --manifest-url https://updates.example/data/manifest.json --quest-candidate docs/data-update-candidates/quest-knowledge-reviewed-v1.json --record path/to/release-review.json
```

検証 command は bundle の署名、全 payload、候補 bytes をもう一度検証し、そこから再構成した
全フィールドと記録を比較する。記録は 64 KiB 以下の厳格な schema とし、未知フィールド、
不正な型・hash・URL・件数、symlink、別の bundle・鍵・URL・候補との組み合わせを拒否する。
成功時は data version と 3 つの SHA-256 だけを表示し、URL、公開鍵本体、ローカル path、
個人情報は表示しない。

## 公開鍵ローテーションのオフライン検証

旧鍵で署名した現在の bundle と、新鍵で署名した候補 bundle を別々に審査した後、
次の command で鍵の切り替え条件をまとめて確認する。

```powershell
npm run data:key:rotation:verify -- --old-bundle path/to/old-bundle --old-public-key-file path/to/old-public-key.txt --new-bundle path/to/new-bundle --new-public-key-file path/to/new-public-key.txt
```

この command は秘密鍵や配布先へアクセスせず、次をすべて検証する。

- 旧 bundle と新 bundle が、それぞれ指定された公開鍵で完全に検証できる。
- 新旧の公開鍵指紋と data version が異なる。
- 新 bundle の `publishedAt` が旧 bundle より後である。
- 旧 bundle は新公開鍵で、新 bundle は旧公開鍵で署名検証できない。

成功時の出力は新旧の data version と SHA-256 指紋だけで、公開鍵本体や path は含まない。
正式な切り替えでは、まず旧 bundle と旧鍵を保持したまま新公開鍵を組み込んだアプリを
配布し、その後に新 bundle へ配布元を切り替える。新鍵を持たない旧アプリは新 bundle を
拒否して検証済みの旧キャッシュまたは同梱データを使い、新アプリも切り替え前の旧 bundle
を拒否して同梱データへ安全にフォールバックする。鍵を戻す場合も配布物だけではなく、
信頼する公開鍵を変更したアプリ版が必要になる。

## 隔離された起動時適用検証

```powershell
npm run smoke:data-update
```

このコマンドは実行ごとの Ed25519 鍵をメモリ内で生成し、署名済みの最小地図・任務知識
bundle を loopback の一時配布サーバーで提供する。production bundle の Electron を
起動し、主プロセスが manifest と payload を実際に取得して署名、ハッシュ、JSON を
検証し、version directory と active pointer を作成したことを確認する。その後、同じ
隔離 profile でアプリを終了・再起動し、次回起動で bundle が有効化されたことと、
renderer から production preload/main bridge を経由して fixture の地図が読み込まれ、
任務指引に fixture の任務が表示されたことを確認する。

localhost HTTP の例外は `KOUBROWSER_LAYOUT_FIXTURE=1`、
`KOUBROWSER_SMOKE_IPC=1`、`KOUBROWSER_DATA_UPDATE_DOWNLOAD_FIXTURE=1`
のすべてが揃った smoke 子プロセスに限定する。通常起動では従来どおり HTTPS が必須である。
秘密鍵をディスクへ保存せず、外部配布元、正式な設定、Cookie、記録、
ゲーム通信にはアクセスしない。

この検証は起動時適用経路の回帰テストであり、正式な HTTPS 配布先、組み込み公開鍵、
秘密鍵運用、実際の審査済み bundle のステージング受け入れを代替しない。

## HTTPS ステージング受け入れ

正式配布前の HTTPS staging に bundle を置いた後、配布 URL と審査済み公開鍵を使って
production 経路を受け入れる。

```powershell
npm run verify
npm run smoke:accept:data-update -- --data-update-staging-manifest https://updates.example.test/data/manifest.json --data-update-public-key-file path/to/public-key.txt
```

この command は次を必須とする。

- manifest URL は、認証情報や fragment を含まない明示的な HTTPS URL である。
- 公開鍵ファイルは Ed25519 DER SPKI Base64 を 1 件だけ含む。秘密鍵は使用しない。
- staging bundle には、表示確認できる spot を持つ地図ファイルと、1 件以上の審査済み
  任務知識 claim が含まれる。
- 隔離 profile への download と production main process の検証が完了した後、
  落盤した bundle を公開鍵でもう一度オフライン検証する。
- 同じ隔離 profile で再起動し、active pointer、任務知識、renderer → preload → main
  bridge から取得した地図 spot、任務ページの対象 claim が一致する。

この受け入れでは `KOUBROWSER_DATA_UPDATE_DOWNLOAD_FIXTURE` を設定せず、HTTP
loopback 例外も使用しない。実アカウント、Cookie、ゲーム通信にはアクセスしない。
要約には data version、ファイル数、任務知識の有無、公開鍵の SHA-256 指紋、
再起動結果だけを出し、配布 URL、公開鍵本体、ローカル path は残さない。

この command の成功は、指定した staging 配布物と公開鍵の組み合わせを確認する。
正式 URL・公開鍵の選定、秘密鍵の保管とローテーション、別担当者による bundle 審査を
省略するものではない。

## 現在の起動設定

公式の配布 URL と公開鍵が確定するまでは自動更新を既定で有効にしない。
正式版の唯一の信頼設定は
`src/main/data-update-deployment.ts` の `bundledDataUpdateDeployment` とする。
ここには認証情報を含まない HTTPS manifest URL、Ed25519 DER SPKI Base64 公開鍵、
別経路で確認した SHA-256 指紋の 3 点を同時に設定する。秘密鍵、token、credential、
認証情報付き URL は追加しない。起動時に URL、鍵形式、指紋の一致を再検証し、
一部だけの設定や不一致は通信前に無効化する。

production build は `KOU_DATA_UPDATE_MANIFEST_URL` と `KOU_DATA_UPDATE_PUBLIC_KEY` を
通常の環境からは信頼しない。ローカル環境や起動用 shortcut によって、配布元や信頼鍵が
意図せず置き換わることを防ぐ。

開発モードで検証する場合は次の環境変数を設定して起動できる。

```powershell
$env:KOU_DATA_UPDATE_MANIFEST_URL = 'https://example.test/data/manifest.json'
$env:KOU_DATA_UPDATE_PUBLIC_KEY = '<DER SPKI base64 public key>'
npm run dev
```

両方が未設定なら更新機能は無効になる。片方だけが設定されている場合、URL が HTTPS
（開発時の localhost を除く）でない場合、または公開鍵が Ed25519 の DER SPKI
Base64 として読めない場合も、安全側に倒して更新機能を無効にし、内蔵データを使用する。
この構成エラーではネットワークアクセスもキャッシュ済み更新データの読み込みも行わない。

開発モードに限り、`localhost`、`127.0.0.1`、`[::1]` の HTTP 配布元も使用できる。
production Electron の自動検証では、隔離 layout fixture、smoke IPC、
`KOUBROWSER_DATA_UPDATE_CONFIG_OVERRIDE=1` の三重 gate が揃った子プロセスだけが
環境上書きを使用できる。smoke token と実際の Node IPC channel も必須である。
`electron-smoke.js` が data update fixture または明示的な HTTPS staging 受け入れ時に
だけこの gate を設定する。

本番運用に進む前に、公式 URL と公開鍵を上記の固定設定へ組み込み、別担当者が指紋を
確認して `npm run test` と HTTPS staging 受け入れを通す。秘密鍵の紛失や漏えい時には
新しいアプリ版で公開鍵を更新する。

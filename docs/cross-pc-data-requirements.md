# PC 間データ移行・統合要件案

状態: 設計案。最初の実装は安全な手動 export/import とし、自動同期はその検証後に
別段階で判断する。

## 背景

[Issue #18](https://github.com/yukikuri/koubrowser/issues/18) では、PC A と PC B の
アカウント別保存フォルダを NAS で双方向同期し、任務進捗、戦果、ドロップなどを
追記・統合できるか質問されている。

[維持管理者の回答](https://github.com/yukikuri/koubrowser/issues/18#issuecomment-4818491772)
では、NeDB は複数 PC から同じデータを同時利用することを想定せず、同時使用の
安全性は保証できない。一方のアプリを終了してから別 PC へコピーする単一 writer の
運用なら問題ない想定とされている。

現在のアプリも、起動中の共有、NAS 上の NeDB 直接利用、双方向フォルダ同期を
禁止する案内を表示している。この制約は統合機能が完成するまで維持する。

## 現在のデータ境界

### アプリ全体

`app.getPath('userData')/koubrowser` 配下:

- `global.json`: 更新確認、情報提供、タイトルバーなどの全体設定
- `option.json`: 保存先、録画対象、Proxy、拡張機能パスなど端末依存設定を含む
- `capture/`: スクリーンショット・録画の既定保存先
- `data-updates/`: 検証済み地図・任務知識 cache

### アカウント単位

`koubrowser/store/<serverId>_<memberId>` 配下:

- `port.db`
- `drop.db`
- `battle.db`
- `item.db`
- `ship.db`
- `remodel.db`
- `mission.db`
- `quest.db`
- `clearitemget.db`
- `app.json`
- `airbase_spots.json`
- `inherit_score.json`
- `mapinfo.json`
- `missionlist.json`
- `questlist.json`

### Chromium storage

workspace 配置、パネル表示、任務指引の表示履歴などには renderer の LocalStorage も
使われる。これはアカウント別 NeDB フォルダをコピーしても移行されない。

## 基本方針

- 起動中の `.db` ファイルを直接コピー、共有、上書きしない。
- NAS・同期フォルダを NeDB の保存先として使わない。
- 端末間交換は、アプリが閉じた整合した snapshot または main process が生成した
  不変 bundle を介して行う。
- 最初は手動 export、preview、import、rollback を完成させる。
- 自動同期は、安定した論理 record ID と衝突規則が実データで検証された後だけ扱う。
- ゲーム通信の観測・処理経路と、PC 間データ交換を分離する。

## データ分類

| 分類 | 初期 export/import | 自動統合 | 理由 |
| --- | --- | --- | --- |
| 戦闘、ドロップ、建造、開発、改修、遠征、報酬履歴 | 対象 | record ID 導入後 | 追記型だが旧データの重複判定が必要 |
| 資源・保有数 snapshot | 対象 | 重複除去後 | 同時刻・近接時刻の snapshot が重複し得る |
| 任務進捗 | 対象 | 同一任務・同一周期の単調 counter のみ | 周期リセットとローカル推定状態があるため、加算せず項目ごとの最大値だけを採用する |
| `app.json`、workspace、パネル設定 | 選択式 profile | 自動 merge しない | 端末の画面構成が異なる |
| `global.json` | 選択式 | 自動 merge しない | 全体設定だが端末差がある |
| `option.json` | 既定で除外 | 対象外 | パス、Proxy、拡張機能が端末依存 |
| master/cache JSON、`data-updates/` | 除外 | 対象外 | ゲームまたは署名配布から再構築可能 |
| Cookie、Local State、DMM session | 除外 | 対象外 | 認証・秘密情報 |
| スクリーンショット、録画 | 除外 | 対象外 | 大容量で別バックアップ対象 |

## bundle 形式

export は版管理された manifest とデータからなる。最低限、次を含む。

- schema version
- 作成アプリ version
- 作成日時
- source device ID（アプリが生成したランダム ID）
- 対象アカウントの識別情報
- 含まれるデータ分類と件数
- 各ファイルの相対パス、サイズ、SHA-256
- 最古・最新記録時刻
- export mode（backup、transfer、merge candidate）

絶対パス、Cookie、Proxy 認証情報、秘密鍵は含めない。アカウント識別情報は画面上で
確認できるようにし、共有用 bundle では必要以上の情報を manifest に平文で置かない。

bundle は一度作成したら上書きしない。自動同期へ進む場合も、各端末が固有名の不変
bundle を追加し、共有 NeDB を直接編集しない。

## record identity

NeDB の `_id` は端末ごとに生成されるため、PC 間の同一イベント判定には使わない。

- 新規の追記型記録には `recordIdentity` を付ける。version 1 は
  `{ schemaVersion: 1, recordId: UUID v4, index: 0 以上の整数 }` とする。
- 論理 key は DB 名、`schemaVersion`、`recordId`、`index` の組み合わせとする。
  1 回の API 応答から複数 record を作る場合は同じ `recordId` を共有し、配列順を
  `index` に保存する。
- 対応する `drop` と戦闘結果の `battle` は同じ `recordIdentity` を共有する。
  DB 名を key に含めるため、両 DB の record が互いを重複扱いすることはない。
- `BattleRecord.eventId` はマスのイベント種別、既存の `uuid` は端末内の出撃単位を
  表すため、同期 identity には使わない。
- 旧記録には、record type と意味のある immutable fields を canonical JSON 化した
  migration fingerprint を作る。旧記録は `recordIdentity` がなくても読み込める。
- fingerprint は import 時の重複候補検出に使うが、衝突時に無条件上書きしない。
- 未知の field、未知の schema version、不正な UUID/index、identity の重複は preview
  で拒否する。同一 identity で内容が違う場合は競合として表示する。
- `recordIdentity` はローカルの保存・copy/export/import で保持するが、外部戦果送信は
  明示的な field mapping で構築し、この field を送信しない。ゲームへの request、
  response、通信 semantics も変更しない。
- 端末時計だけを優先順位に使わない。艦これ server time と記録種別の意味を使う。

## 任務進捗の競合

- key は少なくとも任務番号と既存 `dateKey` を含む。
- 異なる周期の記録を合成しない。
- 同一周期かつ同じ counter schema の単調な進捗だけ、安全な候補として扱う。
- 完了状態、counter の減少、前提 schema の違い、未対応任務 state は自動上書きせず、
  preview で競合として表示する。
- 次回のゲーム API から得られる現行任務状態を正とし、ローカル履歴の統合結果だけで
  ゲーム状態を推測しない。

## DP-1: 安全な backup/export

最初の milestone はアカウント別 `store/<serverId>_<memberId>` の検証済み backup と
同一アカウントへの完全復元に限定する。自動 merge、LocalStorage、`global.json`、
`option.json` は含めない。

- worker の書き込み完了後に main process が snapshot を作る。
- 対象アカウントと含有分類を確認してから export する。
- manifest、件数、hash を生成し、作成直後に自己検証する。
- 読み取り不能 DB や不整合があれば不完全 bundle を成功扱いしない。
- 保存先が既存のアプリ DB フォルダ内の場合は拒否する。
- export 中もゲームサーバー通信を変更しない。

実装状況（2026-07-30）:

- 2 つの DB worker で新規 mutation を保留し、送信済み mutation の完了を待つ
  snapshot barrier を実装済み。
- NeDB の executor 上で全 DB を crash-safe compaction し、DB 別 record count を
  最古・最新 record 時刻とともに snapshot callback へ渡す。callback の成功・失敗に
  かかわらず autocompaction と保留 mutation を復元する。
- account JSON の送信済み書き込み完了を待ち、新規書き込みを保留する barrier を
  DB barrier の外側に実装済み。
- 全 9 DB と `app.json`、`airbase_spots.json`、`inherit_score.json` を対象に、
  versioned manifest、件数、サイズ、SHA-256 を持つローカル専用 bundle core を実装済み。
  app data 配下への出力、symlink、未知 path/field、過大ファイル、既存 bundle の
  上書きを拒否し、一時 directory で自己検証後に atomic rename する。1 byte の破損と
  失敗時の partial cleanup を回帰テストで確認する。
- 現時点の bundle は manifest 上も `none-local-only` と明示した非暗号化 backup である。
  app data ごとに非秘密の source device UUID を厳格 JSON として排他的・原子的に
  生成し、以後の bundle で再利用する。この identity file 自体は bundle に含めない。
  アプリ情報画面から本人専用のローカル保存先を選ぶ backup UI を実装し、未暗号化で
  共有・同期用ではないことを実行前に明示する。IPC は main application frame の固定
  操作だけを許可し、renderer へ account/device ID や完全な保存 path を返さない。
  このローカル backup 自体は引き続き共有不可とする。
- 共有用には別形式の単一 `.koubrowser-transfer` ファイルを実装した。整合 snapshot
  から作った検証済みローカル bundle 全体を認証付き暗号化し、暗号化ファイルを再度
  復号・既存 verifier に通してから、既存ファイルを上書きせず公開する。外側 header
  には固定 format/version、KDF、cipher、暗号文長だけを置き、account、device、
  bundle identity、保存 path、record、hash は暗号文の外へ出さない。
- 受信側は同じ合言葉で transfer を開き、認証成功後だけ既存の account-match、
  DB 別 read-only preview、merge、完全復元へ渡す。合言葉違いと 1 byte の破損は同じ
  認証失敗として扱い、現在データを変更しない。候補の復号済み一時 directory は、
  別候補の選択、merge/restore の staging 完了、通常終了時に削除する。
- 暗号方式は AES-256-GCM、12 byte のランダム IV、16 byte tag。鍵導出は transfer
  ごとの 16 byte salt と scrypt（`N=2^15, r=8, p=3`、32 byte key）とし、
  [OWASP の現行 scrypt 等価推奨値](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt)、
  [RFC 7914](https://www.rfc-editor.org/rfc/rfc7914)、
  [Node.js crypto の GCM/Unicode 注意事項](https://nodejs.org/api/crypto.html)
  に合わせた。合言葉は NFC へ正規化し、12 code point 以上・UTF-8 で 1024 byte 以下、
  文字種制限なしとする。
- 合言葉は保存せず、復旧・再発行・秘密の回収機能も持たない。UI は合言葉を忘れると
  復旧できないことと、transfer と合言葉を別経路で共有することを明示する。export
  snapshot と import preview では短時間の復号済み一時 copy を作るため、異常終了時は
  OS の一時領域を本人管理の機微データとして扱う。

## DP-2: preview と復元可能な import

- import 前に schema、サイズ、hash、アカウントを検証する。
- 追加、重複、競合、対象外、破損の件数を DB 別に表示する。
- 利用者の確定前に既存 DB を変更しない。
- import 直前に復元用 backup を作り、その検証に成功しなければ進めない。
- staging directory で統合し、全 DB の読み込みと件数検査後に切り替える。
- 途中失敗時は元のデータを維持し、再実行しても二重登録しない。
- import 後に rollback 操作と期限を提示する。

実装状況（2026-07-30）:

- 既存 bundle を directory picker から選び、DP-1 と同じ厳格 parser と verifier で
  manifest、許可 path、サイズ、SHA-256、NeDB 行、record count を読み取り専用検査する
  main application 限定 IPC と UI を実装済み。
- 検査結果は account/member ID や完全 path を renderer へ渡さず、現在アカウントとの
  一致・不一致・未確定だけを表示する。不一致 bundle は復元対象にできない旨を明示する。
- 同一アカウントの読み取り専用 preview 後、Phase A の受け入れ証拠を JSON へ保存
  できる。report は current build、OS・CPU architecture、bundle の作成日時と集計、DB 別比較件数・policy
  だけを main process で再構成し、account/device/bundle identity、保存 path、
  semantic/file hash、raw record を含めない。既存ファイルは上書きしない。この report
  はデータ移行用 bundle ではなく、未暗号化 bundle の共有許可も意味しない。
- 同一アカウントの bundle は snapshot barrier 中に worker で現在 DB と比較し、
  DB 別に追加候補、完全一致、同じ `_id` で内容が異なる競合、現在端末だけにある記録を
  表示する。比較中に manifest のサイズ・SHA-256・record count も再確認し、renderer
  へ raw record を渡さない。この検査操作は既存データを一切変更しない。
- preview の第一段階として、追記型の `port`、`drop`、`battle`、`item`、`ship`、
  `remodel`、`mission`、`clearitemget` では `_id` を除く record 全体を key 順の
  canonical JSON にして SHA-256 を計算し、ID が異なるが内容が完全一致する
  `旧ID内容一致` を別に表示する。同一内容が複数ある場合は件数の小さい側までだけを
  対応させるため、1 件の fingerprint で複数イベントを誤って消し込まない。
  `quest` は専用の周期・進捗規則が必要なためこの推定から除外する。処理は snapshot
  barrier 中の worker で行い、renderer へ raw record や fingerprint を渡さない。
  legacy fingerprint は保守的な読み取り専用候補検出として維持する。新規 record の
  stable identity と DB 別比較 policy による record-level merge は後段の実装済み
  transaction だけで使用し、legacy fingerprint 一致だけを自動追加判断には使わない。
- 同一アカウントの verified bundle を app data 内の専用 `.partial` directory へ再コピーし、
  全 payload のサイズ・SHA-256・内容を再検査した後、2 つの既存 worker で 9 DB を
  実際にロードして record count と `_id` 一意性を確認する staging core を実装済み。
  成功時だけ immutable な staging directory へ rename し、失敗時は本処理が作成した
  partial だけを削除する。現在の account directory は読み書き・rename しない。
- 同一アカウントの検査済み候補だけを main process 内に保持し、ネイティブ警告で
  明示確認後に staging と待機 marker を作成して再起動する復元 UI を実装済み。
  renderer は候補 path、member ID、raw record を指定・取得できない。
- 再起動後、`KcRecord` が DB を開く前に現在 directory を同一 filesystem 上の
  `restore-rollbacks/<bundleId>.partial/account` へ rename する。全 9 DB を一時 copy
  上で NeDB load し、件数・サイズ・SHA-256 と既知 profile JSON を検証して
  `rollback.json` を確定してから staging 候補を current directory へ切り替える。
  候補も manifest と worker で再検証し、成功時だけ rollback directory を確定する。
- 待機 marker は `ready`、`prepared`、`current-moved`、`candidate-installed` の
  phase を持ち、directory move と marker 更新の間で停止した場合も path 状態から
  再開する。検証失敗時は候補を staging へ、従来データを current へ戻す。
  その回復にも失敗した場合は DB を開かず、rollback/staging を保持して停止する。
- About 画面から現在アカウント用の最新 rollback を再検査・確認し、再起動して
  復元前 directory へ戻せる。rollback 側 DB は移動前と移動後に worker で検証し、
  置き換えられた現行 directory は `replaced-account` として削除せず保持する。
  rollback marker にも crash recovery phase があり、別アカウントでは実行しない。
- 同一アカウントの完全置換、UI rollback、rollback 後の `replaced-account` の
  UI redo を実装済み。redo は候補を worker で再検査し、確認後の再起動時に current
  と切り替える。切り替え前の current は新しい `account` として再検査・保持し、
  rollback metadata も更新するため、redo 後も再び rollback できる。
- redo marker は `ready`、`current-moved`、`redo-installed` の phase を持つ。
  directory move と marker 更新の間で停止しても path 状態から再開し、切り替え後の
  検証失敗時は元の current と `replaced-account` を復元する。
- About 画面から現在データの読み取り専用監査基準を保存し、後から同じアカウントの
  現在データと比較できる。9 DB は mutation を停止した状態で `_id` 順・key 順の
  canonical semantic SHA-256 を計算し、活動中の NeDB file を compact・書き換え
  しない。既知の account profile も byte hash で比較する。基準は app data 内へ
  atomic 保存し、アカウントは生の member ID ではなく不可逆 fingerprint で束縛する。
  renderer には日時、DB 別件数、変更された DB 名・profile filename だけを返し、
  raw record、hash、account ID、完全 path は返さない。
- 完成済み rollback は起動時の transaction 完了後、DB を開く前に自動整理する。
  既定値は作成後 30 日、アカウントごとに最新 3 世代、全体 2 GiB を目標上限とする。
  期限切れ、世代超過、容量超過の順に古い世代を削除するが、その起動で適用した
  bundle と、待機 transaction がある場合の全世代は保護する。容量整理ではさらに
  各アカウントの最新の期限内世代を保護する。`.partial`、symlink、構造が不完全・
  未認識、または metadata が破損した directory は自動削除せず、保護対象のため
  上限を達成できない場合は安全側で容量超過を報告する。About に方針を表示する。
- record-level merge は同一アカウントの検査結果から追記型 DB の安全追加と
  `quest-monotonic-v1` の単調な counter 進捗だけを選び、明示確認後の再起動
  transaction で活動 DB へ適用できる。merge 専用 rollback/redo と安全側の
  保持期限管理も実装済みで、実アカウントでの受け入れは未確認。
- 同じ bundle が既に current と完全一致し、その bundle の検証済み rollback も
  残っている場合は、staging、current、rollback の 3 者を再検証して安全な no-op
  とする。current が復元後に変化した場合や manifest、rollback のいずれかが一致
  しない場合は再適用せず、marker、staging、current、rollback を保持する。
- 独立した 2 bundle の安全追加を A→B→A、B→A→B の順で worker に適用する統合テスト
  は、最終 record count、record ID、semantic SHA-256 の一致を確認する。candidate
  DB は NeDB が compact 時に用いる `_id` index 順で書き出し、追加 record の `_id`
  が既存 record より前でも初回の再読み込みで byte hash が変化しない。
- 同じ出力先・同じ作成時刻へ異なる端末 ID と bundle UUID を使って同時に export
  するテストは、UUID を含む別々の `.partial` directory から別々の最終 directory
  へ publish し、両 bundle が独立して再検証できることを確認する。同一 bundle 名の
  既存 directory は上書きしない。
- restore transaction は既知の schema version 1 以外（旧 version 0 と未知の
  future version 2）を pending marker の読み込み時点で拒否する。current account
  directory を移動せず、rollback partial を作らず、pending marker と staging を
  調査用に保持する回帰テストを持つ。
- 起動前の worker preflight validation が停止・失敗した場合も、current account
  directory を移動せず rollback partial を作らない。pending marker と staging は
  安全な再試行・調査用に保持し、worker が活動 DB を開く前の失敗を transaction
  mutation から分離する。
- rollback 準備 directory の作成が `ENOSPC` で失敗する fault-injection test も、
  current account directory と内容を維持し、rollback partial を残さず、pending
  marker と staging を保持する。容量不足が directory 切り替え前に起きた場合の
  再試行可能性を明示的に確認する。
- `npm run smoke:account-restore` は一時 user-data と合成した 9 DB だけを使用し、
  各 DB 10,000 件、1 snapshot 合計 90,000 件で production Electron を 8 回起動する。
  production main process で検証済み bundle を `.koubrowser-transfer` へ暗号化し、
  正しい合言葉での復号・再検証、密文外の account/device/bundle identity 不在、
  誤った合言葉と 1 byte 破損の拒否、失敗時に平文 directory を残さないことも確認する。
  初回 restore、同一 bundle の検証済み no-op、rollback、redo、破損候補の拒否を
  実行するほか、stable identity を持つ追記型 8 DB の安全追加と、同一任務・周期・
  counter schema を持つ `quest` の単調進捗を production worker で preview/staging
  し、merge、merge rollback、merge redo を順に確認する。`quest` は
  `quest-monotonic-v1` で counter を加算せず項目別最大値へ更新し、現在側の record
  identity、日時、任務状態と metadata を保持する。初回は 3 個の完成済み履歴も
  事前に置き、restore で 4 世代になった
  後に最古だけが整理され、適用中 bundle を含む 3 世代が残ることを確認する。
  rollback metadata が再 import で変わらないこと、redo 後も rollback source が
  再構成されること、破損時は現行データと調査用 marker/staging が保持されることも
  確認する。同一 bundle の no-op と redo では、適用後にアプリが生成した既知の
  account-local JSON profile だけをサイズ・JSON 構文検査後に許容し、未知ファイルは
  引き続き拒否する。各切り替え後はファイル件数だけでなく、production worker を通して
  `port`、`battle`、`drop`、`mission`、`quest`、`clearitemget` の履歴を検索し、
  資源グラフの点数と海域別 S 勝 drop 集計も検査する。restore/rollback/redo では
  各合成履歴 10,000 件、merge 後は追記型 8 DB が 10,001 件となり、`quest` の
  合成履歴件数は 10,000 件のまま専用 fixture の counter が `[3, 1]` から `[3, 2]`
  へ進む。merge rollback / redo では件数、counter、グラフと集計が可逆に切り替わる
  ことを確認する。さらに初回 restore 後の
  90,000 件を semantic baseline として保存し、
  rollback 後は全 9 DB の差分、redo 後は完全一致になることを production
  main/preload/worker 経路で確認する。smoke 実装時に、起動前検証が worker の活動 DB
  初期化へ依存していた問題を検出したため、staging/rollback/redo の read-only 検査は
  独立した `DbStuff` を使用するよう修正した。merge smoke では preview の
  `currentStateSha256` と再検証用 semantic audit が別アルゴリズムだったため実データが
  常に期限切れになる問題も検出し、同じ audit hash に統一した。大きい DB の検証直後に
  Windows が NeDB の一時ファイル rename を短時間 `EPERM` にする事象も検出したため、
  database load は rename の `EPERM` / `EACCES` / `EBUSY` だけを有限回再試行し、
  永続的な権限エラーやデータエラーは従来どおり失敗として返す。

## DP-3: record-level merge

- 新規記録へ既存の業務 field と衝突しない `recordIdentity` を付け、旧記録
  fingerprint の互換テストを維持する。
- DB ごとの merge 規則を明示し、未知 schema は拒否する。
- 任務、設定、workspace は追記履歴と同じ merge 処理に流さない。
- 同じ bundle を複数回、順序を変えて取り込んでも結果が同じになることを確認する。
- 大容量履歴で main process を停止させず、worker または専用処理で実行する。

現行 record model から確認できる境界:

| DB | 現行の生成単位 | 新規 record の identity | merge 実装前に必要な規則 |
| --- | --- | --- | --- |
| `port` | 30 分ごとの資源・保有数 snapshot | 単独の `recordIdentity` | `date` 衝突時の snapshot 優先規則。端末時計だけでは決めない |
| `drop` | 戦闘結果 1 件 | 対応する戦闘結果 `battle` と共有 | 表示名や `origin` を競合判定の immutable fields にしない |
| `battle` | 出撃内のセル 1 件と帰投 1 件 | 戦闘結果は `drop` と共有、その他は単独 | 現行 `uuid` と `index` を使う出撃内順序・帰投 record の競合規則 |
| `item` | 開発結果 1 件。複数開発では配列 insert | 応答ごとの `recordId` と配列内 `index` | 結果内容の immutable fields と破損判定 |
| `ship` | 建造結果 1 件 | 単独の `recordIdentity` | `kdockId` や時刻だけでは再利用・衝突があるため内容規則が必要 |
| `remodel` | 改修結果 1 件 | 単独の `recordIdentity` | 成功可否や装備内容だけで別試行を同一視しない内容規則 |
| `mission` | 遠征結果 1 件 | 単独の `recordIdentity` | 遠征名、艦隊内容、時刻だけで別結果を同一視しない内容規則 |
| `clearitemget` | 任務報酬受領 1 件 | 単独の `recordIdentity` | 周期任務の同じ番号を別受領として保持する内容規則 |
| `quest` | 任務番号・周期ごとの更新 record | `no` と `dateKey` の専用 identity | 同一 counter schema の単調進捗だけを項目別最大値で統合し、完了状態と進行中一覧は現在側を保持する |

全追記型 DB に共通して、現行 `origin` は作成したアプリのバージョンを表す payload
であり identity ではない。`date` は秒精度の server-time 変換値だが、単独の一意 key
にはしない。新しい identity の値は記録作成時に一度だけ生成し、copy/export/import
で保持する。未知の identity schema や同じ identity で異なる内容を検出した場合は、
自動選択せず preview を競合として停止する。

実装状況（2026-07-30）:

- 読み取り専用 preview に、追記型 8 DB の保守的な legacy content fingerprint と
  multiplicity-aware な候補件数を追加した。key 順が異なる同一内容、重複件数、
  `quest` 除外を worker の回帰テストで確認した。
- 新規の追記型 8 DB に version 1 の `recordIdentity` を付与した。複数開発の batch
  index、`drop` と対応する `battle` の関連、旧 record の互換性、外部戦果 payload
  からの除外を回帰テストで確認した。
- preview 対象は全 `DbName` を列挙した型検査付き policy とし、新しい DB が追加された
  ときに暗黙に legacy 推定へ入らないようにした。
- preview は安定 identity を `_id` より後、legacy fingerprint より前に照合し、
  未知 schema と identity 重複を拒否する。同一 identity・同一内容は完全一致、
  同一 identity・異なる内容は競合として数える。
- 同一 stable identity の内容比較には version 1 の DB 別 policy を適用する。
  NeDB の `_id`、`recordIdentity` 自体に加え、app provenance の `origin` を
  `drop`、`battle`、`item`、`ship`、`remodel`、`mission`、`clearitemget` で
  非 semantic とする。`drop` の `shipName`、`questName`、`enemyDeckName`、
  `battle` の `questName`、`enemyDeckName` と埋め込み `drop` の同じ表示 field、
  `mission` の `mapareaName`、`questName`、`clearitemget` の `questName` も
  master data 由来の表示文字列として比較から除外する。
- policy に列挙していない payload field は全て比較に残す。将来追加された未知 field
  も暗黙に無視せず、値が異なれば競合になる。`port` には除外する provenance field
  がなく、`quest` はこの append-record policy 自体の対象外である。legacy record の
  content fingerprint は従来どおり `_id` 以外の record 全体一致を要求するため、
  旧 record の推定を緩和しない。merge plan は
  `comparisonPolicyVersion: 1` を明示的に保持し、decision hash も同じ version
  を拘束する。staging の再読み込み検証は未対応の version を拒否する。
- payload 競合には独立した version 1 の分類・解決 policy を適用する。解決規則は
  `preserve-current-v1` とし、同じ `_id` または stable identity で semantic
  payload が異なる場合、database-only candidate には現在側 record を残し、
  incoming 側で上書きしない。これは現在側の内容が真であるという判断ではなく、
  活動中に確認済みの記録を破壊しないための保守的な候補生成規則である。元 bundle
  は変更せず保持する。
- 競合 record は DB 別に、`port` の snapshot、`drop` の location/context/result、
  `battle` の location/context/fleet/result/reward/raw-response、`item`、`ship`、
  `remodel` の input/context/result、`mission` の fleet/result/reward、
  `clearitemget` の context/reward と、共通の identity/timestamp/provenance/display
  に分類する。`battle.drop` は `drop` policy で再帰的に分類する。列挙外の field
  は `unknown-field` とし、競合のまま現在側を保持する。1 record が複数 group に
  該当し得るため、group 件数の合計は conflict record 件数と一致するとは限らない。
  `quest` はこの追記型 conflict group policy の対象外で、後述の
  `quest-monotonic-v1` 専用規則を使う。
- merge plan は `conflictPolicyVersion: 1`、`conflictResolution:
  preserve-current-v1`、payload を含まない group 別 record 件数を明示する。
  policy version、resolution、record ごとの group 集合を decision hash に拘束する。
  staging は未知 group、DB に不正な group、重複・非 canonical 順序、0 件、conflict
  件数を超える件数、summary の欠落、不整合な policy version/resolution を worker
  検証前に拒否する。
- preview と同じ worker 処理で version 1 の読み取り専用 merge plan を生成する。
  追記型 DB では、有効な identity が未登録の record だけを `safeAdd`、完全一致を
  `skip`、同じ `_id` または identity で内容が異なるものを `conflict`、identity の
  ない旧 record を `manualReview` とする。
- `quest` には独立した `quest-monotonic-v1` を実装した。同じ `no`、`dateKey`、
  task metadata、`countMax` を持つ counter record だけを対象にし、各 `count` の
  最大値を現在 record へ反映する。端末間の値は加算しない。現在側の `_id`、`date`、
  `quest.api_state`、`quest.api_progress_flag`、task metadata と `meta.inProgress`
  は置き換えない。別周期、task 番号の再利用、未知 outer field、null/未知 state、
  counter 次元・上限の不一致、新規の unmatched task は `manualReview` として
  現在側を保持する。logical key の重複や `_id` との不一致は候補生成自体を拒否する。
- plan は bundle のファイル SHA-256 に加え、現在 DB、入力 record 集合、決定集合の
  semantic SHA-256 を持つ。semantic hash は record 順序に依存せず、同じ snapshot
  での再計算は同じ決定 hash になる。大容量履歴を main process へ列挙しないよう、
  IPC には分類件数と hash だけを返す。
- plan から活動 DB と分離した database-only candidate を
  `merge-staging/<bundleId>-<planSetSha256>/databases` に生成できる。生成直前に
  verified bundle を再検査し、snapshot barrier 内で全 DB の preview を再計算する。
  source、current state、incoming state、decision のいずれかが変わって plan と
  一致しなければ期限切れとして拒否する。
- candidate に含める incoming record は追記型 DB の `safeAdd` と、専用規則で
  生成した `quest` の現在 ID を維持する replacement だけであり、
  `skip`、`conflict`、`manualReview` は取り込まない。各 DB は排他的に新規作成し、batched write と fsync の後、
  全 9 DB の file set、SHA-256、record count、NeDB load を確認する。成功時だけ
  metadata とともに atomic rename し、失敗時は本処理の partial candidate だけを
  削除して、活動 DB と入力 bundle を変更しない。
- database-only candidate は完全復元用の account staging と payload directory を
  分離する。適用時は候補 DB を直接 current directory へコピーせず、現在 account
  directory の DB 以外の regular file/directory を検証付きで複製し、候補の全 9 DB
  を組み合わせた完全な account candidate を別 directory に構築する。symlink と
  special file は拒否し、候補 DB は metadata の byte hash、size、record count と
  NeDB load で再検証する。
- publish 済み candidate は再起動後も独立して再読み込み検証できる。stage は
  bundle ID、対象 account、完全な preview、preview 全体の plan-set SHA-256、
  candidate DB のサイズ・SHA-256・record count を厳格な metadata に保持する。
  再読み込み時は merge staging root 直下の real directory であること、top-level
  と DB file set が完全一致すること、metadata の未知 field がないこと、対象
  account が現在 account と一致することを確認する。その後、全 DB を byte hash、
  NeDB parse、両 worker の load で再検査する。破損・置換・root 外への copy は拒否し、
  調査用 candidate を自動削除しない。
- この再読み込み検証は candidate 自体が publish 時から不変であることを確認する
  static verification であり、それ単独では活動 DB が publish 後も同じかを
  保証しない。
- main process の準備用 service は static verification と 9 DB の current-state
  再比較を同じ snapshot barrier 内で行う。両 worker の semantic audit が欠落・
  重複している場合、またはいずれかの hash が preview の
  `currentStateSha256` と異なる場合は期限切れとして拒否する。将来の schedule 処理が
  barrier 解放後に検証済み結果だけを持ち出さないよう、候補を消費する callback も
  同じ barrier 内で実行する API を用意した。検証済み stage を pending marker に
  束縛する schedule service もこの callback 内でだけ実行する。
- pending merge は bundle ID、account、plan-set SHA-256 と stage directory 名を
  strict JSON marker に保持する。再起動後、`KcRecord` が DB を開く前に、独立した
  worker inspector が current directory の全 9 DB をロードし、preview の
  `currentStateSha256` と再比較する。完全 account candidate の構築後、current
  directory を移動する直前にも同じ比較を繰り返す。変化した DB が 1 つでもあれば
  marker を無効化し、current と publish 済み stage を変更せずに期限切れを返す。
- merge apply は `ready`、`prepared`、`current-moved`、
  `candidate-installed` の phase marker と同一 filesystem の atomic rename を使う。
  current directory は `merge-rollbacks/<stageName>.partial/account` に丸ごと保持し、
  rollback metadata を検証した後だけ完全 account candidate を current に切り替える。
  再開時は path state、stage、候補 DB、移動済み旧 DB の semantic hash を再検証する。
  各 phase からの再開、stage/marker の改変、current-state の変化を合成 9 DB の
  回帰テストで確認した。切り替え後の検証失敗は旧 current を戻し、その回復にも
  失敗した場合は `AggregateError` として DB 初期化を停止する。
- アプリ情報画面には従来の差分候補に加えて `安全追加` と `要確認` を表示する。
  同一アカウントで安全追加が 1 件以上あるときだけ、安全な記録を統合する操作を
  有効にする。候補 path、account ID、raw record は renderer に渡さず、main process
  が検査済み候補を保持する。ネイティブ警告で明示確認後、bundle と plan を再検証し、
  current-state の snapshot 内再比較と pending marker 作成に成功した場合だけ
  再起動する。従来の復元ボタンは引き続き bundle 全体への完全置換として分離する。
- 完了した merge の `merge-rollbacks/<stageName>/account` は About 画面から再検査し、
  ネイティブ確認後の再起動で統合前データへ戻せる。切り替え直前の統合後 directory は
  `merged-account` として保持し、同じ画面から redo できる。rollback 後または redo
  後に現在側へ追加された記録も、次の反対方向の切り替え候補として再検査・保持する。
  rollback/redo はそれぞれ `ready`、`current-moved`、`*-installed` の phase marker
  を持ち、全 9 DB と profile tree を検証してから directory を atomic rename する。
- merge rollback の保留世代は完全復元の rollback と別 root・別 metadata で管理する。
  同じ 30 日・アカウントごと 3 世代・root 合計 2 GiB の既定方針を適用するが、
  pending、`.partial`、破損・未認識、各アカウントの最新の期限内世代、その起動で
  切り替えた世代は削除しない。
- fingerprint は `_id` を除く record 全体が一致する場合だけ候補にするため、
  現段階では誤った legacy 自動統合を行わない。version 1 conflict policy は
  payload 競合を DB 別に分類し、candidate では現在側を保持するが、個別 record を
  incoming 側へ切り替える人工解決 UI は提供しない。`quest` 専用規則、production
  実アカウントでの受け入れは未実装または未確認である。合成 90,000 件による
  production smoke は merge/rollback/redo と履歴検索・グラフ・drop 集計まで通過済み。
- 維持管理者の Issue #18 回答が保証するのはアプリを交互に終了して使う
  single-writer 運用までであり、live multi-writer や NAS 上の直接 merge を許可する
  根拠にはしない。

## DP-4: 任意の同期フォルダ

DP-1 から DP-3 の実データ受け入れ後にだけ検討する。

- ユーザー指定フォルダへ不変 bundle を publish する。
- 一時ファイルへ完全に書き、hash 検証後に atomic rename する。
- 他端末が作成中のファイルを読み込まない。
- device ID と連番でファイル名衝突を避ける。
- 取得した bundle は preview または明示された安全な自動 merge 規則を通す。
- 同じフォルダを複数端末が使っても、既存 bundle を上書きしない。
- ネットワーク障害、容量不足、部分同期、古い client を模擬する。

クラウドベンダー固有 API や常時接続サービスは、この段階とは別の製品・プライバシー
判断とする。

## セキュリティとプライバシー

- export にはプレイ履歴、編成、アカウント識別子が含まれ得ると明示する。
- 外部共有には上記の認証付き暗号化 transfer だけを使う。合言葉の回復機能は提供せず、
  忘れた場合は送信元から新しい transfer を再発行する。
- パス traversal、symlink、巨大ファイル、zip bomb、未知 field を拒否する。
- import parser は bundle 内のコードを実行しない。
- ログへ raw record、member ID、ローカルパス、暗号鍵を出さない。
- telemetry や外部 upload を既定で有効にしない。
- Proxy 設定は [Wiki の互換性情報](https://github.com/yukikuri/koubrowser/wiki/%E7%94%B2%E3%83%96%E3%83%A9%E3%82%A6%E3%82%B6%E3%81%A7%E5%8B%95%E4%BD%9C%E7%A2%BA%E8%AA%8D%E3%81%97%E3%81%9FProxy%E5%9E%8B%E3%83%84%E3%83%BC%E3%83%AB)
  を維持し、データ交換機能のためにゲーム通信の Proxy や semantics を変更しない。

## 受け入れ条件

実アカウントでの実行順、脱敏して残す証拠、rollback / redo の判定、中止後に保全する
directory は
[`account-data-acceptance.md`](account-data-acceptance.md)
を release gate とする。

- 起動中の NeDB ファイルを共有・直接同期しない。
- export bundle は自己検証でき、破損した 1 byte を検出する。
- 暗号化 transfer の外側から account/device/bundle identity、保存 path、record、
  file hash を読み取れず、誤った合言葉と破損を適用前に拒否する。
- Cookie、DMM session、端末パス、Proxy、拡張機能、capture が既定 export に入らない。
- 対象アカウント不一致を import 前に検出する。
- preview が追加、重複、競合、対象外、破損を DB 別に表示する。
- import 前 backup から全データを復元できる。
- 同じ bundle の再 import が記録件数を増やさない。
- A→B→A、B→A→B の順序で同じ merge 結果になる。
- 2 端末が同時に bundle を publish しても、互いのファイルを上書きしない。
- 旧 schema、途中書き込み、容量不足、worker 停止失敗で元 DB を維持する。
- import 後の主要集計件数、資源グラフ、戦闘、ドロップ、任務履歴が期待値と一致する。
- 実アカウント受け入れでは About の整合性基準を保存し、比較結果に account ID、
  保存 path、raw record、hash が表示されないことを確認する。restore 後に基準を
  保存した場合、rollback 後は差分、redo 後は一致となることを確認する。
- 読み取り専用 Phase A の識別情報除外済み report に account/device/bundle identity、保存 path、
  hash、raw record が含まれず、画面に表示した DB 別 preview 件数と一致する。
- rollback 整理は完成済み世代だけを対象にし、待機 transaction、適用中 bundle、
  アカウントごとの最新世代、`.partial`、未知・破損 directory を削除しない。
- ゲームリクエスト、レスポンス、ゲーム状態、サーバー通信 semantics を変更しない。

## 実装前に決めること

1. 初期リリースを backup/export/import のみにするか
2. 対象にする DB と LocalStorage profile の最小集合
3. legacy fingerprint の DB 別 canonical fields
4. 任務競合を手動選択だけにするか、安全な単調 merge を許可するか
5. 将来 OS key store や recovery key を追加するか（初期実装は回復不能な合言葉方式）
6. 既定の rollback 保持値を将来ユーザー設定可能にするか
7. NAS/同期フォルダ自動取り込みを将来提供するか

## 非目標

- NeDB ファイルの live multi-writer 化
- アプリ起動中の DB フォルダ双方向コピー
- Cookie や DMM login の端末間移行
- ゲームサーバーへ記録を書き戻すこと
- 初期実装での特定クラウドサービス必須化
- 競合時の黙示的な last-write-wins

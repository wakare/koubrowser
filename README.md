# 甲ブラウザについて

Electron製艦これ専用ブラウザアプリです。

## 紹介ページとインストーラ

機能紹介やインストーラのダウンロードは、公式サイトで案内しています。

https://koubrowser.app/

## ゲーム通信への非干渉

「艦隊これくしょん ～艦これ～」サーバとの通信内容について、通信内容の改変・追加送信・通信への介入等は一切行っていません。

本アプリでは、ゲーム画面の `XMLHttpRequest` をラップしてリクエスト・レスポンス内容を記録処理へ通知しています。元の `open` / `send` はそのまま呼び出しています。通信内容を参照している主な処理箇所は以下の通りです。

- `src/main/kcbrowser.ts`: ゲーム画面の webview に通信内容取得用 preload を設定
- `src/preload/xhr-hook.ts`: `XMLHttpRequest` をラップし、通信内容を IPC へ通知。実通信は `super.open(...)` / `super.send(...)` を呼び出し
- `src/common/kcsapi_hook.ts`: IPC で通知する通信情報の型と変換処理

## 主な機能

- ゲーム画面と有用な情報画面の同時表示
- 特殊砲撃・弾着・夜戦CI確率・先制対潜など一覧表示
- マップに対しての制空権事前確認
- 遂行中任務の進捗状況を記録、任務編成条件の OK・NG 表示
- 遠征で各艦隊の達成判定、報酬情報、条件詳細をまとめて確認
- 戦闘履歴、戦果、タイムラインの表示
- EOや戦果任務を仮にクリアした場合、また直近日別戦果からの月末戦果予測
- ドロップ履歴のマップ別・艦名別集計
- 艦隊、装備、アイテム情報の参照
- 資源、バケツ、開発資材、改修資材の記録グラフ
- スクリーンショット、録画、ミュート、アプリ更新確認
- 誤って大破進撃した場合、タイトルバーに表示
- 任意のウインドウサイズでゲーム画面表示

## 技術構成

- Electron / electron-vite
- Vue 3 / TypeScript
- Buefy / Bulma
- NeDB
- Highcharts
- Vitest
- electron-builder

## NeDB について

記録データの保存には NeDB を使用しています。開発初期に組み込んだ経緯があり、既存データ形式や周辺処理との互換性を保つため現時点では継続利用しています。

ただし、NeDB は現在の選択肢として積極的に採用したいものではないため、将来的には保守性や移行性を考慮した別の保存方式へ置き換えたいと考えています。

記録データの保存先は、アプリ内の「アプリ情報」から開けます。PC 間の記録データの自動統合には対応していません。複数の PC から同じ保存先を同時に使用したり、甲ブラウザの起動中に双方向同期したりすると、記録の上書きや破損につながるおそれがあります。バックアップや別 PC へのコピーは、甲ブラウザを終了してから行ってください。

## Worker の利用

DB の読み書き、資源記録グラフ用データの計算、戦闘・ドロップ履歴の集計などは、Node.js の Worker Threads で実行しています。記録データの検索や集計でメインプロセスを長時間占有しないようにし、ゲーム画面やアプリ画面の操作感への影響を抑えるためです。

また、クエスト DB 用の Worker は他の記録 DB 用 Worker と分けています。戦闘履歴やドロップ履歴などの DB はサイズが大きくなりやすいため、その読み込みや集計の影響をクエスト進捗の更新・参照に波及させないことを目的としています。

## セットアップ

```bash
npm install
```

`postinstall` で `electron-builder install-app-deps` が実行されます。

## 開発

```bash
npm run dev
```

開発起動時には、同梱ライセンス情報の生成と開発用コードのコピーが実行されます。

### テスト動作確認用の環境変数

テスト動作確認用のモードで起動する場合は、PowerShell で次の環境変数を設定します。

```powershell
$env:test_mode = "1"
npm run dev
```

テスト動作確認用モードでのテストデータ指定方法は、{main|scripts}\debug-data.tsを参照してください。

## ビルド等コマンド

```bash
# テスト
npm run test

# カバレッジ付きテスト
npm run test:coverage

# 型チェック・全テスト・本番バンドルの一括検証
npm run verify

# 通常ビルド
npm run build

# 型チェック済みの変更を再バンドル
npm run build:bundle

# Windows インストーラー作成
npm run build:win

# macOS(未サポート)
npm run build:mac

# Linux(未サポート)
npm run build:linux

# unpack 形式
npm run build:unpack
```

`typecheck` は Node、メイン画面、設定画面の型チェックを並列実行します。
日常の変更確認には、型チェックと全テストだけを実行する高速ゲートを使用できます。

```bash
npm run verify:quick
```

`verify` は生成ファイルを準備した後、型チェックと全テストを並列実行し、
両方が成功した場合だけ本番バンドルを作成します。

本番バンドルを実際の Electron で確認する場合は、先に甲ブラウザを終了してから
次の smoke コマンドを実行します。既定ではアプリ起動前の画面とレイアウトだけを
確認し、`GAME START` はクリックしません。

```bash
npm run smoke:electron
```

PC 間データの復元経路は、実アカウントやネットワークを使わず、各 DB 10,000 件の
隔離 fixture で restore、同一 bundle の再 import、rollback、redo、破損候補の拒否を
確認できます。復元後に保存した読み取り専用の整合性基準が rollback の 9 DB 差分を
検出し、redo 後に再び完全一致することも検査します。さらに 4 世代の完成済み
rollback を用意し、既定の 3 世代制限で最古の世代だけが削除されることを検査します。
同じ run で安全追加の merge、merge rollback / redo を行い、6 種類の履歴検索、
資源グラフ、海域別 drop 集計が各切り替え後の期待件数になることも確認します。
加えて production main process で暗号化 transfer の round-trip、密文外の identity
不在、誤った合言葉と 1 byte 破損の安全な拒否も検査します。

```bash
npm run smoke:account-restore
```

実アカウントの読み取り専用 Phase A では、「アプリ情報」から同じアカウントの
backup を検査した後、「識別情報を除いた検査記録を保存」を実行できます。保存される JSON は
build、OS・CPU architecture、bundle の作成日時、DB・記録件数、DB 別 preview だけを含み、member ID、
端末・bundle 識別子、保存 path、hash、raw record は含みません。これは受け入れ証拠
専用であり、未暗号化の backup bundle を共有可能にする機能ではありません。完全な
実データ受け入れ手順は
[`docs/account-data-acceptance.md`](docs/account-data-acceptance.md)
を参照してください。

別 PC へ渡す場合は、「アプリ情報」→「暗号化共有用エクスポート」で 12 文字以上の
合言葉を 2 回入力し、単一の `.koubrowser-transfer` を保存します。受信側では
「暗号化 transfer の読み込み」から同じ合言葉で開くと、既存の account-match、
DB 別 preview、統合、完全復元へ進めます。transfer は AES-256-GCM で認証付き暗号化
され、誤った合言葉と破損を現在データの変更前に拒否します。合言葉は保存・回復されない
ため、transfer ファイルとは別の経路で共有してください。

実環境で `GAME START` の通常クリックと任務指引まで確認する場合だけ、明示的に
次のオプションを指定します。DMM のログインがプロセス終了後に保持されない場合は、
smoke が起動したウインドウ内でログインします。

```bash
npm run smoke:electron -- --allow-game-start --workspace-pages --task-guide --wide-workspace
```

自動クリック後もゲームが開始されない環境では、次の手動経路を使用できます。
甲ブラウザのウインドウが表示されたら、利用者が `GAME START` を1回クリックします。

```bash
npm run smoke:electron -- --manual-game-start --workspace-pages --task-guide --wide-workspace --summary --timeout 300000
```

同じ実環境検査を、十分な全体タイムアウトと画面キャプチャ付きで起動する短縮コマンドも
用意されています。

```bash
npm run smoke:live
```

live smoke はウインドウを前面に表示し、DMM ログイン、`GAME START`、ゲームロード、
アカウントデータ準備、レイアウト検査の現在段階を出力します。`--timeout` は各段階、
`--total-timeout` は実行全体の上限です。結果の `displayTopology` には、実行時の
各ディスプレイの論理 workArea、拡大率、回転、および対象ウインドウがある
ディスプレイが記録されます。

検査開始時の保存済みレイアウトがクラシックの場合、smoke はアカウントデータの
読み込み後に一時的にワークスペースへ切り替えます。検査終了時には実行前の設定内容と
ウインドウ状態を復元します。

実環境の smoke は Chromium のリモートデバッグを有効にせず、親子プロセス間の
一時的な IPC だけでアプリ画面を検査します。smoke は自分が起動した Electron
プロセスだけを終了し、
`koubrowser.json` を実行前のハッシュと一致する内容へ戻します。
`--workspace-pages` は表示可能な補助ページを順番に開き、タブ、パネル、
ページネーションが各ページ内に収まることを確認して元のページへ戻します。
`--wide-workspace` は現在のディスプレイの利用可能領域が十分な場合だけ一時的に
1440 × 928 の Surface 200% 相当、1600 × 800 の狭小レイアウト、
1756 × 900 の基準レイアウト、
1920 × 1200 の縦長レイアウト、利用可能領域全体の幅広レイアウトを順番に確認し、
各サイズで表示対象となる任務指引を含む全ページを検査して元の大きさへ戻します。
さらに 1316 × 632 の最小 workspace を、収容可能な各ディスプレイへ順番に移動し、
対象 display、1000 × 600 のゲーム領域、`ドック・任務` を含むページ一覧を確認して
元のディスプレイへ戻します。1440 × 928 ではゲーム領域を 1124 × 674 に保ちます。
既存の甲ブラウザが起動中、または想定する
1200 × 720 の DMM ゲームフレームを確認できない場合は操作せず終了します。
DevTools ポートは、隔離されたローカルデータだけを使う `smoke:layout` でのみ
使用します。

レイアウト fixture の各サイズ・各ページを PNG として保存する場合は、次を実行します。
出力は `output/layout-smoke` 配下の実行時刻別ディレクトリに保存されます。

```bash
npm run smoke:layout:capture
```

表示解像度やゲーム通信内容は変更しません。

外部ゲームやアカウントデータに依存せず、同じレイアウト矩陣だけを検査する場合は、
型チェック、全テスト、production bundle、レイアウト矩陣をまとめて実行します。

```bash
npm run verify:layout
```

`smoke:layout` は独立した一時ユーザーデータ領域と最小限の合成データを使用し、
GAME START をクリックしません。1316 × 632、1440 × 928、1600 × 800、
1756 × 900、1920 × 1200、利用可能領域全体を順番に検査し、正式な設定、Cookie、記録には
アクセスしません。最後に 1440 × 928 と `ドック・任務` の選択を保存して同じ隔離
profile で再起動し、ウインドウ、ゲーム倍率、タッチ操作によるページ選択、
Ctrl+0 後のサイズを再確認してから
一時領域を削除します。実アカウントのデータ量に依存する
最終確認は、上記の明示的な `--allow-game-start` 経路で別途行います。

Issue #23 / #34 で報告された物理ディスプレイ構成を受け入れる場合は、それぞれの
対象機で次を実行します。

```bash
npm run smoke:accept:issue-23
npm run smoke:accept:issue-34
```

前者はタッチ対応 2880 × 1920・200% のディスプレイ、後者は
1920 × 1080 の主ディスプレイと 1920 × 1200 の別ディスプレイを必須とします。
Electron が返す論理 bounds と scale factor から物理解像度を照合するため、別の
ディスプレイ構成では受け入れ成功を報告せず終了します。条件が一致した場合だけ、
対象ディスプレイへの移動、全ページの収容、タッチ切り替え、隔離 profile の再起動、
ページ復元、Ctrl+0 後のゲーム倍率までを一連で確認し、証跡 PNG を
`output/acceptance-issue-*` に保存します。表示設定やゲーム通信は変更しません。

Issue #30 の遠征チェックを実アカウントで受け入れる場合は、甲ブラウザを終了してから
次を実行します。

```bash
npm run smoke:accept:issue-30
```

この command は合成 fixture と GAME START の自動クリックを拒否し、表示された
甲ブラウザ内で利用者がログインして `GAME START` を押すまで待ちます。実アカウントの
データ準備後に `ドック・任務` の遠征チェックを開き、鎮守府海域 filter を必要な間だけ
有効にして、明示的な panel error がなく候補が 1 行以上表示されることを確認します。
終了前に元の filter と workspace page を復元し、summary の `liveAcceptance` に
行数、代表任務、filter の一時変更有無を記録します。証跡 PNG にはゲーム画面や
アカウント固有情報が写り得るため、本人管理の場所に保管し、公開前に確認してください。
パネルエラーが表示された場合は `診断情報を保存` から脱敏済み JSON を保存できます。
自動送信は行いません。内容と共有時の注意点は
[`docs/assist-diagnostics.md`](docs/assist-diagnostics.md) を参照してください。

署名済み任務知識 bundle の起動時適用を、隔離された production Electron で確認する
場合は次を実行します。

```bash
npm run smoke:data-update
```

この smoke は実行ごとの Ed25519 鍵をメモリ内で生成し、loopback の一時配布サーバーから
署名済み任務知識 bundle を production 主プロセスにダウンロードさせます。manifest と
payload の取得、検証済み cache と active pointer の作成を確認して隔離 profile を再起動し、
次回起動で bundle が有効化されたことと任務指引に fixture の任務が表示されたことまで
確認します。秘密鍵をディスクへ保存せず、localhost HTTP は layout fixture と smoke IPC の
両方が明示された場合だけ許可します。外部ネットワーク、正式な設定、Cookie、記録、
ゲーム通信にはアクセスしません。

正式配布前の HTTPS staging を、審査済み公開鍵と隔離 profile で受け入れる場合:

```powershell
npm run verify
npm run smoke:accept:data-update -- --data-update-staging-manifest https://updates.example.test/data/manifest.json --data-update-public-key-file path/to/public-key.txt
```

この command は合成配布端を使わず、署名済み bundle の download、落盤後の再検証、
再起動、地図と任務知識の production bridge 反映を確認し、発行・審査時と照合できる
公開鍵 SHA-256 指紋を要約します。詳細は
[`docs/data-update.md`](docs/data-update.md) を参照してください。正式鍵の生成、保管、
backup、ローテーション、漏えい対応は
[`docs/data-update-key-operations.md`](docs/data-update-key-operations.md) に分離しています。

開発中の検証は目的ごとに分けます。編集直後は関連テストと該当する型チェックだけを
実行し、まとまった変更の区切りで `npm run verify` を実行します。レスポンシブ配置を
変更した場合は区切りで `npm run verify:layout` を実行し、実アカウント smoke は
データ量に依存する最終受け入れ時だけ行います。これにより、外部サービスの待ち時間を
通常の編集ループから分離できます。

現在のオープン Issue と実装・自動確認・実機確認の対応は
[`docs/issue-readiness.md`](docs/issue-readiness.md) にまとめています。
実アカウントで PC 間バックアップ、統合、完全復元、rollback / redo を最終確認する
場合は、先に
[`docs/account-data-acceptance.md`](docs/account-data-acceptance.md)
の退避、脱敏、中止条件を確認してください。

生成物は `electron-builder.yml` の設定に従って作成されます。Windows では `KouBrowser-${version}-win-setup.exe` 形式のインストーラーが作成されます。

## ディレクトリ構成

- `src/main`: Electron メインプロセス、IPC、記録、更新確認など
- `src/preload`: preload とレンダラー向け API ブリッジ
- `src/renderer`: Vue アプリ本体
- `src/common`: メイン・レンダラー共通の型、計算、艦これ API 関連処理
- `resources`: マップ情報などの同梱リソース
- `openapi`: ドロップ情報提供openapi定義
- `scripts`: ライセンス生成、開発用コードコピー、更新確認用補助スクリプト

## 型生成とライセンス生成

```bash
# openapi/kc-intake.yaml から型などを生成
npm run gen:types

# 同梱ライセンス情報を生成
npm run gen:licenses
```

## 更新確認の開発用設定

開発中にローカルの更新ファイルを参照する場合は、`KOU_UPDATE_URL` を設定してから `npm run dev` を実行します。

```powershell
$env:KOU_UPDATE_URL = 'http://localhost:8080/releases'
npm run dev
```

更新確認用の HTTP サーバーは次のスクリプトから起動できます。

```bash
scripts/run-http-server-for-update-check.bat
```

scripts/releases/配下に更新情報メタファイルlatest.yml等を配置します。

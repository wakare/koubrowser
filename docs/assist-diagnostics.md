# アシストパネル診断情報

遠征チェックなどのアシストパネルで表示処理に失敗すると、エラー画面に
`診断情報を保存` が表示される。保存は利用者がこのボタンを押した場合だけ行われ、
自動送信、バックグラウンド保存、外部サービスへのアップロードは行わない。

## 保存される情報

診断 JSON の schema version は `1` で、次の情報だけを含む。

- エラー発生時刻と診断ファイル生成時刻
- アプリのバージョン、OS、CPU architecture
- パネル ID と Vue が報告した処理 phase
- 脱敏後の例外名、message、stack

アカウント状態やゲーム API payload を構造化データとして収集しない。renderer から
渡された値は main process で exact schema、許可済みパネル ID、長さ、時刻形式を再検証し、
未知の field を拒否する。main process はローカルパス、URL、`api_*` field、credential、
メールアドレスを置換する。アプリ自身の source location は原因調査に使えるよう
`[APP]/src/...` または `[APP]/out/...` の形式だけを残す。

例外 message と stack は、失敗したコードが生成した文字列である。脱敏規則は既知の
識別情報を除くが、共有前には保存した JSON を利用者自身でも確認する。

## 保存境界

- preload は固定 IPC channel に構造化された診断入力だけを渡す。
- main process は main/assist renderer の main frame 以外からの要求を拒否する。
- 保存先は native save dialog で利用者が選ぶ。
- 既存ファイルは上書きせず、同時に複数の保存処理を開始しない。
- renderer へ返す保存結果には path を含めず、ファイル名だけを返す。

## Issue 報告時

保存した JSON は公開場所へ自動的に添付しない。内容を確認したうえで、必要な場合だけ
maintainer が指定する非公開の方法で共有する。実アカウントの受け入れで作成した
スクリーンショットも、アカウント固有情報が写り得るため本人管理の場所に保管する。

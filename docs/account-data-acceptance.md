# アカウントデータ復元・統合の実データ受け入れ手順

## 目的と範囲

この手順は、合成データの自動検査を通過した PC 間バックアップ、完全復元、
record-level 統合、rollback / redo を、同じ実アカウントの長期履歴で最終確認する
ための手動 release gate である。

ゲーム通信、Cookie、DMM session の移行は対象外とする。2 台の PC で甲ブラウザを
同時に起動したまま同じ保存先を共有せず、bundle を介した single-writer 運用だけを
検査する。本人専用のローカル backup folder は暗号化されていないため共有せず、
PC 間の受け渡しには「暗号化共有用エクスポート」で作る `.koubrowser-transfer`
だけを使用する。

## 実行前の条件

- 対象 build で `npm run typecheck`、`npm run test`、
  `npm run smoke:account-restore` が成功している。
- 送信側と受信側が同じ艦これアカウントであることを、利用者本人が確認している。
- 両方の PC で甲ブラウザを終了し、各 PC のデータフォルダ全体を別媒体へ退避している。
- 送信側と受信側のバックアップ bundle を別名・別 directory で作成し、元 bundle を
  上書きしない。
- 12 文字以上の推測困難な合言葉を用意し、transfer ファイルとは別経路で受信側へ
  渡している。合言葉を失うと復旧できないことを双方が理解している。
- 空き容量が、現在データ、候補、rollback 世代を同時に保持できるだけある。
- member ID、端末 path、raw record、hash、Cookie、画面上の個人情報を Issue、
  チャット、公開ログへ貼り付けない。

実データでの完全復元と統合は、明示的なネイティブ確認後に再起動を伴う。検証専用 PC
または復旧可能なデータコピーで行い、通常運用中の唯一のコピーを試験対象にしない。

## 受け入れ記録

実行者は次の脱敏済み情報だけを記録する。

| 項目 | 記録内容 |
| --- | --- |
| build | アプリ version または commit |
| 環境 | Windows version、CPU architecture、概算 DB 容量 |
| bundle | 作成日時、DB 数、総 record 件数。bundle ID は記録しない |
| preview | DB 別の追加、完全一致、旧 ID 内容一致、競合、要確認、安全追加の件数 |
| audit | `match` / `different` と変更された DB 名。hash は記録しない |
| 業務確認 | 資源、戦闘、ドロップ、遠征、任務、報酬履歴の表示可否と概算件数 |
| transaction | restore / merge / rollback / redo の成否と再起動回数 |

スクリーンショットを残す場合は、アカウント名、member ID、端末 path、艦隊名などを
確認し、公開前に除去する。エラー調査用のデータ一式は公開せず、本人管理の暗号化済み
保管先に置く。

## Phase A: 読み取り専用検査

1. 送信側で甲ブラウザを起動し、ゲームデータの読み込み完了後に
   「アプリ情報」→「暗号化共有用エクスポート」で合言葉を 2 回入力し、
   `.koubrowser-transfer` を作成する。
2. 作成完了後、同じ画面の「暗号化 transfer の読み込み」でそのファイルと合言葉を
   入力し、valid、
   DB 数、総 record 件数を記録する。
3. 受信側でも甲ブラウザを起動し、「暗号化 transfer の読み込み」で送信側 transfer
   と合言葉を入力する。
4. account 判定が「同じ」であることを確認する。「異なる」または「確認不能」の場合は
   以後の操作を行わない。
5. DB 別 preview を記録する。`quest` は同一任務・同一周期・同一 counter schema の
   単調進捗だけが `quest-monotonic-v1` の `安全統合` となり、counter は加算せず
   項目ごとの最大値になることを確認する。別周期、metadata / schema 不一致、未知構造、
   unmatched task、完了状態、`meta.inProgress` は自動統合されず、`要確認` または
   現在側保持になることを確認する。
6. 「識別情報を除いた検査記録を保存」を実行し、生成された JSON の build、実行環境、
   bundle 集計、DB 別 preview が画面と一致することを確認する。
7. JSON と画面のどちらにも raw record、account ID、device/bundle ID、端末 path、
   hash が含まれないことを確認する。JSON は証拠専用であり、元の backup bundle の
   代わりに復元・統合へ使用しない。

この phase では「安全な記録を統合」と「復元を準備して再起動」を押さない。

## Phase B: record-level 統合

この phase は preview に 1 件以上の `安全統合` があり、競合時に現在側を保持する
現行 policy を実行者が理解している場合だけ行う。

1. 受信側で新しいローカルバックアップを作成し、元に戻すための独立した退避コピーを
   確保する。
2. 「安全な記録を統合」を選び、ネイティブ確認に表示された安全統合件数が preview と
   一致することを確認して再起動する。
3. 再起動後、資源グラフ、戦闘履歴、ドロップ履歴・海域集計、遠征、任務、任務報酬の
   各画面を開く。例外、無限 loading、空表示への退行がなく、追記型 DB は preview の
   安全統合分だけ対象履歴が増え、`quest` は record 件数を増やさず preview どおりの
   counter 最大値へ進むことを確認する。
4. 「現在データの基準を保存」で統合後の semantic baseline を保存する。
5. 「統合前データを確認」→「統合前のデータへ戻す」を実行して再起動する。
6. 同じ業務画面が統合前の結果へ戻り、「保存した基準と比較」が `different` となる
   ことを確認する。
7. 「統合後データを確認」→「統合後のデータを再適用」を実行して再起動する。
8. 業務画面が統合後の結果へ戻り、baseline 比較が `match` となることを確認する。

同じ bundle をもう一度検査した場合、既に取り込んだ record が `安全統合` として再度
増えず、`quest` の counter もさらに進まないことを確認する。

## Phase C: 完全復元

完全復元は現在 directory 全体を候補へ切り替えるため、Phase B と分け、再び受信側の
最新バックアップとデータフォルダ全体の退避を作成してから行う。

1. 送信側 bundle を再検査し、valid かつ同じ account であることを確認する。
2. 「復元を準備して再起動」を選び、完全置換であることを示す確認文を読んでから
   実行する。
3. 再起動後、9 DB の概算件数と、資源、戦闘、ドロップ、遠征、任務、報酬履歴が
   送信側の期待値と一致することを確認する。
4. 復元後の状態で semantic baseline を保存する。
5. 「復元前データを確認」→「復元前のデータへ戻す」を実行し、再起動後の baseline
   比較が `different` となることを確認する。
6. 「再適用データを確認」→「元に戻す前のデータを再適用」を実行し、再起動後の
   baseline 比較が `match` となることを確認する。
7. 同じ bundle を再度完全復元し、record 件数が増えず、既存 rollback metadata が
   不要に置き換わらないことを確認する。

## 中止条件と復旧

次のいずれかが起きた場合、その phase を不合格として操作を止める。

- account 判定が同じではない。
- preview、ネイティブ確認、再起動後の件数が一致しない。
- DB 初期化、transaction recovery、容量不足、権限、hash、schema のエラーが出る。
- 業務画面の一部だけが旧状態または新状態となる。
- rollback / redo の候補確認が失敗する。
- baseline が想定と逆になる、または account 不一致を報告する。

失敗後は甲ブラウザを終了し、`restore-staging`、`restore-rollbacks`、
`merge-staging`、`merge-rollbacks` と pending marker を削除・改名しない。
データフォルダ全体をそのまま退避し、実行 build、脱敏済み手順、最後に成功した phase
だけを記録する。唯一のデータコピーへ手作業で DB を上書きせず、実行前に退避した
データフォルダを使って別環境で復旧する。

## 合格条件

- 読み取り専用検査が account 不一致と破損候補を適用前に止める。
- 暗号化 transfer の誤った合言葉、1 byte 破損、未対応 header を同じ安全な失敗として
  拒否し、renderer や公開証跡へ合言葉と平文 account identity を出さない。
- 統合は preview の安全統合だけを反映する。`quest` は同一任務・同一周期・同一
  counter schema の単調進捗だけを加算せず項目別最大値で反映し、別周期、未知構造、
  `meta.inProgress` と競合 record は現在側に残す。
- 完全復元は 9 DB を一体として切り替え、部分的な新旧混在を起こさない。
- restore と merge の rollback / redo がそれぞれ可逆である。
- baseline は rollback 後に `different`、redo 後に `match` となる。
- 主要履歴、資源グラフ、ドロップ集計が期待件数と一致する。
- 同じ bundle の再適用で record が増えない。
- UI と共有可能な記録に account ID、端末 path、raw record、hash が露出しない。
- Phase A の識別情報除外済み JSON は画面の DB 別 preview と一致し、既存ファイルを上書きしない。
- ゲームリクエスト、レスポンス、ゲーム状態、サーバー通信 semantics を変更しない。

全条件を満たした実データ run が少なくとも 1 件記録されるまで、PC 間復元・統合は
「合成データで自動確認済み、実データ受け入れ待ち」と扱う。

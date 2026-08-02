# オープン Issue 実装・受け入れ状況

最終確認日: 2026-08-03

この文書は、現在の作業ツリーに含まれる実装と GitHub のオープン Issue
を対応付けるための受け入れ表である。GitHub 上で Issue が閉じられたことや、
未リリースの作業ツリーが配布済みであることを示すものではない。

## 判定

- **自動確認済み**: 要求に対応する実装と回帰テストがあり、現在の検証を通過している。
- **実機確認済み**: 自動確認に加え、対象の実機・アカウント・実データで専用受け入れを通過している。
- **実機確認待ち**: 自動確認はあるが、報告された機器・アカウント・実データでの確認が必要。
- **一部実装**: Issue 内の複数要求の一部だけを満たしている。
- **方針決定待ち**: 実装前に配布先、運用、データ競合、安全性などの判断が必要。
- **凍結**: 現時点では対応需要がなく、既存実装と自動確認を維持したまま優先対象から外す。

## 対応表

| Issue                                                                            | 現在の判定                 | 実装・自動確認の根拠                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 残る受け入れ条件                                                                                                                              |
| -------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [#4 UI の自動配置](https://github.com/yukikuri/koubrowser/issues/4)              | 自動確認済み               | `src/common/layout.ts`、`src/common/__tests__/layout.test.ts`、workspace のサイズ別 Electron smoke、最小から基準幅まで往復する 11 段階の連続 resize でゲームと UI の左右余白・track 間隔の自動一致、page scroll `0,0`、document overflow なしを確認                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | マウスによる連続リサイズの操作感は任意の実機受け入れとする                                                                                    |
| [#13 改善要望](https://github.com/yukikuri/koubrowser/issues/13)                 | 自動確認済み               | 戦闘結果時の大破警告、保有数表示、game-only の縦横比・復元、ミュート状態保存に加え、production Electron で不正な縦横比を含む 5 段階の game-only 往復 resize、静音化・app renderer 再読み込み・静音維持・原状態復元、残り 5 枠、満額 `12/12`・`23/23`、上限超過 `13/12`・`24/23` の艦娘・装備表示と非重複を確認                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | マウス操作感と実アカウントの実数による確認は任意の実機受け入れとする                                                                          |
| [#17 大破・録画・保存先](https://github.com/yukikuri/koubrowser/issues/17)       | 自動確認済み               | 戦闘結果時の通常/連合艦隊大破判定、window/game 両録画 source の映像・音声 track、隔離 option で選んだカスタム保存先への実 PNG と game-only WebM の生成、既定保存先が未使用であることを production Electron で確認                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 実プレイで大破表示と、生成 WebM のゲーム映像・音声を再生確認する                                                                              |
| [#18 提案とデータ同期](https://github.com/yukikuri/koubrowser/issues/18)         | 一部実装・設計判断待ち     | 戦闘結果で大破艦を検出した際のゲーム領域全体の入力保護（通常クリックは解除不可、Ctrl+クリック/Ctrl+Enter で明示解除）、HP バー、固定上流 Proxy の Chromium 解決・system 復元 smoke、戦闘結果表示、workspace のモジュール化・各パネルの表示/非表示・拡縮、タイトルバー配色、データ保存先案内と renderer→preload→main の実ディレクトリ解決 smoke。多言語化は型付き `ja-JP` カタログ、全 renderer の locale 同期、`Intl` helper、全 4 業務パネル、Electron main 文言、生文字列監査、内部 `en-XA` production smoke、翻訳保守手順まで L10N-4 完了ゲートを通過。PC 間データは DP-1 の整合 backup とローカル UI、AES-256-GCM/scrypt の単一暗号化 transfer export/import、DP-2 の厳格な bundle 検査、redacted account-match、DB 別差分 preview、Phase A 識別情報除外済み JSON 証拠、隔離 staging、再起動前の確認、`KcRecord` 起動前の atomic directory 切り替え、両 worker による起動時再検証、phase marker による crash recovery、従来 directory の検証済み保持、ユーザー操作可能な rollback / redo、活動 DB を変更しない redacted semantic audit、安全側の rollback 保持期限・世代数・容量管理、追記型 8 DB の legacy content fingerprint preview、新規 record の version 1 `recordIdentity` と外部 payload 分離、順序非依存の読み取り専用 merge plan、期限切れ再検証、database-only merge candidate、既存 candidate の厳格な再読み込み検証、準備時と再起動後の apply 直前の current-state 再比較、明示的な `comparisonPolicyVersion: 1` を持つ stable identity 用 DB 別比較 policy、`preserve-current-v1` の DB 別 payload 競合分類・解決、`quest-monotonic-v1` の同一任務・同一周期 counter 最大値統合、redacted な競合内訳表示、未対応 version の拒否、4 phase の record-level merge apply / crash recovery transaction、main process 保管候補とネイティブ確認による安全統合・再起動 UI、独立した merge rollback/redo・crash recovery・保持期限管理、合成 90,000 件の production smoke まで実装 | 第 2 言語・翻訳レビュー体制、暗号化 transfer と実アカウントでの復元・統合受け入れが必要                                                       |
| [#21 キャプチャ完了表示](https://github.com/yukikuri/koubrowser/issues/21)       | 自動確認済み               | `CaptureNotice` のコンポーネントテストに加え、production Electron でアプリ自身の撮影ボタンを操作し、成功通知、通知内ファイル名、カスタム保存先に新規作成された PNG の一致、PNG 署名、ゲーム領域と同じ縦横比を確認                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 実ゲーム画面でも表示名と保存ファイルが一致することを任意の実機確認とする                                                                      |
| [#23 高 DPI で画面分離](https://github.com/yukikuri/koubrowser/issues/23)        | 凍結                       | 1316×632 最小 workspace、1440×928 Surface 200% 相当で 1124×674 のゲーム領域、`ドック・任務` の入渠・建造・任務サマリ、戦果ヘッダーの非重複検査、論理 workArea 判定、production Electron の touch event によるページ選択・再起動復元。`smoke:accept:issue-23` は 2880×1920・200%・touch 対応を物理 topology gate として要求する                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 2026-07-31 の判断で需要が生じるまで実機受け入れを凍結。再開時は Surface Pro 11 で同 command と指操作を確認する                                |
| [#26 戦闘終了時の艦隊更新](https://github.com/yukikuri/koubrowser/issues/26)     | 自動確認済み               | 通常/連合/第7艦の回帰に加え、水上連合、連合夜戦、夜戦→昼戦など 8 endpoint の識別を追加。隔離 fixture を production main/renderer parser に通し、戦闘結果時に主力 HP `9`、護衛 HP `8`、艦隊面板 HP `9` とタイトルバーの大破警告を確認                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 通常海域とイベント連合艦隊の実レスポンスによる確認は任意の実機受け入れとする                                                                  |
| [#29 アプリとデータの更新分離](https://github.com/yukikuri/koubrowser/issues/29) | 自動確認済み・運用決定待ち | 署名済み地図・任務知識 bundle、HTTPS・同一 origin（redirect 後も検証）、サイズ・SHA-256・厳格な JSON 検証、版別保存と安全な同梱データへのフォールバック。URL と Ed25519 公開鍵の半設定・不正設定は通信前に安全に無効化する。発行後の自己検証と独立オフライン審査、固定 trust config、指紋検証、production 環境上書き拒否、production Electron の loopback 配布 smoke に加え、明示した HTTPS staging URL と公開鍵ファイルだけを使い、隔離 download、落盤 bundle の再検証、再起動、renderer bridge の地図 spot、任務ページの claim を確認する `smoke:accept:data-update` を実装                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 正式 URL・公開鍵・指紋の値、秘密鍵保管・ローテーション、初回の審査済み地図・任務知識 bundle を決定し、HTTPS staging で受け入れ command を通す |
| [#30 遠征チェックが空](https://github.com/yukikuri/koubrowser/issues/30)         | 実機確認済み               | 遠征条件計算の回帰テスト、パネルのエラー境界、空状態表示、Electron fixture で 8 行表示。`smoke:accept:issue-30` は合成 fixture と GAME START 自動クリックを拒否し、非表示の運用ページ・遠征パネルを必要時だけ復元して ready な実アカウントを検査し、元の page/panel/filter/scroll 状態を `finally` で復元する。2026-07-31 に実アカウントで 18 行、明示 error なしを確認して PASS                                                                 | 配布版で再発報告がある場合のみ、同じ command と本人管理の証跡 PNG で再確認する                                                                |
| [#31 遊撃部隊 TP](https://github.com/yukikuri/koubrowser/issues/31)              | 自動確認済み               | 単体・コンポーネント回帰に加え、隔離 fixture を production parser に通し、第1〜6艦の 123 TP、第7艦の 16 TP、合計 139 TP を構成。production Electron で `139/97`、7 艦の ID、第7艦が表示領域内に収まることを確認                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 報告元と同等の実編成による確認は任意の実機受け入れとする                                                                                      |
| [#34 双画面・拡大率](https://github.com/yukikuri/koubrowser/issues/34)           | 凍結                       | 125% 相当の双画面論理 workArea、表示変更、Ctrl+0/Ctrl+±/ピンチ抑止、隔離 profile の再起動後 Ctrl+0、サイズ別 Electron smoke と戦果ヘッダー非重複検査。実機の双画面 150% 環境で両画面への workspace 移動も確認済み。`smoke:accept:issue-34` は 1920×1080 主画面 + 1920×1200 副画面以外を拒否する                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 2026-07-31 の判断で需要が生じるまで実機受け入れを凍結。再開時は報告と同じ双画面で同 command を実行する                                         |
| [#38 Proxy サーバー](https://github.com/yukikuri/koubrowser/issues/38)           | 自動確認済み・利用形態確認待ち | 甲ブラウザから 74EO を固定上流 Proxy として使う既存方向なら、両アプリが同じゲーム通信を観測し、甲ブラウザの opt-in 艦ログ提供を利用できる。74EO の既定 port `40620` は設定例と一致し、設定画面にも接続方向を明記。逆方向の HTTPS 上流 Proxy は CONNECT 後の暗号化 tunnel となるため、単純な転送サーバーだけでは艦ログに必要な `/kcsapi/` body を観測できない。詳細は [`proxy-server-integration-requirements.md`](proxy-server-integration-requirements.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 既存の「甲ブラウザ → 74EO」で目的を満たすか確認する。74EO 内蔵 browser を通信元として維持する必要がある場合だけ、二重 TLS 復号または構造化 intake bridge を選ぶ |

## 次の優先順

1. **完了: 任務攻略推薦ルートの決定的 MVP**
   - [`quest-strategy-route-design.md`](quest-strategy-route-design.md) の 8 週間ルートを
     実装し、2～5 件の任務を審査済み出撃候補へまとめる読み取り専用計画、
     canonical snapshot、固定 comparator、説明、fallback、opt-in UI、署名 schema、
     production Electron の合成 smoke を完了した。
   - [`quest-strategy-route-acceptance.md`](quest-strategy-route-acceptance.md) に従い、
     実アカウント表示確認は `PENDING OWNER`、Issue #29 の正式配布運用は `FROZEN`、
     既定有効化は別 PR の判断まで `BLOCKED` とする。
   - 既存任務指引を常に fallback として維持し、勝率・消費量予測、装備 optimizer、
     イベント即時追従、自動操作、ゲーム通信変更は引き続き非目標とする。
   - 成長攻略チェックは、既存の遠征05資源循環・1-5対潜練習に加え、独立した2情報源で
     審査した 1-5 月度EO勲章ルート、2-1 航空・水上基礎ルート、第2～第4艦隊の常設編成任務
     解放チェーンを bundled opt-in として追加した。R7 の署名候補2件、既定無効、session-only、
     runtime eligible count 0 は変更しない。
2. **P1: #29 の本番運用決定**
   - 正式 HTTPS 配布 URL、公開鍵・指紋の値、秘密鍵保管とローテーションを決める。
   - [`data-update-key-operations.md`](data-update-key-operations.md) の役割分離、主鍵と
     passphrase の別保管、独立した 2 backup、復旧試験周期、incident 連絡先を実在する
     担当者・保管先で埋め、別担当者が承認する。
   - 審査済みの URL・公開鍵・指紋を `src/main/data-update-deployment.ts` の固定
     trust config に同時設定する。通常の production 環境変数はこの値を上書きできない。
   - 初回 bundle は発行担当者とは別の審査者が `npm run data:bundle:verify` で検証する。
   - `npm run data:release:record` で署名済み bundle、公開鍵指紋、正式 URL、checked-in
     任務候補の完全一致を JSON 記録へ固定し、同じ組み合わせを staging に配置する。
   - 保存後の審査記録を `npm run data:release:verify` で同じ公開証拠から再構成し、
     未知フィールドや bundle・鍵・URL・候補の取り違えがないことを別担当者が確認する。
   - 起動時適用、production bridge による地図読込、任務指引への反映は
     `npm run smoke:data-update` で自動確認する。
   - 正式設定候補を HTTPS staging に配置した後、
     `npm run smoke:accept:data-update -- --data-update-staging-manifest <URL> --data-update-public-key-file <path>`
     で、合成配布端を使わない download、再検証、再起動、地図・任務知識の反映を確認する。
   - 初回任務知識の署名前候補は
     `docs/data-update-candidates/quest-knowledge-reviewed-v1.json` に生成済み。正式鍵と
     data version の決定後、同梱地図とともに署名し、別担当者の審査を経て staging
     配布を確認する。
3. **P2: #18 の独立要件を承認して Issue 化**
   - [`docs/localization-requirements.md`](localization-requirements.md) で第 2 言語と翻訳レビュー体制を決め、[`docs/localization-workflow.md`](localization-workflow.md) の公開基準で審査する。
   - [`docs/cross-pc-data-requirements.md`](cross-pc-data-requirements.md) の任務競合規則は実装済み。暗号化 transfer と実アカウント受け入れは [`docs/account-data-acceptance.md`](account-data-acceptance.md) の手順で実施する。
   - legacy 内容一致 preview、version 1 `recordIdentity`、安定 identity に基づく
     read-only merge plan、計画の期限切れ再検証、活動 DB と分離した database-only
     candidate の生成、既存 candidate の再読み込み検証、snapshot 内の準備時
     current-state 再比較、未知 field を安全側で扱う version 1 DB 別比較 policy、
     現在側を保持する version 1 DB 別 payload 競合分類・解決と redacted 内訳表示、
     再起動後の apply 直前の current-state 再比較、検証済み database-only candidate
     の 4 phase record-level 適用 transaction と crash recovery、main process が
     検査済み候補を保持してネイティブ確認後に再検証・再起動する安全統合 UI、
     merge 専用 rollback/redo・crash recovery・保持期限管理、合成 90,000 件の
     production smoke、および任務 DB の保守的な `quest-monotonic-v1` 専用規則は実装済み。
   - PC 間データは live NeDB 同期を実装せず、復元可能な export/import を最初の milestone とする。
4. **P3: #38 の Proxy 連携方式を決定**
   - まず、既存の「甲ブラウザ → 74EO」の固定上流 Proxy と opt-in 艦ログ提供で
     利用目的を満たすか Issue 報告者に確認する。
   - 74EO 内蔵 browser を通信元として維持する必要がある場合、単純な CONNECT
     転送では艦ログに必要な API body を観測できないため、
     [`proxy-server-integration-requirements.md`](proxy-server-integration-requirements.md)
     の二重 TLS 復号 Proxy または構造化 loopback intake bridge を選ぶ。
   - 二重 TLS 復号を選ぶ場合は、loopback 限定、既定無効、CA 秘密鍵運用、
     raw payload 非保存、通信 bytes 非変更、security review を受け入れ条件にする。
   - 推奨する intake bridge を選ぶ場合は、74EO 側の対応可否、version 付き schema、
     process 認証、size / rate limit、drop に不要な credential の拒否を先に合意する。
5. **凍結: #23 / #34 の実機受け入れ**
   - 2026-07-31 の判断で、現時点では対応需要がないため優先対象から外す。
   - 既存の自動検査と専用 acceptance command は削除せず、需要が生じた時点で再開する。
6. **継続保守: 任務指引**
   - 新しい任務定義を追加するときだけ Wiki 根拠を再確認する。
   - ローカルデータで証明できない条件を「準備完了」と推測しない。
7. **完了: #30 の実アカウント受け入れ**
   - 2026-07-31 に `npm run smoke:accept:issue-30` が実アカウントで PASS。
   - 脱敏済み summary は 18 行、明示 error なし、鎮守府海域 filter と遠征パネルの
     一時変更・復元を記録した。PNG はアカウント固有情報を含み得るため公開しない。

GitHub Wiki は現在、Proxy 型ツールの動作確認情報が中心であり、開発ロードマップ
全体ではない。Proxy 互換性は維持しつつ、優先順位は Issue とこの受け入れ表を基準にする。

## 2026-07-30 の大破入力保護 smoke 証拠

`npm run smoke:layout` の combined day/night fixture を production Electron で実行した。

- 戦闘結果 callback 後、主力艦 HP `9/40` と護衛艦 HP `8` を parser と renderer の
  両方で確認し、タイトルバーに `！大破艦があります！` を表示した。
- アプリ所有の `alertdialog` がゲーム領域全体と同じ矩形を覆い、ゲーム webview へ
  コードや DOM を注入せずにポインター入力を遮断した。
- 通常クリック後も保護が残り、Ctrl+クリック後だけ解除された。キーボード利用者向けの
  Ctrl+Enter 経路はコンポーネントテストで確認した。
- 新しい大破戦闘結果ごとに解除状態をリセットし、母港・大破なし・進撃後は
  不要な入力保護を表示しないことを状態テストで確認した。

これは #18 の「大破時の強制警告」を、ゲーム通信を変更しないアプリ側の誤操作防止として
確認する。実ゲームで撤退・進撃を選ぶ操作感は任意の実機受け入れとする。

## 2026-07-30 の固定上流 Proxy smoke 証拠

`npm run smoke:layout` の隔離された production Electron 主プロセスで、既存の
Proxy 適用関数へ `http=127.0.0.1:65534;https=127.0.0.1:65534` を一時設定した。

- Chromium の `resolveProxy()` が HTTPS probe を `PROXY 127.0.0.1:65534` と解決した。
- 検査は Proxy 解決だけを行い、probe URL やゲームサーバーへのネットワーク要求を
  発生させなかった。
- `finally` で system mode を再適用し、同じ probe の解決結果から哨兵 Proxy が
  除去されたことを確認した。
- smoke hook は layout fixture でのみ有効であり、通常起動から呼び出せない。

これは #18 の「上流プロキシを手動で設定」を、ゲーム通信を送信・変更せずに
production main process の設定経路まで確認する。

## 2026-07-30 の受け入れ summary 脱敏証拠

`npm run smoke:layout:capture` を production Electron で実行し、成功した run
directory に `smoke-summary.json` が自動保存されることを確認した。

- JSON 内の `screenshotDirectory` は `output/layout-smoke/...` の repository
  相対 path であり、workspace の絶対 path とローカルのユーザー名を含まなかった。
- repository 外の screenshot directory は最後の directory 名だけへ縮約する。
- #30 の実アカウント summary は任務名を除外し、行数、明示 error、filter、
  workspace page、panel の初期状態と一時変更状態だけを残す。
- summary file は `wx` で排他的に作成し、既存の証跡を上書きしない。
- 同じ directory の PNG は引き続き本人確認用であり、公開証跡として扱わない。

これにより、#23 / #34 の合成画面証跡と #30 の実アカウント受け入れで、
terminal log から JSON 部分を手作業で切り出したり、絶対 path を手作業で
削除したりせずに、脱敏済みの機械可読 summary を確認できる。

## 2026-07-31 の #30 実アカウント受け入れ証拠

`npm run smoke:accept:issue-30` を手動 GAME START と ready な実アカウントで実行した。

- 遠征チェックに 18 行を表示し、明示 error はなかった。
- 未選択だった鎮守府海域 filter と非表示だった遠征パネルを検査中だけ有効化し、
  `finally` で元の状態へ戻した。
- 非表示の built-in workspace page は安定した page id で一時復元でき、幅広い
  パネルで意図的に非表示となる filter toggle は、表示中の filter 本体を使って
  geometry を検証する。
- 検査対象を viewport 内へスクロールし、終了時に元の page と scroll 位置を戻した。
- `smoke-summary.json` は行数と復元状態だけを残し、遠征名と絶対 path を除外した。
- 同 directory の PNG は本人管理の証拠であり、公開しない。

## 2026-07-30 のデータ保存先 smoke 証拠

`npm run smoke:layout` の隔離された production Electron で、アプリ情報の
`データ保存先を開く` を実際に操作した。

- renderer の成功表示が `データ保存先を開きました` へ変わった。
- preload の限定 API と信頼済み main frame の IPC 検査を経由して主プロセスへ到達した。
- 主プロセスが選んだ directory は Electron の隔離 `userData` 直下の
  `koubrowser` であり、実在することを確認した。
- layout fixture では `shell.openPath` を fixture-only recorder に差し替え、
  ファイル管理画面を開かずに対象だけを検査した。通常起動では従来どおり
  `shell.openPath` を使用する。
- 絶対 path は通常 renderer や要約へ返さず、ローカルのユーザー名を証跡へ残さない。

これは #18 の保存場所に関する質問について、説明文だけでなく現在の実行環境で
正しいアプリデータ directory を開く経路まで確認する。

## 2026-07-30 の任務進捗統合 smoke 証拠

`npm run smoke:account-restore` の隔離された production Electron と合成 90,000 件の
account データで、追記型 8 DB に加えて `quest-monotonic-v1` を実行した。

- 同じ任務番号、`daily-20260730`、task metadata、`countMax: [5, 3]` を持つ
  現在側 `[3, 1]` と incoming 側 `[2, 2]` を、加算せず項目ごとの最大値
  `[3, 2]` へ統合した。
- candidate は現在側の NeDB ID、日時、`api_state: 2`、
  `api_progress_flag: 0` と task metadata を維持し、incoming 側の完了表示で
  上書きしなかった。`meta.inProgress` も統合対象にしない。
- 全 9 DB の candidate を再検証して再起動適用し、任務進捗を含む merge rollback で
  `[3, 1]`、redo で `[3, 2]` へ戻ることを確認した。その後の破損 restore 候補も
  現在側を変更せず拒否した。
- 単体・worker テストでは別周期、counter 次元・上限不一致、任務 metadata の不一致、
  未知 outer field、unmatched task、logical key 重複を安全側へ分類または拒否する。

これは #18 の任務 DB 専用規則を、ゲーム通信やゲーム状態を変更しないローカル
backup/merge transaction として確認する。実アカウントの受け入れは引き続き必要である。

## 2026-07-30 の workspace モジュール表示切替 smoke 証拠

`npm run smoke:layout` の隔離された production Electron で、`運用` ページの
`遠征チェック` を配置設定から非表示にした。

- パネルが DOM から外れ、保存済み workspace layout の `visible` が `false` になった。
- 配置設定を閉じた状態でも非表示を維持した。
- 配置設定を再度開くと同じ項目が未選択で表示され、設定経路を失わなかった。
- 項目を再選択するとパネルと保存値が復元され、検査前の workspace ページへ戻った。
- 全パネルを非表示にした空ページから設定を開く経路、空の組み込みページの非表示と復元、
  renderer 再読込後の保存値復元はコンポーネント・store テストで確認した。

これは #18 の「モジュール化によるカスタマイズ、各表示のオン/オフ設定」を、
利用者データやゲーム通信を使用せずに確認する。

## 2026-07-29 の #18 要件分離

Issue 本文と維持管理者の回答、現在の保存形式を照合し、未実装の 2 項目を独立した
要件案へ分離した。

- 多言語化は app-owned と game-owned の文字列を分離し、型付きカタログ、fallback、
  全ウインドウ同期、擬似翻訳レイアウト検査を段階化した。
- main/assist renderer は同期済み `GlobalSetting.locale` を翻訳時に参照し、option
  renderer は起動時に同じ locale を受け取る。タイトルバー、捕獲通知、アプリ情報と
  設定画面の全 app-owned 文言、関連するフォルダ選択ダイアログを移行した。
- 更新チェックの全状態、ボタン、バージョン、進捗率、エラー表示を純粋な
  locale-aware view formatter へ分離し、状態マトリクスで回帰確認する。
- アプリ情報画面の全 app-owned 文言を移行し、外部ブランド、URL、バージョン、
  保存先、ライセンス情報は原値を維持する。タイトルバー色の保存値と表示ラベルも分離した。
- 公開ページ名とパネル名を安定 ID に対応する `navigation.*` key へ移し、クラシック、
  workspace、独立 assist とページ選択で同じ locale-aware 定義を使う。保存済みの
  レイアウト形式は変えず、利用者が作成・変更したページ名は原値を維持する。
- 共通 waiting/loading/empty/error/retry 表示を `status.*` / `common.*` key へ移し、
  戦果、戦闘履歴、ドロップ、当月戦果、資源記録、一覧、workspace、起動前案内、
  assist エラー境界を実行時 locale に追従させる。Highcharts の no-data 文言も
  locale 変更時に更新し、ゲーム由来名と技術 detail はパラメーターの原値を保つ。
- 運用、戦闘・装備、ドロップ、任務の業務文言と構造化 formatter、Electron main の
  メニュー・ダイアログ・通知まで移行し、許可リスト方式の生文字列監査を追加した。
- 内部 `en-XA` を隔離 layout fixture にだけ注入する production Electron smoke を追加し、
  200% 文言で全 4 workspace ページの document overflow と操作到達性を確認した。
  翻訳 key の追加・レビュー・更新手順は `docs/localization-workflow.md` に記録した。
- option renderer は限定 preload の解除可能なイベントで正規化済み locale を受け取り、
  設定ウインドウを開いたままでも他 renderer と同じ locale へ再描画する。
- PC 間データは起動中の NeDB 共有を禁止したまま、検証済み export、preview、
  backup、staging import、record-level merge、任意同期フォルダの順に段階化した。
- Wiki は Proxy 互換性の根拠として参照し、ロードマップや同期仕様の根拠には使用しない。

この分離は実装方針の選択肢と受け入れ条件を明確にするが、初期言語、翻訳責任者、
暗号化、競合規則、同期範囲の維持管理者判断を代替しない。

## 2026-07-30 の署名済み地図・任務知識 smoke 証拠

`npm run smoke:data-update` を隔離された一時ユーザーデータ領域で実行した。

- 実行ごとの Ed25519 公開鍵で署名済み bundle が有効化された。
- manifest、`map/001_01_map.json`、`quest/knowledge.json` を loopback 配布端から
  取得し、検証済み version directory と active pointer を作成した。
- 隔離再起動後、production renderer の `cellInfoAsync(1, 1)` が preload/main を
  経由して外部 bundle の `#987 署名更新スモーク地点` を読み込んだ。
- 主プロセスは任務知識 claim 1 件と任務 ID `9000001` を読み込んだ。
- production Electron の任務指引に `#9000001 署名更新スモーク任務` が表示された。
- 外部ネットワーク、正式な設定、Cookie、記録、ゲーム通信を使用しなかった。
- 秘密鍵はディスクへ保存せず、終了時に一時ユーザーデータを削除した。

これは #29 の署名検証から地図・Vue 反映までの起動時経路を確認するが、正式な配布 URL、
組み込み公開鍵、秘密鍵運用、審査済み実データの承認を代替しない。

同じ production 経路を正式設定候補で確認するため、`smoke:accept:data-update` も追加した。
この command は HTTPS manifest と Ed25519 公開鍵ファイルの同時指定を必須にし、
HTTP、認証情報付き URL、合成 download fixture、TLS 検証無効化を拒否する。隔離
download 後に落盤 bundle を再検証し、再起動後の地図 spot と任務 claim を照合する。
bundle 発行、独立オフライン検証、staging 要約は同じ DER SPKI bytes の SHA-256 指紋を
表示し、公開鍵本体を別経路で受け渡さなくても使用鍵の一致を監査できる。
`npm run data:key:inspect` は bundle や秘密鍵へアクセスせず、受け取った Ed25519
公開鍵を正規化して設定値と同じ指紋を表示するため、組み込み前の照合にも使用できる。
`npm run data:key:rotation:verify` は旧・新 bundle の個別検証、異なる鍵と version、
発行時刻の前進、相互の誤鍵拒否を秘密鍵なしで確認し、新旧の指紋だけを記録する。
production build の信頼設定は `src/main/data-update-deployment.ts` に集約し、URL・公開鍵・
指紋を起動時に再検証する。通常の production 環境変数は信頼根を上書きできず、開発時または
layout fixture + smoke IPC + 明示 override の三重 gate だけが一時設定を使用できる。
初回任務知識は、日中両 Wiki の verified claim が完全一致する 129 task・258 claim
だけを決定的に export した署名前候補を作成し、未完了審査 59 task と分岐 5 task を除外した。
配布審査記録は署名済み bundle、公開鍵指紋、HTTPS URL、候補 bytes を相互検証し、秘密鍵・
公開鍵本体・ローカル path・個人情報を含まない JSON として固定できる。
`data:release:verify` は保存された記録を厳格に parse し、bundle の署名・全 payload・候補
bytes を再検証して全フィールドを再構成する。未知フィールド、改変された件数や hash、
別の bundle・鍵・URL・候補、symlink の記録を拒否し、redacted な hash だけを出力する。
`data:key:generate` は既存出力を上書きせず、AES-256-CBC で暗号化した PKCS#8 PEM と
正規化した公開鍵を同時に生成する。publisher は同じ暗号化 PEM を扱い、passphrase を
command line ではなく symlink ではない 1 行の一時ファイルから読み、使用後にメモリ上の
入力を消去する。
鍵運用 runbook は発行・審査の役割分離、鍵と passphrase の別保管、2 backup と定期復旧試験、
app-first の定期ローテーション、漏えい時に旧 cache を新アプリで拒否する手順を固定した。
正式な担当者、保管先、周期、incident 連絡先の決定は引き続き必要である。
発行・検証 CLI は未知 option と重複 option を入力・出力アクセス前に拒否し、
option 名の誤記や後勝ち上書きによる不完全な配布物を成功扱いにしない。
正式 staging が未決定のため、この HTTPS 受け入れ結果そのものはまだ記録していない。

## 2026-07-29 の双画面 smoke 証拠

隔離されたレイアウト fixture を、実機の 2 台のディスプレイで実行した。

- 両ディスプレイとも Electron の `scaleFactor` は 1.5。
- 両ディスプレイの論理 workArea は 2560×1392。
- 1516×752 workspace を各ディスプレイ内へ明示的に移動した。
- 検査時の display ID が対象 display と一致した。
- 両方でゲーム領域は 1200×720 を維持した。
- `運用`、`戦闘・装備`、`ドロップ`、`任務` の 4 ページを検査した。
- 検査後に元の display とウインドウサイズへ復元した。

これは #34 の高 DPI・双画面経路を実機 Electron で確認する証拠だが、ゲームデータは
合成 fixture であり、報告者と同じ解像度・Windows 設定での最終受け入れを代替しない。

## 2026-07-30 のアカウント復元・merge smoke 証拠

`npm run smoke:account-restore` を一時 user-data だけで実行した。

- 9 個の合成 NeDB に各 10,000 件、1 snapshot 合計 90,000 件を作成し、厳格な
  staging manifest と待機 restore marker を使用した。
- production Electron の 1 回目の起動で incoming directory が current になり、
  従来 directory と `rollback.json` が `restore-rollbacks` に保持された。
- production main process で検証済み bundle の暗号化 transfer を作成し、正しい
  合言葉での round-trip、密文外の identity 不在、誤った合言葉と 1 byte 破損の拒否、
  失敗時に復号済み directory を残さないことを確認した。
- 同じアカウントの完成済み履歴を事前に 3 世代置き、初回 restore 後の 4 世代から
  最古だけが世代上限で削除され、適用中 bundle と新しい履歴 2 世代が保持された。
  transaction 中の全世代、容量整理時の最新世代、`.partial`、未知・metadata 破損
  directory は自動削除対象外である。
- 2 回目は同じ bundle を再度 staging し、staging、current、既存 rollback を
  再検証した上で no-op とした。適用後に生成された既知の account-local JSON profile
  はサイズと JSON 構文を検査して保持し、未知ファイルは許容しない。current の件数と
  rollback metadata は変化しなかった。
- 3 回目は待機 rollback marker を適用し、従来 directory を current に戻した。
  置換された incoming directory は `replaced-account` に保持された。
- 1 回目の restore 後に、活動 DB を書き換えない読み取り専用 semantic baseline を
  90,000 件について保存した。baseline file は生の member ID と account path を
  含まず、renderer には日時と DB 別件数だけを返した。
- 3 回目の rollback 後、その baseline との比較で全 9 DB の差分を検出した。
- 4 回目は待機 redo marker を適用し、`replaced-account` を current に戻した。
  redo 直前の current は検証済みの新しい rollback source として `account` に保持した。
  同じ baseline との再比較は完全一致した。
- 5 回目は stable identity を持つ合成 backup を production worker で preview し、
  追記型 8 DB の安全追加と `quest-monotonic-v1` による任務 counter の安全統合を
  staging、再検証、起動時 merge まで通した。統合前の snapshot は独立した
  `merge-rollbacks` に保持された。
- 6 回目は merge rollback で統合前データを current に戻し、統合後データを
  `merged-account` に保持した。7 回目は merge redo で統合後データを再適用し、
  統合前データが再び rollback-ready であることを確認した。
- 8 回目は manifest 作成後に 1 DB を変更した候補を起動時検査で拒否した。
  merge 済み current の追記型 8 DB と任務 counter は変更せず、失敗 marker と staging
  は調査・再実行用に保持し、rollback partial directory は作成しなかった。
- 各起動後に production worker から `port`、`battle`、`drop`、`mission`、
  `quest`、`clearitemget` の合成履歴を検索した。restore/rollback/redo では各
  10,000 件、merge 後は追記型 DB が各 10,001 件となった。`quest` の合成履歴件数は
  10,000 件のまま、専用 fixture の counter が `[3, 1]` から `[3, 2]` へ進み、
  merge rollback / redo で件数と counter が可逆に切り替わった。
- 資源履歴の実集計は 10,000/10,001 chart point、海域 1-1 の S 勝 drop 集計も
  10,000/10,001 件となり、破損 restore の拒否後も merge 済みの業務結果を維持した。
- merge smoke の初回実行で preview と再検証が異なる semantic hash を使っていたため
  実候補が常に期限切れになる不具合を検出し、共通の database audit hash に統一した。
- worker 統合テストで独立した 2 bundle を A→B→A と B→A→B の順に適用し、
  record count、record ID、semantic hash が一致することを確認した。この検査で、
  安全追加 record の `_id` が既存 record より前に並ぶ場合、stage の初回 NeDB load
  がファイル順を正規化して byte hash を変える不具合を検出したため、stage は NeDB
  の `_id` index 順で書き出してから検証するよう修正した。
- 同じ作成時刻と出力先へ異なる端末 ID・bundle UUID で同時に export し、別々の
  immutable directory が publish され、どちらも独立して再検証できることを確認した。
  既存の同名 bundle directory は引き続き上書きしない。
- restore transaction に旧 schema version 0 と未知の future version 2 を与え、
  current account directory の移動や rollback partial の作成前に拒否し、pending
  marker と staging を保持することを確認した。
- 起動前の worker preflight validation を明示的に失敗させ、current account
  directory と内容を維持し、rollback partial は作らず、pending marker と staging
  を再試行・調査用に保持することを確認した。
- rollback 準備 directory の作成へ `ENOSPC` を注入し、current account directory
  と内容を維持し、rollback partial は残さず、pending marker と staging を保持する
  ことを確認した。
- restore/rollback とも `KcRecord` が対象 DB を開く前に実行され、worker の read-only
  検査は活動 DB の初期化を必要としないことを確認した。
- 大きい DB の検証直後、Windows が NeDB の `quest.db~` から `quest.db` への rename
  を短時間 `EPERM` にする事象を検出した。database load は rename の
  `EPERM` / `EACCES` / `EBUSY` に限って有限回再試行し、回帰テストで一時失敗後に
  正常ロードできることを確認した。最終エラーには DB 名と底層エラーを残す。
- 実アカウント、Cookie、DMM session、外部ネットワーク、ゲーム通信は使用しなかった。

これは production main/preload/worker の起動順、directory move、再検証、rollback 保持・
世代整理、同一 bundle の幂等性、restore と merge の rollback/redo 可逆切り替え、
安全追加の worker 計画・再検証、読み取り専用の内容比較、履歴検索と集計結果、
破損候補の失敗分離を確認するが、
実アカウントの長期履歴と実際の最大級 DB での最終受け入れは代替しない。

## 2026-07-30 の終了・再起動 smoke 証拠

Windows 10 で「一度終了すると次回起動できない」と報告された終了経路について、
`npm run smoke:layout` の隔離 profile で production Electron を終了し、同じ
user data で再起動する検査を厳格化した。

- 港口記録と外部掉落送信の周期 timer を終了前に停止し、最終記録を worker
  shutdown より先に投入する。
- 外部送信と各 database worker に 5 秒、アプリ全体の cleanup に 8 秒の有限 deadline
  を設け、worker は応答だけでなく thread の実終了まで待つ。
- 冒頭の終了は外部から強制終了せず、main process の cleanup 完了と exit code `0`
  を確認してから同一 user data で 2 回目を起動した。
- 再起動後、workspace bounds、選択ページ、ドック・任務ページ、ゲーム zoom が
  すべて保持されていることを確認した。

これは終了後に single-instance lock が残る主要経路を自動確認する。報告元と同じ
Windows 10 実機での最終確認は引き続き受け入れ候補とする。

## 2026-07-30 の UI 自動配置 smoke 証拠

`npm run smoke:layout` の隔離 profile で、workspace を 1316×632 から 1756×900
まで拡大して再び 1316×632 へ戻す 11 段階の resize を実行した。

- 各段階でゲーム領域を 5:3 のまま 1000×600 から最大 1200×720 の範囲へ自動調整した。
- 高さに応じて、ゲーム左余白、ゲームと UI の track 間隔、UI 右余白をすべて
  `0px` またはすべて `12px` へ自動で揃えた。
- 各段階で page scroll は `0,0`、document overflow はなく、ゲームと UI は
  viewport 内に収まり、互いに重ならなかった。
- 拡大・縮小後に元のウインドウ位置、サイズ、maximized 状態を復元した。

これは #4 の「スクロールせずゲームを可視領域へ置き、UI を自動調整する」要求を
production Electron の実ジオメトリで確認する。マウス操作感は任意の実機受け入れとする。

## 2026-07-30 の改善要望 smoke 証拠

`npm run smoke:layout` の隔離 profile で #13 の 4 要望を production Electron 上で
一連確認した。

- 戦闘結果 callback 後、主力艦 HP `9/40` とタイトルバーの
  `！大破艦があります！` を表示した。
- 保有数は残り 5 枠の艦娘 `7/12`・装備 `18/23`、満額の `12/12`・`23/23`、
  上限超過の `13/12`・`24/23` を表示した。満額は `空き0`、超過時は
  `上限超過1` と title / aria-label に明記し、警告色、文字切れ、タイトルバー内の
  重複がないことを確認した。
- game-only 表示を不正な縦横比を含む 5 段階で往復 resize し、各段階で 5:3 の
  ゲーム領域、適切な zoom factor、document overflow なしを確認した。workspace へ
  戻した後の再起動と zoom reset も確認した。
- 静音化後に app renderer を再読み込みし、別 document になった後も静音を維持し、
  検査後は元の非静音状態へ復元した。
- 隔離された合成データだけを使用し、外部ネットワーク、実アカウント、
  ゲーム通信を使用しなかった。

これは #13 の表示、状態保存、再読み込み、resize 復帰経路を自動確認する。
実際のマウス操作感と実アカウント値による確認は任意の実機受け入れとする。

## 2026-07-30 の戦闘結果艦隊更新 smoke 証拠

`npm run smoke:layout` の隔離 profile で、水上連合の昼戦、連合夜戦、戦闘結果を
production main と renderer の両方へ順番に入力した。

- 昼戦と夜戦の被害を合算し、主力艦 HP `9`、護衛艦 HP `8` へ更新した。
- renderer の艦隊面板は主力艦 HP `9/40` を大破状態で表示した。
- 戦闘結果 callback 後、タイトルバーは `！大破艦があります！` と大破配色を表示した。
- `battle_water`、`each_battle_water`、連合夜戦、特殊夜戦、夜戦→昼戦、
  航空戦を含む 8 endpoint が短い prefix の API へ誤分類されないことを回帰確認した。
- 隔離された合成データだけを使用し、外部ネットワーク、実アカウント、
  ゲーム通信を使用しなかった。

これは #26 の観測、HP 更新、renderer callback、大破警告までを自動確認する。
ダメコン消費は戦闘結果 response だけでは確定できないため予測せず、次の艦隊更新を
正とする。

## 共通検証

TypeScript、Vue、Electron main/preload、共有ロジックを変更した場合:

```bash
npm run typecheck
npm run test
```

レイアウト fixture の実画面確認:

```bash
npm run smoke:layout:capture
```

内部擬似翻訳のレイアウト確認:

```bash
npm run smoke:localization
```

隔離した合成 DB で restore、rollback 世代整理、再 import、rollback、redo、merge、
破損拒否、semantic audit、履歴検索と集計結果を確認:

```bash
npm run smoke:account-restore
```

実アカウントを使う最終確認:

```bash
npm run smoke:live
```

#30 の遠征チェックを実アカウントで受け入れる場合:

```bash
npm run smoke:accept:issue-30
```

smoke は設定を復元するが、開始前に甲ブラウザを終了し、重要なローカルデータを
バックアップしてから実行する。

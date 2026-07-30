# 翻訳 key の追加・レビュー・更新手順

この文書は、甲ブラウザ自身の文言を `src/common/localization.ts` の型付きカタログで
管理するための開発・レビュー手順である。艦これサーバー、Wiki、利用者入力から得た
原文を翻訳カタログへ移す手順ではない。

## 1. 所有者を分類する

文言を変更する前に、次のいずれかへ分類する。

| 分類 | 例 | 扱い |
| --- | --- | --- |
| app-owned | ボタン、見出し、エラー、aria-label | 型付き翻訳 key を使う |
| game-owned | 艦名、装備名、任務名、海域名 | 原文を維持し、周辺ラベルだけを翻訳する |
| user-owned | ページ名、パス、Proxy ルール | 入力値を変更せず表示する |
| external | ブランド、Wiki の引用・出典名、URL | 原文を維持し、必要な周辺ラベルだけを翻訳する |
| fixture | 合成テスト用の艦名や任務名 | 本番 UI と分離し、監査許可リストへ理由を記録する |

分類が曖昧な場合は key を追加せず、表示元と保存元を確認する。ゲーム由来値を
翻訳値へ置換したり、翻訳後の文字列をロジック判定や保存 ID に使ったりしない。

## 2. key を追加する

1. `JapaneseMessages` に意味ベースの安定した key を追加する。日本語本文そのものや
   Vue コンポーネント名だけを key にしない。
2. 同じ日本語でも意味や画面上の用途が異なる場合は別 key にする。
3. 動的な値は `{count}`、`{fileName}` のような名前付きパラメーターにする。文字列連結で
   文を組み立てず、翻訳値へ HTML を含めない。
4. 数値、日時、相対時刻、複数形は `formatAppNumber`、`formatAppDateTime`、
   `formatAppRelativeTime`、`selectAppPluralCategory` を使う。
5. Vue と Electron main では、それぞれの共通 `translateApp` translator を使う。
   game-owned、user-owned、external の値はパラメーターとして原値を渡す。
6. aria-label、title、placeholder、空状態、エラー状態も表示文言と同じ変更で移行する。

`JapaneseMessages` が型の正本であるため、key の誤記、必要なパラメーターの欠落、
余分なパラメーターは TypeScript で拒否される。

## 3. 生文字列監査を更新する

`npm run check:l10n` は renderer の Vue ファイルと Electron main の利用者向け文言を
走査する。新しい app-owned 日本語が見つかった場合は key へ移す。

翻訳しないことが正しい文字列だけを
`scripts/localization-raw-string-allowlist.json` へ追加できる。各項目には正確なファイル、
文字列、出現数と、game-owned、external、fixture などの具体的な理由を記録する。
広いパターン、空の理由、使われなくなった項目、実際の出現数と一致しない項目は
監査で拒否される。app-owned 文言を一時的に通す目的で許可リストを使わない。

## 4. レビューする

レビューでは次を確認する。

- key が画面上の意味を表し、既存 key の用途を不自然に拡張していない。
- app-owned と game-owned、user-owned、external の境界を維持している。
- 名前付きパラメーターの意味と型が明確で、翻訳値に HTML を要求していない。
- 表示文言と aria-label、title、placeholder の言語が一致する。
- Electron main、main renderer、assist renderer、option renderer が同じ確定済み locale を使う。
- locale を保存 ID、条件分岐、ゲーム通信、記録形式へ混入させていない。
- 追加言語の自然さ、ゲーム用語、文字数制約を、その言語の審査担当が確認している。

公開する言語カタログは `ja-JP` と key 集合およびパラメーター集合が完全一致し、
空文字や機械翻訳の未審査値を含まないことを必須とする。審査担当と全画面の完了が
確認できるまでは `AppLocales` へ追加しない。

## 5. key を更新・削除する

既存 key の意味を変える更新は、新しい key の追加として扱う。文言だけを改善する場合も、
利用箇所、アクセシビリティ属性、main process の通知、テスト期待値を同じ変更で確認する。

key を削除するときは全参照を削除し、生文字列へ戻っていないことを監査する。公開言語が
追加された後は、すべての locale カタログを同じ変更で更新する。翻訳レビューが終わるまで
基準言語だけを先に公開しない。

## 6. 検証する

通常の翻訳変更では次を実行する。

```bash
npm run check:l10n
npm run typecheck
npm run test
```

レイアウトや複数コンポーネントへ影響する変更では production bundle を作り、内部専用の
`en-XA` 擬似翻訳で全 workspace ページの document-level overflow と到達性も確認する。

```bash
npm run build
npm run smoke:localization
```

`en-XA` は文字を 200% に拡張する内部テスト locale であり、利用者設定へ保存したり
`AppLocales` へ公開したりしない。`smoke:localization` は隔離された一時ユーザーデータと
合成レイアウト fixture だけを使い、ゲーム通信や実アカウントを使用しない。


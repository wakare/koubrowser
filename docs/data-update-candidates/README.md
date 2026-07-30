# データ更新候補

この directory は、署名・配布前に独立審査する公開データ候補を保持する。
秘密鍵、token、配布先 credential、署名済み manifest は追加しない。

## 任務知識 v1

`quest-knowledge-reviewed-v1.json` は、アプリ内の `CuratedQuestClaims` から次の条件を
すべて満たす task group だけを決定的に出力した初回候補である。

- 日本語攻略 Wiki と中文 KCWiki の claim が 1 件ずつ存在する。
- 両方が `verified` で、`incomplete` や `under-review` ではない。
- task ID、title、前提 task の mode・ID・title が完全に一致する。
- client と publisher の `QuestKnowledgeUpdate` schema を通過する。

現在の候補は 129 task、258 claim を含む。未完了審査 59 task、情報源の不一致 5 task は
安全側で除外した。候補内の `lastVerifiedAt` と `dataVersion` は各情報源を最後に
確認した証拠であり、export 実行日へ自動更新しない。
checked-in JSON は 153,166 bytes、SHA-256 は
`a916ab1be73f27deb3411587916faf96d7510b513ae4f16d60e721032d0ffb04` である。

新しい候補は既存ファイルを上書きせず、別の output path へ生成する。

```powershell
npm run data:quest:export -- --output path/to/new-quest-knowledge-candidate.json
```

command は claim 数、除外理由別 task 数、候補 JSON bytes の SHA-256 を表示する。
checked-in 候補が現在の reviewed claims と一致することは自動テストで確認する。

このファイル単体は署名済み bundle ではなく、正式配布を意味しない。正式鍵と data
version が決定した後、発行担当者が `data:bundle` へ渡し、別担当者が
`data:bundle:verify` と候補 SHA-256 を確認する。さらに `data:release:record` で
bundle 内の同じ bytes、公開鍵指紋、配布 URL を審査記録へ結び付けてから staging へ
配置する。保存後の記録は `data:release:verify` で同じ bundle、公開鍵、URL、候補から
再構成し、完全一致を確認する。

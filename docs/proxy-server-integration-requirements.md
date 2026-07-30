# Proxy サーバー連携の要件整理

最終確認日: 2026-07-30

この文書は [#38 プロキシサーバ機能追加希望][issue-38] の接続方向と、
艦ログへ提供できるデータの条件を整理する。実装承認やリリース済み機能を
示すものではない。

## 現在サポートしている接続方向

現在の甲ブラウザは Electron の `session.setProxy()` を利用する **Proxy
クライアント** であり、次の方向をサポートする。

```text
甲ブラウザ -> 74EO などの Proxy 型ツール -> 艦これサーバー
```

- 設定画面の「固定プロキシサーバーを使用」で、外部ツールの待受アドレスを指定する。
- HTTP と HTTPS に同じローカル待受を使う例は
  `http=localhost:40620;https=localhost:40620` である。
- 74EO の現在の既定待受 port も `40620` である。利用者が変更している場合は、
  74EO の「通信」設定に表示された port を使う。
- [プロジェクト Wiki][wiki-proxy] では 74EO を含む Proxy 型ツールとの
  動作確認が記録されている。
- この設定は甲ブラウザを Proxy サーバーとして待受状態にしない。

甲ブラウザをゲーム browser として使い、74EO を固定上流 Proxy にした場合は、
甲ブラウザの既存 XHR 観測と 74EO の Proxy 観測が同じ通信をそれぞれ処理する。
甲ブラウザ側で「ドロップ情報を提供する」を有効にすれば、74EO を同時利用しながら
既存の艦ログ提供経路を使える。この利用形態でよければ #38 の目的に新しい Proxy
サーバーは不要である。

設定手順は次のとおり。

1. 74EO を起動し、「通信」設定の待受 port を確認する。
2. 甲ブラウザの「通信設定」で「固定プロキシサーバーを使用」を選ぶ。
3. 既定 port の場合は
   `http=127.0.0.1:40620;https=127.0.0.1:40620` を指定する。
4. 甲ブラウザを再起動し、必要なら「ドロップ情報を提供する」を有効にする。

## #38 が要求する接続方向

甲ブラウザではなく 74EO の内蔵 browser をゲーム通信の発生元として維持したい
場合、Issue 本文の「上流プロキシとして動作」と艦ログへの情報提供という追記は、
次の逆方向を要求する。

```text
74EO -> 甲ブラウザの新しい Proxy サーバー -> 艦これサーバー
```

74EO は `Proxy.UpStreamHttpProxy` と `Proxy.UpStreamHttpsProxy` に外部 Proxy
を設定できる。しかし、利用している Titanium.Web.Proxy 3.2.0 は HTTPS
接続について外部 Proxy へ `CONNECT host:443` を送り、そのトンネル上で
74EO 自身が接続先との TLS を開始する。

このため、通常の CONNECT 転送だけを甲ブラウザへ追加しても、甲ブラウザが
観測できるのは接続先と暗号化された byte stream だけである。艦ログへ送る
drop 情報の生成に必要な `/kcsapi/` の URL、request body、response body は
得られない。

調査時に固定した一次資料は次のとおり。

- 74EO が HTTP / HTTPS の両方へ同じ外部 Proxy を設定する
  [`APIObserver.cs`][74eo-upstream]。
- Titanium.Web.Proxy 3.2.0 が外部 Proxy へ CONNECT を送った後、その stream
  上で TLS client authentication を開始する
  [`TcpConnectionFactory.cs`][titanium-connect]。

## 実装前に必要な方針決定

### A. 二重の TLS 復号を行う Proxy

甲ブラウザ側でも HTTPS を復号すれば API body を観測できるが、専用 CA の
生成、秘密鍵保護、74EO 側での信頼設定、証明書更新、失敗時の通信遮断が必要に
なる。ゲーム通信の意味を変えないことを継続的に証明する負担も大きい。

次の条件をすべて承認するまでは実装しない。

- 待受は既定で無効、loopback のみに限定し、LAN へ公開しない。
- request / response の変更、再送、cache、raw payload の永続化を禁止する。
- CA や system Proxy を無断でインストール・変更しない。
- 証明書秘密鍵の保存、失効、更新、削除手順を定義する。
- 通信失敗時は直接接続へ黙って fallback せず、利用者へ明示する。
- 艦ログ提供は既存の opt-in 設定を尊重する。
- 実ゲーム通信を使わない protocol test と、独立した security review を通す。

### B. 構造化されたローカル intake bridge

推奨案は、HTTPS を二重に復号せず、すでに API を観測している 74EO 側から
必要最小限の構造化データを loopback bridge へ渡す方式である。

- version 付きの厳格な schema と request size / rate limit を設ける。
- drop 提供に不要な Cookie、token、request header、raw account state は受け取らない。
- 起動ごとの認証情報を使用し、他 process からの無許可投稿を拒否する。
- 受信値から既存の `DropData` 境界を再構成・検証し、艦ログへの送信可否は
  甲ブラウザ側の opt-in に従う。
- 74EO 本体または plugin 側の対応と、両 project で固定した protocol version が必要である。

この方式は #38 の「Proxy サーバー」という実装形態そのものではないが、
艦ログへ情報提供する目的を、ゲームサーバー通信へ新しい中間者を追加せずに満たせる。

## 受け入れ条件

実装へ進む前に、維持管理者が A または B を選び、次を Issue 上で確認する。

1. 目的が 74EO の通信内容表示ではなく、艦ログへの drop 情報提供であること。
2. 甲ブラウザを通常のゲーム browser として使わない運用を対象に含めること。
3. 外部 project 側の変更を許容するか、甲ブラウザ単独で完結させるか。
4. 利用者が明示的に有効化・停止でき、停止後に待受や秘密情報が残らないこと。
5. ゲーム request / response の bytes と順序を変更しないことを回帰検査できること。

方針決定までは、現在の「甲ブラウザから 74EO を固定上流 Proxy として使う」
接続だけをサポート済みとして扱う。

[issue-38]: https://github.com/yukikuri/koubrowser/issues/38
[wiki-proxy]: https://github.com/yukikuri/koubrowser/wiki/%E7%94%B2%E3%83%96%E3%83%A9%E3%82%A6%E3%82%B6%E3%81%A7%E5%8B%95%E4%BD%9C%E7%A2%BA%E8%AA%8D%E3%81%97%E3%81%9FProxy%E5%9E%8B%E3%83%84%E3%83%BC%E3%83%AB
[74eo-upstream]: https://github.com/dais-k/ElectronicObserver/blob/e9dc61803b8b78411c5b21ff639b743cd1ea4801/ElectronicObserver/Observer/APIObserver.cs#L198-L205
[titanium-connect]: https://github.com/justcoding121/titanium-web-proxy/blob/9e71608d204e5b67085656dd6b355813929801e4/src/Titanium.Web.Proxy/Network/TcpConnection/TcpConnectionFactory.cs#L488-L544

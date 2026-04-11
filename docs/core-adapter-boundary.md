# Q4M8: core / adapter 境界設計

## 設計概要

本設計は、通知機能を **core** と **adapter** に分離するための責務境界を定義するものです。  
対象は既存の MCP サーバー実装と、将来追加されうる CLI 入口です。

狙いは以下です。

- 通知ユースケースを MCP SDK や `process.env` から切り離す
- MCP / CLI ごとの差分を adapter 側へ閉じ込める
- 後続タスク H1R5 / N9C3 / T6P1 で迷わない境界を先に固定する
- MCP 側の命名を `notifier-mcp` に統一する方針を文書化する

---

## 目的 / 問題設定

現状は `src/index.js` と `src/mcp/tools/notify-send.js` に、以下の責務が混在しています。

- MCP サーバー起動
- stdio 接続
- シグナル処理と終了コード制御
- 入力スキーマ定義
- 環境変数読み込み
- 送信先選択
- 通知送信実行
- MCP 用エラー変換

このままでは、通知の本質的な処理と、MCP 固有の都合が分離されません。  
その結果、CLI 追加や送信先追加のたびに入口実装へ変更が波及しやすくなります。

---

## 現状観察（境界設計に関係する点）

1. `src/index.js`
   - `McpServer` と `StdioServerTransport` を直接生成している
   - `SIGINT` / `SIGTERM` を受けて `close()` 後に `exit(0)` している
   - 起動時の `connect` 失敗で `exit(1)` している
   - これは MCP / process lifecycle 固有であり core には置かない

2. `src/mcp/tools/notify-send.js`
   - `notify_send` の入力制約 (`message` max 4096, `title` max 256 optional) を持つ
   - `loadConfig()` と `DiscordNotificationService` 生成を直接行っている
   - `McpError(ErrorCode.InternalError)` への変換を行っている
   - これは「MCP 契約」と「通知ユースケース」が混在している状態

3. `src/config.js`
   - `process.env` を直接読む
   - 送信先ごとの設定解決も担っている
   - 環境依存の読み出しは core から分離すべき

4. `src/services/notification-service.js` / `src/services/discord-notification-service.js`
   - 通知送信の抽象と Discord 実装はすでに分離の方向性がある
   - 一方で「どの service を選ぶか」の組み立て責務はまだ adapter 寄りの場所にある

5. 命名状況
   - `package.json` の package 名は `notifer-mcp`
   - README / bin / MCP server name は `notifier-mcp`
   - オーナー判断として **MCP 側命名は `notifier-mcp` に統一** する

---

## 境界方針

### 基本原則

- **core は通知ユースケースとその入出力契約に集中する**
- **adapter は外部 I/O・実行環境・プロトコル差分を担当する**
- core は Node.js process / MCP SDK / CLI 引数仕様を知らない

### shared layer の位置づけ

- adapter は `process.env` / `process.argv` / MCP tool input などの **raw input を読む** 入口責務を持つ
- 文字列から型付き config / value object へ変換するような **再利用可能な非 I/O の検証・正規化** は shared layer に置く
- shared layer は pure function ベースで、`process` / MCP SDK / stdio には依存しない
- shared layer で発生した検証・正規化失敗も、そのまま外部へ露出せず **adapter が捕捉して外部契約に沿って変換する**
- これにより adapter ごとの重複実装を避けつつ、core には raw input を持ち込まない

---

## 提案する core の責務

core は「通知を送る」というユースケースを表現する層とする。

### 1. ユースケース実行

- `message` と `title` を受け取り通知送信を実行する
- 必要であれば core 用の入力 DTO / command を定義する
- adapter から渡された送信サービスを使って送信する
- raw input の読取や protocol/schema 解釈は行わない

### 2. core が扱う抽象

- `NotificationService` のような送信ポート
- 通知ペイロードの構造
- 送信失敗を表す adapter 非依存のドメイン/アプリケーションエラー

### 3. 送信先選択と service 構築

- 送信先の選択は adapter が担う
- `DiscordNotificationService` のような具体 service の構築も adapter が担う
- core は **すでに解決済みの `NotificationService` / port abstraction** を受け取って実行する
- core に destination registry / factory / service selector は置かない

### 4. core の戻り値 / 失敗モデル

- 成功時は `void` を返す
- 失敗時は typed な domain / use-case error を throw する
- phase 1 では result object を導入しない
- core は MCP の success response shape を知らず、成功時の response object は生成しない
- 追加 consumer が result object を必要とすることが明確になった時点でのみ再検討する

---

## 提案する adapter の責務

## MCP adapter

MCP adapter は `notifier-mcp` としての外部契約を保持する。

- MCP SDK (`McpServer`, `registerTool`, `McpError`) 利用
- tool 名 `notify_send` の公開
- 入力スキーマ定義
  - `message`: string, max 4096
  - `title`: string, optional, max 256
- MCP request / `process.env` など raw input の読取
- shared layer の検証・正規化を呼び出して core 用 command / config へ変換
- stdio transport の構成
- `SIGINT` / `SIGTERM` の shutdown 制御
- startup connect failure 時の `exit(1)`
- `close()` 後の `exit(0)`
- stdout を MCP protocol traffic 専用に保つ
- core エラーと shared layer の失敗を MCP の外部契約へ変換する
- core 成功後の MCP response object 生成を担う
- success response の baseline は現在の `content` を使う shape を維持する
- 送信先選択と具体 service / dependency の組み立て

## CLI adapter

CLI は将来追加される adapter として以下を担当する。

- `argv` 解析
- `process.env` / 設定ファイル / CLI 引数など raw input の読取
- shared layer の検証・正規化を呼び出して core 用 command / config へ変換
- CLI 用 usage / help / 標準エラー表示
- 送信先選択と具体 service / dependency の組み立て
- core への command 変換
- shared layer / core の成功 / 失敗を CLI 向けの exit code / メッセージへ変換

CLI も core を再利用するが、MCP の tool schema や `McpError` を共有しない。

---

## core から明示的に除外するもの

以下は **core に入れない**。

- `process.env` 参照
- `process.argv` / argv parsing
- MCP SDK 利用
- stdio transport
- `console.*` の直接呼び出し
- stdout / stderr への直接書き込み
- process lifecycle 管理
- `SIGINT` / `SIGTERM` ハンドリング
- `process.exit()` と exit code 判断
- adapter 固有のログ文言
- `McpError` / `ErrorCode.InternalError` への変換
- CLI 専用の終了コード・表示形式
- Node.js エントリーポイント都合の初期化処理

---

## 契約上の考慮事項（後続タスクで維持するもの）

後続タスクでは、境界を変えても以下の MCP baseline を維持する。

- MCP 公開名は `notifier-mcp`
- tool 名は `notify_send`
- 入力制約は維持する
  - `message` max 4096
  - `title` max 256 optional
- transport は stdio
- 設定読込失敗 / 送信失敗は MCP では `InternalError` に写像する
- shared layer の検証・正規化失敗も adapter が MCP の外部契約へ写像する
- 成功レスポンス生成は adapter が担い、baseline として現在の `content` shape を維持する
- `SIGINT` / `SIGTERM` では `close()` 後に `exit(0)`
- 起動時 `connect` 失敗は `exit(1)`
- stdout は MCP protocol traffic のため汚さない

上記は adapter の責務であり、core へ移してはならない。

---

## 命名決定

MCP 側の命名は **`notifier-mcp` に統一** する。

対象例:

- MCP server name
- MCP 向けドキュメント上の名称
- MCP 実行バイナリ名
- MCP adapter を表すモジュール/文書上の名称

補足:

- 現在 `package.json` の package 名は `notifer-mcp` だが、これは現状の不一致として認識する
- 本タスクでは実装修正は行わず、**命名方針の確定のみ** を扱う

---

## トレードオフと設計判断

### 判断 1: raw input の読取は adapter、再利用可能な非 I/O 正規化は shared layer に置く

- 採用理由
  - `process.env` / `argv` / MCP request など入口依存の差分を adapter に閉じ込められる
  - 文字列 -> 型付き config / value object のような処理を adapter 間で共有できる
  - core の再利用性とテスト容易性が高い

- 代替案
  - 各 adapter が raw input 読取後の検証・正規化まで個別実装する

- 代替案を採らない理由
  - adapter ごとに同じ変換ロジックが重複しやすい
  - 入口ごとに仕様差分が生じ、境界が曖昧になる
  - 失敗の外部表現まで shared layer / core に寄せると、MCP / CLI ごとの契約差分を core 側へ逆流させやすい

### 判断 2: MCP の入力制約は adapter 契約として保持する

- 採用理由
  - `notify_send` は MCP 公開 API であり、schema は adapter の責務
  - core は MCP SDK / zod 定義から自由であるべき

- 代替案
  - core でメッセージ長制約まで一元管理する

- 代替案の含意
  - 入力ルールの再利用性は上がる
  - ただし MCP/CLI ごとの差分表現が難しくなる

- 本設計の結論
  - **MCP baseline の制約値自体は保持**
  - ただし公開 schema とエラー表現は adapter が持つ
  - 共通化したい非 I/O の検証・正規化は shared layer に寄せる

### 判断 3: 送信先選択と service の具体生成は adapter が担う

- 採用理由
  - 設定起点の分岐を adapter 側に集約できる
  - core は「何で送るか」より「送る」の実行に集中できる
  - core に registry / factory を持ち込まずに済む

- 代替案
  - core 内に destination registry / factory を置く

- 代替案が向く場合
  - 送信先が多数になり、全 adapter で同じ選択ロジックを共有したい場合

- 現時点で採用しない理由
  - 現状は Discord のみで、抽象化の先回りコストが大きい

### 判断 4: phase 1 の core は `void` 成功 + typed error 失敗を採る

- 採用理由
  - core の契約を最小化できる
  - adapter は成功時の表示用情報ではなく、成功/失敗の制御に集中できる
  - 失敗時の分岐は typed error によって表現できる

- 代替案
  - core が最小の result object を返す

- 現時点で採用しない理由
  - 現フェーズでは利用者が result payload を必要としていない
  - 早すぎる result モデル導入は adapter 向け都合を core に持ち込みやすい
  - MCP success response の `content` shape は adapter 固有であり、core に持ち込むべきではない

---

## 後続タスクへの示唆

- H1R5 / N9C3 / T6P1 では、まず core の入力/出力契約を決め、その後 adapter 側へ
  - MCP schema
  - env / argv 解決
  - lifecycle / exit code
  - エラー変換
  を寄せると境界が崩れにくい

- 実装時に迷った場合は、次の問いで判定する
  - 「これは通知ユースケースそのものか？」
  - 「MCP や CLI を知らずに成立するか？」
  - 「process / transport / protocol が変わっても残るか？」

`yes` なら core、`no` なら adapter の可能性が高い。

---

## Open items（Q4M8 範囲内）

1. package 名 `notifer-mcp` の修正タイミング
   - 命名方針は `notifier-mcp`
   - 実ファイル更新は本タスク外

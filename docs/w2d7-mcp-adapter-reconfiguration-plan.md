# W2D7: MCP adapter 再構成計画

## 設計概要

本設計は、承認済みの Q4M8 / N9C3 / T6P1 と A7K2 baseline を前提に、**`packages/mcp` に残す責務と `packages/core` から利用する公開面**を明確化するものです。  
対象は **MCP adapter の再構成計画のみ** であり、CLI 契約、Bun 方針、全体 migration 手順の再設計は扱いません。

前提として、MCP package は adapter 層であり、外部契約 mapping を所有します。したがって以下を守ります。

- MCP response shape は core に持ち込まない
- stdio / process lifecycle は core に持ち込まない
- destination selection は core に持ち込まない
- shared validation は stable subpath export 経由で利用し、`src/**` deep import は行わない
- 成功レスポンスは adapter が生成し、A7K2 の `content` ベース baseline を維持する
- shared/core の失敗は adapter が MCP 外部契約へ写像する

---

## `packages/mcp` に残す責務

`packages/mcp` は **`notifier-mcp` としての外部契約を保持する adapter package** とする。

### 1. MCP 公開契約

- MCP server の生成と登録
- tool 名 `notify_send` の公開
- MCP request schema の定義と維持
  - `message`: string, max 4096
  - `title`: optional string, max 256
- 成功時の MCP response 生成
  - baseline は現在の `content` ベース shape を維持
- 失敗時の MCP error 生成

### 2. adapter 入力・依存解決

- MCP request からの raw tool input 読取
- `process.env` など実行環境からの raw config 読取
- destination selection
- concrete service / dependency の組み立て
  - 例: Discord 向け設定解決、送信 service 生成
- concrete service implementation は **現時点では `packages/mcp` に置く**
  - CLI 導入後に複数 adapter で共有需要が確認できた時点で、shared 化を再検討する
- **env/config 解決・destination selection・service assembly は boot-time に 1 回だけ実施** する
  - request ごとに `process.env` を再解決しない
  - boot 時点で依存が組み上がらなければ tool は実行可能状態に入らない

### 3. adapter 運用責務

- stdio transport の利用
- stdout を MCP protocol traffic 専用に保つ
- 必要な診断出力を stderr 側へ限定する
- stderr / MCP error message には secret や payload 本文を出さない
  - raw env value
  - webhook URL
  - token / credential
  - `message` / `title` の内容
- startup connect failure の扱い
- `SIGINT` / `SIGTERM` の shutdown 制御
- server/transport close 後の終了制御

### 4. adapter 境界変換

- MCP schema 通過後の input を core 用 command へ変換
- shared validation の結果を failure 起源に応じて MCP 契約へ変換
- core の typed error / infra failure を MCP 契約へ変換
- MCP schema 定義そのものは adapter が所有する
- external に見せる MCP error 表現も adapter が所有する
- shared validation は adapter 非依存の pure validation / normalization のみを所有する
- request payload 起源の validation failure は、validator 実装が shared validation にあっても adapter 側で **tool-input failure** として扱う

---

## `packages/mcp` が import する公開面

`packages/mcp` は **package 契約として公開された面だけ** を import する。

### `notifier-core` から import するもの

- 通知ユースケースの entrypoint
  - 例: `sendNotification` 相当の use-case
- core 用 DTO / command 型
- `NotificationService` のような adapter-neutral port
- adapter 非依存の typed error

### `notifier-core/validation` から import するもの

- raw config を型付き config/value object に正規化する pure function
- adapter から core command へ寄せるための再利用可能 validation / normalization
- adapter 非依存の validation failure 表現
- ただし request payload 起源 failure を `InternalError` にするかどうかの分類責務は export 元ではなく adapter 側に残す

### import ルール

- 許可:
  - `notifier-core`
  - `notifier-core/validation`
- 禁止:
  - `packages/core/src/**`
  - `notifier-core/src/**`
  - package-to-package の deep import

補足:

- MCP tool schema 自体は adapter 契約なので `packages/mcp` 側に残す
- message/title 制約値は A7K2 baseline を維持するが、**MCP 上の schema 定義と response/error 表現の所有者は adapter** とする
- shared validation が担当するのは以下に限定する
  - schema 通過後 payload の pure validation / normalization
  - raw config の pure validation / normalization
  - adapter 非依存の failure 返却
- shared validation は以下を担当しない
  - MCP tool schema の定義
  - MCP request parsing / request-handling
  - `McpError` や `ErrorCode` の選択

---

## 構成解決モデル

W2D7 では **boot-time 解決モデル** を採用する。

- server 起動時に adapter が `process.env` を読み取る
- adapter が boot 時に config 解決・destination selection・service assembly を完了させる
- 成功した場合のみ MCP server を通常運用状態に入れる
- 失敗した場合は request を待たず、redacted な診断を stderr に出して `exit(1)` する

### boot-time failure surface

- config resolution failure
- destination selection failure
- concrete service construction failure
- startup connect failure

### operator-visible behavior

- 起動失敗は MCP tool call の `InternalError` ではなく、**起動失敗として扱う**
- stderr には failure category と remediation に必要な最小限の情報だけを出す
- stderr / MCP error には raw env value・URL・token・message/title を含めない
- process は non-zero exit で終了し、supervisor 側で再起動可否を判断する

### request-time failure surface

- MCP schema 通過後の request payload validation failure
- core use-case failure
- downstream notification send failure

---

## 成功 / エラー mapping 責務

### 成功時

- core は通知送信の成功を返すだけで、MCP response shape は生成しない
- `packages/mcp` が success response を生成する
- response は A7K2 baseline どおり `content` ベース shape を維持する

### 失敗時

`packages/mcp` は失敗源に関わらず、**外部へ見せる MCP error 契約の唯一の所有者** とする。  

- request payload validation failure（schema 通過後）
- core use-case failure
- downstream notification send failure

このうち **`InternalError` へ統一するのは core/downstream/adapter runtime 起因の失敗のみ** とする。  
request payload 起源 failure は、validation 実装が shared validation であっても `InternalError` に吸収しない。  
core/shared は `McpError` や MCP response shape を知らない。

### mapping 境界

- **tool-input contract failure は `InternalError` に吸収しない**
  - MCP schema 未通過
  - request parsing / request-shape failure
  - required field 欠落や型不一致など、MCP request handling 層で閉じる不正入力
- schema 通過後であっても、request payload 起源の validation failure は adapter が tool-input failure として扱い、`InternalError` に変換しない
- boot-time の config 解決 / destination selection / service construction failure は request handling に入る前に起動失敗として扱う
- ただし将来これらを request-time に遅延させる場合、その failure は adapter が `InternalError` に写像する
- core use-case failure / downstream send failure は adapter が `InternalError` に変換する
- adapter は error message / logging を管理するが、stdout を汚さず、秘密情報や `message` / `title` 内容を含めない

### failure source ごとの扱い

| failure source | 発生タイミング | adapter の扱い | 外部から見える結果 |
| --- | --- | --- | --- |
| MCP schema/request handling failure | request-time | adapter 契約として処理 | schema/request handling 側の失敗。`InternalError` へ統一しない |
| request payload validation failure（schema 通過後・shared validation 実装含む） | request-time | tool-input failure として処理 | `InternalError` へ統一しない |
| config resolution failure | boot-time | 起動失敗として stderr に redacted 診断を出す | process `exit(1)` |
| destination selection failure | boot-time | 起動失敗として stderr に redacted 診断を出す | process `exit(1)` |
| service construction failure | boot-time | 起動失敗として stderr に redacted 診断を出す | process `exit(1)` |
| core use-case failure | request-time | `McpError(ErrorCode.InternalError)` に写像 | A7K2 baseline の MCP error |
| downstream send failure | request-time | `McpError(ErrorCode.InternalError)` に写像 | A7K2 baseline の MCP error |

---

## MCP 運用制約

`packages/mcp` は A7K2 baseline を維持するため、以下を必須制約とする。

- transport は stdio
- stdout は MCP protocol traffic のみ
- 通常のログや診断出力は stdout に書かない
- 診断が必要な場合は stderr を使う
- stderr と MCP error は redacted message のみを使う
  - raw env value / webhook URL / token / credential を出さない
  - `message` / `title` の内容を出さない
- startup 時に `connect` が失敗したら `exit(1)`
- `SIGINT` / `SIGTERM` 受信時は single-flight で shutdown を開始する
- 多重 signal では新しい shutdown を開始せず、進行中の shutdown を待つ
- shutdown は原則 `server.close()` を先に呼び、transport 側は close event / 明示 close のいずれか一方で idempotent に完了させる
- `server.close()` は MCP server 側の停止責務を持つ
- transport close は stdio transport resource の停止責務を持つ
- shutdown では close 成功時に `exit(0)`、close failure 時に redacted 診断を stderr に出して `exit(1)` とする
- graceful shutdown には明示的 timeout を設ける
  - timeout 超過時は redacted な stderr 診断のみを出し、fallback path として `exit(1)` する
- これらの lifecycle 制御は adapter 所有であり、core へ移さない

### lifecycle 詳細方針

- shutdown 開始は 1 回のみで、Promise/flag により single-flight 化する
- `SIGINT` と `SIGTERM` は同一 shutdown path を通す
- shutdown 中に追加 signal を受けても強制的に別 close を走らせない
- `server.close()` 済みかどうかと transport close 済みかどうかは adapter が個別に管理する
- transport 側の close event が先に来ても adapter は二重 close を避ける
- server/transport どちらかの close が失敗した場合は graceful shutdown 失敗として `exit(1)` を返す
- graceful shutdown timeout 到達時も成功扱いにはせず、close 完了を待ち続けずに fallback で `exit(1)` を返す

---

## 命名計画

MCP 側 naming は owner 判断どおり **`notifier-mcp` に統一**する。

| 対象 | 計画 |
| --- | --- |
| directory | `packages/mcp` |
| workspace package name | `notifier-mcp` |
| bin name | `notifier-mcp` |
| MCP server name | `notifier-mcp` |
| MCP tool name | `notify_send` |

補足:

- `packages/mcp` は npm publish 前提ではなく、workspace 内 package として扱う
- 現行 root package の `notifer-mcp` 表記揺れは、W2D7 では**実装修正せず**、MCP adapter 計画上の正規名を `notifier-mcp` と定義する

---

## 推奨構成イメージ（MCP 範囲のみ）

```text
packages/mcp/
├─ package.json
└─ src/
   ├─ server/        # MCP server / stdio / signal / startup-shutdown
   ├─ tools/         # notify_send schema, handler, response/error mapping
   ├─ config/        # env 読取, destination selection, dependency assembly
   ├─ services/      # concrete notification service implementations (当面は mcp 内)
   └─ index.*        # notifier-mcp entrypoint
```

意図:

- server 層が process / transport を持つ
- tools 層が MCP contract を持つ
- config 層が env 読取と dependency assembly を持つ
- services 層が concrete 実装を持ち、shared 化は CLI 導入後に再検討する
- core には MCP contract / stdio / destination selection を逆流させない

---

## トレードオフと設計判断

### 判断 1: success response は `packages/mcp` に残す

- 採用理由
  - `content` ベース response は MCP 外部契約そのものだから
  - core を MCP response shape から切り離せるから
- 代替案
  - core が success payload を返す
- 不採用理由
  - MCP 契約が core に逆流し、CLI など他 adapter 追加時に境界が崩れる

### 判断 2: destination selection と concrete service construction/implementation は `packages/mcp` に残す

- 採用理由
  - 実行環境依存の config 解決を adapter に閉じ込められるから
  - core は「何で送るか」ではなく「送る」に集中できるから
  - 現時点では MCP adapter しか存在せず、implementation 共有を先回りしない方が薄い境界を保てるから
- 代替案
  - core/shared 側に factory / registry / concrete implementation を置く
- 不採用理由
  - 現時点では抽象化の先回りであり、adapter 境界を曖昧にする
  - 共有が本当に必要かは CLI 導入後に判断すべきで、現段階で shared 化すると責務分離より共通化を優先してしまう

### 判断 3: shared validation は stable subpath export 経由でのみ使う

- 採用理由
  - package 境界を保ちながら pure validation を再利用できるから
  - `src/**` deep import を避け、後続再編の影響を局所化できるから
- 代替案
  - `packages/mcp` が `packages/core/src/**` を直接参照する
- 不採用理由
  - package 契約が壊れ、モノレポ再構成後の変更耐性が低くなる

### 判断 4: core/downstream 起因 failure の MCP 露出は `InternalError` に統一する

- 採用理由
  - A7K2 baseline と整合するから
  - 外部契約の変化を避けられるから
- 代替案
  - failure 種別ごとに MCP error code を分ける
- 不採用理由
  - 今回の W2D7 範囲を超えて外部契約を再設計してしまうため

補足:

- この統一対象は **core/downstream/adapter runtime failure** に限る
- request payload 起源 failure は schema 通過後でも、validator 実装場所に関係なく adapter 層で閉じ、`InternalError` に吸収しない

### 判断 5: env/config 解決と service assembly は boot-time に固定する

- 採用理由
  - env 起因の misconfiguration を fail-fast にできるから
  - request ごとの env 読取や service 再構築を避け、thin adapter の運用を単純化できるから
- 代替案
  - request-time に毎回 config 解決と service assembly を行う
- 不採用理由
  - 毎 request で同じ失敗を繰り返し得るうえ、failure surface が request handling と混ざって境界が分かりにくくなる

### 判断 6: stderr は診断専用だが secret/payload を出さない

- 採用理由
  - stdio MCP では stderr が唯一の運用診断面になりやすい一方、secret 混入の危険が高いため
  - operator 向け診断と機密保護を両立するため
- 代替案
  - 詳細な raw error/context をそのまま stderr へ出す
- 不採用理由
  - webhook URL・token・message/title が漏えいしうるため

### 判断 7: shutdown には timeout 付き fallback を持たせる

- 採用理由
  - signal 後に close が完了しない場合でも process を無期限に残さないため
  - supervisor/呼び出し側が異常終了として検知できるため
- 代替案
  - shutdown 完了まで無期限に待つ
- 不採用理由
  - stdio transport や server close のハングで process が居残り、運用上の復旧が遅れるため

---

## 結論

W2D7 の MCP adapter 再構成計画では、**`packages/mcp` が `notifier-mcp` として MCP 外部契約・stdio/lifecycle・boot-time の config/destination/service 解決・concrete service implementation・success/error mapping を保持し、`packages/core` からは use-case と stable validation export のみを利用する**。  
これにより、core は adapter 非依存を維持しつつ、MCP baseline (`notify_send`, `content` response, stdio, `InternalError`, startup/shutdown rules) を `packages/mcp` 側で継続保守できる。加えて、request-payload-originated failure と `InternalError` の境界、stderr の secrecy 制約、single-flight shutdown と timeout fallback 方針を adapter 側の責務として明文化できる。

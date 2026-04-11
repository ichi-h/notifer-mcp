# H1R5: CLI 契約設計

## 設計概要

本設計は、将来追加する CLI adapter の**ユーザー向け契約**だけを定義するものです。  
Q4M8 の境界方針に従い、CLI は thin adapter として以下だけを担います。

- `argv` / `process.env` から raw input を読む
- 本書で凍結した CLI 契約を保ったまま shared layer の検証・正規化を呼ぶ
- 送信先選択と具体 service の構築を行う
- core の成功/失敗を CLI の表示と exit code に写像する

core 側へ持ち込まないもの:

- `argv` 解析
- `process.env` 参照
- stdout / stderr への直接出力
- exit code 判断

---

## CLI 契約

### 1. コマンド / バイナリの考え方

- CLI 向けのユーザー公開名は **`notifier`** とする
- MCP 側の公開名 `notifier-mcp` とは分離して扱う
- package / monorepo / bin 配置の最終形は本タスクでは確定しない
- phase 1 のコマンド形は単一用途に絞り、**サブコマンドなし**とする

基本形:

```bash
notifier --message "<message>" [--title "<title>"]
```

補助オプション:

- `--help`: usage を表示して終了

### 2. 入力方法

#### message

- 必須
- `--message "<text>"` で与える
- 追加の trim は行わない
- `--message` の重複指定は usage error とする

意図:

- 短いメッセージは `--message` で簡潔に扱える
- 複数行や長文も 1 つの flag 値として明示的に扱う

#### title

- 任意
- `--title "<text>"` で与える
- `stdin` からは受け取らない
- 指定された場合も追加の trim は行わない
- `--title` の重複指定は usage error とする

### 3. バリデーション期待値

CLI は raw input を読むだけで、再利用可能な検証・正規化は shared layer に委譲する。  
ただし CLI 契約として、利用者に見える入力制約は以下とする。

- `message`
  - 必須
  - 文字列として解決されること
  - `--message` で渡された値は **trim せず保持**する
  - ただし **前後空白を取り除いた結果が空文字**になる値（`""`、空白のみ、改行のみなど）は不正とする
  - **最大 4096 UTF-16 code units**
- `title`
  - 任意
  - 指定時は文字列として解決されること
  - 指定された値は **trim せず保持**する
  - ただし **前後空白を取り除いた結果が空文字**になる値（`--title ""`、空白のみなど）は不正とする
  - **最大 256 UTF-16 code units**

追加方針:

- CLI は MCP baseline と同じ上限値を使う
- 長さ上限は **JavaScript の UTF-16 code units** で測る（`String.prototype.length` 相当）
- shared layer を再利用する場合も、**本書で承認した CLI 契約を保存することが前提**であり、shared layer 側で空文字・blank-only・trim の意味を再定義してはならない
- CLI 独自のビジネスルールは増やさない

### 4. stdout / stderr の振る舞い

#### 成功時

- **stdout, stderr ともに出力しない**
- 終了コード `0`

理由:

- shell script で扱いやすい
- core が `void` 成功を返す方針と整合する
- 成功メッセージ生成を最小化できる

#### `--help`

- usage は **stdout** に出す
- 終了コード `0`
- **最優先で short-circuit** する
  - 他の引数検証より先に処理する
  - `stdin` 処理より先に処理する
  - 環境変数解決より先に処理する

#### エラー時

- 人が読める短いエラーメッセージを **stderr** に出す
- **stdout は空のまま**にする
- stack trace や内部実装詳細はデフォルトで出さない
- **すべての stderr 出力経路**で raw な環境変数値や secret を出さない
  - 対象: 設定解決失敗・入力検証失敗・送信失敗・予期しない内部失敗
  - 例: webhook URL、token、`process.env` から読んだ実値
  - 必要なら変数名や不足種別だけを出す

stderr メッセージの粒度:

- usage / 引数誤り
- 入力検証失敗
- 設定解決失敗
- 送信失敗
- 予期しない内部失敗

### 5. 終了コード方針

phase 1 では過度に細分化せず、以下に固定する。

| code | 意味 |
| --- | --- |
| `0` | 成功 / `--help` |
| `2` | usage / 引数不正 / message・title の検証失敗 |
| `3` | 設定解決失敗 |
| `4` | 通知送信失敗 |
| `1` | 予期しない内部失敗 |

写像方針:

- `argv` の組み合わせ誤りは `2`
- `--message` の重複指定は `2`
- `--title` の重複指定は `2`
- shared layer の message/title 検証失敗は `2`
- `SEND_TO` / `DISCORD_WEBHOOK_URL` など設定の不足・不正は `3`
- 通知先への送信実行失敗は `4`
- 分類できない例外は `1`

### 6. 設定解決ポリシー

phase 1 の許可入力は **環境変数のみ** とする。  
暗黙の設定ファイル探索は行わない。

利用する環境変数:

- `SEND_TO`
- `DISCORD_WEBHOOK_URL`（`SEND_TO=discord` のとき必須）

解決順序:

1. 実行時の `process.env`
2. shared layer による検証・正規化
3. adapter による送信先選択と service 構築

補足:

- CLI 引数で送信先設定値を上書きする契約は **持たない**
- `.env` 自動読込も phase 1 では持たない
- 設定取得元を env に絞ることで、MCP と CLI で同じ設定ルールを共有しやすくする

---

## 典型的な利用例

```bash
notifier --message "build finished"
notifier --message "deploy failed" --title "CI"
```

---

## adapter 内の責務整理

CLI adapter の処理順は以下を想定する。

1. `argv` を読む
2. `--help` があれば、**他の検証・stdin 処理・env 解決より先に** usage を stdout へ出して `0` で終了する
3. `argv` の構造を検証する
   - `--message` 重複、`--title` 重複などの usage error をここで判定する
4. `message` を `--message` から解決する
5. `process.env` から設定を読む
6. shared layer で入力/設定を検証・正規化する
7. adapter が送信先を選び、具体 service を構築する
8. core を呼ぶ
9. 成否を stdout / stderr / exit code に写像する
   - すべての stderr 出力経路で secret redaction ルールを適用する

この契約により、CLI は Q4M8 の方針どおり thin adapter に保たれる。  
入力の意味づけと外部契約の写像は adapter が持つが、送信ユースケース本体は core (`void` 成功 / typed error 失敗) に閉じ込める。

---

## トレードオフと設計判断

### 判断 1: サブコマンドを導入せず単一コマンドにする

- 採用理由
  - phase 1 の用途は「通知を 1 回送る」だけで十分
  - `notifier --message ...` のほうが学習コストが低い
  - CLI adapter を薄く保てる

- 代替案
  - `notifier send --message ...`

- 代替案を採らない理由
  - 現時点では拡張余地のためだけに構文を増やすことになる
  - H1R5 の範囲では過剰設計

### 判断 2: message は `--message` flag のみを許可する

- 採用理由
  - phase 1 の契約を最小に保てる
  - CLI adapter が `stdin` 読取責務を持たず、thin adapter を維持しやすい
  - 入力経路を 1 つに固定することで usage error と検証境界が明確になる

- 代替案
  - `--message-stdin` を追加する
  - message を位置引数で受ける

- 代替案を採らない理由
  - `--message-stdin` は追加の入出力契約、優先順位、失敗モードを増やす
  - 位置引数は `title` との組み合わせや空白を含む値の扱いが分かりにくくなる

### 判断 3: 設定は env のみに絞る

- 採用理由
  - MCP と同じ設定モデルをそのまま共有できる
  - adapter 実装が単純になる
  - 暗黙のファイル探索を避けられる

- 代替案
  - `.env` 自動読込
  - 設定ファイルの既定パス探索
  - `--webhook-url` など CLI 引数上書き

- 代替案を採らない理由
  - source of truth が増え、契約が複雑になる
  - H1R5 時点では必要性が不足している

### 判断 4: 成功時は無出力にする

- 採用理由
  - スクリプト利用時に stdout を汚さない
  - adapter が余計な success payload を持たずに済む

- 代替案
  - `sent` のような成功メッセージを stdout に出す

- 代替案を採らない理由
  - 自動化用途では不要な出力になりやすい
  - 将来の機械可読出力拡張の余地を狭める

### 判断 5: 空文字 / blank-only の扱いは CLI 契約として今ここで固定する

- 採用理由
  - shared layer 実装待ちにせず、利用者が観測する挙動を先に固定できる
  - MCP baseline の上限と矛盾せず、adapter ごとの差分も明示しやすい
  - trim を「空判定にだけ使い、実値は保持する」と決めることで thin adapter を保ちやすい

- 代替案
  - shared layer 実装時に空文字・trim の意味を決め、CLI は後追いで従う
  - blank-only title を未指定扱いにする

- 代替案を採らない理由
  - 外部契約が実装都合で揺れてしまう
  - `--title` を明示指定したのに silently drop すると利用者が気づきにくい

---

## 前提・open items（H1R5 範囲内）

1. CLI 公開名は `notifier` を採用する
   - ただし package / bin 配置の最終決定は別タスク

2. phase 1 の設定入力は env のみ
   - もし後続で設定ファイルを追加する場合でも、まずは **明示的な `--config <path>`** を優先し、暗黙探索は再検討とする

3. shared layer の再利用方針
   - shared layer は CLI / MCP で共有してよい
   - ただし CLI では、本書で固定した「trim しない値保持・blank-only 拒否・max 4096 / 256」の契約を保つことを前提とする

# B8L4: CLI adapter 追加計画

## 設計概要

本設計は、承認済みの CLI 契約（H1R5）、core / adapter 境界（Q4M8）、monorepo 配置（N9C3）、段階移行順序（T6P1）を前提に、**`packages/cli` を thin adapter として追加する実装計画**だけを定義するものです。

本書では CLI 契約自体は再定義せず、`notifier` という outward-facing command を **`notifier-cli` package がどう実現するか** を整理します。

前提:

- CLI package は thin adapter である
- core は成功時 `void`、失敗時 typed error を throw する
- adapter は raw input 読取、外部契約 mapping、destination 選択、concrete service 構築を持つ
- shared validation / normalization は `notifier-core` の stable export のみ利用する
- `packages/cli -> packages/core` の一方向依存を守る
- `--message-stdin` は追加しない
- stderr の全経路で secret redaction を適用する

---

## `packages/cli` に残す責務

`packages/cli` は CLI 外部契約を保つため、以下を保持する。

### 1. エントリーポイント / bin ownership

- `packages/cli` が workspace package `notifier-cli` として存在する
- ユーザー向け実行名 `notifier` の bin は `packages/cli` が所有する
- bin は CLI adapter の entrypoint にのみ接続し、core を直接 CLI 契約へ露出しない

### 2. argv handling

- `process.argv` から raw argv を読む
- `--help` を最優先で short-circuit する
- `--message` / `--title` の構造解釈を行う
- 重複指定、未知オプション、必須不足などの usage error を判定する
- `stdin` を message 入力経路として扱わない

### 3. env resolution

- `process.env` から raw 設定値を読む
- phase 1 では env のみを設定入力源として扱う
- `SEND_TO` を raw destination 指定として読む
- raw env 一式を shared config validation へ渡し、validation / normalization 後に destination を確定する

### 4. shared validation / normalization の呼び出し

- raw な `message` / `title` を shared validation へ渡す
- raw env を shared config validation へ渡す
- validation failure を CLI の stderr / exit code に変換する

### 5. concrete service construction

- validation 済み destination / config を使って concrete notification service を生成する
- service 生成の分岐は adapter 側に閉じ込める
- core には解決済み service と command だけを渡す

### 6. stdout / stderr / exit code mapping

- `--help` の usage は stdout に出す
- 成功時は stdout / stderr 無出力のまま `0`
- error は stderr に短い文言で出す
- typed error / validation failure / config 解決 failure / usage error / unexpected error を exit code に写像する
- stderr のすべての出力経路で secret redaction を適用する

### 7. notifier bin と package identity の分離維持

- workspace package identity は `notifier-cli`
- outward-facing command は `notifier`
- package 名と CLI 実行名を混同しない

### 8. Phase 4 の official launch surface

- Phase 4 での公式 launch path は **repo / workspace 内からの `pnpm --filter notifier-cli exec notifier ...`** とする
- outward-facing な usage / help / example は `notifier` を使い、`notifier-cli` は workspace package identity としてのみ使う
- `notifier-cli` を公開 package 名や install 名として案内しない
- 将来 root convenience script を置く場合も、`notifier-cli` workspace package への委譲であることを明示し、この公式 launch path を置き換えない

---

## `packages/cli` が持たない責務

以下は `packages/cli` に入れない。

- 通知ユースケース本体
- adapter 非依存の domain / use-case error 定義
- raw input 読取を伴わない再利用可能 validation / normalization 実装本体
- adapter 間共有を目的とした独自 utility package 化
- MCP 契約や MCP response shape
- `packages/mcp` への依存
- `notifier-core/src/**` の deep import

---

## `packages/cli` からの core / shared validation 利用方針

### 利用境界

`packages/cli` は `packages/core` を以下の 2 つの公開面で消費する。

1. **core use-case export**
   - 通知送信ユースケース
   - core command / port 契約
   - typed error
2. **stable subpath export**
   - `notifier-core/validation`
   - 入力 validation / normalization
   - 設定 validation / normalization

### import 方針

- 許可:
  - `notifier-core`
  - `notifier-core/validation`
- 禁止:
  - `notifier-core/src/...`
  - `../core/src/...`
  - `packages/core/src/...`

### adapter 内の変換責務

CLI adapter は次の順で変換する。

1. argv から raw CLI input を抽出する
2. env から raw config input を抽出する
3. shared validation で input を検証・正規化する
4. shared validation で config を検証・正規化し、validated destination を確定する
5. validated destination に基づいて concrete service を構築する
6. core command を作る
7. core use-case を呼ぶ
8. thrown error を CLI 契約へ写像する

### core 呼び出し形

core には以下だけを渡す想定とする。

- validation 済み `message`
- validation 済み `title`
- adapter が構築した `NotificationService`

core から受け取るもの:

- 成功時: `void`
- 失敗時: typed error throw

これにより、CLI 側は表示・終了制御に集中し、core 側は通知ユースケースに集中できる。

---

## CLI 契約と adapter 責務の対応

### 1. argv handling

CLI 契約を実現する adapter 責務は以下。

| 契約項目 | adapter の責務 |
| --- | --- |
| `notifier --message ... [--title ...]` | argv から flag を解釈する |
| `--help` | 最優先 short-circuit で usage を stdout 出力し終了する |
| `--message` 必須 | raw argv 段階で存在確認する |
| `--message` 重複禁止 | usage error として扱う |
| `--title` 重複禁止 | usage error として扱う |
| `--message-stdin` なし | stdin 由来の入力経路を実装しない |
| trim しない値保持 | raw 値を shared validation にそのまま渡す |

補足:

- blank-only / length 上限判定そのものは shared validation へ委譲する
- ただし「どの入力経路を許すか」は adapter 契約なので CLI 側に残す

### 2. env resolution

| 契約項目 | adapter の責務 |
| --- | --- |
| 設定入力は env のみ | `process.env` だけを読む |
| `SEND_TO` を使う | raw destination 指定として読み、shared config validation 後に validated destination を確定する |
| destination 別の必須設定 | raw env を集めて shared validation に渡し、validated config として確定する |
| `.env` 自動読込なし | CLI 側で追加しない |
| CLI 引数による設定上書きなし | env と argv の source of truth を分離する |

### 3. stdout / stderr

| 契約項目 | adapter の責務 |
| --- | --- |
| 成功時は無出力 | 成功パスで何も書かない |
| `--help` は stdout | usage 出力先を stdout に固定する |
| エラーは stderr | error path の出力先を stderr に固定する |
| stdout は空のまま | error path では stdout を触らない |
| 秘密情報を出さない | stderr formatter / error mapper に redaction を適用する |

### 4. exit code

| code | adapter の判定責務 |
| --- | --- |
| `0` | 成功 / `--help` |
| `2` | usage error、argv error、message/title validation failure |
| `3` | config 解決 failure（env 読取後の設定 validation、destination 確定、送信前 service construction のうち user-correctable なものを含む） |
| `4` | 通知送信失敗（service 構築完了後の send 実行 failure のみ） |
| `1` | unexpected internal failure（validated destination に対する service constructor 不足 / 解決不能を含む） |

判定順の原則:

1. `--help`
2. argv usage 判定
3. shared input validation failure
4. shared config validation による destination / config 確定 failure
5. adapter による送信前 service construction failure（user-correctable なもの）
6. core / service の send 実行 failure
7. validated destination に対する service constructor 不足 / 解決不能などの internal adapter bug
8. fallback unexpected error

### 5. notifier bin ownership

| 項目 | 方針 |
| --- | --- |
| workspace package identity | `notifier-cli` |
| outward-facing command | `notifier` |
| bin 所有者 | `packages/cli` |
| Phase 4 official launch path | `pnpm --filter notifier-cli exec notifier ...` |
| core の bin | なし |
| MCP package との関係 | `packages/mcp` とは分離し、相互依存しない |

---

## 推奨する `packages/cli` 内部構成

実装時は以下程度の分割を推奨する。

```text
packages/cli/
├─ package.json
└─ src/
   ├─ bin/
   │  └─ notifier.js           # notifier bin entrypoint
   ├─ cli/
   │  ├─ parse-argv.js         # argv 構造解釈、usage error 判定
   │  ├─ print-usage.js        # help 文言
   │  ├─ stderr.js             # stderr 出力 + redaction
   │  ├─ exit-codes.js         # 0/1/2/3/4 定義
   │  └─ map-error.js          # validation/core error -> stderr/exit mapping
   ├─ config/
   │  └─ read-env.js           # process.env から raw config を読む
   ├─ services/
   │  └─ build-service.js      # validated destination / config から concrete service を構築
   └─ run-cli.js               # adapter orchestration
```

意図:

- `parse-argv.js` は raw argv 構造の責務に限定する
- `read-env.js` は raw env 読取に限定する
- `build-service.js` は validation 済み destination を受けて service 構築に限定する
- `run-cli.js` が adapter の実行順序を統括する
- shared validation の実装本体は `notifier-core/validation` に置き、CLI 側で再実装しない

この分割は一例であり、重要なのは**責務境界**であってファイル名の固定ではない。

---

## 推奨実行シーケンス

`run-cli.js` 相当の orchestration は以下の順序を推奨する。

1. raw argv を読む
2. `--help` を検出したら usage を stdout に出して `0` で終了
3. argv 構造を解釈し、usage error を判定
4. raw env を読む
5. `notifier-core/validation` で input validation を実施
6. `notifier-core/validation` で config validation / normalization を実施し、validated destination を確定
7. validated destination / config を使って concrete service を構築
8. core use-case を呼ぶ
9. 成功なら無出力で `0`
10. failure は error type に応じて stderr + exit code へ写像

この順序により、H1R5 の help short-circuit と Q4M8 の adapter 責務を両立できる。

---

## エラー写像計画

### usage / argv error

- 発生源: CLI adapter 自身
- 例: `--message` 未指定、重複指定、未知オプション
- 出力: stderr に短い usage error
- exit code: `2`

### input validation failure

- 発生源: `notifier-core/validation`
- 例: blank-only message、message 長すぎ、blank-only title、title 長すぎ
- 出力: stderr に入力誤りを示す短文
- exit code: `2`

### config resolution / destination selection / service construction failure

- 発生源: env 読取後の shared config validation、adapter-owned destination 確定、送信前の concrete service construction
- 例: `SEND_TO` 不足、不正値、destination に必要な env 不足、destination に応じた user-correctable な設定不足で service construction できない場合
- 出力: stderr に変数名や不足種別のみを出す
- exit code: `3`
- 補足: adapter が send を始める前の failure は `4` へ入れず、設定解決 failure として扱う
- 補足: service construction 中でも、validated destination に対応する service constructor の不足 / 解決不能のような設定に還元できない adapter bug / runtime exception はこの分類に押し込めず `1` とする

### notification send failure

- 発生源: concrete service 構築完了後に、core または service の send 実行が throw する失敗
- 出力: stderr に送信失敗を示す短文
- exit code: `4`
- 補足: constructor / factory 段階の失敗はここに含めない

### unexpected failure

- 発生源: 分類不能な例外
- 例: validated destination は確定済みだが、対応する service constructor が見つからない / 解決できない
- 出力: stderr に内部失敗の短文
- exit code: `1`
- 例: config と結び付けられない adapter bug、分類不能な runtime exception

### secret redaction

stderr formatter / mapper は最低限以下を守る。

- env 実値をそのまま出さない
- webhook URL や token をそのまま出さない
- 不足時は「どの変数が必要か」のみを出す
- 不正値時も raw 値ではなく「不正」だけを示す
- unexpected error でも `error.message` を無条件に垂れ流さない

---

## 実装への影響

B8L4 の実装着手時に必要になる作業は、CLI 契約変更ではなく adapter 追加に限定される。

1. `packages/cli` package の追加
2. `notifier` bin entrypoint の追加
3. argv parser / usage formatter / stderr mapper の追加
4. env reader の追加
5. core / validation export 利用 wiring の追加
6. destination 選択 / concrete service construction の追加
7. Phase 4 の official launch path（`pnpm --filter notifier-cli exec notifier ...`）での起動・確認導線の追加
8. CLI 単体確認項目の追加

逆に、以下は B8L4 では行わない。

- CLI 契約の reopen
- `--message-stdin` 導入
- core の result object 化
- adapter 間共通 package の追加
- npm publish を前提とした設計変更

---

## トレードオフと設計判断

### 判断 1: CLI は thin orchestration に徹する

- 採用理由
  - Q4M8 の境界と整合する
  - CLI の責務を argv/env/stdio/exit に限定できる
  - core の再利用性を保てる
- 代替案
  - CLI 側に validation や送信ロジックを一部複製する
- 採らない理由
  - MCP と CLI で仕様差分や重複実装が生じやすい

### 判断 2: shared validation は stable export 経由のみで使う

- 採用理由
  - N9C3 の package 境界を守れる
  - `src/**` deep import による内部構造依存を避けられる
- 代替案
  - `packages/core/src/shared/...` を直接 import する
- 採らない理由
  - package 内部構造が CLI 実装詳細に漏れ、移動に弱くなる

### 判断 3: destination 選択と concrete service 構築は CLI に残す

- 採用理由
  - adapter owns destination selection という承認済み方針に一致する
  - core を service registry や runtime config から切り離せる
- 代替案
  - core に factory / registry を置く
- 採らない理由
  - phase 1 のスコープに対して過剰で、core へ runtime 都合が逆流する

### 判断 4: stderr redaction を共通ハンドラで一元化する

- 採用理由
  - 「全 stderr 経路で redaction」を抜け漏れなく守りやすい
  - usage / validation / send / unexpected の文言制御を一か所に寄せられる
- 代替案
  - 各 catch / 出力箇所で個別に redact する
- 採らない理由
  - 将来の経路追加時に漏れやすい

### 判断 5: Phase 4 の outward-facing `notifier` surface は workspace launch path で公開する

- 採用理由
  - K7F0/N9C3 の internal workspace / private package モデルと整合する
  - outward-facing command `notifier` を維持しつつ、package identity `notifier-cli` を内部識別子に留められる
  - npm publish や `npx` 前提を持ち込まずに T6P1 の Phase 4 完了条件を満たせる
- 代替案
  - `notifier-cli` をそのままユーザー向け実行名として案内する
  - npm publish / install 前提で `notifier` を配布導線として定義する
- 採らない理由
  - 前者は H1R5 の outward-facing 契約 `notifier` と衝突する
  - 後者は `private: true` workspace package モデルと矛盾する

---

## リスクと注意事項

- `--help` の short-circuit より前に env validation を呼ぶと H1R5 に反する
- argv parsing と shared validation の責務が混ざると thin adapter から逸脱する
- config 解決 / destination 確定 / service construction failure を send failure と混同すると H1R5 の exit code 契約（`3` と `4`）を破る
- core typed error と CLI exit code mapping の対応表を曖昧にすると `1` へ過剰に倒れやすい
- `notifier-cli` と `notifier` の名称を混同すると package identity と外部契約が崩れる
- service construction を core 側へ寄せると Q4M8/N9C3 に反する

---

## 結論

B8L4 の `packages/cli` 追加は、**`notifier-cli` package が `notifier` bin を所有し、argv/env/stdio/exit の adapter 責務だけを持つ thin CLI adapter を追加する計画**として進める。  
CLI は `notifier-core` と `notifier-core/validation` の stable export を利用して、まず input と config を検証・正規化し、その結果として確定した destination / config から concrete service を自 package 内で構築したうえで、core の `void` 成功 / typed error 失敗を CLI 契約の stdout / stderr / exit code へ写像する。  
Phase 4 の outward-facing `notifier` surface は、`notifier-cli` という private workspace package identity を内部に保ったまま、**repo / workspace 内から `pnpm --filter notifier-cli exec notifier ...` で起動する公式 launch path**として扱う。  
これにより H1R5 の固定契約を reopen せず、Q4M8・N9C3・T6P1 と整合した形で Phase 4 の CLI adapter 追加に着手できる。

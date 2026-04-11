# N9C3: モノレポ / パッケージ配置方針

## 設計概要

本設計は、承認済みの境界方針（Q4M8）と CLI 契約（H1R5）を前提に、リポジトリを最小構成のモノレポへ整理するための**パッケージ配置方針だけ**を定義するものです。  
対象は以下の 3 パッケージです。

- `packages/core`
- `packages/mcp`
- `packages/cli`

方針はシンプルです。

- `core` は通知ユースケースだけを持つ
- `core` package 内に、adapter から再利用される非 I/O の validation / normalization 層も同居させる
- adapter は shared validation / normalization を `notifier-core/validation` のような**安定した subpath export**経由で利用し、`src/**` への deep import は禁止する
- `mcp` と `cli` はそれぞれ外部契約を持つ adapter とする
- 依存方向は `adapter -> core` の一方向に固定する
- 命名は MCP 側を `notifier-mcp`、CLI 側を `notifier` として扱う
- `notifier-core` / `notifier-mcp` / `notifier-cli` は workspace 内部識別子としてのみ扱い、npm 公開名や publish 方針の約束とはみなさない
- npm publish 前提は持ち込まず、最小の workspace 構成に留める

---

## 推奨パッケージ構成

```text
.
├─ package.json                  # workspace root（private）
├─ pnpm-workspace.yaml           # workspace 定義
├─ docs/
└─ packages/
   ├─ core/
   │  ├─ package.json
   │  └─ src/
   ├─ mcp/
   │  ├─ package.json
   │  └─ src/
   └─ cli/
      ├─ package.json
      └─ src/
```

### `packages/core`

**責務**

- 通知ユースケース本体
- core 用 command / DTO / port
- adapter 非依存の typed error
- adapter 間で再利用する pure な validation / normalization 関数群
- `NotificationService` のような抽象 port を受けて実行する処理

**含めないもの**

- `process.env`
- `process.argv`
- MCP SDK
- stdio / process lifecycle
- CLI 表示文言、exit code
- MCP success response 生成
- 送信先選択や concrete service 構築

**公開面**

- bin なし
- workspace 内の library package

### `packages/mcp`

**責務**

- MCP adapter 一式
- `notifier-mcp` としての公開契約
- MCP request / env の読取
- schema / validation entrypoint / error mapping
- stdio transport
- success response 生成
- destination 選択と concrete service 構築

**含めないもの**

- 通知ユースケースそのものの実装詳細
- CLI 契約

**公開面**

- MCP 実行 bin を持つ
- 公開名 / server 名 / 実行名は `notifier-mcp`

### `packages/cli`

**責務**

- CLI adapter 一式
- H1R5 で固定済みの CLI 契約の保持
- argv / env の読取
- usage error 判定
- stdout / stderr / exit code への写像
- destination 選択と concrete service 構築

**含めないもの**

- MCP 契約
- 通知ユースケースそのものの実装詳細

**公開面**

- CLI 実行 bin を持つ
- CLI のユーザー向け公開名は `notifier`

### `packages/core` 内の shared layer 配置

Q4M8/H1R5 で承認済みの **shared non-I/O validation / normalization layer** は、**第 4 package を増やさず `packages/core` の内部サブレイヤとして置く**方針にします。

想定イメージ:

```text
packages/core/src/
├─ usecases/          # 通知ユースケース
├─ ports/             # core port / DTO
├─ errors/            # adapter 非依存 error
└─ shared/
   └─ validation/     # pure な検証・正規化
```

この `shared/validation` は以下の性質を持ちます。

- `process.env` / `process.argv` / MCP SDK / stdio に依存しない pure function 群
- raw input の**読取**はしない
- 文字列や plain object を core 用 command / value object へ寄せるための再利用可能処理を置く
- 失敗は adapter 非依存な失敗として返し、**MCP response / CLI message / exit code への写像は各 adapter が担当**する
- adapter からの利用面は `notifier-core/validation` のような stable subpath export に固定し、`packages/core/src/**` への deep import は許容しない

これにより依存方向は引き続き package 単位では **`mcp -> core`, `cli -> core`** のままで、adapter 同士の共有 package を増やさずに Q4M8 の shared layer 要件を満たせます。  
adapter が依存するのはあくまで `core` package の一部公開面であり、`mcp <-> cli` の境界を崩しません。

---

## public / private 推奨

| パッケージ | 推奨 | 理由 |
| --- | --- | --- |
| workspace root | `private: true` | publish 対象ではなく、workspace 管理専用にするため |
| `packages/core` | `private: true` | 現時点では adapter から利用される内部ライブラリであり、外部公開契約をまだ持たないため |
| `packages/mcp` | `private: true` | workspace 内 package として扱い、npm publish 前提を持ち込まないため |
| `packages/cli` | `private: true` | workspace 内 package として扱い、CLI 契約と npm package 公開を分離するため |

補足:

- workspace 内の `package.json:name` は monorepo 内依存解決のための識別子であり、公開 package 名を意味しない
- 本プロジェクトは npm publish を前提にしていないため、ここでの命名は publish 可否や registry 上の名称を約束しない

---

## 依存方向

推奨依存は以下に固定します。

```text
packages/mcp  ──▶ packages/core
packages/cli  ──▶ packages/core
```

禁止する依存:

- `packages/core -> packages/mcp`
- `packages/core -> packages/cli`
- `packages/mcp -> packages/cli`
- `packages/cli -> packages/mcp`

理由:

- core を env / argv / MCP / process / stdio から切り離すため
- adapter ごとの外部契約を相互汚染させないため
- Q4M8 の「adapter owns external contract mapping」を守るため

---

## 命名 / package identity / bin ガイダンス

### ディレクトリ名

- `packages/core`
- `packages/mcp`
- `packages/cli`

### `package.json:name`（workspace 内識別子として固定）

workspace package identity は bin 名とは別に、以下で固定します。  
これらは **workspace 内部識別子**であり、外部公開 package 名や npm publish 名を意味しません。

| directory | planned `package.json:name` | role |
| --- | --- | --- |
| `packages/core` | `notifier-core` | internal core library |
| `packages/mcp` | `notifier-mcp` | MCP adapter package |
| `packages/cli` | `notifier-cli` | CLI adapter package |

意図:

- `notifier-core` は workspace 内依存の識別子で、外向きの実行名は持たない
- `notifier-mcp` は workspace 内 package identity としつつ、MCP server 名 / bin 名は owner 承認どおり `notifier-mcp` を使う
- `notifier-cli` は workspace 上の package identity としつつ、**ユーザー向け CLI 名は H1R5 どおり `notifier` を維持**する

つまり、`package.json:name` は **workspace 依存の識別子**、bin / server 名は **外部契約上の呼び名** として扱います。  
CLI だけはこの 2 つを意図的に分離し、固定済みの CLI 契約を守りながら monorepo 内の package identity も安定化させます。

### bin 名

- `packages/mcp` の bin 名は **`notifier-mcp`**
- `packages/cli` の bin 名は **`notifier`**
- `packages/core` は bin を持たない

### server 名 / outward-facing 名との対応

| package | `package.json:name` | outward-facing name |
| --- | --- | --- |
| `packages/core` | `notifier-core` | なし |
| `packages/mcp` | `notifier-mcp` | MCP server 名 / 実行 bin ともに `notifier-mcp` |
| `packages/cli` | `notifier-cli` | CLI 実行名は `notifier` |

### 命名上の注意

- MCP 側の名称は owner 判断どおり **`notifier-mcp` に統一**する
- CLI 側の公開名は H1R5 どおり **`notifier`** を維持する
- ただし CLI package identity は **`notifier-cli`** とし、bin 名と分離して扱う
- `core` に adapter 名を含む命名を持ち込まない

---

## workspace root の責務

workspace root は**配布物ではなく、リポジトリ運用の親**として扱います。

持つ責務は最小限に留めます。

- workspace 定義
- ルート共通の開発ツール設定
- repo 全体にかかる lint / format / test 実行導線
- docs と共通設定ファイルの配置

持たせないもの:

- 通知ユースケース実装
- MCP / CLI の adapter 実装
- adapter 間共有の業務ロジック

---

## トレードオフと設計判断

### 判断 1: 3 パッケージに限定する

**採用**

- `core` / `mcp` / `cli` の 3 分割に留める
- Q4M8 の shared validation / normalization は `packages/core` の内部サブレイヤに置く

**理由**

- 今回すでに承認されている境界にそのまま対応できる
- 追加の shared/util package を導入せずに済み、再編コストが低い
- shared layer を `core` 配下へ置いても、adapter が外部契約 mapping を持つ原則は維持できる
- 「adapter が外部契約を持つ」という原則を崩さない

**代替案**

- `packages/shared` や `packages/adapters` を追加する

**見送り理由**

- 現段階では package 数だけが増え、責務境界がかえって曖昧になりやすい
- 今回必要な shared layer は pure function 群であり、独立 package 化しなくても package 境界要件を満たせる

### 判断 2: workspace package 名は内部識別子として今ここで固定する

**採用**

- `notifier-core` / `notifier-mcp` / `notifier-cli` を workspace 内部識別子として planned `package.json:name` に固定する

**理由**

- monorepo 内依存の識別子を先に固定しておくと、後続タスクで package 名と bin 名の議論が再燃しにくい
- `notifier-mcp` は owner 承認済み名称を workspace package identity にも揃えられる
- CLI は package 名を `notifier-cli`、外向き実行名を `notifier` と分けることで、H1R5 の契約を reopen せずに済む
- ただしこれらは npm 公開名の約束ではなく、workspace 内参照を安定化するための決定に留める

**代替案**

- package 名の確定をさらに先送りする
- CLI package 名も `notifier` に寄せる

**見送り理由**

- review 指摘どおり、bin 名だけでは workspace identity が不足する
- CLI package 名を `notifier` にすると、package identity とユーザー向けコマンド名が過度に結びつき、後続の配布判断まで不必要に拘束しやすい

### 判断 3: 3 パッケージすべてを workspace private とする

**採用**

- 3 パッケージすべてを `private: true` とする

**理由**

- 本タスクは package layout の決定が目的であり、配布戦略の確定は範囲外
- 本プロジェクトは npm publish を前提にしておらず、registry metadata の議論を持ち込む必要がない

**代替案**

- `mcp` と `cli` を npm 公開 package 前提で扱う

**見送り理由**

- 実行名 (`notifier-mcp`, `notifier`) の決定には有効だが、layout 決定には必須ではない
- 現在の owner 判断とも整合しない

### 判断 4: adapter 間依存は禁止する

**採用**

- `mcp` と `cli` は互いに依存しない

**理由**

- MCP baseline と CLI 契約を独立して保守できる
- 片方の外部契約変更が他方へ逆流しない

**代替案**

- adapter 共通コードをどちらか一方に寄せる

**見送り理由**

- 外部契約の責務混在が起きやすく、Q4M8 と H1R5 に反する

---

## レイアウト上の注意事項

- `core` は resolved service / port を受け取る前提を維持する
- `packages/core` 配下の shared validation / normalization は pure に保ち、raw input の読取責務は持たせない
- adapter から shared validation / normalization を使うときは stable subpath export を経由し、`src/**` deep import を行わない
- destination 選択と concrete service 構築は `mcp` / `cli` 各 package 側に置く
- MCP success response shape は `packages/mcp` に残す
- CLI 契約の reopen は行わず、`packages/cli` は H1R5 の保持に専念する

---

## 結論

N9C3 の推奨レイアウトは、**workspace root 配下に `packages/core`, `packages/mcp`, `packages/cli` を置く最小 3 パッケージ構成**です。  
Q4M8/H1R5 の shared non-I/O validation / normalization は `packages/core` の内部サブレイヤに置き、adapter は `notifier-core/validation` のような stable subpath export 経由でそれを利用しつつ外部契約 mapping を各自で保持します。  
依存は `mcp -> core`, `cli -> core` の一方向、workspace package 名は `notifier-core` / `notifier-mcp` / `notifier-cli` に固定し、外向きの実行名は MCP 側 `notifier-mcp`、CLI 側 `notifier` を維持します。  
これらの package 名はあくまで workspace 内部識別子であり、3 パッケージとも `private: true` を前提として npm 公開名や publish 方針の約束は行いません。

# K7F0: internal release / distribution / usage policy

## 設計概要

本設計は、この repository を **internal / workspace-oriented な配布単位**として扱うための最小ポリシーだけを定義するものです。  
N9C3 で固定した workspace package identity（`notifier-core` / `notifier-mcp` / `notifier-cli`）と、T6P1 の移行順序を前提に、以下を明確化します。

- package identity は **workspace 内部識別子**として使う
- bin 名 / entrypoint は **開発者・利用者に見せる呼び名**として使う
- npm publish 前提は持ち込まない
- version は **内部運用用 metadata** としてだけ扱う
- 利用導線は **repo 内からの実行**を標準とする

---

## 推奨ポリシー

### 1. 配布単位

- 配布単位は **個別 package** ではなく **repository / workspace 全体**とする
- `packages/core` / `packages/mcp` / `packages/cli` はすべて `private: true` を前提とする
- `package.json:name` は pnpm workspace 内の依存解決・識別のために保持する
- これらの名前は **npm 公開名・外部配布名・将来の publish 約束ではない**

### 2. package identity / outward-facing name の扱い

| package path | workspace identity | outward-facing name | 扱い |
| --- | --- | --- | --- |
| `packages/core` | `notifier-core` | なし | 内部 library。エンドユーザーには見せない |
| `packages/mcp` | `notifier-mcp` | `notifier-mcp` | MCP server 名 / 実行名として見せる |
| `packages/cli` | `notifier-cli` | `notifier` | CLI 実行名として見せる |

補足:

- `notifier-core` は **import 用の内部識別子**であり、bin は持たない
- `notifier-mcp` は package identity と outward-facing 名が一致する
- `notifier-cli` は package identity であり、**ユーザー向けコマンド名は `notifier`** と分離して扱う

### 3. entrypoint / bin 命名ポリシー

- `packages/core`
  - bin なし
  - adapter からは安定した package entrypoint / subpath export のみ使う
  - `src/**` への deep import はしない
- `packages/mcp`
  - developer / user 向けには `notifier-mcp` と表記する
  - 実行 bin 名と usage 上の呼び名は `notifier-mcp` で固定する
  - MCP client 側の設定キー / 表示ラベルは利用者定義でよく、本ポリシーの命名対象に含めない
- `packages/cli`
  - developer / user 向けには `notifier` と表記する
  - docs・usage・help・example は `notifier-cli` ではなく `notifier` を使う

### 4. 実行・利用ポリシー

標準の利用導線は **repo root から package 側の公式 launch path を pnpm workspace 経由で起動すること**とする。

- 推奨:
  - MCP: `pnpm --filter notifier-mcp exec notifier-mcp ...`
  - CLI: `pnpm --filter notifier-cli exec notifier ...`
- 許容:
  - repo root に管理用 script を置くこと自体はよい
  - ただし runtime 用の最終案内は上記 package 側 command を公式導線とし、root wrapper を公式 usage として固定しない
- 非推奨:
  - npm publish 前提の説明
  - `npx notifier-mcp` のような公開 package 前提の案内
  - `notifier-cli` をユーザー向け実行名として案内すること
  - root runtime wrapper を package 側 command より先に案内すること

実務上は、README や利用手順で「この repo を checkout / install した状態で使う」前提を明記する。

### 5. internal versioning / metadata ポリシー

- 実用ルールは 1 つだけ: `version` は workspace 内 metadata としてのみ保持し、**公開向け semver 契約・配布判断・運用手順の基準には使わない**

要するに、version は「公開物の約束」ではなく、**repo 内運用の補助情報**である。

---

## 開発者・利用者への見せ方

### developers 向け

- package 名を説明するときは `notifier-core` / `notifier-mcp` / `notifier-cli` を使う
- ただし実行方法を説明するときは bin 名を使う
  - MCP 実行名: `notifier-mcp`
  - CLI 実行名: `notifier`
- MCP client 設定例を書く場合でも、設定キー名や UI 上のラベルは利用者定義であり、固定名として扱わない
- import / dependency 文脈では package identity、usage 文脈では outward-facing 名、という切り分けを徹底する

### users 向け

- MCP 側は `notifier-mcp` として案内する
- CLI 側は `notifier` として案内する
- `notifier-cli` という名前は基本的にユーザー向け文章へ出さない
- MCP client の設定エントリ名はユーザーが自由に付けるものであり、本ポリシーでは規定しない
- 「インストールして公開 package を使う」ではなく、「この repo / workspace から実行する」と案内する

---

## repo-level docs / usage への含意

最低限、repo-level documentation は次を守る。

1. README で、この project が **npm 公開前提ではない internal workspace**であることを明示する
2. package identity と実行名の対応表を 1 箇所にまとめる
3. repo root からの標準 usage 例は MCP `pnpm --filter notifier-mcp exec notifier-mcp ...`、CLI `pnpm --filter notifier-cli exec notifier ...` を使う
4. `notifier-core` は internal library としてのみ説明し、直接実行対象としては案内しない
5. root scripts を載せる場合でも、それが管理用または wrapper であり、runtime の公式導線は package 側 command であることを併記する

この方針により、package identity・bin 名・利用導線の混同を避けられる。

---

## トレードオフと設計判断

### 判断 1: repository 全体を内部配布単位とし、個別 package 配布を採らない

- 採用理由
  - owner の「npm publication を意図しない」という前提に一致する
  - package ごとの公開契約管理を増やさずに済む
  - workspace identity を内部依存のためだけに使える
- 代替案
  - `packages/mcp` や `packages/cli` を将来公開前提の release 単位として扱う
- 採らない理由
  - 現段階では過剰で、命名・version・配布導線の議論を再び広げる

### 判断 2: package identity と bin 名を明確に分離する

- 採用理由
  - N9C3 の `notifier-cli` / `notifier` split をそのまま運用に落とせる
  - import 名と user-facing 名の役割分担が明確になる
- 代替案
  - CLI も package 名と bin 名を同じにして `notifier-cli` で統一する
- 採らない理由
  - H1R5 で固定した CLI の outward-facing 契約 `notifier` と衝突する

### 判断 3: version は内部 metadata に限定し、運用ルールを単純化する

- 採用理由
  - 非公開 workspace に対して最も軽量
  - semver の意味づけだけが先行するのを防げる
  - package 単位の互換保証を背負わずに済む
- 代替案
  - bump ルールや tag 運用を細かく定義する
- 採らない理由
  - internal-only の現状に対して管理コストが高く、実務上の意思決定を複雑にする

---

## まとめ

この workspace では、`notifier-core` / `notifier-mcp` / `notifier-cli` を **内部識別子**として維持しつつ、利用者に見せる実行名は MCP 側 `notifier-mcp`、CLI 側 `notifier` に固定する。MCP client の設定キー名は利用者定義であり、本ポリシーの対象外とする。  
配布は repository 全体の内部運用として扱い、npm publish は前提にしない。  
runtime の公式導線は repo root からの package 側 command（`pnpm --filter notifier-mcp exec notifier-mcp ...` / `pnpm --filter notifier-cli exec notifier ...`）とし、version は内部 metadata に留める。

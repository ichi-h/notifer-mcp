# T6P1: 単一パッケージから workspace 目標構成への段階的移行順序

## 設計概要

本設計は、現行の単一 package 構成から、承認済みの目標構成である `packages/core`・`packages/mcp`・`packages/cli` への**低リスクな段階移行順序**を定義するものです。  
Q4M8 の core / adapter 境界、H1R5 の CLI 契約、N9C3 の monorepo package layout は**再検討しません**。本書では、それらを前提に「どの順で移すと安全か」だけを扱います。

推奨方針は、以下の 5 phase です。

1. **境界準備**: 単一 package のまま core 候補と MCP adapter 候補を分離する
2. **workspace 化**: 現行実行物を `packages/mcp` へ移し、root を private な workspace 管理層へ変える
3. **core 抽出**: `packages/core` を切り出し、MCP 非依存で成立することを確認したうえで shared validation を stable subpath export で公開する
4. **CLI 追加**: `packages/cli` を追加し、固定済み CLI 契約を実装できる位置まで持っていく
5. **最終収束**: 暫定互換を除去し、目標 workspace 構成を checkpoint 化する

この順序により、**責務分離**、**パッケージ分離**、**新 adapter 追加**を別々の phase に分けられ、1 phase で変わる軸を最小化できます。

## 推奨 phase 順序

| Phase | 目的 | 主な変更軸 |
| --- | --- | --- |
| 1 | 単一 package 内で future core / adapter 境界を明確化 | 論理責務の分離 |
| 2 | workspace root と `packages/mcp` を成立させる | パッケージ配置の変更 |
| 3 | `packages/core` を抽出し、MCP から依存させる | shared library 化 |
| 4 | `packages/cli` を追加する | 新 adapter の追加 |
| 5 | 暫定構成を整理し、目標 layout を完了させる | 仕上げ・互換撤去 |

---

## Phase 1: 単一 package のまま境界準備を行う

### この phase で変えること

- 現行 `src/**` の中で、Q4M8 に沿って以下の責務を分ける
  - **core 候補**: pure な validation / normalization、value object、adapter 非依存ロジック
  - **MCP adapter 候補**: MCP tool 登録、MCP request 受取、success / error mapping、`process.env` 読取
- 将来 `packages/core` に移す対象を、MCP SDK や raw input 読取から切り離す
- 将来 `packages/mcp` に残す対象を、MCP 固有責務へ寄せる

### この phase で意図的に変えないこと

- まだ workspace 化しない
- `packages/*` はまだ作らない
- 実行 entrypoint、bin 名、MCP 外部契約は変えない
- CLI は追加しない

### 完了条件 / 受け入れ条件

- 単一 package のまま既存 MCP baseline が維持される
- core 候補モジュールが以下を**責務として持たない**
  - MCP SDK / MCP tool 登録 / MCP request 読取
  - stdout / stderr / `console.*` への出力
  - `process.env` / `process.argv` / `stdin` など raw input の直接読取
  - destination selection、concrete service construction、registry / factory / service-selector ロジック
  - `SIGINT` / `SIGTERM` ハンドリング
  - `process.exit()`、exit code 判断、起動・終了ライフサイクル制御
  - MCP success response 生成、`McpError` を含む MCP error mapping
- 上記の除外は import 有無だけでなく、module 責務・呼び出し方向でも確認できる
- MCP 側モジュールが、raw input 読取、外部契約 mapping、destination selection、concrete service construction、registry / factory / service-selector ロジック、process / signal / stdio 制御を保持している
- 将来 `packages/core` に移す対象が、概ね file / directory 単位で識別できる

---

## Phase 2: workspace root を導入し、現行実行物を `packages/mcp` へ移す

### この phase で変えること

- repository root を workspace 管理層に変更する
- 現行の runnable package を `packages/mcp` へ移す
- A7K2 で固定された `notifier-mcp` baseline を、workspace 配下でも同じ役割で起動できる状態にする
- 低リスク移行のため、repo root の既存 launch surface（root `bin` / `scripts.start` / `scripts.dev` / `scripts.test` など）は**この phase では壊さず**、`packages/mcp` へ委譲する thin shim として残す
- root のスクリプトや参照は、必要最小限の workspace 経由に寄せる

### この phase で意図的に変えないこと

- まだ `packages/core` への本格抽出はしない
- CLI はまだ追加しない
- MCP の外部動作、名称、success response shape は変えない
- validation 共有の公開面はまだ最終化しない
- root shim の整理・撤去はまだ行わない

### 完了条件 / 受け入れ条件

- root が workspace 管理層として成立し、`private: true` を持つ
- MCP の実行主体が `packages/mcp` になっている
- `packages/mcp` が workspace package として成立し、`package.json:name` は N9C3 方針どおり `notifier-mcp`、`private: true` である
- `packages/mcp` 単体で、現行 baseline 相当の起動・テスト確認ができる
- root 直下の旧 package 実装に依存しなくても MCP が成立する
- repo root の既存 launch surface / workflow は thin shim 経由で継続利用でき、`packages/mcp` 起点へ委譲されている

---

## Phase 3: `packages/core` を抽出し、shared validation の公開面を固定する

### この phase で変えること

- Phase 1 で切り分けた pure ロジックを `packages/core` へ移す
- shared validation / normalization を `packages/core` 内へ配置する
- adapter からの利用面を、承認済みの stable subpath export（例: `notifier-core/validation`）へ固定する
- `packages/mcp` は `packages/core` へ依存する構成へ更新する
- CLI 着手前 checkpoint として、`packages/core` を MCP 非依存で検証できる状態にする

### この phase で意図的に変えないこと

- MCP adapter の外部契約は変えない
- CLI 契約はまだ実装しない
- 第 4 package は作らない
- npm publish 前提の metadata 設計には踏み込まない

### 完了条件 / 受け入れ条件

- `packages/core` が workspace package として成立し、`package.json:name` は `notifier-core`、`private: true` である
- `packages/core` は MCP 非依存で isolated に検証でき、`packages/mcp` を経由しない validation / normalization / core use-case 確認が完了している
- `packages/mcp` から shared validation / normalization を利用できる
- cross-package 利用が package 名 + stable export 経由になっている
- stable subpath export 方針（例: `notifier-core/validation`）が package 契約として明示されている
- **package-to-package の `src/**` deep import が存在しない**
- `packages/core` には raw input 読取責務、destination selection、concrete service construction、registry / factory / service-selector ロジック、MCP response 生成責務が入っていない
- 上記の adapter 責務は `packages/mcp` 側に残り、core は pure な validation / normalization / use-case に閉じている

---

## Phase 4: `packages/cli` を追加する

### この phase で変えること

- `packages/cli` を追加する
- H1R5 固定済み契約に沿って、CLI adapter の入口責務を配置する
  - `argv` / `process.env` の読取
  - help / option 処理
  - shared validation 利用後の CLI 向け error / exit mapping
- `packages/cli` から `packages/core` を利用する

### この phase で意図的に変えないこと

- `--message-stdin` は追加しない
- MCP adapter の契約や実装責務は変えない
- core / adapter 境界を再定義しない
- Bun 戦略や toolchain 再設計には踏み込まない

### 完了条件 / 受け入れ条件

- `packages/cli` が workspace package として成立している
- `packages/cli` の `package.json:name` は `notifier-cli` で、`private: true` の internal workspace package として扱われる
- workspace package identity（`notifier-cli`）と outward-facing bin 名（`notifier`）の split が明示され、両者を混同しない
- CLI が H1R5 の固定契約に従っている
- CLI は `stdin` を入力経路として要求しない
- CLI から shared validation を stable subpath export 経由で利用している
- `packages/cli` から `packages/mcp` への依存がない
- `packages/cli` が package 単体で independently runnable に確認できる
- outward-facing の `notifier` launch surface からも `packages/cli` を起動・検証できる

---

## Phase 5: 暫定互換を除去し、目標 workspace 構成を完了させる

### この phase で変えること

- root 直下に残る暫定的な実装・互換導線を整理する
- 目標構成 `packages/core`・`packages/mcp`・`packages/cli` を最終形として確定する
- package 間依存を N9C3 の想定どおりに収束させる
  - `packages/mcp -> packages/core`
  - `packages/cli -> packages/core`

### この phase で意図的に変えないこと

- package 名称方針は再変更しない
- npm publish 契約は追加しない
- adapter 外部契約は reopen しない

### 完了条件 / 受け入れ条件

- `packages/core`・`packages/mcp`・`packages/cli` の 3 package が揃っている
- 各 package は internal workspace package として整理されている
- 旧単一 package 前提の import / 実装配置が残っていない
- Phase 2 で導入した repo root の temporary thin shim（root `bin` / `scripts.start` / `scripts.dev` / `scripts.test` など）が remove / close out され、最終状態に残っていない
- 禁止依存が存在しない
  - `packages/core -> packages/mcp`
  - `packages/core -> packages/cli`
  - `packages/mcp -> packages/cli`
  - `packages/cli -> packages/mcp`
- package-to-package の `src/**` deep import が残っていない

## トレードオフと設計判断

### 判断 1: 先に「境界準備」を入れる

- **採用理由**
  - 責務分離と workspace 化を同時にやるより、失敗時の切り戻し範囲が小さい
  - `packages/core` 抽出時に「何を移すか」が明確になる
- **代替案**
  - 最初に一気に `packages/core` / `packages/mcp` へ split する
- **代替案を採らない理由**
  - file move、import 更新、責務再配置が同時発生し、レビュー難度が上がる

### 判断 2: CLI 追加は core 抽出の後に置く

- **採用理由**
  - CLI 導入前に shared validation の受け皿を固定できる
  - CLI 追加時の重複実装を避けられる
- **代替案**
  - `packages/cli` を先に追加し、その後 core へ共通化する
- **代替案を採らない理由**
  - 一時的に CLI / MCP の両側で validation 重複が発生しやすい

### 判断 3: 最終収束 phase を独立させる

- **採用理由**
  - 暫定互換の撤去を、機能追加や package 分割と切り離せる
  - 「最終形に到達したか」の checkpoint を明確にできる
- **代替案**
  - 各 phase で都度すべての暫定物を撤去する
- **代替案を採らない理由**
  - phase ごとの変更量が増え、低リスク方針に反する

### 判断 4: repo root の launch surface は Phase 2 では thin shim として残す

- **採用理由**
  - workspace 化と利用者向け起動導線の変更を同時に起こさず、切り戻しと review を容易にできる
  - `packages/mcp` への実行主体移管を先に完了し、その後 Phase 5 で互換整理に集中できる
- **代替案**
  - Phase 2 で root entrypoint / root script を意図的に破壊し、利用側 migration も同時に行う
- **代替案を採らない理由**
  - package 配置変更と運用導線変更が同時発生し、今回の low-risk 方針に反する
  - 既存 workflow の breakage が phase 成功判定を曖昧にする

## 実装時の注意事項

- 各 phase は、**1 つ前の phase の acceptance を満たしてから**次へ進む
- 1 PR / 1 phase を基本とし、review 対象を狭く保つ
- 既存 doc で固定済みの以下は reopen しない
  - Q4M8 の core / adapter 境界
  - H1R5 の CLI 契約
  - N9C3 の package layout / stable subpath export 方針

## 要約

最も低リスクなのは、**境界準備 → workspace 化 → core 抽出 → CLI 追加 → 最終収束**の順です。  
この順序なら、単一 package から目標 workspace 構成へ進む際に、**責務変更・物理移動・新 adapter 導入**を分けて扱えます。

# E3V9: shared toolchain / workspace-root 方針

## 設計概要

本設計は、N9C3 で確定した workspace/package 配置と、T6P1 で確定した段階移行順序を前提に、**shared toolchain と workspace root の責務だけ**を最小限で定義するものです。  
対象は `packages/core`、`packages/mcp`、`packages/cli` を支える **root の管理方針**であり、runtime 移行や build system 追加は扱いません。

結論は次のとおりです。

- repository root は **private な workspace 管理層**にする
- root では **workspace 定義・共通ツール設定・全体実行導線**を持つ
- Biome は **root 管理の単一設定**を共有する
- package manager は **pnpm を workspace 標準**とする
- Nix shell / flake は **root 管理の toolchain baseline** とする
- test は **Node 24 の `node:test` を前提に共有**し、root から全 package をまとめて実行できる形にする
- 各 package は **自分の公開面・依存・entrypoint・必要な局所 script / metadata**だけを持つ
- package 間利用は **workspace package 名 + 公開 export のみ**とし、`src/**` deep import は禁止する

---

## root の責務

workspace root は配布物ではなく、次の責務だけを持ちます。

1. **workspace 管理**
   - `private: true`
   - `pnpm-workspace.yaml` による package 列挙
   - workspace 共通 lockfile / install 起点の保持

2. **共通ツール設定**
   - Biome dependency / 設定の root 一元管理
   - Node / pnpm 前提バージョンの authority を root に置く
   - `flake.nix` / `flake.lock` による Nix shell baseline の管理
   - repo 全体で共通に使う ignore / 設定ファイルの配置

3. **repo 全体の実行導線**
   - 全 package 向けの `lint` / `format` / `check` / `test` の root script
   - root script の実行モデル定義
     - `lint` / `format` / `check` は root が直接 owner として実行する
     - `test` は root が workspace 集約窓口になり、各 package の `test` script を集約実行する
   - package 単位実行への薄い pnpm filter 導線

4. **ドキュメントと運用の親**
   - `docs/` 配下の設計書管理
   - workspace 運用ルールの記述場所

root が**持たない**もの:

- `core` の業務ロジック
- `mcp` / `cli` の adapter 実装
- package 間共有のための新しい util/build layer
- 特定 package 専用の実装詳細

---

## shared toolchain 方針

### 1. package manager

- workspace の標準 package manager は **pnpm** とする
- install / run / filter 実行は pnpm 前提で統一する
- root は pnpm workspace の起点になる
- root `package.json` の `packageManager` は workspace authority として root が持つ
- Node / pnpm version の正本は root の toolchain baseline（Nix flake と必要なら root metadata）に置く
- npm / yarn / Bun package manager 前提の運用はこの task では導入しない

期待値:

- root から全体実行: `pnpm -r ...` または workspace root script
- package 単位実行: `pnpm --filter <package> ...`

### 2. Biome

- Biome 設定は **root の単一 `biome.json`** を正本とする
- Biome dependency も root が持つ
- package ごとに Biome 設定を複製しない
- package ごとの Biome dependency 追加は原則しない
- lint / format / check は root から全 package に対して一貫して実行できるようにする

理由:

- JS workspace 全体で整形・lint ルールを揃えやすい
- package 追加時の設定重複を避けられる
- `core` / `mcp` / `cli` 間で差分のない最小運用にできる

### 3. Nix shell / flake

- `flake.nix` / `flake.lock` は root-managed な開発 shell baseline とする
- Node / pnpm / Biome を含む共通開発 toolchain の入口は root の flake に置く
- package は個別に Nix shell を持たず、workspace 共通 baseline を前提にする

理由:

- workspace 全体で同じ Node / pnpm 前提を揃えやすい
- package ごとの toolchain drift を避けられる
- private workspace 管理層としての root の責務と整合する

### 4. tests

- test runner は **Node 24 の `node:test`** を共有前提とする
- root `test` は **package の `test` script を集約実行する script** として定義する
- test を持つ package は **package-local `test` script を定義する**
- test を持たない package は `test` script を必須としない
- test 実体は package ごとに保ち、root は aggregation に徹する
- `lint` / `format` / `check` については package-local script を必須にしない
- package がローカル開発都合で `lint` / `format` / `check` script を追加してもよいが、root 方針と衝突させない

期待値:

- root: 全 package の test をまとめて回せる
- package: test を持つものは単体で自 package の test を回せる

### 5. deep import 禁止

- package 間 import は `notifier-core` のような **workspace package identity** と公開 export を使う
- `packages/core/src/**` のような **package-to-package deep import は禁止**
- shared validation なども stable export 経由で利用する

---

## root 管理と package ローカルの分担

| 領域 | root 管理 | package ローカル |
| --- | --- | --- |
| workspace 定義 | `pnpm-workspace.yaml`、root `package.json` | なし |
| package manager | pnpm 方針、`packageManager`、lockfile、workspace 実行導線 | 各 package の依存宣言 |
| Node / pnpm version authority | root flake、必要なら root metadata | 原則なし |
| Biome | root dependency と `biome.json` を一元管理 | 原則なし |
| Nix shell | `flake.nix` / `flake.lock` | 原則なし |
| test 方針 | root の全体 test aggregation | test を持つ package の test 対象・`test` script |
| scripts | repo 共通の `lint` / `format` / `check` / `test` | `dev` / `start` / package 専用検証など |
| exports / entrypoints | なし | 各 package が定義 |
| package metadata | workspace 運用に関わる共通 authority | `name` / `private` / `version` / `type` / `exports` / `bin` などの package identity / runtime metadata |
| runtime 固有事項 | なし | 各 package の実行責務として保持 |

補足:

- `packages/mcp` と `packages/cli` の起動 script は package 側が持つ
- `packages/core` は library package として、test があるなら package 単位 `test` script を持つ
- final state の root script は、`lint` / `format` / `check` では root 直接実行、`test` では package script 集約を行う
- root script は別の task runner にはしない
- package-local metadata は internal workspace 運用に必要な範囲で追加してよいが、root authority と衝突させない
  - 例: `name` / `private` / `version` / `type` / `exports` / `bin` / `dependencies`
  - これらは npm publish 契約ではなく、internal workspace metadata として扱う
  - 非例: package ごとの `packageManager`、独自 Biome 正本、root と別の Node / pnpm authority

---

## 推奨 root script の責務

root script は最小限に留め、次だけを担当します。

- `lint`: root が直接 owner として workspace 全体に Biome lint を実行
- `format`: root が直接 owner として workspace 全体に Biome format を実行
- `check`: root が直接 owner として workspace 全体に Biome check を実行
- `test`: root が package-local `test` script を集約実行

必要なら package 指定実行を pnpm filter で補助してよいですが、root に新しい build orchestration 層は作りません。

package script 必須条件:

- `dev` / `start`: 実行主体である package が定義する
- `test`: test を持つ package が定義する
- `lint` / `format` / `check`: final state では必須ではない

---

## T6P1 migration shim との切り分け

T6P1 Phase 2 の root `bin` / `scripts.start` / `scripts.dev` / `scripts.test` などの thin shim は、**移行互換のための temporary runtime shim** です。  
これらは既存導線を壊さないための暫定措置であり、**final-state の root policy そのものではありません**。

この E3V9 が定義する final state は次です。

- root は private な workspace 管理層
- root の常設 script は `lint` / `format` / `check` / `test` の workspace 管理導線
- `start` / `dev` / runtime entrypoint は package owner 側に残す
- T6P1 Phase 2 の temporary shim は Phase 5 で撤去され、最終 root 責務には含めない

---

## この task で意図的に変えないこと

本 task は次を**変更しません**。

- Bun への移行計画
- Bun を前提にした runtime / package manager / test runner 方針
- Node 24 前提の見直し
- `core` / `mcp` / `cli` の責務境界
- N9C3 で確定した package identity / layout
- T6P1 で確定した phased migration sequence
- npm publish 前提の metadata 設計
- 新しい build system / task runner / monorepo orchestration tool の導入

---

## トレードオフと設計判断

### 判断 1: root は private な workspace 管理層に限定する

**採用理由**

- root の責務を scripts/config/workspace 管理に限定できる
- package 実装と repo 運用責務を分離できる
- 「root が 4 つ目の実装 package になる」状態を避けられる

**代替案**

- root に実装コードや共通 runtime ロジックも残す

**見送る理由**

- package 境界が曖昧になりやすい
- T6P1 の最終収束方向と相性が悪い

### 判断 2: Biome は root 一元管理にする

**採用理由**

- 同じ JS workspace で formatter/linter を揃えやすい
- package ごとの重複設定を避けられる
- 最小運用で済む

**代替案**

- package ごとに Biome 設定を持つ

**見送る理由**

- 今回の 3 package 構成では差分管理コストの方が大きい
- style drift を起こしやすい

### 判断 3: test は `node:test` 継続、root は集約実行だけ持つ

**採用理由**

- 現行 stack と整合する
- build system や別 test runner を増やさずに済む
- package 単位 test と workspace 全体 test の両方を単純に保てる

**代替案**

- monorepo 向け専用 test orchestrator を導入する

**見送る理由**

- 現段階では過剰
- 「最小で practical」に反する

### 判断 4: package 間 deep import を禁止し、公開 export のみ許可する

**採用理由**

- package 境界の破壊を防げる
- `core` の内部構造変更に adapter が引きずられにくい
- shared validation の再利用面を stable に保てる

**代替案**

- workspace 内なら `src/**` import を暫定許可する

**見送る理由**

- 後から export 面を締め直すコストが高い
- N9C3 の方針に反する

---

## 実装への影響

- root `package.json` は workspace 管理用の private package として整理する
- root に workspace 共通 script を置く
- Biome は root 設定を共通利用する
- 各 package は自 package の entrypoint / exports / test script を持つ
- cross-package import は公開 export に限定する

---

## 結論

E3V9 の結論は、**root を private な workspace 管理層にし、pnpm・Biome・`node:test` を workspace 共通基盤として root で共有しつつ、実装責務は `packages/core`・`packages/mcp`・`packages/cli` に残す**ことです。  
これにより、追加の build system を持ち込まずに、最小の shared toolchain と明確な root/package 境界を両立できます。  
また、Bun への移行や runtime 再設計は本 task の範囲外として明示的に据え置きます。

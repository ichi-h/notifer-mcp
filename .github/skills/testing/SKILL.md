---
name: testing
description: テストや静的解析などの検証を行うスキル。この検証を求められたときに使用する。
---

# Testing Skill

## 実行すること

1. **linter / formatter の実行**
  - `pnpm check`（biome check: フォーマット + lint）
  - `pnpm lint`（biome lint）
2. **既存テストコードの実行**
  - `pnpm test` が定義されていれば実行する
  - テストファイル（`*.test.js`, `*.spec.js` 等）が存在すれば実行する

## 実行しないこと

- **テストコードの新規作成は行わない**
  - アドホックなテストスクリプトの生成・実行は禁止
  - テストコードが存在しない場合は「テストなし」として報告するにとどめる
- lint/format/test 以外のコマンド実行は行わない

## 報告フォーマット

| チェック | 結果 | 詳細 |
|---|---|---|
| `pnpm check` | ✅ / ❌ | ... |
| `pnpm lint` | ✅ / ❌ | ... |
| `pnpm test` | ✅ / ❌ / スキップ（未定義） | ... |

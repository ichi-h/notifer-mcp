# コードスタイルと規約

## 言語
- JavaScript（TypeScriptは使用しない）

## 命名規則
- 変数・関数: camelCase
- クラス・インターフェース: PascalCase
- 定数: UPPER_SNAKE_CASE

## 静的解析・フォーマット
- **biome** を使用（linting + formatting）
- `pnpm lint`: lint実行
- `pnpm format`: フォーマット実行

## ファイル構成（予定）
- `src/`: ソースコード
- `src/index.js`: エントリーポイント
- `src/services/`: 通知サービス実装
- `src/tools/`: MCPツール定義

## コードコメント・ドキュメント
- 成果物として残るテキストは標準的な日本語を使用

## 設計方針
- 将来のSlack等への拡張を見据えた抽象化（インターフェース設計）
- 環境変数によるバリデーション

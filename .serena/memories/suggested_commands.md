# 開発用コマンド

## 環境セットアップ
```bash
# Nix flake環境に入る（direnvが自動的に実行）
direnv allow
# または手動で
nix develop
```

## Node.js / pnpm
```bash
# 依存関係のインストール
pnpm install

# ビルド（設定後）
pnpm build

# 開発サーバー起動（設定後）
pnpm dev

# MCPサーバー起動（設定後）
pnpm start
```

## 注意事項
- プロジェクトはまだ初期段階のためpackage.jsonが存在しない
- Nix flake経由でNode.js 24 + pnpmが提供される

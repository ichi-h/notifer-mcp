# notifer-mcp プロジェクト概要

## 目的

AIエージェントがタスク完了やユーザーへのアクション要求を通知するMCPサーバーを構築する。
`notify_send` ツールを提供し、現状はDiscord Webhookによる通知のみ対応する。
将来的なSlack対応を見据えた拡張可能な設計とする。

## ステータス

planned（初期段階 - ソースコードはまだ存在しない）

## 技術スタック

- **言語**: JavaScript（TypeScript不使用）
- **ランタイム**: Node.js 24
- **パッケージマネージャー**: pnpm
- **フレームワーク**: hono.js（@hono/mcp）※予定
- **静的解析**: biome
- **環境管理**: Nix flake + direnv

## 環境変数

- `SEND_TO`: 通知先の指定
- `DISCORD_WEBHOOK_URL`: Discord Webhook URL

## タスク一覧（.ichi-h/2026-03-05-notifier-mcp.md に記載）

- task-q3w7: プロジェクトの初期セットアップ（package.json、pnpm、Node.js 24設定）
- task-r5t9: 通知サービスのインターフェース設計（Slack対応見据えた抽象化）[依存: task-q3w7]
- task-k2p6: Discord Webhookを用いた通知サービス実装 [依存: task-r5t9]
- task-m8n1: 環境変数の読み込みとバリデーション実装 [依存: task-q3w7]
- task-a4f2: notify_send MCPツールをhono.jsで実装 [依存: task-k2p6, task-m8n1]
- task-b6c3: MCPサーバーのエントリーポイント実装 [依存: task-a4f2]
- task-d9e5: README.md作成 [依存: task-b6c3]
- task-h7j4: 動作確認 [依存: task-b6c3]

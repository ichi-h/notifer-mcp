/**
 * 動作確認用スクリプト
 *
 * 環境変数 SEND_TO=discord と DISCORD_WEBHOOK_URL が設定されている場合のみ
 * 実際に Discord Webhook へテストメッセージを送信する統合テスト。
 *
 * 使い方:
 *   SEND_TO=discord DISCORD_WEBHOOK_URL=https://... node scripts/verify.js
 */

import { loadConfig } from "../src/config.js";
import { DiscordNotificationService } from "../src/services/discord-notification-service.js";

let config;
try {
  config = loadConfig();
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
  // 環境変数が未設定の場合はスキップ
  if (msg.includes("is required") || msg.includes("must be a string")) {
    console.log("環境変数が設定されていません。テストをスキップします。");
    process.exit(0);
  }
  // その他の設定エラー
  console.error("❌ 設定エラー:", msg);
  process.exit(1);
}

const service = new DiscordNotificationService(config.discordWebhookUrl);

console.log("Discord Webhook へテストメッセージを送信します...");

try {
  await service.send({
    title: "notifier-mcp 動作確認",
    message:
      "これは notifier-mcp の動作確認用テストメッセージです。\n正常に受信できていれば送信は成功しています。",
  });

  console.log("✅ 送信成功");
} catch (error) {
  console.error(
    "❌ 送信失敗:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
}

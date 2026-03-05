import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DiscordWebhookUrl } from "./discord-webhook-url.js";

const VALID_URL = "https://discord.com/api/webhooks/123456789/abcdef-token";

describe("DiscordWebhookUrl", () => {
  describe("正常系", () => {
    it("有効なDiscord Webhook URLでインスタンスが作成できること", () => {
      const url = new DiscordWebhookUrl(VALID_URL);
      assert.ok(url instanceof DiscordWebhookUrl);
    });

    it("value で文字列を取得できること", () => {
      const url = new DiscordWebhookUrl(VALID_URL);
      assert.strictEqual(url.value, VALID_URL);
    });

    it("前後スペースがtrimされること", () => {
      const url = new DiscordWebhookUrl(`  ${VALID_URL}  `);
      assert.strictEqual(url.value, VALID_URL);
    });

    it("discordapp.com ドメインも有効であること", () => {
      const url = new DiscordWebhookUrl(
        "https://discordapp.com/api/webhooks/123456789/abcdef-token",
      );
      assert.strictEqual(
        url.value,
        "https://discordapp.com/api/webhooks/123456789/abcdef-token",
      );
    });
  });

  describe("異常系", () => {
    it("undefined でエラーになること", () => {
      assert.throws(
        () => new DiscordWebhookUrl(undefined),
        /DISCORD_WEBHOOK_URL must be a string/,
      );
    });

    it("null でエラーになること", () => {
      assert.throws(
        () => new DiscordWebhookUrl(null),
        /DISCORD_WEBHOOK_URL must be a string/,
      );
    });

    it("数値でエラーになること", () => {
      assert.throws(
        () => new DiscordWebhookUrl(42),
        /DISCORD_WEBHOOK_URL must be a string/,
      );
    });

    it("空文字でエラーになること", () => {
      assert.throws(
        () => new DiscordWebhookUrl(""),
        /DISCORD_WEBHOOK_URL is required/,
      );
    });

    it("スペースのみの文字列でエラーになること", () => {
      assert.throws(
        () => new DiscordWebhookUrl("   "),
        /DISCORD_WEBHOOK_URL is required/,
      );
    });

    it("HTTP URLでエラーになること", () => {
      assert.throws(
        () =>
          new DiscordWebhookUrl(
            "http://discord.com/api/webhooks/123456789/abcdef-token",
          ),
        /DISCORD_WEBHOOK_URL must be a valid Discord webhook URL/,
      );
    });

    it("Discord以外のドメインでエラーになること", () => {
      assert.throws(
        () =>
          new DiscordWebhookUrl(
            "https://example.com/api/webhooks/123456789/abcdef-token",
          ),
        /DISCORD_WEBHOOK_URL must be a valid Discord webhook URL/,
      );
    });

    it("改行を含むURLでエラーになること（\\n）", () => {
      assert.throws(
        () => new DiscordWebhookUrl(`${VALID_URL}\n`),
        /DISCORD_WEBHOOK_URL contains invalid characters/,
      );
    });

    it("改行を含むURLでエラーになること（\\r\\n）", () => {
      assert.throws(
        () => new DiscordWebhookUrl(`${VALID_URL}\r\n`),
        /DISCORD_WEBHOOK_URL contains invalid characters/,
      );
    });
  });
});

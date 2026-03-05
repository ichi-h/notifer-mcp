import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { loadConfig } from "./config.js";

const VALID_DISCORD_WEBHOOK_URL =
  "https://discord.com/api/webhooks/123456789/abcdef-token";

describe("loadConfig", () => {
  describe("正常系", () => {
    beforeEach(() => {
      process.env.SEND_TO = "discord";
      process.env.DISCORD_WEBHOOK_URL = VALID_DISCORD_WEBHOOK_URL;
    });

    afterEach(() => {
      delete process.env.SEND_TO;
      delete process.env.DISCORD_WEBHOOK_URL;
    });

    it("SEND_TO=discord + 有効な DISCORD_WEBHOOK_URL でconfigオブジェクトが返ること", () => {
      const config = loadConfig();
      assert.strictEqual(config.sendTo, "discord");
      assert.ok(config.discordWebhookUrl);
      assert.strictEqual(
        config.discordWebhookUrl.value,
        VALID_DISCORD_WEBHOOK_URL,
      );
    });
  });

  describe("異常系", () => {
    afterEach(() => {
      delete process.env.SEND_TO;
      delete process.env.DISCORD_WEBHOOK_URL;
    });

    it("SEND_TO 未設定でエラーになること", () => {
      delete process.env.SEND_TO;
      assert.throws(() => loadConfig(), /SEND_TO is required/);
    });

    it("SEND_TO が無効値でエラーになること", () => {
      process.env.SEND_TO = "slack";
      assert.throws(() => loadConfig(), /SEND_TO has an invalid value/);
    });

    it("SEND_TO=discord で DISCORD_WEBHOOK_URL 未設定でエラーになること", () => {
      process.env.SEND_TO = "discord";
      delete process.env.DISCORD_WEBHOOK_URL;
      assert.throws(() => loadConfig(), /DISCORD_WEBHOOK_URL/);
    });
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DiscordWebhookUrl } from "../values/index.js";
import { DiscordNotificationService } from "./discord-notification-service.js";

const VALID_WEBHOOK_URL =
  "https://discord.com/api/webhooks/123456789/abcdef-token";

function makeWebhookUrl() {
  return new DiscordWebhookUrl(VALID_WEBHOOK_URL);
}

describe("DiscordNotificationService", () => {
  describe("コンストラクタ", () => {
    it("discordWebhookUrl が DiscordWebhookUrl インスタンスでない場合に TypeError をスローすること", () => {
      assert.throws(
        () => new DiscordNotificationService("not-a-value-object"),
        (err) => {
          assert.ok(err instanceof TypeError);
          assert.match(
            err.message,
            /discordWebhookUrl must be an instance of DiscordWebhookUrl/,
          );
          return true;
        },
      );
    });

    it("有効な DiscordWebhookUrl でインスタンスが生成されること", () => {
      const service = new DiscordNotificationService(makeWebhookUrl());
      assert.ok(service instanceof DiscordNotificationService);
    });

    it("fetch が関数でない場合に TypeError をスローすること", () => {
      assert.throws(
        () => new DiscordNotificationService(makeWebhookUrl(), "not-a-function"),
        (err) => {
          assert.ok(err instanceof TypeError);
          assert.match(err.message, /fetch must be a callable function/);
          return true;
        },
      );
    });
  });

  describe("name", () => {
    it('"discord" を返すこと', () => {
      const service = new DiscordNotificationService(makeWebhookUrl());
      assert.strictEqual(service.name, "discord");
    });
  });

  describe("send()", () => {
    describe("タイトルなし", () => {
      it("fetch が正しい URL・メソッド・ヘッダー・ボディで呼ばれること", async () => {
        let capturedUrl;
        let capturedOptions;

        const mockFetch = async (url, options) => {
          capturedUrl = url;
          capturedOptions = options;
          return { ok: true };
        };

        const service = new DiscordNotificationService(
          makeWebhookUrl(),
          mockFetch,
        );
        await service.send({ message: "テストメッセージ" });

        assert.strictEqual(capturedUrl, VALID_WEBHOOK_URL);
        assert.strictEqual(capturedOptions.method, "POST");
        assert.deepEqual(capturedOptions.headers, {
          "Content-Type": "application/json",
        });
        assert.strictEqual(capturedOptions.redirect, "error");

        const body = JSON.parse(capturedOptions.body);
        assert.deepEqual(body, { content: "@everyone\nテストメッセージ" });
      });

      it("response.ok = true のとき正常終了すること", async () => {
        const mockFetch = async () => ({ ok: true });
        const service = new DiscordNotificationService(
          makeWebhookUrl(),
          mockFetch,
        );
        await assert.doesNotReject(() =>
          service.send({ message: "テストメッセージ" }),
        );
      });
    });

    describe("タイトルあり", () => {
      it("embed 形式のボディで fetch が呼ばれること", async () => {
        let capturedBody;
        let capturedOptions;

        const mockFetch = async (_url, options) => {
          capturedBody = JSON.parse(options.body);
          capturedOptions = options;
          return { ok: true };
        };

        const service = new DiscordNotificationService(
          makeWebhookUrl(),
          mockFetch,
        );
        await service.send({ message: "本文", title: "タイトル" });

        assert.deepEqual(capturedBody, {
          content: "@everyone",
          embeds: [
            {
              title: "タイトル",
              description: "本文",
            },
          ],
        });
        assert.strictEqual(capturedOptions.redirect, "error");
      });
    });

    describe("エラーハンドリング", () => {
      it("response.ok = false のとき DiscordWebhookError 相当のエラーをスローすること", async () => {
        const mockFetch = async () => ({ ok: false, status: 400 });
        const service = new DiscordNotificationService(
          makeWebhookUrl(),
          mockFetch,
        );

        await assert.rejects(
          () => service.send({ message: "テスト" }),
          (err) => {
            assert.ok(err instanceof Error);
            assert.match(
              err.message,
              /Discord Webhook request failed: HTTP 400/,
            );
            return true;
          },
        );
      });

      it("タイムアウト（AbortError）のとき 'Discord Webhook request timed out after 10 seconds' エラーをスローすること", async () => {
        let capturedSignal;

        const mockFetch = async (_url, options) => {
          capturedSignal = options.signal;
          const abortError = new Error("The operation was aborted");
          abortError.name = "AbortError";
          throw abortError;
        };
        const service = new DiscordNotificationService(
          makeWebhookUrl(),
          mockFetch,
        );

        await assert.rejects(
          () => service.send({ message: "テスト" }),
          (err) => {
            assert.ok(err instanceof Error);
            assert.strictEqual(
              err.message,
              "Discord Webhook request timed out after 10 seconds",
            );
            return true;
          },
        );

        // assert.rejects の後（catch の外）でアサート → AssertionError が飲み込まれない
        assert.ok(capturedSignal instanceof AbortSignal, "signal が渡されていること");
      });

      it("ネットワークエラーのとき 'Discord Webhook request failed due to a network error' エラーをスローすること", async () => {
        const mockFetch = async () => {
          throw new Error("network failure");
        };
        const service = new DiscordNotificationService(
          makeWebhookUrl(),
          mockFetch,
        );

        await assert.rejects(
          () => service.send({ message: "テスト" }),
          (err) => {
            assert.ok(err instanceof Error);
            assert.strictEqual(
              err.message,
              "Discord Webhook request failed due to a network error",
            );
            return true;
          },
        );
      });
    });
  });
});

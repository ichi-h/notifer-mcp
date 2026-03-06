import { DiscordWebhookUrl } from "../values/index.js";
import { NotificationService } from "./notification-service.js";

class DiscordWebhookError extends Error {
  constructor(message) {
    super(message);
    this.name = "DiscordWebhookError";
  }
}

/**
 * Discord Webhook notification service
 *
 * Sends notifications to a Discord channel via Webhook.
 * If a title is provided, it uses an embed; otherwise it sends a plain message.
 *
 * @extends {NotificationService}
 */
export class DiscordNotificationService extends NotificationService {
  /**
   * @param {import("../values/discord-webhook-url.js").DiscordWebhookUrl} discordWebhookUrl - Discord Webhook URL value object
   * @param {typeof globalThis.fetch} [fetch] - fetch implementation (defaults to globalThis.fetch)
   */
  constructor(discordWebhookUrl, fetch = globalThis.fetch) {
    super();
    if (!(discordWebhookUrl instanceof DiscordWebhookUrl)) {
      throw new TypeError(
        "discordWebhookUrl must be an instance of DiscordWebhookUrl",
      );
    }
    if (typeof fetch !== "function") {
      throw new TypeError("fetch must be a callable function");
    }
    this.#webhookUrl = discordWebhookUrl.value;
    this.#fetch = fetch;
  }

  /** @type {string} */
  #webhookUrl;

  /** @type {typeof globalThis.fetch} */
  #fetch;

  /**
   * @returns {string}
   */
  get name() {
    return "discord";
  }

  /**
   * Send a notification to Discord via Webhook
   *
   * @param {import("./notification-service.js").NotificationPayload} payload
   * @returns {Promise<void>}
   */
  async send(payload) {
    const body = payload.title
      ? {
        content: "@everyone",
        embeds: [
          {
            title: payload.title,
            description: payload.message,
          },
        ],
      }
      : { content: `@everyone\n${payload.message}` };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await this.#fetch(this.#webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        redirect: "error",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new DiscordWebhookError(
          `Discord Webhook request failed: HTTP ${response.status}`,
        );
      }
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("Discord Webhook request timed out after 10 seconds");
      }
      if (error instanceof DiscordWebhookError) {
        throw error;
      }
      throw new Error("Discord Webhook request failed due to a network error");
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

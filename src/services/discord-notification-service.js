import { NotificationService } from "./notification-service.js";

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
   */
  constructor(discordWebhookUrl) {
    super();
    this.#webhookUrl = discordWebhookUrl.value;
  }

  /** @type {string} */
  #webhookUrl;

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
          embeds: [
            {
              title: payload.title,
              description: payload.message,
            },
          ],
        }
      : { content: payload.message };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(this.#webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        redirect: "error",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Discord Webhook request failed: HTTP ${response.status}`,
        );
      }
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("Discord Webhook request timed out after 10 seconds");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

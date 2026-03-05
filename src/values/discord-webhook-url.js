/**
 * DiscordWebhookUrl value object
 *
 * Validates and normalizes a Discord Webhook URL.
 * Throws an Error on invalid input.
 */

const DISCORD_WEBHOOK_URL_PATTERN =
  /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/;

export class DiscordWebhookUrl {
  /** @type {string} */
  #value;

  /**
   * @param {string} rawUrl - Raw Discord Webhook URL string
   */
  constructor(rawUrl) {
    if (typeof rawUrl !== "string") {
      throw new Error("DISCORD_WEBHOOK_URL must be a string.");
    }

    if (/[\r\n]/.test(rawUrl)) {
      throw new Error("DISCORD_WEBHOOK_URL contains invalid characters.");
    }

    const trimmed = rawUrl?.trim();

    if (!trimmed) {
      throw new Error(
        'DISCORD_WEBHOOK_URL is required when SEND_TO is "discord".',
      );
    }

    if (!DISCORD_WEBHOOK_URL_PATTERN.test(trimmed)) {
      throw new Error(
        "DISCORD_WEBHOOK_URL must be a valid Discord webhook URL (https://discord.com/api/webhooks/... or https://discordapp.com/api/webhooks/...).",
      );
    }

    this.#value = trimmed;
  }

  /**
   * @returns {string}
   */
  get value() {
    return this.#value;
  }

  /**
   * @returns {string}
   */
  toString() {
    return this.#value;
  }
}

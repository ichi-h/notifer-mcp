/**
 * Environment variable loading and validation
 */

const SUPPORTED_DESTINATIONS = ["discord"];

/**
 * Loads environment variables, validates them, and returns a config object.
 * Throws an Error if validation fails.
 *
 * @returns {{ sendTo: string, discordWebhookUrl?: string }}
 */
function loadConfig() {
  const sendTo = process.env.SEND_TO;

  // SEND_TO validation
  if (!sendTo) {
    throw new Error("Environment variable SEND_TO is required.");
  }

  if (!SUPPORTED_DESTINATIONS.includes(sendTo)) {
    throw new Error(
      `Environment variable SEND_TO has an invalid value. Valid values: ${SUPPORTED_DESTINATIONS.join(", ")}`,
    );
  }

  // Destination-specific validation
  if (sendTo === "discord") {
    const rawDiscordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (/[\r\n]/.test(rawDiscordWebhookUrl)) {
      throw new Error("DISCORD_WEBHOOK_URL contains invalid characters.");
    }

    const discordWebhookUrl = rawDiscordWebhookUrl?.trim();

    if (!discordWebhookUrl) {
      throw new Error(
        'DISCORD_WEBHOOK_URL is required when SEND_TO is "discord".',
      );
    }

    const DISCORD_WEBHOOK_URL_PATTERN =
      /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/.+$/;
    if (!DISCORD_WEBHOOK_URL_PATTERN.test(discordWebhookUrl)) {
      throw new Error(
        "DISCORD_WEBHOOK_URL must be a valid Discord webhook URL (https://discord.com/api/webhooks/... or https://discordapp.com/api/webhooks/...).",
      );
    }

    return {
      sendTo,
      discordWebhookUrl,
    };
  }

  return {
    sendTo,
  };
}

export { loadConfig };

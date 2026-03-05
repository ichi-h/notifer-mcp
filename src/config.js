/**
 * Environment variable loading and validation
 */

import { DiscordWebhookUrl } from "./values/index.js";

const SUPPORTED_DESTINATIONS = ["discord"];

/**
 * Loads environment variables, validates them, and returns a config object.
 * Throws an Error if validation fails.
 *
 * @returns {{ sendTo: string, discordWebhookUrl?: import("./values/discord-webhook-url.js").DiscordWebhookUrl }}
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
    const rawUrl = process.env.DISCORD_WEBHOOK_URL;
    const discordWebhookUrl = new DiscordWebhookUrl(rawUrl);

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

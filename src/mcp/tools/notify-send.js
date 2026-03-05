/**
 * notify/send MCP tool
 *
 * Sends a notification to the configured destination.
 */

import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { loadConfig } from "../../config.js";
import { DiscordNotificationService } from "../../services/index.js";

/**
 * Registers the `notify/send` tool on the given MCP server.
 *
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server
 */
function registerNotifySend(server) {
  server.registerTool(
    "notify/send",
    {
      description:
        "Send a notification to the configured destination (e.g. Discord)",
      inputSchema: {
        message: z.string().max(4096).describe("The notification message body"),
        title: z
          .string()
          .max(256)
          .optional()
          .describe("Optional notification title"),
      },
    },
    async ({ message, title }) => {
      let config;
      try {
        config = loadConfig();
      } catch (error) {
        console.error(
          "[notify/send] Failed to load configuration:",
          error instanceof Error ? error.message : String(error),
        );
        throw new McpError(
          ErrorCode.InternalError,
          "Failed to load configuration. Check server environment variables.",
        );
      }

      try {
        /** @type {import("../../services/notification-service.js").NotificationService} */
        let service;

        if (config.sendTo === "discord") {
          service = new DiscordNotificationService(config.discordWebhookUrl);
        } else {
          throw new McpError(
            ErrorCode.InternalError,
            `Unsupported destination: ${config.sendTo}`,
          );
        }

        await service.send({ message, title });

        return {
          content: [
            {
              type: "text",
              text: `Notification sent successfully via ${service.name}.`,
            },
          ],
        };
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        console.error(
          "[notify/send] Failed to send notification:",
          error instanceof Error ? error.message : String(error),
        );
        throw new McpError(
          ErrorCode.InternalError,
          "Failed to send notification. Check server logs for details.",
        );
      }
    },
  );
}

export { registerNotifySend };

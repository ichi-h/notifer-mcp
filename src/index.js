#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerNotifySend } from "./mcp/tools/notify-send.js";

const server = new McpServer({
  name: "notifier-mcp",
  version: "1.0.0",
});

registerNotifySend(server);

const shutdown = async () => {
  await server.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const transport = new StdioServerTransport();
try {
  await server.connect(transport);
} catch (err) {
  console.error("Failed to connect MCP server:", err);
  process.exit(1);
}

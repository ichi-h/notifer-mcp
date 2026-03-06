# notifier-mcp

An MCP (Model Context Protocol) server that sends notifications from AI agents via Discord Webhook.

## Overview

`notifier-mcp` exposes a single MCP tool — `notify_send` — that allows AI agents (e.g. Claude, Cursor, GitHub Copilot) to push messages to a Discord channel through a Webhook URL.

## Prerequisites

| Requirement | Version |
| ----------- | ------- |
| Node.js     | >= 24   |
| pnpm        | any     |

## Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/notifer-mcp.git
   cd notifer-mcp
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

## Environment Variables

| Variable              | Required                  | Description                                                      |
| --------------------- | ------------------------- | ---------------------------------------------------------------- |
| `SEND_TO`             | ✅ Always                 | Notification destination. Currently only `discord` is supported. |
| `DISCORD_WEBHOOK_URL` | ✅ When `SEND_TO=discord` | The Discord Webhook URL to post messages to.                     |

### Example `.env`

```env
SEND_TO=discord
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/<id>/<token>
```

## Registering with MCP Clients

The server communicates over **stdio**. Add it to your MCP client configuration as shown below.

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or the equivalent path on your OS:

```json
{
  "mcpServers": {
    "notifier": {
      "command": "node",
      "args": ["/absolute/path/to/notifer-mcp/src/index.js"],
      "env": {
        "SEND_TO": "discord",
        "DISCORD_WEBHOOK_URL": "https://discord.com/api/webhooks/<id>/<token>"
      }
    }
  }
}
```

### Cursor

Edit `.cursor/mcp.json` in your project root (or the global `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "notifier": {
      "command": "node",
      "args": ["/absolute/path/to/notifer-mcp/src/index.js"],
      "env": {
        "SEND_TO": "discord",
        "DISCORD_WEBHOOK_URL": "https://discord.com/api/webhooks/<id>/<token>"
      }
    }
  }
}
```

### VS Code (GitHub Copilot)

Edit `.vscode/mcp.json` in your project root:

```json
{
  "servers": {
    "notifier": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/notifer-mcp/src/index.js"],
      "env": {
        "SEND_TO": "discord",
        "DISCORD_WEBHOOK_URL": "https://discord.com/api/webhooks/<id>/<token>"
      }
    }
  }
}
```

## Available MCP Tools

### `notify_send`

Sends a notification message to the configured destination.

| Parameter | Type   | Required | Constraints    | Description                   |
| --------- | ------ | -------- | -------------- | ----------------------------- |
| `message` | string | ✅       | max 4096 chars | The notification message body |
| `title`   | string | ❌       | max 256 chars  | Optional notification title   |

**Example invocation (natural language prompt):**

> "Send a notification that the deployment has finished."

The agent will call `notify_send` with an appropriate `message` (and optionally `title`) based on context.

## Development Commands

| Command       | Description                             |
| ------------- | --------------------------------------- |
| `pnpm start`  | Run the MCP server                      |
| `pnpm dev`    | Run the MCP server with `--watch` mode  |
| `pnpm test`   | Run tests (`node --test`)               |
| `pnpm lint`   | Lint source files with Biome            |
| `pnpm format` | Format source files with Biome          |
| `pnpm check`  | Run both lint and format checks (Biome) |

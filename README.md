# hostaway-mcp

Read-only, hospitality-shaped MCP server for Hostaway.

## V1 Goal

Make Codex and Claude useful in real Hostaway workflows without hand-wiring raw API
calls every time.

V1 is intentionally narrow:
- read-only only
- hospitality-native tools, not raw endpoint parity
- optimized for conversation context, reservation lookup, and listing lookup

## Exact V1 Surface

- `list_unread_guest_threads`
- `get_conversation_context`
- `get_reservation_brief`
- `get_listing_brief`
- `search_reservations`
- `search_conversations`

## Local Development

```bash
npm install
npm test
npm run check
npm run build
```

Run the stdio server locally:

```bash
HOSTAWAY_API_TOKEN=your-token-here node dist/cli.js
```

Create a local npm package tarball:

```bash
npm pack
```

After publish, run without cloning:

```bash
npx hostaway-mcp
```

## MCP Client Wiring

For local MCP clients, provide `HOSTAWAY_API_TOKEN` through the environment and
spawn the published npm package over stdio.

The snippets below are pinned to the current published version:

```text
hostaway-mcp@0.1.2
```

Update that version intentionally when you upgrade.

### Claude Desktop (macOS)

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`.

If you already have top-level keys like `preferences`, keep them and add
`mcpServers` alongside them:

```json
{
  "mcpServers": {
    "hostaway": {
      "command": "npx",
      "args": ["-y", "hostaway-mcp@0.1.2"],
      "env": {
        "HOSTAWAY_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

Restart Claude Desktop after saving the file.

### Codex

Edit `~/.codex/config.toml` and add:

```toml
[mcp_servers.hostaway]
command = "npx"
args = ["-y", "hostaway-mcp@0.1.2"]

[mcp_servers.hostaway.env]
HOSTAWAY_API_TOKEN = "your-token-here"
```

Verify the server is registered:

```bash
codex mcp list
```

### Local Built CLI

If you want to run the repo checkout instead of npm, point the client at the built
CLI directly:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/hostaway-mcp/dist/cli.js"],
  "env": {
    "HOSTAWAY_API_TOKEN": "your-token-here"
  }
}
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `HOSTAWAY_API_TOKEN` | Yes | — | Hostaway API token used to authenticate all requests. |
| `HOSTAWAY_BASE_URL` | No | Hostaway production URL | Override the API base URL (useful for testing). |
| `HOSTAWAY_MCP_READONLY` | No | `false` | Set to `true` to disable all write tools. Only read-only tools will be available. |

## V1 Non-Goals

- sending guest messages
- mutating reservations or listings
- webhook ingestion
- background sync pipelines
- dashboards or owner reporting
- generic REST-to-MCP proxy coverage

## Source Design

See [`docs/designs/v1-readonly-hostaway-mcp.md`](./docs/designs/v1-readonly-hostaway-mcp.md).

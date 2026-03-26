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

## MCP Client Wiring

For local MCP clients, point the server command at the built CLI and provide the token
through the environment:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/hostaway-mcp/dist/cli.js"],
  "env": {
    "HOSTAWAY_API_TOKEN": "your-token-here"
  }
}
```

## V1 Non-Goals

- sending guest messages
- mutating reservations or listings
- webhook ingestion
- background sync pipelines
- dashboards or owner reporting
- generic REST-to-MCP proxy coverage

## Source Design

See [`docs/designs/v1-readonly-hostaway-mcp.md`](./docs/designs/v1-readonly-hostaway-mcp.md).

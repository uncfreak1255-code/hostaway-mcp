# V1 Read-Only Hostaway MCP

Generated from approved office-hours design on 2026-03-26.
Status: APPROVED

## Problem Statement

Build a read-only, open-source Hostaway MCP server that makes Codex and Claude useful
in real Hostaway workflows without hand-wiring raw API calls every time.

The product is not "Hostaway API inside MCP." The product is a hospitality-shaped tool
surface that already understands the important nouns and workflows.

## Chosen Scope

V1 is a separate open-source repo with a small, opinionated read-only tool surface:

- `list_unread_guest_threads`
- `get_conversation_context`
- `get_reservation_brief`
- `get_listing_brief`
- `search_reservations`
- `search_conversations`

## Why This Shape

- Generic REST-to-MCP wrapping is commodity.
- The real value is preventing agents from guessing the Hostaway model.
- Read-only keeps the tool safe enough to dogfood daily.
- The existing Seascape runtime already contains proven mappings worth extracting.

## Existing Logic To Reuse

From `/Users/sawbeck/Projects/seascape-ops/scripts/hostaway-poller.js`:
- channel detection from `channelId` and `channelName`
- guest-name normalization with `recipientName` fallback logic
- conversation/message fetch patterns
- "guest spoke last" and "host already replied" style heuristics

From `/Users/sawbeck/Projects/seascape-ops/scripts/import-hostaway-conversations.js`:
- normalized conversation shape
- reservation/listing linkage patterns
- lower-level channel mapping logic

Important:
- `seascape-ops` is source material, not a runtime dependency.
- `hostaway-mcp` must define its own canonical mapping behavior and freeze it with fixtures and regression tests.
- Where the existing scripts disagree, `hostaway-mcp` must choose one explicit rule and document it.

## V1 Non-Goals

- sending guest messages
- creating or editing reservations
- webhook ingestion
- Discord integration
- background job orchestration
- analytics dashboards
- owner reporting
- broad Hostaway endpoint parity

## Proposed Architecture

```text
Hostaway API
    |
    v
Read-Only Hostaway Client
    |
    +--> Normalizers
    |      - channel
    |      - guest
    |      - conversation
    |      - reservation
    |      - listing
    |
    +--> Tool Handlers
           - list_unread_guest_threads
           - get_conversation_context
           - get_reservation_brief
           - get_listing_brief
           - search_reservations
           - search_conversations
    |
    v
MCP Server
```

## Locked Architecture Decisions

- Transport: `stdio` only in v1
- Runtime: Node + TypeScript
- MCP framework: official Model Context Protocol TypeScript SDK
- Validation: explicit schemas for tool inputs and outputs
- Distribution: npm package with a CLI bin for local `stdio` use
- Output strategy: compact default outputs with explicit detail controls
- Auth/config: environment variables only in v1
- Domain model: thin normalized domain only for the six v1 tools

Why these are locked:
- `stdio` matches the actual v1 user and avoids premature remote auth and HTTP surface area.
- Node/TypeScript reuses the proven patterns already living in `seascape-ops`.
- The official MCP SDK is the boring choice and avoids custom protocol glue.
- npm CLI distribution gives local MCP clients a clean install and `npx` path.
- Compact defaults keep agents grounded without flooding context; raw/detail output must be explicit.
- Environment-based auth is enough for local `stdio` use and avoids premature config machinery.
- A thin normalized domain keeps shared semantics consistent without spending an innovation token on a big internal platform.

## Tool Contracts

Shared output contract rules for all brief-style tools:
- stable top-level identifiers first
- compact summary fields second
- explicit `missing` or `notes` fields instead of silent omission where data is absent
- detail controls must expand output predictably, not change base field names
- field naming and null handling must be consistent across all tool responses

### `list_unread_guest_threads`
Purpose:
Return guest conversations that likely need attention.

Expected output:
- conversation id
- guest name
- listing id and listing name if known
- channel
- arrival/departure dates if known
- latest guest message timestamp
- raw Hostaway unread metadata if available
- whether host already replied after the latest guest message
- derived `needs_attention` flag based on guest-last / host-replied-after heuristic
- compact preview text

### `get_conversation_context`
Purpose:
Return an agent-friendly summary of a conversation plus recent message history.

Expected output:
- conversation identity
- guest identity summary
- reservation/listing linkage
- recent messages in chronological order
- latest speaker
- attachment presence
- compact operational summary
- explicit detail controls for more raw message/body fields when needed

### `get_reservation_brief`
Purpose:
Return the minimum useful reservation context for an agent or operator.

Expected output:
- reservation id
- guest name
- listing identity
- channel
- stay dates
- status
- occupancy summary if available
- notes on missing fields
- explicit detail controls for additional raw reservation fields when needed

### `get_listing_brief`
Purpose:
Return the minimum useful listing context tied to conversations or reservations.

Expected output:
- listing id
- listing name
- normalized channel-facing identity if applicable
- compact metadata needed to ground conversation context
- explicit detail controls for additional listing metadata when needed

### `search_reservations`
Purpose:
Lookup reservations by guest name, date range, listing, or reservation id.

Expected output:
- compact result list
- stable identifiers
- enough fields to route into `get_reservation_brief`

### `search_conversations`
Purpose:
Lookup conversations by guest name, listing, reservation id, or conversation id.

Expected output:
- compact result list
- enough fields to route into `get_conversation_context`

## Key Engineering Decisions To Lock In

- What runtime and SDK stack should the server use?
- What should default tool outputs include versus omit?
- How should raw Hostaway payloads be normalized without leaking unnecessary noise?
- Should "unread" be defined only by Hostaway state, or by a stricter operator heuristic?
- How should fixtures be structured so tests cover real payload shapes without live credentials?

## Test Plan Baseline

Minimum required from day one:
- Vitest as the test runner for TypeScript fixture-driven tests
- normalization tests for conversation, guest, listing, reservation, and channel mapping
- tool handler tests for all six MCP tools
- fixture-based tests for null, empty, and partially missing Hostaway fields
- regression tests for `recipientName` fallback, channel detection, and host-replied-after logic
- explicit mapping-spec tests for any rule inherited from `seascape-ops` where existing scripts differ

## Distribution Baseline

The first implementation plan must include:
- package/build command
- local install/run instructions
- publish target for releases
- versioning plan

Distribution is not optional. If users cannot install it cleanly, it is not a product.

## Performance Baseline

- No persistent cache in v1
- Request-scoped memoization is allowed to avoid duplicate fetches inside a single tool call
- Search tools must use explicit result limits and predictable pagination
- Tool handlers should avoid fan-out fetch patterns unless the output contract truly requires them
- Rate limits and slow upstream responses must surface clearly instead of failing silently

## Initial Package Shape

```text
src/
  hostaway/
    client.ts
    types.ts
    normalizers.ts
    briefs.ts
    attention.ts
  tools/
    list-unread-guest-threads.ts
    get-conversation-context.ts
    get-reservation-brief.ts
    get-listing-brief.ts
    search-reservations.ts
    search-conversations.ts
  server.ts
bin/
  hostaway-mcp
fixtures/
tests/
```

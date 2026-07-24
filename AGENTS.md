# Hostaway MCP — Agent Instructions (Canonical)

This is the canonical agent kernel for the hostaway-mcp repo. `CLAUDE.md` is a
thin Claude-specific delta that points back here. Any unique operating signal
lives in this file.

This repo owns the open-source Hostaway MCP server: the **operator product
only** — local/npm `stdio`, a small set of read-only, hospitality-shaped tools.

## Scope & Write-Safety Contract (READ FIRST)

This is the safety-critical part of this repo. Get it exactly right.

- **`main` is read-only. There are no write paths and no "safe" exceptions.**
  `src/server.ts` registers six read tools and nothing else:
  `list_unread_guest_threads`, `get_conversation_context`,
  `get_reservation_brief`, `get_listing_brief`, `search_reservations`,
  `search_conversations`. There is no write-tool registration, no
  `HOSTAWAY_MCP_READONLY` flag, and no `src/write-infra/` on `main`.
- **No PMS mutation.** Sending guest messages and mutating reservations or
  listings are explicit V1 Non-Goals (see `README.md`). The server only reads
  from Hostaway; it never writes to a guest, a reservation, or a listing.
- **The only credential is `HOSTAWAY_API_TOKEN`** (required, secret) with an
  optional `HOSTAWAY_BASE_URL` override for testing. The token authenticates
  read requests. Never print, echo, or commit token values, and never read or
  echo the contents of `.mcp.local.json` or `.mcpregistry_*` files.
- **Introducing any write path is a [SENSITIVE CHANGE].** If a future plan adds
  guest messaging, reservation/listing mutation, or any other write surface, it
  must be an explicit, approved scope change with: a confirmation/dry-run guard
  so writes never execute by default, an audit trail for every write, rate
  limiting, and regression tests covering the guard. Do not add write tools as
  an incidental part of unrelated work, and do not weaken the read-only default.
  Default to read-only.
- **No booking/distribution Worker in this repo.** Cloudflare Worker transport
  and Seascape booking/distribution flows are Non-Goals. Do not add a Worker,
  `wrangler.toml`, webhook ingestion, or background sync pipelines here.

## Commands (verified against package.json)

```bash
npm install        # install dependencies (Node >= 22)
npm test           # vitest run — the full test suite
npm run check      # tsc --noEmit — typecheck gate
npm run build      # rm -rf dist && tsc -p tsconfig.build.json
```

Run the stdio server locally after a build:

```bash
HOSTAWAY_API_TOKEN=your-token-here node dist/cli.js
```

Gates run in two places:
- **Local githooks** (`.githooks/pre-commit`, `.githooks/pre-push`) invoke the
  shared guardrail kit. `.guardrails.json` enforces feature-branch workflow and
  protects `main`/`master`.
- **GitHub Actions CI** (`.github/workflows/ci.yml`) runs
  `npm ci`, `npm test`, `npm run check`, and `npm run build` on PRs to and
  pushes to `main`.

## File Map

The tree on `main` is a single surface — the operator stdio server. There is no
Worker/distribution surface and no shared-client split on `main`.

- **Operator tools** — `src/tools/*`, each registered in `src/server.ts`.
- **Hostaway client + data shaping** — `src/hostaway/*` (`client.ts`,
  `normalizers.ts`, `briefs.ts`, `attention.ts`, `types.ts`).
- **Entrypoint** — `src/cli.ts` (stdio CLI), `src/server.ts`
  (`createHostawayMcpServer` wiring).
- **Tests** — `tests/hostaway/*`, `tests/tools/server.test.ts`.
- **Distribution metadata** — `server.json` (MCP registry), `package.json`
  (`bin: hostaway-mcp`), published as an npm package over stdio.

## Core Rules

- Hold scope on the v1 surface in `README.md`.
- Prefer explicit, hospitality-shaped tools over broad raw API coverage.
- Reuse proven Hostaway field and workflow mappings from:
  - `/Users/sawbeck/Projects/seascape-ops/scripts/hostaway-poller.js`
  - `/Users/sawbeck/Projects/seascape-ops/scripts/import-hostaway-conversations.js`
- Do not copy Seascape runtime concerns into this repo: Discord posting,
  launchd jobs, watchdogs, mailbox plumbing, or local runtime state.

## Before Coding

1. Read [`docs/designs/v1-readonly-hostaway-mcp.md`](./docs/designs/v1-readonly-hostaway-mcp.md).
2. Lock the architecture before non-trivial changes.
3. Keep the minimal tool surface unless the plan is explicitly updated.

## Testing Expectations

- Use sanitized fixtures based on real Hostaway payload shapes.
- No live credentials required for core normalization tests.
- Tests are part of the first implementation, not follow-up cleanup.
- Every bug fix gets a regression test.

## Skill Routing

Use the live lanes:

- Bugs / failures / unexpected behavior -> use the debugging lane and prove the
  root cause before fixing.
- Features and bug fixes -> implement with the repo proof gate and add focused
  regression coverage when behavior changes.
- Before merging non-trivial diffs -> run Codex `autoreview` with `gpt-5.5`;
  use GStack `review` for PR or landing readiness.
- Landing the work -> use `agent-finish` or GStack `ship`; merge only with
  explicit permission.

## Distribution Expectation

This is a developer tool. Build and publish are part of the product, not
optional afterthoughts.

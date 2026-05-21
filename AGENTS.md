# Agent Knowledge Base - hostaway-mcp

> Repo-local agent surface for the generic Hostaway MCP.

## Project Overview
This repo owns the open-source, hospitality-shaped Hostaway MCP server. V1 is
read-only and is the generic sibling to `seascape-booking-mcp`.

## Architecture Patterns
- Hold scope on the v1 surface in `README.md`.
- Prefer explicit, hospitality-shaped tools over broad raw API coverage.
- Reuse proven Hostaway mappings from `seascape-ops`, but do not copy Seascape
  runtime concerns, launchd state, or Discord workflows into this repo.

## Active Skills
- For Cloudflare Worker distribution, Wrangler config, remote MCP transport, or
  Worker-specific review, use the global Codex skills:
  - `cloudflare`
  - `wrangler`
  - `workers-best-practices`
- For contained local failures, use `diagnose`.
- For behavior changes with tests, use `tdd`.

## Known Gotchas
- V1 is read-only. No write paths, no "safe" exceptions.
- Do not let Seascape-specific booking-domain concerns drift back into this
  generic repo.

## Recent Learnings
- This repo still owns the generic npm/stdio Hostaway MCP surface even when a
  Cloudflare Worker distribution path is present.
- Verification is `npm test`, `npm run check`, `npm run build`, plus
  `guardrail-merge-check` when the guarded lane is active.

---
*Last updated: 2026-05-21*

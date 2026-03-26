# Hostaway MCP — Repo Instructions

This repo owns the implementation of the open-source Hostaway MCP server.

## Core Rules

- Hold scope on the v1 surface in `README.md`.
- V1 is read-only. No write paths, no "safe" exceptions.
- Prefer explicit, hospitality-shaped tools over broad raw API coverage.
- Reuse proven Hostaway field and workflow mappings from:
  - `/Users/sawbeck/Projects/seascape-ops/scripts/hostaway-poller.js`
  - `/Users/sawbeck/Projects/seascape-ops/scripts/import-hostaway-conversations.js`
- Do not copy Seascape runtime concerns into this repo:
  - Discord posting
  - launchd jobs
  - watchdogs
  - mailbox plumbing
  - local runtime state

## Before Coding

1. Read [docs/designs/v1-readonly-hostaway-mcp.md](/Users/sawbeck/Projects/hostaway-mcp/docs/designs/v1-readonly-hostaway-mcp.md)
2. Lock the architecture with `/plan-eng-review`
3. Keep the minimal tool surface unless the plan is explicitly updated

## Testing Expectations

- Use sanitized fixtures based on real Hostaway payload shapes
- No live credentials required for core normalization tests
- Tests are part of the first implementation, not follow-up cleanup

## Distribution Expectation

This is a developer tool. Build and publish are part of the product, not optional afterthoughts.

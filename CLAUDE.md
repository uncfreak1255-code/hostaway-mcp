# Hostaway MCP — Claude Notes

**Read [`AGENTS.md`](./AGENTS.md) first — it is canonical.** It holds the scope
and write-safety contract, verified commands, the file map, core rules, and
skill routing. This file is only the Claude-specific delta.

## Safety-critical reminder

`main` is **read-only**: six read tools in `src/server.ts`, no write paths, no
PMS mutation. Adding any write surface is a [SENSITIVE CHANGE] — see the
write-safety contract in `AGENTS.md`. Default to read-only; never print or
commit `HOSTAWAY_API_TOKEN`, and never read/echo `.mcp.local.json` or
`.mcpregistry_*`.

## Claude-specific notes

- Commands, file map, and CI/githook gates: see the "Commands" and "File Map"
  sections of `AGENTS.md` rather than duplicating them here.
- Skill lanes: `superpowers:systematic-debugging` for bugs,
  `superpowers:test-driven-development` for features/fixes,
  `superpowers:requesting-code-review` before merge, `agent-finish` to land.

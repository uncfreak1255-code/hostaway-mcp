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
- Skill lanes: use the debugging lane for bugs, the repo proof gate plus focused
  regression coverage for features/fixes, Codex `autoreview` with `gpt-5.5` for
  non-trivial diffs, and `agent-finish` or GStack `ship` to land.

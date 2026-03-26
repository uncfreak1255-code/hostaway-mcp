#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createHostawayClientFromEnv, createHostawayMcpServer } from "./server.js";

export async function main() {
  const client = createHostawayClientFromEnv();
  const server = createHostawayMcpServer({ client });
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});

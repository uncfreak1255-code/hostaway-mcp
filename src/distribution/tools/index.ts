/// <reference types="@cloudflare/workers-types" />

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { HostawayDataClient } from "../../hostaway/client.js";
import { registerSearchAvailabilityTool } from "./search-availability.js";
import { registerGetPropertyDetailsTool } from "./get-property-details.js";
import { registerGetRatesTool } from "./get-rates.js";

export function registerDistributionTools(
  server: McpServer,
  client: HostawayDataClient,
  kv?: KVNamespace
) {
  registerSearchAvailabilityTool(server, client, kv);
  registerGetPropertyDetailsTool(server, client, kv);
  registerGetRatesTool(server, client, kv);
}

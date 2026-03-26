import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { HostawayClient } from "./hostaway/client.js";
import type { HostawayDataClient, HostawayClientConfig } from "./hostaway/client.js";
import { registerGetConversationContextTool } from "./tools/get-conversation-context.js";
import { registerGetListingBriefTool } from "./tools/get-listing-brief.js";
import { registerGetReservationBriefTool } from "./tools/get-reservation-brief.js";
import { registerListUnreadGuestThreadsTool } from "./tools/list-unread-guest-threads.js";
import { registerSearchConversationsTool } from "./tools/search-conversations.js";
import { registerSearchReservationsTool } from "./tools/search-reservations.js";

export function createHostawayClientFromEnv() {
  const apiToken = process.env.HOSTAWAY_API_TOKEN;

  if (!apiToken) {
    throw new Error("HOSTAWAY_API_TOKEN is required");
  }

  const config: HostawayClientConfig = {
    apiToken
  };

  if (process.env.HOSTAWAY_BASE_URL) {
    config.baseUrl = process.env.HOSTAWAY_BASE_URL;
  }

  return new HostawayClient(config);
}

export function createHostawayMcpServer({
  client,
  name = "hostaway-mcp",
  version = "0.1.0"
}: {
  client: HostawayDataClient;
  name?: string;
  version?: string;
}) {
  const server = new McpServer({
    name,
    version
  });

  registerListUnreadGuestThreadsTool(server, client);
  registerGetConversationContextTool(server, client);
  registerGetReservationBriefTool(server, client);
  registerGetListingBriefTool(server, client);
  registerSearchReservationsTool(server, client);
  registerSearchConversationsTool(server, client);

  return server;
}

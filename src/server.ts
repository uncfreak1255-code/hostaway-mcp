import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { HostawayClient } from "./hostaway/client.js";
import type { HostawayDataClient, HostawayClientConfig, HostawayWriteClient } from "./hostaway/client.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };
import { registerGetConversationContextTool } from "./tools/get-conversation-context.js";
import { registerGetListingBriefTool } from "./tools/get-listing-brief.js";
import { registerGetReservationBriefTool } from "./tools/get-reservation-brief.js";
import { registerListUnreadGuestThreadsTool } from "./tools/list-unread-guest-threads.js";
import { registerSearchConversationsTool } from "./tools/search-conversations.js";
import { registerSearchReservationsTool } from "./tools/search-reservations.js";
import { registerMarkConversationReadTool } from "./tools/mark-conversation-read.js";
import { registerAddReservationNoteTool } from "./tools/add-reservation-note.js";
import { registerSendGuestMessageTool } from "./tools/send-guest-message.js";
import { JsonlAuditLogger } from "./write-infra/audit-logger.js";
import type { AuditLogger } from "./write-infra/audit-logger.js";
import { WriteRateLimiter } from "./write-infra/rate-limiter.js";

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
  version = pkg.version,
  auditLogger,
  rateLimiter
}: {
  client: HostawayDataClient;
  name?: string;
  version?: string;
  auditLogger?: AuditLogger;
  rateLimiter?: WriteRateLimiter;
}) {
  const server = new McpServer({
    name,
    version
  });

  // Read tools
  registerListUnreadGuestThreadsTool(server, client);
  registerGetConversationContextTool(server, client);
  registerGetReservationBriefTool(server, client);
  registerGetListingBriefTool(server, client);
  registerSearchReservationsTool(server, client);
  registerSearchConversationsTool(server, client);

  // Write tools — skip entirely when HOSTAWAY_MCP_READONLY=true
  const readonly = process.env.HOSTAWAY_MCP_READONLY === "true";

  if (!readonly) {
    const writeClient = client as HostawayWriteClient;
    const logger = auditLogger ?? new JsonlAuditLogger();
    const limiter = rateLimiter ?? new WriteRateLimiter();

    if (typeof writeClient.updateConversation === "function") {
      registerMarkConversationReadTool(server, writeClient, logger, limiter);
    }

    if (typeof writeClient.updateReservation === "function") {
      registerAddReservationNoteTool(server, writeClient, logger, limiter);
    }

    if (typeof writeClient.sendMessage === "function") {
      registerSendGuestMessageTool(server, writeClient, logger, limiter);
    }
  }

  return server;
}

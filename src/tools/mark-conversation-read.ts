import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import type { HostawayWriteClient } from "../hostaway/client.js";
import type { AuditLogger } from "../write-infra/audit-logger.js";
import { truncateParams } from "../write-infra/audit-logger.js";
import { WriteRateLimiter } from "../write-infra/rate-limiter.js";
import { requiresConfirmation, dryRunResult } from "../write-infra/confirmation-guard.js";

function toolResult<T>(structuredContent: T) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(structuredContent, null, 2)
      }
    ],
    structuredContent
  };
}

export function registerMarkConversationReadTool(
  server: McpServer,
  client: HostawayWriteClient,
  auditLogger: AuditLogger,
  rateLimiter: WriteRateLimiter
) {
  server.registerTool(
    "mark_conversation_read",
    {
      description: "Mark a guest conversation as read. Tier 0: safe to auto-execute.",
      inputSchema: {
        conversationId: z.union([z.string(), z.number()]),
        confirm: z.boolean().optional()
      }
    },
    async ({ conversationId, confirm }) => {
      const params = { conversationId, confirm };

      if (requiresConfirmation(confirm)) {
        await auditLogger.log({
          ts: new Date().toISOString(),
          tool: "mark_conversation_read",
          params: truncateParams(params),
          result_status: "dry_run",
          hostaway_response_id: null
        });

        return dryRunResult({
          action: "mark_conversation_read",
          conversationId: `${conversationId}`,
          would_send: { hasUnreadMessages: 0 }
        });
      }

      if (!rateLimiter.tryConsume()) {
        await auditLogger.log({
          ts: new Date().toISOString(),
          tool: "mark_conversation_read",
          params: truncateParams(params),
          result_status: "rate_limited",
          hostaway_response_id: null
        });

        return {
          content: [
            {
              type: "text" as const,
              text: "Rate limited: too many write operations. Try again in a few seconds."
            }
          ],
          isError: true
        };
      }

      try {
        const result = await client.updateConversation(conversationId, { hasUnreadMessages: 0 });
        const responseId = result && typeof result === "object" && "result" in result
          ? `${(result as { result?: { id?: unknown } }).result?.id ?? ""}`
          : null;

        await auditLogger.log({
          ts: new Date().toISOString(),
          tool: "mark_conversation_read",
          params: truncateParams(params),
          result_status: "ok",
          hostaway_response_id: responseId || null
        });

        return toolResult({
          success: true,
          conversationId: `${conversationId}`,
          action: "marked_read"
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";

        await auditLogger.log({
          ts: new Date().toISOString(),
          tool: "mark_conversation_read",
          params: truncateParams(params),
          result_status: "error",
          hostaway_response_id: null,
          error: message
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to mark conversation read: ${message}`
            }
          ],
          isError: true
        };
      }
    }
  );
}

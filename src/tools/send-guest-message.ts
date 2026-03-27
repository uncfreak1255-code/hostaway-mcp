import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import type { HostawayWriteClient } from "../hostaway/client.js";
import { normalizeGuestName, normalizeChannel } from "../hostaway/normalizers.js";
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

export function registerSendGuestMessageTool(
  server: McpServer,
  client: HostawayWriteClient,
  auditLogger: AuditLogger,
  rateLimiter: WriteRateLimiter
) {
  server.registerTool(
    "send_guest_message",
    {
      description: "Send a message to a guest in an existing conversation. Tier 2: requires approval. Message sends immediately on confirm — there is no draft mode.",
      inputSchema: {
        conversationId: z.union([z.string(), z.number()]),
        body: z.string().min(1).max(4000),
        confirm: z.boolean()
      }
    },
    async ({ conversationId, body, confirm }) => {
      const params = { conversationId, body, confirm };

      if (requiresConfirmation(confirm)) {
        // Fetch conversation context so the caller can verify before confirming
        let conversationContext: {
          guestName: string;
          channel: string;
          listingName: string | null;
          reservationId: string | null;
        } | null = null;

        try {
          const conversation = await client.getConversation(conversationId, { includeResources: 1 });
          const reservation = conversation.Reservation ?? null;
          conversationContext = {
            guestName: normalizeGuestName(conversation),
            channel: normalizeChannel(conversation),
            listingName: reservation?.listingName ?? null,
            reservationId: conversation.reservationId != null ? `${conversation.reservationId}` : null
          };
        } catch {
          // If we can't fetch context, still show the preview
        }

        await auditLogger.log({
          ts: new Date().toISOString(),
          tool: "send_guest_message",
          params: truncateParams(params),
          result_status: "dry_run",
          hostaway_response_id: null
        });

        return dryRunResult({
          action: "send_guest_message",
          conversationId: `${conversationId}`,
          message_preview: body,
          message_length: body.length,
          conversation_context: conversationContext,
          warning: "This message will be sent IMMEDIATELY to the guest when confirmed. There is no draft mode."
        });
      }

      if (!rateLimiter.tryConsume()) {
        await auditLogger.log({
          ts: new Date().toISOString(),
          tool: "send_guest_message",
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
        const result = await client.sendMessage(conversationId, { body });
        const responseId = result && typeof result === "object" && "result" in result
          ? `${(result as { result?: { id?: unknown } }).result?.id ?? ""}`
          : null;

        await auditLogger.log({
          ts: new Date().toISOString(),
          tool: "send_guest_message",
          params: truncateParams(params),
          result_status: "ok",
          hostaway_response_id: responseId || null
        });

        return toolResult({
          success: true,
          conversationId: `${conversationId}`,
          action: "message_sent",
          message_length: body.length
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";

        await auditLogger.log({
          ts: new Date().toISOString(),
          tool: "send_guest_message",
          params: truncateParams(params),
          result_status: "error",
          hostaway_response_id: null,
          error: message
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to send message: ${message}`
            }
          ],
          isError: true
        };
      }
    }
  );
}

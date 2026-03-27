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

export function registerAddReservationNoteTool(
  server: McpServer,
  client: HostawayWriteClient,
  auditLogger: AuditLogger,
  rateLimiter: WriteRateLimiter
) {
  server.registerTool(
    "add_reservation_note",
    {
      description: "Add or replace the notes field on a reservation. Tier 1: notify after execution.",
      inputSchema: {
        reservationId: z.union([z.string(), z.number()]),
        note: z.string().min(1).max(2000),
        mode: z.enum(["append", "replace"]).optional(),
        confirm: z.boolean().optional().default(false)
      }
    },
    async ({ reservationId, note, mode, confirm }) => {
      const resolvedMode = mode ?? "append";
      const params = { reservationId, note, mode: resolvedMode, confirm };

      if (requiresConfirmation(confirm)) {
        let existingNotes: string | null = null;

        if (resolvedMode === "replace") {
          try {
            const reservation = await client.getReservation(reservationId);
            existingNotes = (reservation as Record<string, unknown>).notes as string | null ?? null;
          } catch {
            existingNotes = null;
          }
        }

        await auditLogger.log({
          ts: new Date().toISOString(),
          tool: "add_reservation_note",
          params: truncateParams(params),
          result_status: "dry_run",
          hostaway_response_id: null
        });

        return dryRunResult({
          action: "add_reservation_note",
          reservationId: `${reservationId}`,
          mode: resolvedMode,
          note_preview: note,
          ...(resolvedMode === "replace" ? { existing_notes: existingNotes, warning: "Replace mode will overwrite existing notes." } : {}),
          would_send: resolvedMode === "replace"
            ? { notes: note }
            : { notes: `(existing notes)\\n${note}` }
        });
      }

      if (!rateLimiter.tryConsume()) {
        await auditLogger.log({
          ts: new Date().toISOString(),
          tool: "add_reservation_note",
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
        let finalNote = note;

        if (resolvedMode === "append") {
          try {
            const reservation = await client.getReservation(reservationId);
            const existing = (reservation as Record<string, unknown>).notes as string | undefined;
            if (existing && existing.trim()) {
              finalNote = `${existing}\n${note}`;
            }
          } catch {
            // If we can't fetch existing notes, just use the new note as-is
          }
        }

        const result = await client.updateReservation(reservationId, { notes: finalNote });
        const responseId = result && typeof result === "object" && "result" in result
          ? `${(result as { result?: { id?: unknown } }).result?.id ?? ""}`
          : null;

        await auditLogger.log({
          ts: new Date().toISOString(),
          tool: "add_reservation_note",
          params: truncateParams(params),
          result_status: "ok",
          hostaway_response_id: responseId || null
        });

        return toolResult({
          success: true,
          reservationId: `${reservationId}`,
          action: resolvedMode === "append" ? "note_appended" : "note_replaced",
          note_length: finalNote.length
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";

        await auditLogger.log({
          ts: new Date().toISOString(),
          tool: "add_reservation_note",
          params: truncateParams(params),
          result_status: "error",
          hostaway_response_id: null,
          error: message
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to update reservation notes: ${message}`
            }
          ],
          isError: true
        };
      }
    }
  );
}

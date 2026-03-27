import { afterEach, describe, expect, test } from "vitest";
import { readFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { JsonlAuditLogger, NoopAuditLogger, truncateParams } from "../../src/write-infra/audit-logger.js";
import type { AuditEntry } from "../../src/write-infra/audit-logger.js";

const testDir = join(tmpdir(), `hostaway-mcp-test-${Date.now()}`);

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("JsonlAuditLogger", () => {
  test("creates directory and writes JSONL entries", async () => {
    const filePath = join(testDir, "subdir", "writes.jsonl");
    const logger = new JsonlAuditLogger(filePath);

    const entry: AuditEntry = {
      ts: "2026-03-27T12:00:00Z",
      tool: "mark_conversation_read",
      params: '{"conversationId":"201","confirm":true}',
      result_status: "ok",
      hostaway_response_id: "201"
    };

    await logger.log(entry);

    const contents = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(contents.trim());
    expect(parsed).toEqual(entry);
  });

  test("appends multiple entries to same file", async () => {
    const filePath = join(testDir, "writes.jsonl");
    const logger = new JsonlAuditLogger(filePath);

    await logger.log({
      ts: "2026-03-27T12:00:00Z",
      tool: "mark_conversation_read",
      params: "{}",
      result_status: "ok",
      hostaway_response_id: null
    });

    await logger.log({
      ts: "2026-03-27T12:01:00Z",
      tool: "send_guest_message",
      params: "{}",
      result_status: "error",
      hostaway_response_id: null,
      error: "API down"
    });

    const contents = await readFile(filePath, "utf-8");
    const lines = contents.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).tool).toBe("mark_conversation_read");
    expect(JSON.parse(lines[1]!).tool).toBe("send_guest_message");
    expect(JSON.parse(lines[1]!).error).toBe("API down");
  });

  test("logs error entries with error field", async () => {
    const filePath = join(testDir, "writes.jsonl");
    const logger = new JsonlAuditLogger(filePath);

    await logger.log({
      ts: "2026-03-27T12:00:00Z",
      tool: "send_guest_message",
      params: '{"conversationId":"201"}',
      result_status: "error",
      hostaway_response_id: null,
      error: "Hostaway request failed (500)"
    });

    const contents = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(contents.trim());
    expect(parsed.result_status).toBe("error");
    expect(parsed.error).toBe("Hostaway request failed (500)");
  });

  test("swallows write errors silently (never breaks the operation)", async () => {
    // Point at a path we can't write to
    const logger = new JsonlAuditLogger("/dev/null/impossible/path/writes.jsonl");

    // Should not throw
    await expect(
      logger.log({
        ts: "2026-03-27T12:00:00Z",
        tool: "test",
        params: "{}",
        result_status: "ok",
        hostaway_response_id: null
      })
    ).resolves.toBeUndefined();
  });

  test("getFilePath returns the configured path", () => {
    const logger = new JsonlAuditLogger("/custom/path/writes.jsonl");
    expect(logger.getFilePath()).toBe("/custom/path/writes.jsonl");
  });
});

describe("NoopAuditLogger", () => {
  test("collects entries in memory for test assertions", async () => {
    const logger = new NoopAuditLogger();

    await logger.log({
      ts: "2026-03-27T12:00:00Z",
      tool: "test",
      params: "{}",
      result_status: "ok",
      hostaway_response_id: null
    });

    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0]!.tool).toBe("test");
  });
});

describe("truncateParams", () => {
  test("truncates long param strings to max length", () => {
    const longBody = "x".repeat(300);
    const result = truncateParams({ body: longBody }, 200);
    expect(result.length).toBeLessThanOrEqual(203); // 200 + "..."
    expect(result).toContain("...");
  });

  test("does not truncate short param strings", () => {
    const result = truncateParams({ conversationId: "201" }, 200);
    expect(result).toBe('{"conversationId":"201"}');
    expect(result).not.toContain("...");
  });
});

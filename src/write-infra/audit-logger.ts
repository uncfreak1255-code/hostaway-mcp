import { writeFile, appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { homedir } from "node:os";
import { join } from "node:path";

export interface AuditEntry {
  ts: string;
  tool: string;
  params: string;
  result_status: "ok" | "error" | "dry_run" | "rate_limited";
  hostaway_response_id: string | null;
  error?: string;
}

export interface AuditLogger {
  log(entry: AuditEntry): Promise<void>;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) + "..." : value;
}

export function truncateParams(params: Record<string, unknown>, maxLength = 200): string {
  return truncate(JSON.stringify(params), maxLength);
}

export class JsonlAuditLogger implements AuditLogger {
  private readonly filePath: string;
  private ensuredDir = false;

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(homedir(), ".hostaway-mcp", "writes.jsonl");
  }

  async log(entry: AuditEntry): Promise<void> {
    try {
      if (!this.ensuredDir) {
        await mkdir(dirname(this.filePath), { recursive: true });
        this.ensuredDir = true;
      }

      const line = JSON.stringify(entry) + "\n";
      await appendFile(this.filePath, line, "utf-8");
    } catch {
      // Audit logging must never break a write operation.
      // Swallow errors silently — the write itself is more important.
    }
  }

  getFilePath(): string {
    return this.filePath;
  }
}

/** No-op logger for tests that don't care about audit output. */
export class NoopAuditLogger implements AuditLogger {
  readonly entries: AuditEntry[] = [];

  async log(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}

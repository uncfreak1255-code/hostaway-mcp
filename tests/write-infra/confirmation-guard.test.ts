import { describe, expect, test } from "vitest";

import { requiresConfirmation, dryRunResult } from "../../src/write-infra/confirmation-guard.js";

describe("requiresConfirmation", () => {
  test("returns true when confirm is undefined", () => {
    expect(requiresConfirmation(undefined)).toBe(true);
  });

  test("returns true when confirm is false", () => {
    expect(requiresConfirmation(false)).toBe(true);
  });

  test("returns false when confirm is true", () => {
    expect(requiresConfirmation(true)).toBe(false);
  });
});

describe("dryRunResult", () => {
  test("wraps preview in standard dry-run response with text and structured content", () => {
    const preview = { action: "test", would_send: { foo: "bar" } };
    const result = dryRunResult(preview);

    expect(result.structuredContent).toEqual({
      dry_run: true,
      message: "No changes made. Set confirm: true to execute this operation.",
      preview
    });

    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe("text");
    expect(JSON.parse(result.content[0]!.text)).toEqual({
      dry_run: true,
      message: "No changes made. Set confirm: true to execute this operation.",
      preview
    });
  });
});

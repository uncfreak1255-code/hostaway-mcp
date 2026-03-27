/**
 * Confirmation guard for write operations.
 * If confirm is not exactly `true`, returns a dry-run preview with no side effects.
 */
export function requiresConfirmation(confirm: boolean | undefined): boolean {
  return confirm !== true;
}

export function dryRunResult<T>(preview: T) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            dry_run: true,
            message: "No changes made. Set confirm: true to execute this operation.",
            preview
          },
          null,
          2
        )
      }
    ],
    structuredContent: {
      dry_run: true as const,
      message: "No changes made. Set confirm: true to execute this operation.",
      preview
    }
  };
}

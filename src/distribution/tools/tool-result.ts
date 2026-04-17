/**
 * Wrap structured content into the MCP tool result format.
 * Provides both text (JSON) and structuredContent for maximum client compat.
 */
export function toolResult<T>(structuredContent: T) {
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

/** Milliseconds in one day — shared constant for date math. */
export const MS_PER_DAY = 86_400_000;

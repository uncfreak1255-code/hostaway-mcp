import { isIncomingGuestMessage, isOutgoingHostMessage, normalizeTimestamp } from "./normalizers.js";
import type { RawHostawayMessage, ThreadAttention } from "./types.js";

function asDate(timestamp: string | null): Date | null {
  return timestamp ? new Date(timestamp) : null;
}

export function latestGuestMessageTimestamp(messages: RawHostawayMessage[]): string | null {
  return messages.reduce<string | null>((latest, message) => {
    if (!isIncomingGuestMessage(message)) {
      return latest;
    }

    const timestamp = normalizeTimestamp(message);
    if (!timestamp) {
      return latest;
    }

    if (!latest) {
      return timestamp;
    }

    return asDate(timestamp)! > asDate(latest)! ? timestamp : latest;
  }, null);
}

export function hostRepliedAfterLatestGuestMessage(messages: RawHostawayMessage[]): boolean {
  const latestGuestTimestamp = latestGuestMessageTimestamp(messages);

  if (!latestGuestTimestamp) {
    return false;
  }

  return messages.some((message) => {
    if (!isOutgoingHostMessage(message)) {
      return false;
    }

    const hostTimestamp = normalizeTimestamp(message);
    return Boolean(hostTimestamp && asDate(hostTimestamp)! > asDate(latestGuestTimestamp)!);
  });
}

export function deriveThreadAttention(
  messages: RawHostawayMessage[],
  rawUnreadMetadata?: { unread?: boolean | null }
): ThreadAttention & { rawUnread?: boolean | null } {
  const latestGuestTimestamp = latestGuestMessageTimestamp(messages);
  const hostReplied = hostRepliedAfterLatestGuestMessage(messages);

  return {
    latestGuestMessageTimestamp: latestGuestTimestamp,
    hostRepliedAfterLatestGuestMessage: hostReplied,
    needsAttention: Boolean(latestGuestTimestamp && !hostReplied),
    rawUnread: rawUnreadMetadata?.unread ?? null
  };
}

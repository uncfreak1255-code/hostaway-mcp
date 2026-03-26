import type {
  HostawayChannel,
  NormalizedConversation,
  RawHostawayConversation,
  RawHostawayGuestLike,
  RawHostawayMessage,
  RawHostawayReservationLike
} from "./types.js";

const AIRBNB_CHANNEL_IDS = new Set([2000, 2018]);
const BOOKING_CHANNEL_IDS = new Set([2002]);
const VRBO_CHANNEL_IDS = new Set([2016]);

type ChannelLike = Pick<RawHostawayConversation, "channelId" | "channelName" | "source" | "Reservation"> | RawHostawayReservationLike;

export function normalizeChannel(conversation: ChannelLike): HostawayChannel {
  const reservation = "Reservation" in conversation ? conversation.Reservation ?? undefined : undefined;
  const channelId = conversation.channelId ?? reservation?.channelId ?? undefined;
  const channelName = `${conversation.channelName ?? reservation?.channelName ?? conversation.source ?? reservation?.source ?? ""}`.toLowerCase();

  if ((typeof channelId === "number" && AIRBNB_CHANNEL_IDS.has(channelId)) || channelName.includes("airbnb")) {
    return "Airbnb";
  }

  if ((typeof channelId === "number" && BOOKING_CHANNEL_IDS.has(channelId)) || channelName.includes("booking")) {
    return "Booking.com";
  }

  if ((typeof channelId === "number" && VRBO_CHANNEL_IDS.has(channelId)) || channelName.includes("vrbo") || channelName.includes("homeaway")) {
    return "VRBO";
  }

  return "Direct";
}

export function normalizeGuestName(conversation: RawHostawayGuestLike): string {
  const recipientName = conversation.recipientName?.trim();
  if (recipientName) {
    return recipientName;
  }

  const first = conversation.guestFirstName?.trim();
  const last = conversation.guestLastName?.trim();
  const splitName = [first, last].filter(Boolean).join(" ").trim();
  if (splitName) {
    return splitName;
  }

  const guestName = conversation.guestName?.trim();
  if (guestName) {
    return guestName;
  }

  return "Unknown Guest";
}

export function normalizeMessageText(message: RawHostawayMessage): string {
  return message.body ?? message.message ?? message.text ?? "";
}

export function normalizeTimestamp(message: RawHostawayMessage): string | null {
  return message.insertedOn ?? message.createdOn ?? message.date ?? null;
}

export function normalizeConversation(conversation: RawHostawayConversation): NormalizedConversation {
  const listingId = conversation.listingMapId ?? conversation.listingId ?? null;
  const reservationId = conversation.reservationId ?? conversation.Reservation?.id ?? conversation.Reservation?.hostawayReservationId ?? conversation.Reservation?.reservationId ?? null;
  const rawHasUnreadMessages =
    conversation.hasUnreadMessages == null
      ? null
      : conversation.hasUnreadMessages === true || conversation.hasUnreadMessages === 1;

  return {
    id: `${conversation.id ?? ""}`,
    listingId: listingId == null ? null : `${listingId}`,
    reservationId: reservationId == null ? null : `${reservationId}`,
    channel: normalizeChannel(conversation),
    guestName: normalizeGuestName(conversation),
    guestEmail: conversation.guestEmail?.trim() ?? null,
    arrivalDate: conversation.arrivalDate ?? null,
    departureDate: conversation.departureDate ?? null,
    isArchived: conversation.isArchived === true,
    rawHasUnreadMessages
  };
}

export function isIncomingGuestMessage(message: RawHostawayMessage): boolean {
  return (
    message.isIncoming === true ||
    message.isIncoming === 1 ||
    message.type === "guest" ||
    message.direction === "incoming"
  );
}

export function isOutgoingHostMessage(message: RawHostawayMessage): boolean {
  return (
    message.isIncoming === false ||
    message.isIncoming === 0 ||
    message.type === "host" ||
    message.direction === "outgoing"
  );
}

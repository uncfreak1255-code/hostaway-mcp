import { deriveThreadAttention } from "./attention.js";
import {
  isIncomingGuestMessage,
  isOutgoingHostMessage,
  normalizeChannel,
  normalizeConversation,
  normalizeGuestName,
  normalizeMessageText,
  normalizeTimestamp
} from "./normalizers.js";
import type {
  ConversationMessageSummary,
  DetailLevel,
  RawHostawayConversation,
  RawHostawayListing,
  RawHostawayMessage,
  RawHostawayReservationLike
} from "./types.js";

function asId(value: unknown): string | null {
  return value == null || value === "" ? null : `${value}`;
}

function asBoolean(value: unknown): boolean | null {
  if (value == null) {
    return null;
  }

  if (value === true || value === 1) {
    return true;
  }

  if (value === false || value === 0) {
    return false;
  }

  return null;
}

function listMissing(entries: Array<[string, unknown]>): string[] {
  return entries
    .filter(([, value]) => value == null || value === "" || (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0))
    .map(([field]) => field);
}

function compareTimestamps(a: string | null, b: string | null): number {
  if (!a && !b) {
    return 0;
  }

  if (!a) {
    return -1;
  }

  if (!b) {
    return 1;
  }

  return new Date(a).getTime() - new Date(b).getTime();
}

function summarizeMessages(messages: RawHostawayMessage[]): ConversationMessageSummary[] {
  return [...messages]
    .map((message) => {
      const timestamp = normalizeTimestamp(message);
      const hasAttachments = Array.isArray(message.attachments) && message.attachments.length > 0;
      const speaker = isIncomingGuestMessage(message)
        ? "guest"
        : isOutgoingHostMessage(message)
          ? "host"
          : "unknown";

      return {
        id: asId(message.id) ?? "",
        speaker,
        text: normalizeMessageText(message),
        timestamp,
        hasAttachments
      } satisfies ConversationMessageSummary;
    })
    .sort((left, right) => compareTimestamps(left.timestamp, right.timestamp));
}

function buildOccupancy(reservation: RawHostawayReservationLike) {
  const occupancy = {
    totalGuests: reservation.numberOfGuests ?? null,
    adults: reservation.adults ?? null,
    children: reservation.children ?? null,
    infants: reservation.infants ?? null,
    pets: reservation.pets ?? null
  };

  return Object.values(occupancy).every((value) => value == null) ? null : occupancy;
}

function listingIdFrom(value: { listingMapId?: unknown; listingId?: unknown }): string | null {
  return asId(value.listingMapId ?? value.listingId);
}

function reservationIdFrom(value: RawHostawayReservationLike | RawHostawayConversation): string | null {
  const hostawayReservationId = "hostawayReservationId" in value ? value.hostawayReservationId : null;
  return asId(value.id ?? hostawayReservationId ?? value.reservationId);
}

function listingNameFrom(listing?: RawHostawayListing | null, reservation?: RawHostawayReservationLike | null): string | null {
  return listing?.name ?? listing?.internalName ?? reservation?.listingName ?? null;
}

function channelFacingNameFrom(listing: RawHostawayListing): string {
  return listing.airbnbName ?? listing.bookingName ?? listing.vrboName ?? listing.name ?? listing.internalName ?? "Unknown Listing";
}

export function buildConversationContext({
  conversation,
  messages,
  reservation,
  listing,
  detailLevel = "compact"
}: {
  conversation: RawHostawayConversation;
  messages: RawHostawayMessage[];
  reservation?: RawHostawayReservationLike | null;
  listing?: RawHostawayListing | null;
  detailLevel?: DetailLevel;
}) {
  const normalizedConversation = normalizeConversation(conversation);
  const summarizedMessages = summarizeMessages(messages);
  const latestMessage = summarizedMessages[summarizedMessages.length - 1] ?? null;
  const attention = deriveThreadAttention(messages, {
    unread: asBoolean(conversation.hasUnreadMessages)
  });
  const listingId = normalizedConversation.listingId ?? listingIdFrom(reservation ?? {});
  const reservationId = normalizedConversation.reservationId ?? reservationIdFrom(reservation ?? {});
  const listingName = listingNameFrom(listing, reservation);

  const result = {
    conversationId: normalizedConversation.id,
    reservationId,
    listingId,
    guest: {
      name: normalizedConversation.guestName,
      email: normalizedConversation.guestEmail
    },
    listing: {
      id: listingId,
      name: listingName
    },
    reservation: {
      id: reservationId,
      status: reservation?.status ?? null,
      arrivalDate: reservation?.arrivalDate ?? normalizedConversation.arrivalDate,
      departureDate: reservation?.departureDate ?? normalizedConversation.departureDate
    },
    channel: normalizedConversation.channel,
    attention: {
      rawHasUnreadMessages: attention.rawUnread === null ? normalizedConversation.rawHasUnreadMessages : attention.rawUnread,
      latestGuestMessageTimestamp: attention.latestGuestMessageTimestamp,
      hostRepliedAfterLatestGuestMessage: attention.hostRepliedAfterLatestGuestMessage,
      needsAttention: attention.needsAttention
    },
    latestSpeaker: latestMessage?.speaker ?? null,
    hasAttachments: summarizedMessages.some((message) => message.hasAttachments),
    preview: latestMessage?.text ?? "",
    recentMessages: summarizedMessages,
    missing: listMissing([
      ["conversationId", normalizedConversation.id],
      ["guestName", normalizedConversation.guestName],
      ["listingId", listingId],
      ["listingName", listingName],
      ["reservationId", reservationId],
      ["arrivalDate", reservation?.arrivalDate ?? normalizedConversation.arrivalDate],
      ["departureDate", reservation?.departureDate ?? normalizedConversation.departureDate]
    ]),
    notes: [] as string[]
  };

  if (detailLevel === "full") {
    return {
      ...result,
      raw: {
        conversation,
        reservation: reservation ?? null,
        listing: listing ?? null
      }
    };
  }

  return result;
}

export function buildReservationBrief({
  reservation,
  listing,
  detailLevel = "compact"
}: {
  reservation: RawHostawayReservationLike;
  listing?: RawHostawayListing | null;
  detailLevel?: DetailLevel;
}) {
  const listingId = listingIdFrom(reservation);
  const listingName = listingNameFrom(listing, reservation);
  const occupancy = buildOccupancy(reservation);

  const result = {
    reservationId: reservationIdFrom(reservation),
    listingId,
    listingName,
    guestName: normalizeGuestName(reservation),
    guestEmail: reservation.guestEmail?.trim() ?? null,
    channel: normalizeChannel(reservation),
    status: reservation.status ?? null,
    arrivalDate: reservation.arrivalDate ?? null,
    departureDate: reservation.departureDate ?? null,
    occupancy,
    missing: listMissing([
      ["reservationId", reservationIdFrom(reservation)],
      ["listingId", listingId],
      ["listingName", listingName],
      ["status", reservation.status ?? null],
      ["occupancy", occupancy]
    ]),
    notes: [] as string[]
  };

  if (detailLevel === "full") {
    return {
      ...result,
      raw: {
        reservation,
        listing: listing ?? null
      }
    };
  }

  return result;
}

export function buildListingBrief({
  listing,
  detailLevel = "compact"
}: {
  listing: RawHostawayListing;
  detailLevel?: DetailLevel;
}) {
  const result = {
    listingId: asId(listing.id),
    listingName: listing.name ?? listing.internalName ?? "Unknown Listing",
    channelFacingName: channelFacingNameFrom(listing),
    city: listing.city ?? null,
    country: listing.country ?? null,
    personCapacity: listing.personCapacity ?? null,
    bedrooms: listing.bedroomsNumber ?? null,
    bathrooms: listing.guestBathroomsNumber ?? null,
    missing: listMissing([
      ["listingId", listing.id ?? null],
      ["city", listing.city ?? null],
      ["country", listing.country ?? null],
      ["personCapacity", listing.personCapacity ?? null]
    ]),
    notes: [] as string[]
  };

  if (detailLevel === "full") {
    return {
      ...result,
      raw: {
        listing
      }
    };
  }

  return result;
}

export function buildUnreadThreadSummary({
  conversation,
  messages,
  reservation,
  listing
}: {
  conversation: RawHostawayConversation;
  messages: RawHostawayMessage[];
  reservation?: RawHostawayReservationLike | null;
  listing?: RawHostawayListing | null;
}) {
  const context = buildConversationContext({
    conversation,
    messages,
    ...(reservation !== undefined ? { reservation } : {}),
    ...(listing !== undefined ? { listing } : {})
  });

  return {
    conversationId: context.conversationId,
    reservationId: context.reservationId,
    listingId: context.listingId,
    listingName: context.listing.name,
    guestName: context.guest.name,
    channel: context.channel,
    arrivalDate: context.reservation.arrivalDate,
    departureDate: context.reservation.departureDate,
    latestGuestMessageTimestamp: context.attention.latestGuestMessageTimestamp,
    rawHasUnreadMessages: context.attention.rawHasUnreadMessages,
    hostRepliedAfterLatestGuestMessage: context.attention.hostRepliedAfterLatestGuestMessage,
    needsAttention: context.attention.needsAttention,
    preview: context.preview
  };
}

export function buildReservationSearchResult({
  reservation
}: {
  reservation: RawHostawayReservationLike;
}) {
  return {
    reservationId: reservationIdFrom(reservation),
    listingId: listingIdFrom(reservation),
    listingName: reservation.listingName ?? null,
    guestName: normalizeGuestName(reservation),
    channel: normalizeChannel(reservation),
    arrivalDate: reservation.arrivalDate ?? null,
    departureDate: reservation.departureDate ?? null,
    status: reservation.status ?? null
  };
}

export function buildConversationSearchResult({
  conversation,
  reservation,
  listing
}: {
  conversation: RawHostawayConversation;
  reservation?: RawHostawayReservationLike | null;
  listing?: RawHostawayListing | null;
}) {
  const normalizedConversation = normalizeConversation(conversation);
  const listingId = normalizedConversation.listingId ?? listingIdFrom(reservation ?? {});

  return {
    conversationId: normalizedConversation.id,
    reservationId: normalizedConversation.reservationId ?? reservationIdFrom(reservation ?? {}),
    listingId,
    listingName: listingNameFrom(listing, reservation),
    guestName: normalizedConversation.guestName,
    channel: normalizedConversation.channel,
    arrivalDate: reservation?.arrivalDate ?? normalizedConversation.arrivalDate,
    departureDate: reservation?.departureDate ?? normalizedConversation.departureDate,
    rawHasUnreadMessages: normalizedConversation.rawHasUnreadMessages
  };
}

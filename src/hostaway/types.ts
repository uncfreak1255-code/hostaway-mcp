export type HostawayChannel = "Airbnb" | "Booking.com" | "VRBO" | "Direct";
export type DetailLevel = "compact" | "full";

export interface RawHostawayGuestLike {
  recipientName?: string | null;
  guestFirstName?: string | null;
  guestLastName?: string | null;
  guestName?: string | null;
  guestEmail?: string | null;
}

export interface RawHostawayReservationLike extends RawHostawayGuestLike {
  id?: number | string | null;
  channelId?: number | null;
  channelName?: string | null;
  source?: string | null;
  listingMapId?: number | string | null;
  listingId?: number | string | null;
  listingName?: string | null;
  reservationId?: number | string | null;
  hostawayReservationId?: number | string | null;
  arrivalDate?: string | null;
  departureDate?: string | null;
  status?: string | null;
  numberOfGuests?: number | null;
  adults?: number | null;
  children?: number | null;
  infants?: number | null;
  pets?: number | null;
  totalPrice?: number | null;
  currency?: string | null;
}

export interface RawHostawayConversation extends RawHostawayGuestLike {
  id?: number | string | null;
  channelId?: number | null;
  channelName?: string | null;
  source?: string | null;
  listingMapId?: number | string | null;
  listingId?: number | string | null;
  reservationId?: number | string | null;
  arrivalDate?: string | null;
  departureDate?: string | null;
  isArchived?: boolean | null;
  hasUnreadMessages?: boolean | number | null;
  messageSentOn?: string | null;
  messageReceivedOn?: string | null;
  Reservation?: RawHostawayReservationLike | null;
}

export interface RawHostawayMessage {
  id?: number | string | null;
  isIncoming?: boolean | number | null;
  type?: string | null;
  direction?: string | null;
  body?: string | null;
  message?: string | null;
  text?: string | null;
  insertedOn?: string | null;
  createdOn?: string | null;
  date?: string | null;
  attachments?: unknown[] | null;
}

export interface RawHostawayListing {
  id?: number | string | null;
  name?: string | null;
  internalName?: string | null;
  airbnbName?: string | null;
  bookingName?: string | null;
  vrboName?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  address?: string | null;
  personCapacity?: number | null;
  bedroomsNumber?: number | null;
  guestBathroomsNumber?: number | null;
  description?: string | null;
  amenities?: string[] | null;
  bookingEngineUrls?: string[] | null;
  vrboListingUrl?: string | null;
}

export interface NormalizedConversation {
  id: string;
  listingId: string | null;
  reservationId: string | null;
  channel: HostawayChannel;
  guestName: string;
  guestEmail: string | null;
  arrivalDate: string | null;
  departureDate: string | null;
  isArchived: boolean;
  rawHasUnreadMessages: boolean | null;
}

export interface ThreadAttention {
  latestGuestMessageTimestamp: string | null;
  hostRepliedAfterLatestGuestMessage: boolean;
  needsAttention: boolean;
}

export interface ConversationMessageSummary {
  id: string;
  speaker: "guest" | "host" | "unknown";
  text: string;
  timestamp: string | null;
  hasAttachments: boolean;
}

export interface HostawayCalendarDay {
  id: number;
  date: string;
  isAvailable: 0 | 1;
  status: string;
  price: number;
  minimumStay: number;
  maximumStay: number;
  closedOnArrival: 0 | 1;
  closedOnDeparture: 0 | 1;
  note: string | null;
  countAvailableUnits: number;
  availableUnitsToSell: number;
}

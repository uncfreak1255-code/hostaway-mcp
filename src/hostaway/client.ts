import type {
  HostawayCalendarDay,
  RawHostawayConversation,
  RawHostawayListing,
  RawHostawayMessage,
  RawHostawayReservationLike
} from "./types.js";

type QueryValue = string | number | boolean | null | undefined;

export interface HostawayClientConfig {
  apiToken: string;
  baseUrl?: string;
}

export interface ListConversationsParams {
  reservationId?: string | number;
  limit?: number;
  offset?: number;
  includeResources?: number;
}

export interface ListMessagesParams {
  limit?: number;
  offset?: number;
  sortOrder?: string;
}

export interface ListReservationsParams {
  limit?: number;
  offset?: number;
  sortOrder?: string;
  channelId?: number;
  listingId?: string | number;
  match?: string;
  arrivalStartDate?: string;
  arrivalEndDate?: string;
  departureStartDate?: string;
  departureEndDate?: string;
  hasUnreadConversationMessages?: 0 | 1;
  guestEmail?: string;
  includeResources?: number;
}

export interface ListListingsParams {
  limit?: number;
  offset?: number;
  match?: string;
  includeResources?: number;
}

export interface HostawayWriteResult {
  status: string;
  result: unknown;
}

export interface HostawayDataClient {
  listConversations(params?: ListConversationsParams): Promise<RawHostawayConversation[]>;
  getConversation(conversationId: string | number, params?: { includeResources?: number }): Promise<RawHostawayConversation>;
  getConversationMessages(conversationId: string | number, params?: ListMessagesParams): Promise<RawHostawayMessage[]>;
  listReservations(params?: ListReservationsParams): Promise<RawHostawayReservationLike[]>;
  getReservation(reservationId: string | number): Promise<RawHostawayReservationLike>;
  listListings(params?: ListListingsParams): Promise<RawHostawayListing[]>;
  getListing(listingId: string | number): Promise<RawHostawayListing>;
  getCalendar(listingId: number, startDate: string, endDate: string): Promise<HostawayCalendarDay[]>;
}

export interface HostawayWriteClient extends HostawayDataClient {
  updateConversation(conversationId: string | number, body: Record<string, unknown>): Promise<HostawayWriteResult>;
  updateReservation(reservationId: string | number, body: Record<string, unknown>): Promise<HostawayWriteResult>;
  sendMessage(conversationId: string | number, body: Record<string, unknown>): Promise<HostawayWriteResult>;
}

export class HostawayClient implements HostawayWriteClient {
  private readonly apiToken: string;
  private readonly baseUrl: string;

  constructor(config: HostawayClientConfig) {
    this.apiToken = config.apiToken;
    this.baseUrl = (config.baseUrl ?? "https://api.hostaway.com").replace(/\/+$/, "");
  }

  async listConversations(params: ListConversationsParams = {}): Promise<RawHostawayConversation[]> {
    return this.request("/v1/conversations", params);
  }

  async getConversation(conversationId: string | number, params: { includeResources?: number } = {}): Promise<RawHostawayConversation> {
    return this.request(`/v1/conversations/${conversationId}`, params);
  }

  async getConversationMessages(conversationId: string | number, params: ListMessagesParams = {}): Promise<RawHostawayMessage[]> {
    return this.request(`/v1/conversations/${conversationId}/messages`, params);
  }

  async listReservations(params: ListReservationsParams = {}): Promise<RawHostawayReservationLike[]> {
    return this.request("/v1/reservations", params);
  }

  async getReservation(reservationId: string | number): Promise<RawHostawayReservationLike> {
    return this.request(`/v1/reservations/${reservationId}`);
  }

  async listListings(params: ListListingsParams = {}): Promise<RawHostawayListing[]> {
    return this.request("/v1/listings", params);
  }

  async getListing(listingId: string | number): Promise<RawHostawayListing> {
    return this.request(`/v1/listings/${listingId}`);
  }

  async getCalendar(listingId: number, startDate: string, endDate: string): Promise<HostawayCalendarDay[]> {
    return this.request(`/v1/listings/${listingId}/calendar`, { startDate, endDate });
  }

  async updateConversation(conversationId: string | number, body: Record<string, unknown>): Promise<HostawayWriteResult> {
    return this.mutate("PUT", `/v1/conversations/${conversationId}`, body);
  }

  async updateReservation(reservationId: string | number, body: Record<string, unknown>): Promise<HostawayWriteResult> {
    return this.mutate("PUT", `/v1/reservations/${reservationId}`, body);
  }

  async sendMessage(conversationId: string | number, body: Record<string, unknown>): Promise<HostawayWriteResult> {
    return this.mutate("POST", `/v1/conversations/${conversationId}/messages`, body);
  }

  private async mutate<T>(method: "PUT" | "POST", path: string, body: Record<string, unknown>): Promise<T> {
    const url = this.buildUrl(path, {});
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error("AUTH_EXPIRED");
    }

    if (response.status === 429) {
      throw new Error("RATE_LIMITED");
    }

    const rawBody = await response.text();

    let parsed: unknown;
    try {
      parsed = rawBody ? JSON.parse(rawBody) : null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown parse error";
      throw new Error(`JSON parse error: ${message}`);
    }

    if (!response.ok) {
      throw new Error(`Hostaway request failed (${response.status}): ${this.stringifyErrorBody(parsed)}`);
    }

    if (parsed && typeof parsed === "object" && "status" in parsed) {
      const payload = parsed as { status?: string; result?: unknown; message?: string };

      if (payload.status === "fail") {
        throw new Error(`Hostaway API error: ${payload.message ?? this.stringifyErrorBody(payload.result)}`);
      }
    }

    return parsed as T;
  }

  private async request<T>(path: string, params: object = {}): Promise<T> {
    const url = this.buildUrl(path, params);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiToken}`
      }
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error("AUTH_EXPIRED");
    }

    if (response.status === 429) {
      throw new Error("RATE_LIMITED");
    }

    const rawBody = await response.text();

    let parsed: unknown;
    try {
      parsed = rawBody ? JSON.parse(rawBody) : null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown parse error";
      throw new Error(`JSON parse error: ${message}`);
    }

    if (!response.ok) {
      throw new Error(`Hostaway request failed (${response.status}): ${this.stringifyErrorBody(parsed)}`);
    }

    if (parsed && typeof parsed === "object" && "status" in parsed) {
      const payload = parsed as { status?: string; result?: unknown; message?: string };

      if (payload.status === "fail") {
        throw new Error(`Hostaway API error: ${payload.message ?? this.stringifyErrorBody(payload.result)}`);
      }

      if ("result" in payload) {
        return payload.result as T;
      }
    }

    return parsed as T;
  }

  private buildUrl(path: string, params: object): string {
    const url = new URL(path, `${this.baseUrl}/`);

    for (const [key, value] of Object.entries(params) as Array<[string, QueryValue]>) {
      if (value == null || value === "") {
        continue;
      }

      url.searchParams.set(key, `${value}`);
    }

    return url.toString();
  }

  private stringifyErrorBody(value: unknown): string {
    if (typeof value === "string") {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return "Unknown error";
    }
  }
}

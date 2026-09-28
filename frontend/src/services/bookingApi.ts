export interface BookingSlot {
  id: string;
  start: string;
  end: string;
  providerId?: string;
}

export interface BookingRequest {
  slotId: string;
  patientId: string;
  reason?: string;
  idempotencyKey: string;
}

export interface BookingResult {
  bookingId: string;
  slotId: string;
  status: 'confirmed' | 'pending';
}

export interface ConflictAlternative {
  slotId: string;
  start: string;
  end: string;
}

export class BookingConflictError extends Error {
  readonly alternatives: ConflictAlternative[];

  constructor(message: string, alternatives: ConflictAlternative[]) {
    super(message);
    this.name = 'BookingConflictError';
    this.alternatives = alternatives;
  }
}

export class BookingTimeoutError extends Error {
  readonly idempotencyKey: string;

  constructor(message: string, idempotencyKey: string) {
    super(message);
    this.name = 'BookingTimeoutError';
    this.idempotencyKey = idempotencyKey;
  }
}

export interface BookingApiOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Generates a stable idempotency key for a single user booking intent.
 * The same key must be reused across retries of that intent so the backend
 * can deduplicate double submits and network retries.
 */
export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `bk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface RawBookingResponse {
  bookingId?: string;
  slotId?: string;
  status?: string;
  alternatives?: ConflictAlternative[];
}

export class BookingApi {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: BookingApiOptions = {}) {
    this.baseUrl = options.baseUrl ?? '/api';
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Submits a booking for a single intent. The caller is responsible for
   * generating one idempotency key per intent and reusing it on retries.
   */
  async book(request: BookingRequest): Promise<BookingResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': request.idempotencyKey,
        },
        body: JSON.stringify({
          slotId: request.slotId,
          patientId: request.patientId,
          reason: request.reason,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new BookingTimeoutError(
          'Booking request timed out. Reconcile before retrying.',
          request.idempotencyKey,
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 409) {
      const body = await this.safeJson(response);
      throw new BookingConflictError(
        'The selected slot is no longer available.',
        body?.alternatives ?? [],
      );
    }

    if (!response.ok) {
      throw new Error(`Booking failed with status ${response.status}`);
    }

    const body = await this.safeJson(response);
    return {
      bookingId: body?.bookingId ?? '',
      slotId: body?.slotId ?? request.slotId,
      status: body?.status === 'pending' ? 'pending' : 'confirmed',
    };
  }

  /**
   * Reconciles a timed-out booking by querying the server for the outcome of
   * the original idempotency key. This prevents a retry from creating a
   * duplicate booking when the first request actually succeeded.
   */
  async reconcile(idempotencyKey: string): Promise<BookingResult | null> {
    const response = await this.fetchImpl(
      `${this.baseUrl}/bookings/by-idempotency-key/${encodeURIComponent(idempotencyKey)}`,
      { method: 'GET' },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Reconciliation failed with status ${response.status}`);
    }

    const body = await this.safeJson(response);
    if (!body?.bookingId) {
      return null;
    }

    return {
      bookingId: body.bookingId,
      slotId: body.slotId ?? '',
      status: body.status === 'pending' ? 'pending' : 'confirmed',
    };
  }

  private async safeJson(response: Response): Promise<RawBookingResponse | null> {
    try {
      return (await response.json()) as RawBookingResponse;
    } catch {
      return null;
    }
  }
}

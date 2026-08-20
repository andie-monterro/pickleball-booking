import { randomUUID } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import {
  coversInstant,
  readBookingHorizon,
} from "@/lib/booking-horizon";
import { clock } from "@/lib/clock";
import { getPool } from "@/lib/db";

const CANCELLATION_CUTOFF_MS = 6 * 60 * 60 * 1000;
const CANCELLATION_GRACE_MS = 15 * 60 * 1000;

export type CancellationKind = "penalty_free" | "late_cancel";

export type Booking = {
  id: string;
  courtId: number;
  courtName: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  cancellationKind: CancellationKind;
};

type CreateBookingInput = {
  courtId: number;
  startsAt: Date;
  durationHours: 1 | 2;
};

type CancelBookingInput = {
  bookingId: string;
  confirmLateCancel: boolean;
};

export type Cancellation = {
  bookingId: string;
  kind: CancellationKind;
};

interface BookingRow extends QueryResultRow {
  id: string;
  court_id: number;
  court_name: string;
  starts_at: Date;
  duration_hours: number;
  created_at: Date;
}

interface CourtAvailabilityRow extends QueryResultRow {
  name: string;
  open_slot_count: number;
}

interface CancellableBookingRow extends QueryResultRow {
  starts_at: Date;
  created_at: Date;
}

interface StrikeCountRow extends QueryResultRow {
  strike_count: number;
}

type PostgresError = Error & { code?: string };

export class BookingError extends Error {
  constructor(
    readonly code:
      | "invalid_request"
      | "slot_in_past"
      | "slot_not_bookable"
      | "slot_taken"
      | "outside_horizon"
      | "booking_not_found"
      | "booking_started"
      | "cancellation_reclassified",
    readonly status: number,
  ) {
    super(code);
  }
}

function parseInput(input: unknown): CreateBookingInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BookingError("invalid_request", 400);
  }
  const record = input as Record<string, unknown>;
  const courtId = record.courtId;
  const startsAtValue = record.startsAt;
  const durationHours = record.durationHours;
  const startsAt = typeof startsAtValue === "string" ? new Date(startsAtValue) : new Date(Number.NaN);

  if (
    !Number.isInteger(courtId) ||
    (courtId as number) <= 0 ||
    Number.isNaN(startsAt.getTime()) ||
    startsAt.getUTCMinutes() !== 0 ||
    startsAt.getUTCSeconds() !== 0 ||
    startsAt.getUTCMilliseconds() !== 0 ||
    (durationHours !== 1 && durationHours !== 2)
  ) {
    throw new BookingError("invalid_request", 400);
  }

  return {
    courtId: courtId as number,
    startsAt,
    durationHours,
  };
}

function parseCancelInput(input: unknown): CancelBookingInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BookingError("invalid_request", 400);
  }
  const record = input as Record<string, unknown>;
  const bookingId = record.bookingId;
  const confirmLateCancel = record.confirmLateCancel;
  if (
    typeof bookingId !== "string" ||
    bookingId.length === 0 ||
    (confirmLateCancel !== undefined && typeof confirmLateCancel !== "boolean")
  ) {
    throw new BookingError("invalid_request", 400);
  }
  return { bookingId, confirmLateCancel: confirmLateCancel === true };
}

function classifyCancellation(
  startsAt: Date,
  createdAt: Date,
  at: Date,
): CancellationKind {
  const beforeOrAtCutoff =
    at.getTime() <= startsAt.getTime() - CANCELLATION_CUTOFF_MS;
  const withinGrace =
    at.getTime() <= createdAt.getTime() + CANCELLATION_GRACE_MS;
  return beforeOrAtCutoff || withinGrace ? "penalty_free" : "late_cancel";
}

function bookingFromRow(row: BookingRow, at: Date): Booking {
  const endsAt = new Date(row.starts_at.getTime() + row.duration_hours * 60 * 60 * 1000);
  return {
    id: row.id,
    courtId: row.court_id,
    courtName: row.court_name,
    startsAt: row.starts_at.toISOString(),
    endsAt: endsAt.toISOString(),
    createdAt: row.created_at.toISOString(),
    cancellationKind: classifyCancellation(row.starts_at, row.created_at, at),
  };
}

async function readBookableCourt(
  client: PoolClient,
  input: CreateBookingInput,
): Promise<CourtAvailabilityRow> {
  const result = await client.query<CourtAvailabilityRow>(
    `select courts.name,
            (select count(*)::integer
               from generate_series(0, $3::integer - 1) as slot(slot_number)
              where exists (
                select 1
                  from venue_settings
                  join opening_hours
                    on opening_hours.day_of_week = extract(
                      dow from ($2::timestamptz + slot.slot_number * interval '1 hour')
                        at time zone venue_settings.venue_time_zone
                    )
                 where venue_settings.id = 1
                   and extract(
                     hour from ($2::timestamptz + slot.slot_number * interval '1 hour')
                       at time zone venue_settings.venue_time_zone
                   ) >= opening_hours.start_hour
                   and extract(
                     hour from ($2::timestamptz + slot.slot_number * interval '1 hour')
                       at time zone venue_settings.venue_time_zone
                   ) < opening_hours.end_hour
              )) as open_slot_count
       from courts
      where courts.id = $1`,
    [input.courtId, input.startsAt, input.durationHours],
  );
  const court = result.rows[0];
  if (!court || court.open_slot_count !== input.durationHours) {
    throw new BookingError("slot_not_bookable", 400);
  }
  return court;
}

// Whole-day horizon: every venue day the Booking touches must be inside the
// Booker's horizon, so a Booking can never straddle the boundary.
async function refuseOutsideHorizon(playerId: string, input: CreateBookingInput): Promise<void> {
  const horizon = await readBookingHorizon(playerId);
  for (let slotNumber = 0; slotNumber < input.durationHours; slotNumber += 1) {
    const slotStart = new Date(input.startsAt.getTime() + slotNumber * 60 * 60 * 1000);
    if (!coversInstant(horizon, slotStart)) {
      throw new BookingError("outside_horizon", 400);
    }
  }
}

export async function createBooking(playerId: string, rawInput: unknown): Promise<Booking> {
  const input = parseInput(rawInput);
  const now = clock.now();
  if (input.startsAt.getTime() < now.getTime()) {
    throw new BookingError("slot_in_past", 400);
  }
  await refuseOutsideHorizon(playerId, input);

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const court = await readBookableCourt(client, input);
    const id = randomUUID();
    await client.query(
      `insert into bookings (id, booker_id, court_id, starts_at, duration_hours, created_at)
       values ($1, $2, $3, $4, $5, $6)`,
      [id, playerId, input.courtId, input.startsAt, input.durationHours, now],
    );
    await client.query(
      `insert into slot_claims (court_id, slot_starts_at, source_kind, source_id)
       select $1, $2::timestamptz + slot.slot_number * interval '1 hour', 'booking', $3
         from generate_series(0, $4::integer - 1) as slot(slot_number)`,
      [input.courtId, input.startsAt, id, input.durationHours],
    );
    await client.query("commit");
    return {
      id,
      courtId: input.courtId,
      courtName: court.name,
      startsAt: input.startsAt.toISOString(),
      endsAt: new Date(input.startsAt.getTime() + input.durationHours * 60 * 60 * 1000).toISOString(),
      createdAt: now.toISOString(),
      cancellationKind: "penalty_free",
    };
  } catch (error) {
    await client.query("rollback");
    if ((error as PostgresError).code === "23505") {
      throw new BookingError("slot_taken", 409);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function cancelBooking(
  playerId: string,
  rawInput: unknown,
): Promise<{ cancellation: Cancellation; strikeCount: number }> {
  const input = parseCancelInput(rawInput);
  const now = clock.now();
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const bookingResult = await client.query<CancellableBookingRow>(
      `select starts_at, created_at
         from bookings
        where id = $1
          and booker_id = $2
          and cancelled_at is null
        for update`,
      [input.bookingId, playerId],
    );
    const booking = bookingResult.rows[0];
    if (!booking) {
      throw new BookingError("booking_not_found", 404);
    }
    if (booking.starts_at.getTime() <= now.getTime()) {
      throw new BookingError("booking_started", 409);
    }

    const kind = classifyCancellation(
      booking.starts_at,
      booking.created_at,
      now,
    );
    if (kind === "late_cancel" && !input.confirmLateCancel) {
      throw new BookingError("cancellation_reclassified", 409);
    }

    await client.query(
      `update bookings
          set cancelled_at = $2,
              cancellation_kind = $3
        where id = $1`,
      [input.bookingId, now, kind],
    );
    await client.query(
      `delete from slot_claims
        where source_kind = 'booking'
          and source_id = $1`,
      [input.bookingId],
    );
    if (kind === "late_cancel") {
      await client.query(
        `insert into strikes (id, player_id, booking_id, reason, earned_at)
         values ($1, $2, $3, 'late_cancel', $4)`,
        [randomUUID(), playerId, input.bookingId, now],
      );
    }
    const strikeResult = await client.query<StrikeCountRow>(
      "select current_strike_count($1, $2) as strike_count",
      [playerId, now],
    );
    await client.query("commit");
    return {
      cancellation: { bookingId: input.bookingId, kind },
      strikeCount: strikeResult.rows[0]?.strike_count ?? 0,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function readUpcomingBookings(playerId: string): Promise<Booking[]> {
  const now = clock.now();
  const result = await getPool().query<BookingRow>(
    `select bookings.id,
            bookings.court_id,
            courts.name as court_name,
            bookings.starts_at,
            bookings.duration_hours,
            bookings.created_at
       from bookings
       join courts on courts.id = bookings.court_id
      where bookings.booker_id = $1
        and bookings.starts_at >= $2
        and bookings.cancelled_at is null
      order by bookings.starts_at, bookings.id`,
    [playerId, now],
  );
  return result.rows.map((row) => bookingFromRow(row, now));
}

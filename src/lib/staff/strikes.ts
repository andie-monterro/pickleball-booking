// No-show marking and Strike waivers: the two judgement calls the front desk
// makes about a Player's record.
//
// The app enforces no waiting period on a No-show — Staff judge, and they may
// mark a Booking the moment it starts or days later. What the app does enforce
// is that there is something to judge: the Booking must have started, and it
// must still stand.
//
// The mark is the Strike. Marking inserts one strikes row with reason
// 'no_show'; undoing deletes it. There is no second record saying "this Booking
// is a No-show", so a mark can never drift from the Strike it earned, and both
// halves of "undoing removes the Strike it created" are the same statement.
// A Booking Ban is derived from the Strike records at check time, so a ban that
// only existed because of that Strike disappears with it — the same reason a
// waiver lifts the ban it caused, with nothing to keep in step.

import { randomUUID } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import {
  recordStaffAction,
  type BookingAuditDetails,
  type StaffIdentity,
} from "@/lib/audit-log";
import { clock } from "@/lib/clock";
import { getPool, runInTransaction } from "@/lib/db";

export type StrikeReason = "late_cancel" | "no_show";

// The Player a Strike is against, echoed back so the desk sees whose record it
// just changed.
export interface StrikePlayer {
  id: string;
  displayName: string;
  phone: string;
}

export interface Strike {
  id: string;
  playerId: string;
  bookingId: string;
  reason: StrikeReason;
  earnedAt: string;
  // Set when Staff waived it: the Strike stays on the record and stops counting
  // toward a Booking Ban.
  waivedAt: string | null;
  // The Booking the Strike came from, so the desk can see which session it was
  // about without a second read.
  courtName: string;
  startsAt: string;
  endsAt: string;
}

// What a Player's record looks like after the change: both numbers are derived
// from the Strike records, so they answer "did this lift the ban?" directly.
export interface StrikeOutcome {
  player: StrikePlayer;
  strikeCount: number;
  bookingBanEndsAt: string | null;
}

export class StrikeError extends Error {
  constructor(
    readonly code:
      | "invalid_request"
      | "booking_not_found"
      | "booking_cancelled"
      | "booking_not_started"
      | "no_show_already_marked"
      | "no_show_not_marked"
      | "strike_not_found"
      | "strike_already_waived",
    readonly status: number,
  ) {
    super(code);
  }
}

interface MarkableBookingRow extends QueryResultRow {
  booker_id: string;
  booker_name: string;
  booker_phone: string;
  court_name: string;
  starts_at: Date;
  duration_hours: number;
  cancelled_at: Date | null;
}

interface StrikeRow extends QueryResultRow {
  id: string;
  player_id: string;
  booking_id: string;
  reason: StrikeReason;
  earned_at: Date;
  waived_at: Date | null;
  court_name: string;
  starts_at: Date;
  duration_hours: number;
  player_name: string;
  player_phone: string;
}

interface OutcomeRow extends QueryResultRow {
  strike_count: number;
  ban_ends_at: Date | null;
}

const HOUR_MS = 60 * 60 * 1000;

const STRIKE_COLUMNS = `strikes.id,
            strikes.player_id,
            strikes.booking_id,
            strikes.reason,
            strikes.earned_at,
            strikes.waived_at,
            bookings.starts_at,
            bookings.duration_hours,
            courts.name as court_name,
            players.display_name as player_name,
            players.phone as player_phone`;

const STRIKE_SOURCE = `from strikes
       join bookings on bookings.id = strikes.booking_id
       join courts on courts.id = bookings.court_id
       join players on players.id = strikes.player_id`;

// One Strike with the Booking behind it, locked: the caller is about to change
// it, so two Staff cannot waive the same Strike at once.
async function lockStrikeById(
  client: PoolClient,
  strikeId: string,
): Promise<StrikeRow | undefined> {
  const result = await client.query<StrikeRow>(
    `select ${STRIKE_COLUMNS}
       ${STRIKE_SOURCE}
      where strikes.id = $1
      for update of strikes`,
    [strikeId],
  );
  return result.rows[0];
}

function endOf(startsAt: Date, durationHours: number): Date {
  return new Date(startsAt.getTime() + durationHours * HOUR_MS);
}

function strikeFromRow(row: StrikeRow): Strike {
  return {
    id: row.id,
    playerId: row.player_id,
    bookingId: row.booking_id,
    reason: row.reason,
    earnedAt: row.earned_at.toISOString(),
    waivedAt: row.waived_at?.toISOString() ?? null,
    courtName: row.court_name,
    startsAt: row.starts_at.toISOString(),
    endsAt: endOf(row.starts_at, row.duration_hours).toISOString(),
  };
}

// Both endpoints take one id and nothing else, so one guard serves both.
function requiredId(input: unknown, field: "bookingId" | "strikeId"): string {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new StrikeError("invalid_request", 400);
  }
  const value = (input as Record<string, unknown>)[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new StrikeError("invalid_request", 400);
  }
  return value;
}

// Read inside the same transaction as the change, so the numbers describe the
// record the desk now has, not the one it had a moment ago.
async function readOutcome(
  client: PoolClient,
  player: StrikePlayer,
  now: Date,
): Promise<StrikeOutcome> {
  const result = await client.query<OutcomeRow>(
    `select current_strike_count($1, $2) as strike_count,
            booking_ban_ends_at($1, $2) as ban_ends_at`,
    [player.id, now],
  );
  const row = result.rows[0];
  return {
    player,
    strikeCount: row?.strike_count ?? 0,
    bookingBanEndsAt: row?.ban_ends_at?.toISOString() ?? null,
  };
}

function bookingDetails(
  courtName: string,
  startsAt: Date,
  durationHours: number,
  player: StrikePlayer,
): BookingAuditDetails {
  return {
    courtName,
    startsAt: startsAt.toISOString(),
    endsAt: endOf(startsAt, durationHours).toISOString(),
    bookerName: player.displayName,
    bookerPhone: player.phone,
  };
}

// A Strike is earned when Staff mark the No-show, not when the Booking started.
// The 90-day count and the 14-day ban both run from earned_at, so dating the
// Strike back to a Booking played days ago would start a ban that has already
// run out — the mark would cost the Booker nothing.
export async function markNoShow(
  staff: StaffIdentity,
  rawInput: unknown,
): Promise<{ strike: Strike } & StrikeOutcome> {
  const bookingId = requiredId(rawInput, "bookingId");
  const now = clock.now();

  return runInTransaction(async (client) => {
    const booking = await readMarkableBooking(client, bookingId, now);
    const player: StrikePlayer = {
      id: booking.booker_id,
      displayName: booking.booker_name,
      phone: booking.booker_phone,
    };

    const existing = await client.query(
      "select id from strikes where booking_id = $1 for update",
      [bookingId],
    );
    if (existing.rowCount !== 0) {
      throw new StrikeError("no_show_already_marked", 409);
    }

    const id = randomUUID();
    await client.query(
      `insert into strikes (id, player_id, booking_id, reason, earned_at)
       values ($1, $2, $3, 'no_show', $4)`,
      [id, player.id, bookingId, now],
    );
    await recordStaffAction(client, {
      staff,
      action: "no_show_marked",
      bookingId,
      blockId: null,
      subjectPlayerId: player.id,
      details: bookingDetails(
        booking.court_name,
        booking.starts_at,
        booking.duration_hours,
        player,
      ),
      occurredAt: now,
    });

    return {
      // Built from the values it was just created with: the row is in this
      // transaction, so there is nothing to read back.
      strike: {
        id,
        playerId: player.id,
        bookingId,
        reason: "no_show",
        earnedAt: now.toISOString(),
        waivedAt: null,
        courtName: booking.court_name,
        startsAt: booking.starts_at.toISOString(),
        endsAt: endOf(booking.starts_at, booking.duration_hours).toISOString(),
      },
      ...(await readOutcome(client, player, now)),
    };
  });
}

// There must be something to judge: a Booking that has started, and one that
// still stands. A cancelled Booking was never played, so it cannot be a
// No-show — a Late Cancel is the Strike that fits it.
async function readMarkableBooking(
  client: PoolClient,
  bookingId: string,
  now: Date,
): Promise<MarkableBookingRow> {
  const result = await client.query<MarkableBookingRow>(
    `select bookings.booker_id,
            bookings.starts_at,
            bookings.duration_hours,
            bookings.cancelled_at,
            players.display_name as booker_name,
            players.phone as booker_phone,
            courts.name as court_name
       from bookings
       join players on players.id = bookings.booker_id
       join courts on courts.id = bookings.court_id
      where bookings.id = $1
      for update of bookings`,
    [bookingId],
  );
  const booking = result.rows[0];
  if (!booking) {
    throw new StrikeError("booking_not_found", 404);
  }
  if (booking.cancelled_at) {
    throw new StrikeError("booking_cancelled", 409);
  }
  // "Any time after it starts" includes the start instant itself, the same
  // boundary at which the Booker's own cancellation is already refused.
  if (now.getTime() < booking.starts_at.getTime()) {
    throw new StrikeError("booking_not_started", 409);
  }
  return booking;
}

// Mistakes stay correctable: undoing deletes the Strike the mark created, so
// the Player's count drops back and any ban that only existed because of that
// Strike is gone with it.
export async function undoNoShow(
  staff: StaffIdentity,
  rawInput: unknown,
): Promise<{ bookingId: string } & StrikeOutcome> {
  const bookingId = requiredId(rawInput, "bookingId");
  const now = clock.now();

  return runInTransaction(async (client) => {
    const result = await client.query<StrikeRow>(
      `select ${STRIKE_COLUMNS}
         ${STRIKE_SOURCE}
        where strikes.booking_id = $1
          and strikes.reason = 'no_show'
        for update of strikes`,
      [bookingId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new StrikeError("no_show_not_marked", 404);
    }
    const player: StrikePlayer = {
      id: row.player_id,
      displayName: row.player_name,
      phone: row.player_phone,
    };

    await client.query("delete from strikes where id = $1", [row.id]);
    await recordStaffAction(client, {
      staff,
      action: "no_show_undone",
      bookingId,
      blockId: null,
      subjectPlayerId: player.id,
      details: bookingDetails(
        row.court_name,
        row.starts_at,
        row.duration_hours,
        player,
      ),
      occurredAt: now,
    });

    return { bookingId, ...(await readOutcome(client, player, now)) };
  });
}

// Goodwill: a waived Strike stays on the record and stops counting, so the
// Player keeps the history but not the consequence. A waiver is not undoable —
// nothing asks for that, and Staff may not need it.
export async function waiveStrike(
  staff: StaffIdentity,
  rawInput: unknown,
): Promise<{ strike: Strike } & StrikeOutcome> {
  const strikeId = requiredId(rawInput, "strikeId");
  const now = clock.now();

  return runInTransaction(async (client) => {
    const row = await lockStrikeById(client, strikeId);
    if (!row) {
      throw new StrikeError("strike_not_found", 404);
    }
    if (row.waived_at) {
      throw new StrikeError("strike_already_waived", 409);
    }
    const player: StrikePlayer = {
      id: row.player_id,
      displayName: row.player_name,
      phone: row.player_phone,
    };

    await client.query("update strikes set waived_at = $2 where id = $1", [
      strikeId,
      now,
    ]);
    await recordStaffAction(client, {
      staff,
      action: "strike_waived",
      // Every Strike belongs to exactly one Booking, so the Booking id points at
      // the Strike even after its row is gone.
      bookingId: row.booking_id,
      blockId: null,
      subjectPlayerId: player.id,
      details: {
        strikeReason: row.reason,
        earnedAt: row.earned_at.toISOString(),
        playerName: player.displayName,
        playerPhone: player.phone,
      },
      occurredAt: now,
    });

    return {
      strike: { ...strikeFromRow(row), waivedAt: now.toISOString() },
      ...(await readOutcome(client, player, now)),
    };
  });
}

// A Player's whole Strike history, newest first, waived ones included: the desk
// decides what to waive by looking at what is there.
export async function readPlayerStrikes(playerId: string): Promise<Strike[]> {
  const result = await getPool().query<StrikeRow>(
    `select ${STRIKE_COLUMNS}
       ${STRIKE_SOURCE}
      where strikes.player_id = $1
      order by strikes.earned_at desc, strikes.id desc`,
    [playerId],
  );
  return result.rows.map(strikeFromRow);
}

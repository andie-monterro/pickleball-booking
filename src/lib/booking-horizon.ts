// The Booking Horizon: how far ahead a Player may book, by standing.
// Horizon lengths are venue settings data, read here at policy-evaluation time
// so changing them in the database changes enforcement with no code change.

import type { QueryResultRow } from "pg";
import { clock } from "@/lib/clock";
import { getPool } from "@/lib/db";
import { addDays, venueDateFromInstant, type VenueDate } from "@/lib/venue-date";

export type PlayerStanding = "casual" | "member";

export interface BookingHorizon {
  standing: PlayerStanding;
  casualDays: number;
  memberDays: number;
  // Whole venue days this viewer may book, and the range they cover.
  days: number;
  firstDate: VenueDate;
  lastDate: VenueDate;
}

interface HorizonRow extends QueryResultRow {
  casual_horizon_days: number;
  member_horizon_days: number;
  member_until: string | null;
}

// Standing is judged now, from the staff-set "member until" date: a Player is a
// Member through the whole of that venue date, and a casual player after it.
// Pass no playerId for a viewer who is not signed in.
export async function readBookingHorizon(playerId?: string): Promise<BookingHorizon> {
  const result = await getPool().query<HorizonRow>(
    `select venue_settings.casual_horizon_days,
            venue_settings.member_horizon_days,
            to_char(players.member_until, 'YYYY-MM-DD') as member_until
       from venue_settings
       left join players on players.id = $1::text
      where venue_settings.id = 1`,
    [playerId ?? null],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("Venue settings are not seeded");
  }

  const firstDate = venueDateFromInstant(clock.now());
  const standing: PlayerStanding =
    row.member_until !== null && row.member_until >= firstDate.key ? "member" : "casual";
  const days = standing === "member" ? row.member_horizon_days : row.casual_horizon_days;
  return {
    standing,
    casualDays: row.casual_horizon_days,
    memberDays: row.member_horizon_days,
    days,
    firstDate,
    lastDate: addDays(firstDate, days - 1),
  };
}

export function coversVenueDate(horizon: BookingHorizon, date: VenueDate): boolean {
  return date.key >= horizon.firstDate.key && date.key <= horizon.lastDate.key;
}

export function coversInstant(horizon: BookingHorizon, at: Date): boolean {
  return coversVenueDate(horizon, venueDateFromInstant(at));
}

// The Booking Ban: 14 days without self-service booking, started whenever a new
// Strike brings a Player to 3 or more unwaived Strikes earned in the trailing 90
// days.
//
// Ban state is derived from the Strike records every time it is checked, not
// stored as a flag of its own. Waiving a Strike therefore undoes the ban that
// Strike caused, with nothing to keep in step. The derivation itself lives in
// the booking_ban_ends_at SQL function so the write path can evaluate it inside
// the transaction that creates the Booking.

import type { QueryResultRow } from "pg";
import type { Queryable } from "@/lib/booking-horizon";
import { getPool } from "@/lib/db";

interface BanRow extends QueryResultRow {
  ban_ends_at: Date | null;
}

// The instant the Player's ban runs out, or null when they are not banned. The
// ban covers up to but not including that instant: after exactly 14 days the
// Player may book again.
export async function readBookingBanEndsAt(
  playerId: string,
  at: Date,
  db: Queryable = getPool(),
): Promise<Date | null> {
  const result = await db.query<BanRow>(
    "select booking_ban_ends_at($1, $2) as ban_ends_at",
    [playerId, at],
  );
  return result.rows[0]?.ban_ends_at ?? null;
}

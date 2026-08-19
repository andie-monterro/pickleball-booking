// Venue settings are data, not code: the Courts, the per-weekday Opening Hours
// and the Booking Horizon all live in the database, so changing them changes
// what players see without a code change. This module is the only reader of
// that data.

import { getPool } from "@/lib/db";

export interface Court {
  id: number;
  name: string;
}

// The venue's bookable window for one day of week, in whole venue-local hours.
// `closesHour` is exclusive as a Slot start: hours 6..21 for 06:00–22:00.
export interface OpeningHours {
  opensHour: number;
  closesHour: number;
}

export interface BookingHorizon {
  memberDays: number;
  casualDays: number;
}

export async function readCourts(): Promise<Court[]> {
  const { rows } = await getPool().query<{ id: number; name: string }>(
    "select id, name from courts order by id",
  );
  return rows;
}

// Undefined when the venue is closed on that day of week.
export async function readOpeningHours(
  dayOfWeek: number,
): Promise<OpeningHours | undefined> {
  const { rows } = await getPool().query<{
    opens_hour: number;
    closes_hour: number;
  }>(
    "select opens_hour, closes_hour from opening_hours where day_of_week = $1",
    [dayOfWeek],
  );
  const row = rows[0];
  return row
    ? { opensHour: row.opens_hour, closesHour: row.closes_hour }
    : undefined;
}

export async function readBookingHorizon(): Promise<BookingHorizon> {
  const { rows } = await getPool().query<{
    member_horizon_days: number;
    casual_horizon_days: number;
  }>(
    "select member_horizon_days, casual_horizon_days from venue_settings where id = 1",
  );
  const row = rows[0];
  if (!row) {
    throw new Error("The venue settings row is missing");
  }
  return {
    memberDays: row.member_horizon_days,
    casualDays: row.casual_horizon_days,
  };
}

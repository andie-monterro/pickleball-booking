// The venue's Slot grid for one venue day: which Courts exist, and which whole
// hours fall inside Opening Hours. Slots are derived, not stored — only claims
// (Bookings, Blocks) are rows. The public availability read and the staff
// schedule share this grid; they differ only in what they may reveal about a
// claim.

import { getPool } from "@/lib/db";
import {
  addDays,
  venueSlotStart,
  weekdayForVenueDate,
  type VenueDate,
} from "@/lib/venue-date";

export interface VenueCourt {
  id: number;
  name: string;
}

export interface VenueGrid {
  timeZone: string;
  courts: VenueCourt[];
  // Venue-local whole hours, and the instants they start at, in the same order.
  hours: number[];
  slotStarts: Date[];
}

interface VenueSettingsRow {
  venue_time_zone: string;
}

interface OpeningHoursRow {
  start_hour: number;
  end_hour: number;
}

export async function readVenueGrid(date: VenueDate): Promise<VenueGrid> {
  const pool = getPool();
  const [settingsResult, courtsResult, openingHoursResult] = await Promise.all([
    pool.query<VenueSettingsRow>(
      "select venue_time_zone from venue_settings where id = 1",
    ),
    pool.query<VenueCourt>("select id, name from courts order by id"),
    pool.query<OpeningHoursRow>(
      "select start_hour, end_hour from opening_hours where day_of_week = $1 order by start_hour",
      [weekdayForVenueDate(date)],
    ),
  ]);

  const settings = settingsResult.rows[0];
  if (!settings) {
    throw new Error("Venue settings are not seeded");
  }

  const hours: number[] = [];
  for (const row of openingHoursResult.rows) {
    for (let hour = row.start_hour; hour < row.end_hour; hour += 1) {
      hours.push(hour);
    }
  }

  return {
    timeZone: settings.venue_time_zone,
    courts: courtsResult.rows.map((court) => ({ id: court.id, name: court.name })),
    hours,
    slotStarts: hours.map((hour) => venueSlotStart(date, hour)),
  };
}

// The half-open instant range of one venue day, for reading its claims.
export function venueDayBounds(date: VenueDate): [Date, Date] {
  return [venueSlotStart(date, 0), venueSlotStart(addDays(date, 1), 0)];
}

export function claimKey(courtId: number, start: Date): string {
  return `${courtId}|${start.toISOString()}`;
}

export function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

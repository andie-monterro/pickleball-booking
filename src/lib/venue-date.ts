// Venue-local calendar dates. Opening Hours and the Booking Horizon are
// whole-hour and whole-day rules in venue time (see
// docs/adr/0003-whole-day-booking-horizon.md), so they are evaluated against
// these dates, never against raw instants.

import { VENUE_TIME_ZONE } from "@/lib/clock";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HO_CHI_MINH_UTC_OFFSET_HOURS = 7;

const VENUE_DATE_PARTS = new Intl.DateTimeFormat("en", {
  timeZone: VENUE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export interface VenueDate {
  key: string;
  year: number;
  month: number;
  day: number;
}

export function parseVenueDate(value: string): VenueDate {
  if (!DATE_PATTERN.test(value)) {
    throw new RangeError("date must use YYYY-MM-DD");
  }
  const [year, month, day] = value.split("-").map(Number);
  const key = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
  if (key !== value) {
    throw new RangeError("date must be a real calendar date");
  }
  return { key, year, month, day };
}

export function venueDateFromInstant(at: Date): VenueDate {
  const byType: Record<string, string> = {};
  for (const part of VENUE_DATE_PARTS.formatToParts(at)) {
    byType[part.type] = part.value;
  }
  return parseVenueDate(`${byType.year}-${byType.month}-${byType.day}`);
}

export function addDays(date: VenueDate, days: number): VenueDate {
  return parseVenueDate(
    new Date(Date.UTC(date.year, date.month - 1, date.day + days)).toISOString().slice(0, 10),
  );
}

export function venueSlotStart(date: VenueDate, hour: number): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day, hour - HO_CHI_MINH_UTC_OFFSET_HOURS));
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function weekdayForVenueDate(date: VenueDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

// A whole venue hour, as the grid and the settings panel write it.
export function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

export function venueWeekdayName(dayOfWeek: number): string {
  return WEEKDAY_NAMES[dayOfWeek];
}

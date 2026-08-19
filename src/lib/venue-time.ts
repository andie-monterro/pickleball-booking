// Venue-local calendar arithmetic. Instants stay plain UTC Dates everywhere;
// this module is the only place that converts between an instant and the venue
// day and hour a human sees (see VENUE_TIME_ZONE in ./clock).

import { VENUE_TIME_ZONE } from "@/lib/clock";

// A calendar day in venue time, as "YYYY-MM-DD". Comparing two of these as
// strings compares them as dates, which the availability read model relies on.
export type VenueDate = string;

const VENUE_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const venueTimeParts = new Intl.DateTimeFormat("en-US", {
  timeZone: VENUE_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatVenueDate({ year, month, day }: CalendarDate): VenueDate {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function parseVenueDate(date: string): CalendarDate | undefined {
  const match = VENUE_DATE_PATTERN.exec(date);
  if (!match) {
    return undefined;
  }
  const candidate = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const asUtc = new Date(
    Date.UTC(candidate.year, candidate.month - 1, candidate.day),
  );
  const roundTrips =
    asUtc.getUTCFullYear() === candidate.year &&
    asUtc.getUTCMonth() + 1 === candidate.month &&
    asUtc.getUTCDate() === candidate.day;
  return roundTrips ? candidate : undefined;
}

function requireVenueDate(date: string): CalendarDate {
  const parsed = parseVenueDate(date);
  if (!parsed) {
    throw new Error(`Not a venue date: ${date}`);
  }
  return parsed;
}

export function isVenueDate(value: string): boolean {
  return parseVenueDate(value) !== undefined;
}

// How far the venue's wall clock is ahead of UTC at this instant.
function venueOffsetMs(instant: Date): number {
  const parts = venueTimeParts.formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((candidate) => candidate.type === type);
    if (!part) {
      throw new Error(`Venue time is missing its ${type} part`);
    }
    return Number(part.value);
  };
  const wallClock = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );
  return wallClock - (instant.getTime() - instant.getUTCMilliseconds());
}

// The venue day an instant falls in.
export function venueDateOf(instant: Date): VenueDate {
  const shifted = new Date(instant.getTime() + venueOffsetMs(instant));
  return formatVenueDate({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

// 0 = Sunday ... 6 = Saturday, matching the opening_hours day numbering.
export function venueDayOfWeek(date: VenueDate): number {
  const { year, month, day } = requireVenueDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function addVenueDays(date: VenueDate, days: number): VenueDate {
  const { year, month, day } = requireVenueDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return formatVenueDate({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

// The instant at which a whole hour of a venue day starts. Resolved in two
// passes so a zone whose offset changes still lands on the right instant.
export function venueHourInstant(date: VenueDate, hour: number): Date {
  const { year, month, day } = requireVenueDate(date);
  const asIfUtc = Date.UTC(year, month - 1, day, hour);
  const firstGuess = new Date(asIfUtc - venueOffsetMs(new Date(asIfUtc)));
  return new Date(asIfUtc - venueOffsetMs(firstGuess));
}

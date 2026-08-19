// The public availability read model.
//
// Slots are derived, never stored: one Court for one whole hour inside the
// venue's Opening Hours. This module joins those derived Slots with the stored
// claims on them and reports occupancy only — free, taken, blocked, or outside
// the viewer's Booking Horizon. Booker identity is never part of it, so the
// read is safe to serve to a visitor with no session.

import { clock } from "@/lib/clock";
import { getPool } from "@/lib/db";
import {
  readBookingHorizon,
  readCourts,
  readOpeningHours,
  type BookingHorizon,
  type Court,
  type OpeningHours,
} from "@/lib/settings";
import {
  addVenueDays,
  venueDateOf,
  venueDayOfWeek,
  venueHourInstant,
  type VenueDate,
} from "@/lib/venue-time";

// What a viewer may do with a Slot, and nothing more:
// - "free": nobody claims it and it is inside the viewer's Booking Horizon.
// - "taken": a Booking claims it.
// - "blocked": a Block claims it.
// - "outside_horizon": unclaimed, but the viewer cannot book it now, because
//   the Slot has already started or its day is not open for booking yet.
export type Occupancy = "free" | "taken" | "blocked" | "outside_horizon";

// The standing the horizon is measured against. An unauthenticated visitor is
// a casual player.
export type Standing = "member" | "casual";

export interface Slot {
  courtId: number;
  // The venue-local whole hour the Slot starts at, 0-23.
  hour: number;
  startsAt: string;
  occupancy: Occupancy;
}

// One day of the day strip. `memberOnly` is a property of the day, not of the
// viewer: it marks days that lie beyond the casual Booking Horizon and are
// therefore open to Members only, together with the day they open to everyone.
export interface DayStripEntry {
  date: VenueDate;
  memberOnly: boolean;
  opensToAllOn: VenueDate | null;
}

export interface Availability {
  date: VenueDate;
  today: VenueDate;
  standing: Standing;
  courts: Court[];
  hours: number[];
  slots: Slot[];
  days: DayStripEntry[];
}

export interface AvailabilityQuery {
  // Defaults to today in venue time.
  date?: VenueDate;
  // Defaults to a casual player, which is what an unauthenticated visitor is.
  standing?: Standing;
}

type ClaimKind = "booking" | "block";

export async function readAvailability(
  query: AvailabilityQuery = {},
): Promise<Availability> {
  const now = clock.now();
  const today = venueDateOf(now);
  const date = query.date ?? today;
  const standing = query.standing ?? "casual";

  const [horizon, courts, openingHours] = await Promise.all([
    readBookingHorizon(),
    readCourts(),
    readOpeningHours(venueDayOfWeek(date)),
  ]);

  const hours = hoursInside(openingHours);
  const claims = await readClaims(date, courts, hours);
  const lastBookableDate = addVenueDays(
    today,
    horizonDaysFor(standing, horizon) - 1,
  );

  const slots = courts.flatMap((court) =>
    hours.map((hour) => {
      const startsAt = venueHourInstant(date, hour);
      return {
        courtId: court.id,
        hour,
        startsAt: startsAt.toISOString(),
        occupancy: occupancyOf({
          claim: claims.get(claimKey(court.id, startsAt)),
          startsAt,
          date,
          lastBookableDate,
          now,
        }),
      };
    }),
  );

  return {
    date,
    today,
    standing,
    courts,
    hours,
    slots,
    days: dayStrip(today, horizon),
  };
}

function horizonDaysFor(
  standing: Standing,
  horizon: BookingHorizon,
): number {
  return standing === "member" ? horizon.memberDays : horizon.casualDays;
}

// Slots exist only inside Opening Hours, and only on whole hours. An hour is a
// Slot start when the whole hour fits before closing time.
function hoursInside(openingHours: OpeningHours | undefined): number[] {
  if (!openingHours) {
    return [];
  }
  const count = openingHours.closesHour - openingHours.opensHour;
  return Array.from(
    { length: count },
    (_unused, index) => openingHours.opensHour + index,
  );
}

// A claim wins over the horizon: a claimed Slot is reported as taken or
// blocked whether or not the viewer could have booked it.
function occupancyOf({
  claim,
  startsAt,
  date,
  lastBookableDate,
  now,
}: {
  claim: ClaimKind | undefined;
  startsAt: Date;
  date: VenueDate;
  lastBookableDate: VenueDate;
  now: Date;
}): Occupancy {
  if (claim === "booking") {
    return "taken";
  }
  if (claim === "block") {
    return "blocked";
  }
  // The horizon is a whole venue day: a viewer with a 7-day horizon reaches
  // today and the next six days. Once a Slot has started it can no longer be
  // booked either.
  if (startsAt.getTime() <= now.getTime() || date > lastBookableDate) {
    return "outside_horizon";
  }
  return "free";
}

function claimKey(courtId: number, startsAt: Date): string {
  return `${courtId}@${startsAt.toISOString()}`;
}

async function readClaims(
  date: VenueDate,
  courts: Court[],
  hours: number[],
): Promise<Map<string, ClaimKind>> {
  const claims = new Map<string, ClaimKind>();
  if (courts.length === 0 || hours.length === 0) {
    return claims;
  }
  const { rows } = await getPool().query<{
    court_id: number;
    starts_at: Date;
    kind: ClaimKind;
  }>(
    `select court_id, starts_at, kind from slot_claims
       where starts_at >= $1 and starts_at < $2`,
    [venueHourInstant(date, 0), venueHourInstant(addVenueDays(date, 1), 0)],
  );
  for (const row of rows) {
    claims.set(claimKey(row.court_id, row.starts_at), row.kind);
  }
  return claims;
}

// The day strip covers the member Booking Horizon. The days beyond the casual
// horizon are member-only, and each one opens to everyone on the day it enters
// the casual horizon.
function dayStrip(today: VenueDate, horizon: BookingHorizon): DayStripEntry[] {
  return Array.from({ length: horizon.memberDays }, (_unused, index) => {
    const date = addVenueDays(today, index);
    const memberOnly = index >= horizon.casualDays;
    return {
      date,
      memberOnly,
      opensToAllOn: memberOnly
        ? addVenueDays(date, -(horizon.casualDays - 1))
        : null,
    };
  });
}

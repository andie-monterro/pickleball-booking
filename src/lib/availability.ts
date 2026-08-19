import {
  coversVenueDate,
  readBookingHorizon,
  type BookingHorizon,
  type PlayerStanding,
} from "@/lib/booking-horizon";
import { clock, formatVenueTime } from "@/lib/clock";
import { getPool } from "@/lib/db";
import {
  addDays,
  parseVenueDate,
  venueDateFromInstant,
  venueSlotStart,
  weekdayForVenueDate,
  type VenueDate,
} from "@/lib/venue-date";

type ClaimKind = "booking" | "block";
export type SlotStatus = "free" | "taken" | "blocked" | "outside_horizon";
export type SlotLabel = "Free" | "Taken" | "Blocked" | "Past" | "Outside horizon";

export interface AvailabilityDay {
  date: string;
  // A fact about the day: only Members can book it yet.
  memberOnly: boolean;
  // Whether this viewer's own Booking Horizon reaches the day.
  bookable: boolean;
  opensToEveryoneOn?: string;
}

export interface AvailabilityCourt {
  id: number;
  name: string;
}

export interface AvailabilitySlot {
  courtId: number;
  courtName: string;
  hour: string;
  start: string;
  status: SlotStatus;
  label: SlotLabel;
}

export interface AvailabilityResponse {
  date: string;
  timeZone: string;
  currentVenueTime: string;
  viewer: PlayerStanding;
  horizons: {
    casualDays: number;
    memberDays: number;
  };
  days: AvailabilityDay[];
  courts: AvailabilityCourt[];
  hours: string[];
  slots: AvailabilitySlot[];
}

interface VenueSettingsRow {
  venue_time_zone: string;
}

interface OpeningHoursRow {
  start_hour: number;
  end_hour: number;
}

interface CourtRow {
  id: number;
  name: string;
}

interface ClaimRow {
  court_id: number;
  slot_starts_at: Date;
  source_kind: ClaimKind;
}

// Pass the signed-in Player's id so the read mirrors their Booking Horizon;
// without one the viewer is treated as a casual player.
export async function readAvailability(
  dateParam?: string,
  playerId?: string,
): Promise<AvailabilityResponse> {
  const pool = getPool();
  const [settings, horizon] = await Promise.all([
    readVenueSettings(),
    readBookingHorizon(playerId),
  ]);
  const now = clock.now();
  const date = normalizeDateParam(dateParam, horizon.firstDate);
  const dayOfWeek = weekdayForVenueDate(date);

  const [courtsResult, openingHoursResult] = await Promise.all([
    pool.query<CourtRow>("select id, name from courts order by id"),
    pool.query<OpeningHoursRow>(
      "select start_hour, end_hour from opening_hours where day_of_week = $1 order by start_hour",
      [dayOfWeek],
    ),
  ]);

  const courts = courtsResult.rows.map((court) => ({ id: court.id, name: court.name }));
  const hours = hoursFor(openingHoursResult.rows);
  const slotStarts = hours.map((hour) => venueSlotStart(date, hour));
  const claims = await readClaims(date, slotStarts);
  const claimByCourtAndStart = new Map<string, ClaimKind>();

  for (const claim of claims) {
    claimByCourtAndStart.set(claimKey(claim.court_id, claim.slot_starts_at), claim.source_kind);
  }

  const insideHorizon = coversVenueDate(horizon, date);
  const slots = courts.flatMap((court) =>
    slotStarts.map((start, index) => {
      const status = slotStatus(insideHorizon, claimByCourtAndStart.get(claimKey(court.id, start)));
      return {
        courtId: court.id,
        courtName: court.name,
        hour: formatHour(hours[index]),
        start: start.toISOString(),
        status,
        label: slotLabel(status, start, now),
      };
    }),
  );

  return {
    date: date.key,
    timeZone: settings.venue_time_zone,
    currentVenueTime: formatVenueTime(now),
    viewer: horizon.standing,
    horizons: {
      casualDays: horizon.casualDays,
      memberDays: horizon.memberDays,
    },
    days: dayStrip(horizon),
    courts,
    hours: hours.map(formatHour),
    slots,
  };
}

async function readVenueSettings(): Promise<VenueSettingsRow> {
  const result = await getPool().query<VenueSettingsRow>(
    "select venue_time_zone from venue_settings where id = 1",
  );
  const settings = result.rows[0];
  if (!settings) {
    throw new Error("Venue settings are not seeded");
  }
  return settings;
}

async function readClaims(date: VenueDate, slotStarts: Date[]): Promise<ClaimRow[]> {
  if (slotStarts.length === 0) {
    return [];
  }

  const dayStart = venueSlotStart(date, 0);
  const nextDayStart = venueSlotStart(addDays(date, 1), 0);
  const result = await getPool().query<ClaimRow>(
    `select court_id, slot_starts_at, source_kind
     from slot_claims
     where slot_starts_at >= $1 and slot_starts_at < $2`,
    [dayStart, nextDayStart],
  );
  return result.rows;
}

function normalizeDateParam(dateParam: string | undefined, fallback: VenueDate): VenueDate {
  if (dateParam === undefined || dateParam === "") {
    return fallback;
  }
  return parseVenueDate(dateParam);
}

// The strip always spans the member horizon. A day past the casual horizon is
// member-only, and carries the venue date at whose start it opens to casual
// players; whether this viewer may book it depends on their own standing.
function dayStrip(horizon: BookingHorizon): AvailabilityDay[] {
  return Array.from({ length: horizon.memberDays }, (_, index) => {
    const date = addDays(horizon.firstDate, index);
    const bookable = index < horizon.days;
    if (index < horizon.casualDays) {
      return { date: date.key, memberOnly: false, bookable };
    }
    return {
      date: date.key,
      memberOnly: true,
      bookable,
      opensToEveryoneOn: addDays(date, 1 - horizon.casualDays).key,
    };
  });
}

function hoursFor(rows: OpeningHoursRow[]): number[] {
  const hours: number[] = [];
  for (const row of rows) {
    for (let hour = row.start_hour; hour < row.end_hour; hour += 1) {
      hours.push(hour);
    }
  }
  return hours;
}

function slotStatus(insideHorizon: boolean, claim: ClaimKind | undefined): SlotStatus {
  if (!insideHorizon) {
    return "outside_horizon";
  }
  if (claim === "booking") {
    return "taken";
  }
  if (claim === "block") {
    return "blocked";
  }
  return "free";
}

function slotLabel(status: SlotStatus, start: Date, now: Date): SlotLabel {
  if (status === "taken") {
    return "Taken";
  }
  if (status === "blocked") {
    return "Blocked";
  }
  if (status === "free") {
    return start < now ? "Past" : "Free";
  }
  return "Outside horizon";
}

function claimKey(courtId: number, start: Date): string {
  return `${courtId}|${start.toISOString()}`;
}

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

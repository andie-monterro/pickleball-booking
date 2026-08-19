import { clock, VENUE_TIME_ZONE } from "@/lib/clock";
import { getPool } from "@/lib/db";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HO_CHI_MINH_UTC_OFFSET_HOURS = 7;

type ClaimKind = "booking" | "block";
export type SlotStatus = "free" | "taken" | "blocked" | "outside_horizon";
export type SlotLabel = "Free" | "Taken" | "Blocked" | "Past" | "Outside horizon";

export interface AvailabilityDay {
  date: string;
  memberOnly: boolean;
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
  viewer: "casual";
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
  casual_horizon_days: number;
  member_horizon_days: number;
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

interface VenueDate {
  key: string;
  year: number;
  month: number;
  day: number;
}

export async function readAvailability(dateParam?: string): Promise<AvailabilityResponse> {
  const pool = getPool();
  const settings = await readVenueSettings();
  const now = clock.now();
  const today = venueDateFromInstant(now);
  const date = normalizeDateParam(dateParam, today);
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
  const slotStarts = hours.map((hour) => localSlotStart(date, hour));
  const claims = await readClaims(date, slotStarts);
  const claimByCourtAndStart = new Map<string, ClaimKind>();

  for (const claim of claims) {
    claimByCourtAndStart.set(claimKey(claim.court_id, claim.slot_starts_at), claim.source_kind);
  }

  const casualHorizonEnd = new Date(now.getTime() + settings.casual_horizon_days * 86_400_000);
  const slots = courts.flatMap((court) =>
    slotStarts.map((start, index) => {
      const status = slotStatus(start, now, casualHorizonEnd, claimByCourtAndStart.get(claimKey(court.id, start)));
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
    viewer: "casual",
    horizons: {
      casualDays: settings.casual_horizon_days,
      memberDays: settings.member_horizon_days,
    },
    days: dayStrip(today, settings.casual_horizon_days, settings.member_horizon_days),
    courts,
    hours: hours.map(formatHour),
    slots,
  };
}

async function readVenueSettings(): Promise<VenueSettingsRow> {
  const result = await getPool().query<VenueSettingsRow>(
    "select venue_time_zone, casual_horizon_days, member_horizon_days from venue_settings where id = 1",
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

  const dayStart = localSlotStart(date, 0);
  const nextDayStart = localSlotStart(addDays(date, 1), 0);
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

function venueDateFromInstant(date: Date): VenueDate {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: VENUE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType: Record<string, string> = {};
  for (const part of parts) {
    byType[part.type] = part.value;
  }
  return parseVenueDate(`${byType.year}-${byType.month}-${byType.day}`);
}

function parseVenueDate(value: string): VenueDate {
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

function dayStrip(today: VenueDate, casualDays: number, memberDays: number): AvailabilityDay[] {
  return Array.from({ length: memberDays }, (_, index) => {
    const date = addDays(today, index);
    if (index < casualDays) {
      return { date: date.key, memberOnly: false };
    }
    return {
      date: date.key,
      memberOnly: true,
      opensToEveryoneOn: addDays(date, -casualDays).key,
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

function slotStatus(
  start: Date,
  now: Date,
  casualHorizonEnd: Date,
  claim: ClaimKind | undefined,
): SlotStatus {
  if (claim === "booking") {
    return "taken";
  }
  if (claim === "block") {
    return "blocked";
  }
  if (start <= now || start > casualHorizonEnd) {
    return "outside_horizon";
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
    return "Free";
  }
  return start <= now ? "Past" : "Outside horizon";
}

function claimKey(courtId: number, start: Date): string {
  return `${courtId}|${start.toISOString()}`;
}

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

function localSlotStart(date: VenueDate, hour: number): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day, hour - HO_CHI_MINH_UTC_OFFSET_HOURS));
}

function weekdayForVenueDate(date: VenueDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function addDays(date: VenueDate, days: number): VenueDate {
  return parseVenueDate(new Date(Date.UTC(date.year, date.month - 1, date.day + days)).toISOString().slice(0, 10));
}

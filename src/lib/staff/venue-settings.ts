// Venue settings: the data that says how this venue runs — which Courts exist,
// which whole hours they are open, and how far ahead each standing may book.
//
// Settings are data, not code. Every read that builds the grid or judges a
// Booking reads them at the moment it runs, so a change here takes effect on
// the next request with nothing to redeploy and no cache to clear.
//
// A change that would strand a Booking is refused whole, the same rule Blocks
// already follow: a Court holding Bookings cannot be deactivated, and Opening
// Hours cannot shrink past a Booking that is still to be played. Staff cancel
// those Bookings explicitly first, so no player's Booking silently disappears.

import type { PoolClient, QueryResultRow } from "pg";
import {
  recordStaffAction,
  type CourtAuditDetails,
  type StaffIdentity,
} from "@/lib/audit-log";
import { clock } from "@/lib/clock";
import { getPool, isUniqueViolation, runInTransaction } from "@/lib/db";
import { formatHour } from "@/lib/venue-date";

const MAX_COURT_NAME_LENGTH = 60;

const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6];

// A horizon longer than a year is a typo, not a policy: the day strip draws one
// cell per Member day, and nobody plans a pickleball game two years out.
const MAX_HORIZON_DAYS = 365;

export interface ManagedCourt {
  id: number;
  name: string;
  // False once Staff took the Court out of booking. It stays on this list, so
  // the desk can bring it back; it is gone from every availability grid.
  active: boolean;
}

// One venue weekday. Null hours mean the venue is closed that day, so the day
// has no Slots at all. Opening Hours are whole hours of one day: end 24 is
// midnight at the end of it, and a day that runs past midnight is not a thing
// this venue does.
export interface DayOpeningHours {
  dayOfWeek: number;
  startHour: number | null;
  endHour: number | null;
}

// How far ahead each standing may book, in whole venue days. A Member always
// reaches at least as far as a casual player — that is what the membership
// buys.
export interface HorizonSettings {
  casualHorizonDays: number;
  memberHorizonDays: number;
}

export class VenueSettingsError extends Error {
  constructor(
    readonly code:
      | "invalid_request"
      | "court_not_found"
      | "court_name_taken"
      | "court_has_bookings"
      | "bookings_outside_new_hours",
    readonly status: number,
  ) {
    super(code);
  }
}

interface CourtRow extends QueryResultRow {
  id: number;
  name: string;
  deactivated_at: Date | null;
}

interface OpeningHoursRow extends QueryResultRow {
  day_of_week: number;
  start_hour: number;
  end_hour: number;
}

interface HorizonRow extends QueryResultRow {
  casual_horizon_days: number;
  member_horizon_days: number;
}

interface CountRow extends QueryResultRow {
  booking_count: number;
}

function courtFromRow(row: CourtRow): ManagedCourt {
  return { id: row.id, name: row.name, active: row.deactivated_at === null };
}

function requestBodyRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new VenueSettingsError("invalid_request", 400);
  }
  return { ...input };
}

// Settings are whole numbers in a fixed range — an hour of the day, a weekday,
// a count of days. One guard for all of them, so a parser reads as its rule.
function isWholeNumberIn(value: unknown, low: number, high: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= low && value <= high;
}

function normalizedCourtName(value: unknown): string {
  if (typeof value !== "string") {
    throw new VenueSettingsError("invalid_request", 400);
  }
  const name = value.trim();
  if (name.length === 0 || name.length > MAX_COURT_NAME_LENGTH) {
    throw new VenueSettingsError("invalid_request", 400);
  }
  return name;
}

// Staff see every Court, deactivated ones included: the list is where a Court
// comes back from. The public grid reads only the active ones.
export async function readManagedCourts(): Promise<ManagedCourt[]> {
  const result = await getPool().query<CourtRow>(
    "select id, name, deactivated_at from courts order by id",
  );
  return result.rows.map(courtFromRow);
}

export async function addCourt(
  staff: StaffIdentity,
  rawInput: unknown,
): Promise<ManagedCourt> {
  const name = normalizedCourtName(requestBodyRecord(rawInput).name);
  const now = clock.now();

  try {
    return await runInTransaction(async (client) => {
      const inserted = await client.query<CourtRow>(
        "insert into courts (name) values ($1) returning id, name, deactivated_at",
        [name],
      );
      const court = courtFromRow(inserted.rows[0]);
      await recordCourtAction(client, staff, "court_added", { court: court.name }, now);
      return court;
    });
  } catch (error) {
    // Court names are unique: two Courts called the same thing would leave the
    // desk unable to say which one a Booking is on.
    if (isUniqueViolation(error)) {
      throw new VenueSettingsError("court_name_taken", 409);
    }
    throw error;
  }
}

// One request carries the changes Staff made to one Court: a new name, a new
// standing, or both. Each change is its own Audit Log entry, because each is
// its own thing to explain later.
export async function updateCourt(
  staff: StaffIdentity,
  rawInput: unknown,
): Promise<ManagedCourt> {
  const record = requestBodyRecord(rawInput);
  const courtId = record.courtId;
  if (
    !isWholeNumberIn(courtId, 1, Number.MAX_SAFE_INTEGER) ||
    (record.active !== undefined && typeof record.active !== "boolean")
  ) {
    throw new VenueSettingsError("invalid_request", 400);
  }
  const name = record.name === undefined ? undefined : normalizedCourtName(record.name);
  const active = typeof record.active === "boolean" ? record.active : undefined;
  const now = clock.now();

  try {
    return await runInTransaction(async (client) => {
      const found = await client.query<CourtRow>(
        "select id, name, deactivated_at from courts where id = $1 for update",
        [courtId],
      );
      const existing = found.rows[0];
      if (!existing) {
        throw new VenueSettingsError("court_not_found", 404);
      }
      let court = courtFromRow(existing);

      if (name !== undefined && name !== court.name) {
        await client.query("update courts set name = $2 where id = $1", [court.id, name]);
        await recordCourtAction(
          client,
          staff,
          "court_renamed",
          { court: name, previousCourt: court.name },
          now,
        );
        court = { ...court, name };
      }

      if (active !== undefined && active !== court.active) {
        if (!active) {
          await refuseWhileBookingsStand(client, court.id, now);
        }
        await client.query("update courts set deactivated_at = $2 where id = $1", [
          court.id,
          active ? null : now,
        ]);
        await recordCourtAction(
          client,
          staff,
          active ? "court_reactivated" : "court_deactivated",
          { court: court.name },
          now,
        );
        court = { ...court, active };
      }

      return court;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new VenueSettingsError("court_name_taken", 409);
    }
    throw error;
  }
}

// A Court that still holds Bookings cannot be taken out of the grid: the
// Booking would stay valid and stop being visible anywhere, and the player
// would turn up to a court nobody at the desk can see. Bookings already played
// do not stand in the way.
async function refuseWhileBookingsStand(
  client: PoolClient,
  courtId: number,
  now: Date,
): Promise<void> {
  const result = await client.query<CountRow>(
    `select count(*)::integer as booking_count
       from slot_claims
      where slot_claims.court_id = $1
        and slot_claims.source_kind = 'booking'
        and slot_claims.slot_starts_at >= $2`,
    [courtId, now],
  );
  if (result.rows[0].booking_count > 0) {
    throw new VenueSettingsError("court_has_bookings", 409);
  }
}

async function recordCourtAction(
  client: PoolClient,
  staff: StaffIdentity,
  action: "court_added" | "court_renamed" | "court_deactivated" | "court_reactivated",
  details: CourtAuditDetails,
  occurredAt: Date,
): Promise<void> {
  await recordStaffAction(client, {
    staff,
    action,
    bookingId: null,
    blockId: null,
    subjectPlayerId: null,
    details,
    occurredAt,
  });
}

// Every weekday, closed ones included: the panel edits a fixed week, so a day
// with no hours has to be there to be given some. A weekday carries one range,
// which is what setOpeningHours leaves behind; a day with several takes the
// earliest, so a hand-written extra range cannot hide the day's opening time.
export async function readOpeningHours(): Promise<DayOpeningHours[]> {
  const result = await getPool().query<OpeningHoursRow>(
    "select day_of_week, start_hour, end_hour from opening_hours order by day_of_week, start_hour",
  );
  const byDay = new Map(result.rows.map((row) => [row.day_of_week, row]));
  return DAYS_OF_WEEK.map((dayOfWeek) => {
    const row = byDay.get(dayOfWeek);
    return {
      dayOfWeek,
      startHour: row ? row.start_hour : null,
      endHour: row ? row.end_hour : null,
    };
  });
}

function parseOpeningHours(input: unknown): DayOpeningHours {
  const record = requestBodyRecord(input);
  const { dayOfWeek, startHour, endHour } = record;
  if (!isWholeNumberIn(dayOfWeek, 0, 6)) {
    throw new VenueSettingsError("invalid_request", 400);
  }
  // A closed day is both hours left out; one of the two alone says nothing.
  if (startHour === null && endHour === null) {
    return { dayOfWeek, startHour: null, endHour: null };
  }
  // End 24 is midnight at the end of the day, and closing must come after
  // opening: a weekday's hours never run past its own midnight.
  if (
    !isWholeNumberIn(startHour, 0, 23) ||
    !isWholeNumberIn(endHour, 1, 24) ||
    startHour >= endHour
  ) {
    throw new VenueSettingsError("invalid_request", 400);
  }
  return { dayOfWeek, startHour, endHour };
}

function openingHoursLabel(hours: DayOpeningHours): string | null {
  if (hours.startHour === null || hours.endHour === null) {
    return null;
  }
  return `${formatHour(hours.startHour)}-${formatHour(hours.endHour)}`;
}

// One weekday at a time: the venue answers "when are you open on a Tuesday?",
// and the whole day is replaced, so a weekday always has one range or none.
export async function setOpeningHours(
  staff: StaffIdentity,
  rawInput: unknown,
): Promise<DayOpeningHours> {
  const hours = parseOpeningHours(rawInput);
  const now = clock.now();

  return runInTransaction(async (client) => {
    const existing = await client.query<OpeningHoursRow>(
      `select day_of_week, start_hour, end_hour
         from opening_hours
        where day_of_week = $1
        order by start_hour
        for update`,
      [hours.dayOfWeek],
    );
    const previous: DayOpeningHours = existing.rows[0]
      ? {
          dayOfWeek: hours.dayOfWeek,
          startHour: existing.rows[0].start_hour,
          endHour: existing.rows[0].end_hour,
        }
      : { dayOfWeek: hours.dayOfWeek, startHour: null, endHour: null };

    await refuseWhileBookingsFallOutside(client, hours, now);
    await client.query("delete from opening_hours where day_of_week = $1", [
      hours.dayOfWeek,
    ]);
    if (hours.startHour !== null && hours.endHour !== null) {
      await client.query(
        "insert into opening_hours (day_of_week, start_hour, end_hour) values ($1, $2, $3)",
        [hours.dayOfWeek, hours.startHour, hours.endHour],
      );
    }

    await recordStaffAction(client, {
      staff,
      action: "opening_hours_changed",
      bookingId: null,
      blockId: null,
      subjectPlayerId: null,
      details: {
        weekday: hours.dayOfWeek,
        openingHours: openingHoursLabel(hours),
        previousOpeningHours: openingHoursLabel(previous),
      },
      occurredAt: now,
    });
    return hours;
  });
}

// Slots exist only inside Opening Hours, so hours that no longer cover a
// Booking would take that Booking off every grid while it still stands. The
// change is refused whole; Staff cancel those Bookings first. Bookings already
// played do not stand in the way.
async function refuseWhileBookingsFallOutside(
  client: PoolClient,
  hours: DayOpeningHours,
  now: Date,
): Promise<void> {
  const result = await client.query<CountRow>(
    `select count(*)::integer as booking_count
       from slot_claims
       join venue_settings on venue_settings.id = 1
      where slot_claims.source_kind = 'booking'
        and slot_claims.slot_starts_at >= $1
        and extract(
              dow from slot_claims.slot_starts_at
                at time zone venue_settings.venue_time_zone
            ) = $2
        and ($3::integer is null
             or extract(
                  hour from slot_claims.slot_starts_at
                    at time zone venue_settings.venue_time_zone
                ) < $3
             or extract(
                  hour from slot_claims.slot_starts_at
                    at time zone venue_settings.venue_time_zone
                ) >= $4)`,
    [now, hours.dayOfWeek, hours.startHour, hours.endHour],
  );
  if (result.rows[0].booking_count > 0) {
    throw new VenueSettingsError("bookings_outside_new_hours", 409);
  }
}

export async function readHorizonSettings(): Promise<HorizonSettings> {
  const result = await getPool().query<HorizonRow>(
    "select casual_horizon_days, member_horizon_days from venue_settings where id = 1",
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("Venue settings are not seeded");
  }
  return {
    casualHorizonDays: row.casual_horizon_days,
    memberHorizonDays: row.member_horizon_days,
  };
}

function parseHorizonSettings(input: unknown): HorizonSettings {
  const { casualHorizonDays, memberHorizonDays } = requestBodyRecord(input);
  if (
    !isWholeNumberIn(casualHorizonDays, 1, MAX_HORIZON_DAYS) ||
    !isWholeNumberIn(memberHorizonDays, 1, MAX_HORIZON_DAYS) ||
    memberHorizonDays < casualHorizonDays
  ) {
    throw new VenueSettingsError("invalid_request", 400);
  }
  return { casualHorizonDays, memberHorizonDays };
}

// Both horizons move together, because the rule that a Member reaches at least
// as far as a casual player is about the pair, not about either one.
export async function setHorizonSettings(
  staff: StaffIdentity,
  rawInput: unknown,
): Promise<HorizonSettings> {
  const horizons = parseHorizonSettings(rawInput);
  const now = clock.now();

  return runInTransaction(async (client) => {
    const previous = await client.query<HorizonRow>(
      `select casual_horizon_days, member_horizon_days
         from venue_settings
        where id = 1
          for update`,
    );
    const row = previous.rows[0];
    if (!row) {
      throw new Error("Venue settings are not seeded");
    }
    await client.query(
      `update venue_settings
          set casual_horizon_days = $1, member_horizon_days = $2
        where id = 1`,
      [horizons.casualHorizonDays, horizons.memberHorizonDays],
    );

    await recordStaffAction(client, {
      staff,
      action: "booking_horizons_changed",
      bookingId: null,
      blockId: null,
      subjectPlayerId: null,
      details: {
        ...horizons,
        previousCasualHorizonDays: row.casual_horizon_days,
        previousMemberHorizonDays: row.member_horizon_days,
      },
      occurredAt: now,
    });
    return horizons;
  });
}

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

const MAX_COURT_NAME_LENGTH = 60;

export interface ManagedCourt {
  id: number;
  name: string;
  // False once Staff took the Court out of booking. It stays on this list, so
  // the desk can bring it back; it is gone from every availability grid.
  active: boolean;
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
  if (
    !Number.isInteger(record.courtId) ||
    (record.active !== undefined && typeof record.active !== "boolean")
  ) {
    throw new VenueSettingsError("invalid_request", 400);
  }
  const courtId = Number(record.courtId);
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

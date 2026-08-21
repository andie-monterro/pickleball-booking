// The claim mechanism every occupier of a Slot shares. A Booking and a Block
// both take Slots the same way: one slot_claims row per (Court, Slot start),
// under a uniqueness constraint. No-double-booking is that constraint, not
// application logic — two racing claims are resolved by the database, and the
// loser sees a unique violation.
//
// This module owns the SQL of a claim, not the policy around it. Callers decide
// which of their own errors a missing Court or a taken Slot means.

import type { PoolClient, QueryResultRow } from "pg";

const UNIQUE_VIOLATION = "23505";

export type ClaimKind = "booking" | "block";

export interface ClaimRange {
  courtId: number;
  startsAt: Date;
  slotCount: number;
}

export interface ClaimableCourt {
  name: string;
  // How many hours of the range are real Slots: inside that venue day's Opening
  // Hours. Fewer than the range asked for means the range runs outside them.
  openSlotCount: number;
}

interface ClaimableCourtRow extends QueryResultRow {
  name: string;
  open_slot_count: number;
}

// Slots are derived, not stored: an hour is a Slot only if it falls inside the
// Opening Hours of its venue day. Undefined means there is no such Court.
export async function readClaimableCourt(
  client: PoolClient,
  range: ClaimRange,
): Promise<ClaimableCourt | undefined> {
  const result = await client.query<ClaimableCourtRow>(
    `select courts.name,
            (select count(*)::integer
               from generate_series(0, $3::integer - 1) as slot(slot_number)
              where exists (
                select 1
                  from venue_settings
                  join opening_hours
                    on opening_hours.day_of_week = extract(
                      dow from ($2::timestamptz + slot.slot_number * interval '1 hour')
                        at time zone venue_settings.venue_time_zone
                    )
                 where venue_settings.id = 1
                   and extract(
                     hour from ($2::timestamptz + slot.slot_number * interval '1 hour')
                       at time zone venue_settings.venue_time_zone
                   ) >= opening_hours.start_hour
                   and extract(
                     hour from ($2::timestamptz + slot.slot_number * interval '1 hour')
                       at time zone venue_settings.venue_time_zone
                   ) < opening_hours.end_hour
              )) as open_slot_count
       from courts
      where courts.id = $1`,
    [range.courtId, range.startsAt, range.slotCount],
  );
  const row = result.rows[0];
  return row ? { name: row.name, openSlotCount: row.open_slot_count } : undefined;
}

// One statement for the whole range, so a range that loses any one of its Slots
// claims none of them.
export async function claimSlots(
  client: PoolClient,
  range: ClaimRange,
  kind: ClaimKind,
  sourceId: string,
): Promise<void> {
  await client.query(
    `insert into slot_claims (court_id, slot_starts_at, source_kind, source_id)
     select $1, $2::timestamptz + slot.slot_number * interval '1 hour', $3, $4
       from generate_series(0, $5::integer - 1) as slot(slot_number)`,
    [range.courtId, range.startsAt, kind, sourceId, range.slotCount],
  );
}

// The Slots reopen for booking immediately.
export async function releaseSlots(
  client: PoolClient,
  kind: ClaimKind,
  sourceId: string,
): Promise<void> {
  await client.query(
    `delete from slot_claims
      where source_kind = $1
        and source_id = $2`,
    [kind, sourceId],
  );
}

export function isSlotTaken(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === UNIQUE_VIOLATION;
}

export function slotRangeEnd(range: ClaimRange): Date {
  return new Date(range.startsAt.getTime() + range.slotCount * 60 * 60 * 1000);
}

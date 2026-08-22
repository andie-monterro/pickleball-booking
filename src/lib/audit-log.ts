// The Audit Log: an append-only record of what Staff did, when, and to whom,
// so disputes stay resolvable. Every staff mutation writes one entry inside the
// same transaction as the change it describes — the change and its record land
// together or not at all.

import { randomUUID } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import { getPool } from "@/lib/db";

export type AuditAction =
  | "booking_created"
  | "booking_cancelled"
  | "block_placed"
  | "block_removed"
  | "staff_account_created"
  | "staff_account_deactivated"
  | "no_show_marked"
  | "no_show_undone"
  | "strike_waived"
  | "court_added"
  | "court_renamed"
  | "court_deactivated"
  | "court_reactivated"
  | "opening_hours_changed"
  | "booking_horizons_changed"
  | "membership_changed";

// Who acted. Only the id and the name are needed, so any Staff session value
// fits, and the log keeps the name as it read at the time.
export interface StaffIdentity {
  id: string;
  displayName: string;
}

// An entry stays readable on its own, years later, whether or not the records it
// describes still exist. What it snapshots depends on the action, so details is
// a union: the Slots an action took — a Booking or a Block, and a Block has no
// Booker — the name and phone of the Staff account granted or revoked, or the
// Strike a waiver let go. Readers tell them apart by the fields, not by the
// action, so a details shape can never be read as the wrong one.
export interface BookingAuditDetails {
  courtName: string;
  startsAt: string;
  endsAt: string;
  bookerName?: string;
  bookerPhone?: string;
}

export interface StaffAccountAuditDetails {
  accountName: string;
  accountPhone: string;
}

// A waived Strike is identified by what it was for, not by its row: the row may
// be deleted later (undoing a No-show mark does exactly that), and the entry
// still has to read the same.
export interface StrikeAuditDetails {
  strikeReason: "late_cancel" | "no_show";
  earnedAt: string;
  playerName: string;
  playerPhone: string;
}

// Venue settings are data Staff edit, so each change snapshots the value it
// left behind next to the one it put there: the entry says what changed, not
// only that something did. A Court is named rather than referenced, so a later
// rename cannot rewrite what an older entry says.
export interface CourtAuditDetails {
  court: string;
  previousCourt?: string;
}

export interface OpeningHoursAuditDetails {
  weekday: number;
  // Venue-local whole hours as "06:00-22:00", or null for a closed day.
  openingHours: string | null;
  previousOpeningHours: string | null;
}

export interface HorizonAuditDetails {
  casualHorizonDays: number;
  memberHorizonDays: number;
  previousCasualHorizonDays: number;
  previousMemberHorizonDays: number;
}

export interface MembershipAuditDetails {
  playerName: string;
  playerPhone: string;
  // The staff-set last venue date of membership, null for a casual player.
  memberUntil: string | null;
  previousMemberUntil: string | null;
}

export type AuditEntryDetails =
  | BookingAuditDetails
  | StaffAccountAuditDetails
  | StrikeAuditDetails
  | CourtAuditDetails
  | OpeningHoursAuditDetails
  | HorizonAuditDetails
  | MembershipAuditDetails;

export interface AuditEntry {
  id: string;
  action: AuditAction;
  occurredAt: string;
  staff: StaffIdentity;
  bookingId: string | null;
  blockId: string | null;
  subjectPlayerId: string | null;
  details: AuditEntryDetails;
}

interface AuditEntryRow extends QueryResultRow {
  id: string;
  staff_id: string;
  staff_display_name: string;
  action: AuditAction;
  booking_id: string | null;
  block_id: string | null;
  subject_player_id: string | null;
  details: AuditEntryDetails;
  occurred_at: Date;
}

interface RecordedActionBase {
  staff: StaffIdentity;
  bookingId: string | null;
  blockId: string | null;
  subjectPlayerId: string | null;
  occurredAt: Date;
}

// What a staff mutation may write: the action fixes which details go with it, so
// a Booking action cannot be logged with a Staff account's details.
export type RecordedAction = RecordedActionBase &
  (
    | {
        action:
          | "booking_created"
          | "booking_cancelled"
          | "block_placed"
          | "block_removed"
          | "no_show_marked"
          | "no_show_undone";
        details: BookingAuditDetails;
      }
    | {
        action: "staff_account_created" | "staff_account_deactivated";
        details: StaffAccountAuditDetails;
      }
    | {
        action: "strike_waived";
        details: StrikeAuditDetails;
      }
    | {
        action:
          | "court_added"
          | "court_renamed"
          | "court_deactivated"
          | "court_reactivated";
        details: CourtAuditDetails;
      }
    | {
        action: "opening_hours_changed";
        details: OpeningHoursAuditDetails;
      }
    | {
        action: "booking_horizons_changed";
        details: HorizonAuditDetails;
      }
    | {
        action: "membership_changed";
        details: MembershipAuditDetails;
      }
  );

export async function recordStaffAction(
  client: PoolClient,
  entry: RecordedAction,
): Promise<void> {
  await client.query(
    `insert into audit_log_entries
       (id, staff_id, staff_display_name, action, booking_id, block_id,
        subject_player_id, details, occurred_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      randomUUID(),
      entry.staff.id,
      entry.staff.displayName,
      entry.action,
      entry.bookingId,
      entry.blockId,
      entry.subjectPlayerId,
      JSON.stringify(entry.details),
      entry.occurredAt,
    ],
  );
}

// Newest first: the desk reads the log to answer "what just happened?". The log
// only grows, so a read is capped.
export async function readAuditLog(limit = 200): Promise<AuditEntry[]> {
  const result = await getPool().query<AuditEntryRow>(
    `select id, staff_id, staff_display_name, action, booking_id, block_id,
            subject_player_id, details, occurred_at
       from audit_log_entries
      order by occurred_at desc, id desc
      limit $1`,
    [limit],
  );
  return result.rows.map((row) => ({
    id: row.id,
    action: row.action,
    occurredAt: row.occurred_at.toISOString(),
    // The name is the snapshot taken when the action happened, so a later
    // rename cannot rewrite history.
    staff: { id: row.staff_id, displayName: row.staff_display_name },
    bookingId: row.booking_id,
    blockId: row.block_id,
    subjectPlayerId: row.subject_player_id,
    details: row.details,
  }));
}

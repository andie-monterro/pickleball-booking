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
  | "staff_account_created"
  | "staff_account_deactivated";

// Who acted. Only the id and the name are needed, so any Staff session value
// fits, and the log keeps the name as it read at the time.
export interface StaffIdentity {
  id: string;
  displayName: string;
}

// An entry stays readable on its own, so it snapshots what the action was
// about. What that is depends on the action, so details is a union: a Booking's
// court, time and Booker, or the name and phone of the Staff account granted or
// revoked. Readers tell them apart by the fields, not by the action, so a
// details shape can never be read as the wrong one.
export interface BookingAuditDetails {
  courtName: string;
  startsAt: string;
  endsAt: string;
  bookerName: string;
  bookerPhone: string;
}

export interface StaffAccountAuditDetails {
  accountName: string;
  accountPhone: string;
}

export type AuditEntryDetails = BookingAuditDetails | StaffAccountAuditDetails;

export interface AuditEntry {
  id: string;
  action: AuditAction;
  occurredAt: string;
  staff: StaffIdentity;
  bookingId: string | null;
  subjectPlayerId: string | null;
  details: AuditEntryDetails;
}

interface AuditEntryRow extends QueryResultRow {
  id: string;
  staff_id: string;
  staff_display_name: string;
  action: AuditAction;
  booking_id: string | null;
  subject_player_id: string | null;
  details: AuditEntryDetails;
  occurred_at: Date;
}

interface RecordedActionBase {
  staff: StaffIdentity;
  bookingId: string | null;
  subjectPlayerId: string | null;
  occurredAt: Date;
}

// What a staff mutation may write: the action fixes which details go with it, so
// a Booking action cannot be logged with a Staff account's details.
export type RecordedAction = RecordedActionBase &
  (
    | {
        action: "booking_created" | "booking_cancelled";
        details: BookingAuditDetails;
      }
    | {
        action: "staff_account_created" | "staff_account_deactivated";
        details: StaffAccountAuditDetails;
      }
  );

export async function recordStaffAction(
  client: PoolClient,
  entry: RecordedAction,
): Promise<void> {
  await client.query(
    `insert into audit_log_entries
       (id, staff_id, staff_display_name, action, booking_id,
        subject_player_id, details, occurred_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      randomUUID(),
      entry.staff.id,
      entry.staff.displayName,
      entry.action,
      entry.bookingId,
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
    `select id, staff_id, staff_display_name, action, booking_id,
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
    subjectPlayerId: row.subject_player_id,
    details: row.details,
  }));
}

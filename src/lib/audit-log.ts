// The Audit Log: an append-only record of what Staff did, when, and to whom,
// so disputes stay resolvable. Every staff mutation writes one entry inside the
// same transaction as the change it describes — the change and its record land
// together or not at all.

import { randomUUID } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import { getPool } from "@/lib/db";

export type AuditAction = "booking_created" | "booking_cancelled";

export interface AuditEntryDetails {
  courtName: string;
  startsAt: string;
  endsAt: string;
  bookerName: string;
  bookerPhone: string;
}

export interface AuditEntry {
  id: string;
  action: AuditAction;
  occurredAt: string;
  staff: { id: string; displayName: string };
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

export interface RecordedAction {
  staff: { id: string; displayName: string };
  action: AuditAction;
  bookingId: string | null;
  subjectPlayerId: string | null;
  details: AuditEntryDetails;
  occurredAt: Date;
}

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

// Newest first: the desk reads the log to answer "what just happened?".
export async function readAuditLog(): Promise<AuditEntry[]> {
  const result = await getPool().query<AuditEntryRow>(
    `select id, staff_id, staff_display_name, action, booking_id,
            subject_player_id, details, occurred_at
       from audit_log_entries
      order by occurred_at desc, id desc`,
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

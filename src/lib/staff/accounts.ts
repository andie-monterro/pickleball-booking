// Staff account management: the desk onboards and offboards front-desk people
// itself, so neither needs a developer. There is one Staff role and no separate
// admin, so every Staff account may create and deactivate Staff accounts.
//
// An account is the staff role granted to a Player record, keyed by phone
// number like every other identity (ADR-0001). Onboarding a phone the app
// already knows grants the role to that Player, so a front-desk person who
// plays here keeps one identity and one history.

import { randomUUID } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import {
  recordStaffAction,
  type StaffAccountAuditDetails,
  type StaffIdentity,
} from "@/lib/audit-log";
import {
  AuthError,
  normalizedDisplayName,
  normalizedPhone,
} from "@/lib/auth/auth";
import { clock } from "@/lib/clock";
import { getPool, runInTransaction } from "@/lib/db";

export interface StaffAccount {
  id: string;
  displayName: string;
  phone: string;
  grantedAt: string;
}

// What the desk types to onboard someone. The name is only needed when the
// phone number is new: an existing Player keeps their own name, which the staff
// panel has no business rewriting.
interface StaffAccountNaming {
  phone: string;
  displayName?: string;
}

export class StaffAccountError extends Error {
  constructor(
    readonly code:
      | "invalid_request"
      | "staff_account_exists"
      | "staff_account_not_found"
      | "last_staff_account",
    readonly status: number,
  ) {
    super(code);
  }
}

interface StaffAccountRow extends QueryResultRow {
  player_id: string;
  display_name: string;
  phone: string;
  granted_at: Date;
}

interface PlayerRecordRow extends QueryResultRow {
  id: string;
  display_name: string;
  phone: string;
}

function accountFromRow(row: StaffAccountRow): StaffAccount {
  return {
    id: row.player_id,
    displayName: row.display_name,
    phone: row.phone,
    grantedAt: row.granted_at.toISOString(),
  };
}

function auditDetails(account: StaffAccount): StaffAccountAuditDetails {
  return { accountName: account.displayName, accountPhone: account.phone };
}

function requestBodyRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new StaffAccountError("invalid_request", 400);
  }
  return { ...input };
}

function parseNaming(input: unknown): StaffAccountNaming {
  const record = requestBodyRecord(input);
  return {
    phone: normalizedPhone(record.phone),
    ...(record.displayName === undefined
      ? {}
      : { displayName: normalizedDisplayName(record.displayName) }),
  };
}

function parseAccountId(input: unknown): string {
  const record = requestBodyRecord(input);
  if (typeof record.playerId !== "string" || record.playerId.length === 0) {
    throw new StaffAccountError("invalid_request", 400);
  }
  return record.playerId;
}

const ACCOUNT_COLUMNS = `staff_accounts.player_id,
            staff_accounts.granted_at,
            players.display_name,
            players.phone`;

export async function readStaffAccounts(): Promise<StaffAccount[]> {
  const result = await getPool().query<StaffAccountRow>(
    `select ${ACCOUNT_COLUMNS}
       from staff_accounts
       join players on players.id = staff_accounts.player_id
      order by players.display_name, players.id`,
  );
  return result.rows.map(accountFromRow);
}

// A phone number is one person, so onboarding reuses the Player record that
// already holds it instead of making a second one.
async function resolveAccountPlayer(
  client: PoolClient,
  naming: StaffAccountNaming,
  now: Date,
): Promise<PlayerRecordRow> {
  if (naming.displayName) {
    // The insert stands only when the number is new: an existing record keeps
    // its own name, which the staff panel has no business rewriting.
    await client.query(
      `insert into players (id, display_name, phone, created_at)
       values ($1, $2, $3, $4)
       on conflict (phone) do nothing`,
      [randomUUID(), naming.displayName, naming.phone, now],
    );
  }
  const result = await client.query<PlayerRecordRow>(
    "select id, display_name, phone from players where phone = $1 for update",
    [naming.phone],
  );
  const row = result.rows[0];
  // Nothing on file, and no name to make a record with.
  if (!row) {
    throw new AuthError("invalid_display_name", 400);
  }
  return row;
}

export async function createStaffAccount(
  actor: StaffIdentity,
  rawInput: unknown,
): Promise<StaffAccount> {
  const naming = parseNaming(rawInput);
  const now = clock.now();

  return runInTransaction(async (client) => {
    const player = await resolveAccountPlayer(client, naming, now);
    const granted = await client.query<StaffAccountRow>(
      `insert into staff_accounts (player_id, granted_at)
       values ($1, $2)
       on conflict (player_id) do nothing
       returning player_id, granted_at`,
      [player.id, now],
    );
    if (granted.rowCount === 0) {
      throw new StaffAccountError("staff_account_exists", 409);
    }
    // A Staff account signs in rather than signing up, so the record counts as
    // signed up from the start. That also stops a stranger from claiming a
    // staff phone number through self-signup.
    await client.query(
      `insert into player_signups (player_id, completed_at)
       values ($1, $2)
       on conflict (player_id) do nothing`,
      [player.id, now],
    );

    const account = accountFromRow({
      player_id: player.id,
      display_name: player.display_name,
      phone: player.phone,
      granted_at: now,
    });
    await recordStaffAction(client, {
      staff: actor,
      action: "staff_account_created",
      bookingId: null,
      subjectPlayerId: account.id,
      details: auditDetails(account),
      occurredAt: now,
    });
    return account;
  });
}

// Offboarding removes the role and nothing else: the person stays a Player, and
// their past Audit Log entries stay attributed to them, because the log holds
// plain ids and name snapshots rather than references.
//
// The venue may not offboard its way out of the app: the last Staff account
// cannot be deactivated, because no one left could grant the role back. The
// read locks every grant, so two simultaneous deactivations cannot both believe
// another account remains.
export async function deactivateStaffAccount(
  actor: StaffIdentity,
  rawInput: unknown,
): Promise<StaffAccount> {
  const playerId = parseAccountId(rawInput);
  const now = clock.now();

  return runInTransaction(async (client) => {
    const active = await client.query<StaffAccountRow>(
      `select ${ACCOUNT_COLUMNS}
         from staff_accounts
         join players on players.id = staff_accounts.player_id
        for update of staff_accounts`,
    );
    const row = active.rows.find((candidate) => candidate.player_id === playerId);
    if (!row) {
      throw new StaffAccountError("staff_account_not_found", 404);
    }
    if (active.rows.length === 1) {
      throw new StaffAccountError("last_staff_account", 409);
    }

    await client.query("delete from staff_accounts where player_id = $1", [
      playerId,
    ]);
    const account = accountFromRow(row);
    await recordStaffAction(client, {
      staff: actor,
      action: "staff_account_deactivated",
      bookingId: null,
      subjectPlayerId: account.id,
      details: auditDetails(account),
      occurredAt: now,
    });
    return account;
  });
}

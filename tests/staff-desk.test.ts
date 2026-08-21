import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as meRoute from "@/app/api/auth/me/route";
import * as auditLogRoute from "@/app/api/staff/audit-log/route";
import { fixedClock, resetClock, setClock } from "@/lib/clock";
import { getPool } from "@/lib/db";
import { httpGet } from "./harness/http";

// 2026-08-21 12:00 venue time (Asia/Ho_Chi_Minh, UTC+7). Venue date is
// 2026-08-21, so a casual player's 7-day horizon covers 2026-08-21..2026-08-27
// and a Member's 14-day horizon covers 2026-08-21..2026-09-03.
const NOW = new Date("2026-08-21T05:00:00.000Z");

const STAFF = {
  playerId: "staff-desk-staff",
  displayName: "Desk One",
  phone: "+84902000001",
  sessionToken: "staff-desk-staff-session",
};

const PLAYER = {
  playerId: "staff-desk-player",
  displayName: "Lan Nguyen",
  phone: "+84902000002",
  sessionToken: "staff-desk-player-session",
};

type Account = typeof STAFF;

function cookieFor(account: Account): { cookie: string } {
  return { cookie: `pb_session=${account.sessionToken}` };
}

async function insertAccount(account: Account): Promise<void> {
  const pool = getPool();
  await pool.query(
    `insert into players (id, display_name, phone, created_at)
     values ($1, $2, $3, $4)`,
    [account.playerId, account.displayName, account.phone, NOW],
  );
  await pool.query(
    "insert into player_signups (player_id, completed_at) values ($1, $2)",
    [account.playerId, NOW],
  );
  await pool.query(
    `insert into player_sessions (token_hash, player_id, expires_at, created_at)
     values ($1, $2, $3, $4)`,
    [
      createHash("sha256").update(account.sessionToken).digest("hex"),
      account.playerId,
      new Date("2026-09-21T05:00:00.000Z"),
      NOW,
    ],
  );
}

async function clearStaffDeskData(): Promise<void> {
  const pool = getPool();
  // The Audit Log is append-only, so nothing may delete from it. Tests reset it
  // with truncate, which the append-only trigger does not see.
  await pool.query("truncate audit_log_entries");
  await pool.query("delete from slot_claims");
  await pool.query("delete from strikes");
  await pool.query("delete from bookings");
  await pool.query("delete from staff_accounts");
  await pool.query("delete from player_sessions");
  await pool.query("delete from player_signups");
  await pool.query("delete from players");
}

async function resetStaffDeskData(): Promise<void> {
  const pool = getPool();
  await clearStaffDeskData();
  await pool.query("delete from opening_hours");
  await pool.query(
    `insert into opening_hours (day_of_week, start_hour, end_hour)
     select day, 6, 22 from generate_series(0, 6) as day`,
  );
  await pool.query(
    `insert into venue_settings (id, venue_time_zone, casual_horizon_days, member_horizon_days)
     values (1, 'Asia/Ho_Chi_Minh', 7, 14)
     on conflict (id) do update
       set venue_time_zone = excluded.venue_time_zone,
           casual_horizon_days = excluded.casual_horizon_days,
           member_horizon_days = excluded.member_horizon_days`,
  );
  await insertAccount(STAFF);
  await insertAccount(PLAYER);
  await pool.query(
    "insert into staff_accounts (player_id, granted_at) values ($1, $2)",
    [STAFF.playerId, NOW],
  );
}

describe("staff desk HTTP API", () => {
  beforeEach(async () => {
    setClock(fixedClock(NOW));
    await resetStaffDeskData();
  });

  afterEach(async () => {
    resetClock();
    await clearStaffDeskData();
  });

  it("lets a Staff account reach staff endpoints and refuses a player session", async () => {
    const profile = await httpGet(meRoute, "/api/auth/me", cookieFor(STAFF));
    expect(await profile.json()).toMatchObject({ player: { role: "staff" } });

    const staffRead = await httpGet(
      auditLogRoute,
      "/api/staff/audit-log",
      cookieFor(STAFF),
    );
    expect(staffRead.status).toBe(200);
    expect(await staffRead.json()).toEqual({ entries: [] });

    const playerProfile = await httpGet(meRoute, "/api/auth/me", cookieFor(PLAYER));
    expect(await playerProfile.json()).toMatchObject({ player: { role: "player" } });

    const playerRead = await httpGet(
      auditLogRoute,
      "/api/staff/audit-log",
      cookieFor(PLAYER),
    );
    expect(playerRead.status).toBe(403);
    expect(await playerRead.json()).toEqual({ error: "staff_only" });

    const anonymousRead = await httpGet(auditLogRoute, "/api/staff/audit-log");
    expect(anonymousRead.status).toBe(401);
    expect(await anonymousRead.json()).toEqual({ error: "unauthorized" });
  });
});

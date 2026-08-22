import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as availabilityRoute from "@/app/api/availability/route";
import * as auditLogRoute from "@/app/api/staff/audit-log/route";
import * as courtsRoute from "@/app/api/staff/courts/route";
import { fixedClock, resetClock, setClock } from "@/lib/clock";
import { getPool } from "@/lib/db";
import { httpGet, httpPatch, httpPost } from "./harness/http";

// 2026-08-21 12:00 venue time (Asia/Ho_Chi_Minh, UTC+7). A Friday.
const NOW = new Date("2026-08-21T05:00:00.000Z");

const SEED_COURTS = ["Court 1", "Court 2", "Court 3", "Court 4"];

const DESK = {
  playerId: "venue-settings-desk",
  displayName: "Desk One",
  phone: "+84904000001",
  sessionToken: "venue-settings-desk-session",
};

const PLAYER = {
  playerId: "venue-settings-player",
  displayName: "Lan Nguyen",
  phone: "+84904000002",
  sessionToken: "venue-settings-player-session",
};

type Account = typeof DESK;

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

// The venue data this slice edits is shared by every test file, so each test
// starts from the seeded venue and every test file finds it again afterwards.
async function resetVenueData(): Promise<void> {
  const pool = getPool();
  await pool.query("truncate audit_log_entries");
  await pool.query("delete from slot_claims");
  await pool.query("delete from bookings");
  await pool.query("delete from staff_accounts");
  await pool.query("delete from player_sessions");
  await pool.query("delete from players");
  await pool.query("delete from opening_hours");
  await pool.query("delete from courts");
  await pool.query("alter sequence courts_id_seq restart with 1");

  for (const name of SEED_COURTS) {
    await pool.query("insert into courts (name) values ($1)", [name]);
  }
  for (let day = 0; day <= 6; day += 1) {
    await pool.query(
      "insert into opening_hours (day_of_week, start_hour, end_hour) values ($1, $2, $3)",
      [day, 6, 22],
    );
  }
  await pool.query(
    `update venue_settings
        set casual_horizon_days = 7, member_horizon_days = 14
      where id = 1`,
  );
}

// A Booking on one Slot, written straight into the database: this file is
// about the settings, not about how the Booking got there.
async function bookCourt(
  bookingId: string,
  courtId: number,
  startsAt: string,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `insert into bookings (id, booker_id, court_id, starts_at, duration_hours, created_at)
     values ($1, $2, $3, $4, 1, $5)`,
    [bookingId, PLAYER.playerId, courtId, startsAt, NOW],
  );
  await pool.query(
    `insert into slot_claims (court_id, slot_starts_at, source_kind, source_id)
     values ($1, $2, 'booking', $3)`,
    [courtId, startsAt, bookingId],
  );
}

async function cancelBookingRecord(bookingId: string): Promise<void> {
  const pool = getPool();
  await pool.query("delete from slot_claims where source_id = $1", [bookingId]);
  await pool.query(
    "update bookings set cancelled_at = $2, cancellation_kind = 'penalty_free' where id = $1",
    [bookingId, NOW],
  );
}

async function courtNamesInGrid(date: string): Promise<string[]> {
  const response = await httpGet(availabilityRoute, `/api/availability?date=${date}`);
  expect(response.status).toBe(200);
  const body = await response.json();
  return body.courts.map((court: { name: string }) => court.name);
}

// The Audit Log is newest first, and entries made at the same instant have no
// order between them. Each step of a test therefore moves the clock on.
function atMinute(minute: number): void {
  setClock(fixedClock(new Date(NOW.getTime() + minute * 60 * 1000)));
}

async function auditActions(): Promise<string[]> {
  const response = await httpGet(auditLogRoute, "/api/staff/audit-log", cookieFor(DESK));
  expect(response.status).toBe(200);
  const { entries } = await response.json();
  return entries.map((entry: { action: string }) => entry.action);
}

describe("venue settings HTTP API", () => {
  beforeEach(async () => {
    setClock(fixedClock(NOW));
    await resetVenueData();
    await insertAccount(DESK);
    await insertAccount(PLAYER);
    await getPool().query(
      "insert into staff_accounts (player_id, granted_at) values ($1, $2)",
      [DESK.playerId, NOW],
    );
  });

  afterEach(async () => {
    resetClock();
    await resetVenueData();
  });

  it("adds, renames and deactivates Courts, and the grid follows at once", async () => {
    const listed = await httpGet(courtsRoute, "/api/staff/courts", cookieFor(DESK));
    expect(listed.status).toBe(200);
    expect((await listed.json()).courts).toEqual(
      SEED_COURTS.map((name) => ({ id: expect.any(Number), name, active: true })),
    );

    atMinute(1);
    const added = await httpPost(
      courtsRoute,
      "/api/staff/courts",
      { name: "Court 5" },
      cookieFor(DESK),
    );
    expect(added.status).toBe(201);
    const { court } = await added.json();
    expect(court).toMatchObject({ name: "Court 5", active: true });
    expect(await courtNamesInGrid("2026-08-21")).toEqual([...SEED_COURTS, "Court 5"]);

    atMinute(2);
    const renamed = await httpPatch(
      courtsRoute,
      "/api/staff/courts",
      { courtId: court.id, name: "Show Court" },
      cookieFor(DESK),
    );
    expect(renamed.status).toBe(200);
    expect(await renamed.json()).toMatchObject({
      court: { id: court.id, name: "Show Court", active: true },
    });
    expect(await courtNamesInGrid("2026-08-21")).toEqual([...SEED_COURTS, "Show Court"]);

    atMinute(3);
    const deactivated = await httpPatch(
      courtsRoute,
      "/api/staff/courts",
      { courtId: court.id, active: false },
      cookieFor(DESK),
    );
    expect(deactivated.status).toBe(200);
    expect(await deactivated.json()).toMatchObject({
      court: { id: court.id, name: "Show Court", active: false },
    });
    // The Court leaves the grid, so nobody can book it any more.
    expect(await courtNamesInGrid("2026-08-21")).toEqual(SEED_COURTS);
    // Staff still see it, so they can bring it back.
    const afterwards = await httpGet(courtsRoute, "/api/staff/courts", cookieFor(DESK));
    expect((await afterwards.json()).courts).toContainEqual({
      id: court.id,
      name: "Show Court",
      active: false,
    });

    atMinute(4);
    const reactivated = await httpPatch(
      courtsRoute,
      "/api/staff/courts",
      { courtId: court.id, active: true },
      cookieFor(DESK),
    );
    expect(reactivated.status).toBe(200);
    expect(await courtNamesInGrid("2026-08-21")).toEqual([...SEED_COURTS, "Show Court"]);

    expect(await auditActions()).toEqual([
      "court_reactivated",
      "court_deactivated",
      "court_renamed",
      "court_added",
    ]);
  });

  it("names the Court and its old name in the Audit Log", async () => {
    const added = await httpPost(
      courtsRoute,
      "/api/staff/courts",
      { name: "Court 5" },
      cookieFor(DESK),
    );
    const { court } = await added.json();

    atMinute(1);
    await httpPatch(
      courtsRoute,
      "/api/staff/courts",
      { courtId: court.id, name: "Show Court" },
      cookieFor(DESK),
    );

    const log = await httpGet(auditLogRoute, "/api/staff/audit-log", cookieFor(DESK));
    const { entries } = await log.json();
    expect(entries[0]).toMatchObject({
      action: "court_renamed",
      staff: { id: DESK.playerId, displayName: DESK.displayName },
      details: { court: "Show Court", previousCourt: "Court 5" },
    });
    expect(entries[1]).toMatchObject({
      action: "court_added",
      details: { court: "Court 5" },
    });
  });

  it("keeps a Court whose Bookings are still to be played", async () => {
    await bookCourt("court-in-use-booking", 1, "2026-08-22T03:00:00.000Z");

    const refused = await httpPatch(
      courtsRoute,
      "/api/staff/courts",
      { courtId: 1, active: false },
      cookieFor(DESK),
    );
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: "court_has_bookings" });
    expect(await courtNamesInGrid("2026-08-21")).toEqual(SEED_COURTS);

    // Staff cancel the Booking explicitly, and the same change then stands.
    await cancelBookingRecord("court-in-use-booking");
    const deactivated = await httpPatch(
      courtsRoute,
      "/api/staff/courts",
      { courtId: 1, active: false },
      cookieFor(DESK),
    );
    expect(deactivated.status).toBe(200);
    expect(await courtNamesInGrid("2026-08-21")).toEqual(SEED_COURTS.slice(1));
  });

  it("deactivates a Court whose Bookings have all been played", async () => {
    await bookCourt("court-played-booking", 2, "2026-08-20T03:00:00.000Z");

    const deactivated = await httpPatch(
      courtsRoute,
      "/api/staff/courts",
      { courtId: 2, active: false },
      cookieFor(DESK),
    );
    expect(deactivated.status).toBe(200);
  });

  it("refuses a Court change it cannot carry out", async () => {
    const duplicate = await httpPost(
      courtsRoute,
      "/api/staff/courts",
      { name: "Court 1" },
      cookieFor(DESK),
    );
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toEqual({ error: "court_name_taken" });

    const blank = await httpPost(
      courtsRoute,
      "/api/staff/courts",
      { name: "   " },
      cookieFor(DESK),
    );
    expect(blank.status).toBe(400);
    expect(await blank.json()).toEqual({ error: "invalid_request" });

    const renameToTaken = await httpPatch(
      courtsRoute,
      "/api/staff/courts",
      { courtId: 1, name: "Court 2" },
      cookieFor(DESK),
    );
    expect(renameToTaken.status).toBe(409);
    expect(await renameToTaken.json()).toEqual({ error: "court_name_taken" });

    const unknown = await httpPatch(
      courtsRoute,
      "/api/staff/courts",
      { courtId: 9999, name: "Court 9" },
      cookieFor(DESK),
    );
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: "court_not_found" });

    const fromPlayer = await httpPost(
      courtsRoute,
      "/api/staff/courts",
      { name: "Court 5" },
      cookieFor(PLAYER),
    );
    expect(fromPlayer.status).toBe(403);
    expect(await fromPlayer.json()).toEqual({ error: "staff_only" });

    const anonymous = await httpGet(courtsRoute, "/api/staff/courts");
    expect(anonymous.status).toBe(401);

    // A refused attempt is no action, so nothing changed and nothing is logged.
    expect(await courtNamesInGrid("2026-08-21")).toEqual(SEED_COURTS);
    expect(await auditActions()).toEqual([]);
  });
});

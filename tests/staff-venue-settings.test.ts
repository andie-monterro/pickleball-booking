import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as availabilityRoute from "@/app/api/availability/route";
import * as bookingsRoute from "@/app/api/bookings/route";
import * as auditLogRoute from "@/app/api/staff/audit-log/route";
import * as courtsRoute from "@/app/api/staff/courts/route";
import * as horizonsRoute from "@/app/api/staff/horizons/route";
import * as openingHoursRoute from "@/app/api/staff/opening-hours/route";
import { fixedClock, resetClock, setClock } from "@/lib/clock";
import { getPool } from "@/lib/db";
import { httpGet, httpPatch, httpPost, httpPut } from "./harness/http";

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

async function hoursInGrid(date: string): Promise<string[]> {
  const response = await httpGet(availabilityRoute, `/api/availability?date=${date}`);
  expect(response.status).toBe(200);
  return (await response.json()).hours;
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

  it("edits one weekday's Opening Hours, and the grid keeps only the Slots inside them", async () => {
    const listed = await httpGet(
      openingHoursRoute,
      "/api/staff/opening-hours",
      cookieFor(DESK),
    );
    expect(listed.status).toBe(200);
    expect((await listed.json()).openingHours).toEqual(
      Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        startHour: 6,
        endHour: 22,
      })),
    );

    // 2026-08-21 is a Friday; 2026-08-22 is the Saturday after it.
    atMinute(1);
    const shortened = await httpPut(
      openingHoursRoute,
      "/api/staff/opening-hours",
      { dayOfWeek: 5, startHour: 8, endHour: 12 },
      cookieFor(DESK),
    );
    expect(shortened.status).toBe(200);
    expect(await shortened.json()).toEqual({
      openingHours: { dayOfWeek: 5, startHour: 8, endHour: 12 },
    });

    expect(await hoursInGrid("2026-08-21")).toEqual([
      "08:00",
      "09:00",
      "10:00",
      "11:00",
    ]);
    // Only that weekday moved.
    expect(await hoursInGrid("2026-08-22")).toHaveLength(16);

    atMinute(2);
    const closed = await httpPut(
      openingHoursRoute,
      "/api/staff/opening-hours",
      { dayOfWeek: 5, startHour: null, endHour: null },
      cookieFor(DESK),
    );
    expect(closed.status).toBe(200);
    expect(await hoursInGrid("2026-08-21")).toEqual([]);

    const response = await httpGet(availabilityRoute, "/api/availability?date=2026-08-21");
    expect((await response.json()).slots).toEqual([]);

    const log = await httpGet(auditLogRoute, "/api/staff/audit-log", cookieFor(DESK));
    const { entries } = await log.json();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      action: "opening_hours_changed",
      staff: { id: DESK.playerId, displayName: DESK.displayName },
      details: {
        weekday: 5,
        openingHours: null,
        previousOpeningHours: "08:00-12:00",
      },
    });
    expect(entries[1]).toMatchObject({
      action: "opening_hours_changed",
      details: {
        weekday: 5,
        openingHours: "08:00-12:00",
        previousOpeningHours: "06:00-22:00",
      },
    });
  });

  it("keeps Opening Hours that a Booking still to be played needs", async () => {
    // A Friday Booking at 20:00 venue time, inside the current hours.
    await bookCourt("hours-in-use-booking", 1, "2026-08-28T13:00:00.000Z");

    const refused = await httpPut(
      openingHoursRoute,
      "/api/staff/opening-hours",
      { dayOfWeek: 5, startHour: 6, endHour: 18 },
      cookieFor(DESK),
    );
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: "bookings_outside_new_hours" });
    expect(await hoursInGrid("2026-08-21")).toHaveLength(16);

    // Hours that still cover the Booking are fine.
    const narrowed = await httpPut(
      openingHoursRoute,
      "/api/staff/opening-hours",
      { dayOfWeek: 5, startHour: 6, endHour: 21 },
      cookieFor(DESK),
    );
    expect(narrowed.status).toBe(200);

    await cancelBookingRecord("hours-in-use-booking");
    const afterCancelling = await httpPut(
      openingHoursRoute,
      "/api/staff/opening-hours",
      { dayOfWeek: 5, startHour: 6, endHour: 18 },
      cookieFor(DESK),
    );
    expect(afterCancelling.status).toBe(200);
  });

  it("refuses Opening Hours that are not whole hours of one day", async () => {
    const refusals = [
      { dayOfWeek: 5, startHour: 12, endHour: 12 },
      { dayOfWeek: 5, startHour: 14, endHour: 9 },
      { dayOfWeek: 5, startHour: 6, endHour: 25 },
      { dayOfWeek: 5, startHour: -1, endHour: 10 },
      { dayOfWeek: 5, startHour: 6.5, endHour: 10 },
      { dayOfWeek: 7, startHour: 6, endHour: 10 },
      { dayOfWeek: 5, startHour: 6, endHour: null },
      { startHour: 6, endHour: 10 },
    ];
    for (const body of refusals) {
      const response = await httpPut(
        openingHoursRoute,
        "/api/staff/opening-hours",
        body,
        cookieFor(DESK),
      );
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_request" });
    }

    const fromPlayer = await httpPut(
      openingHoursRoute,
      "/api/staff/opening-hours",
      { dayOfWeek: 5, startHour: 8, endHour: 12 },
      cookieFor(PLAYER),
    );
    expect(fromPlayer.status).toBe(403);
    const anonymous = await httpGet(openingHoursRoute, "/api/staff/opening-hours");
    expect(anonymous.status).toBe(401);

    expect(await hoursInGrid("2026-08-21")).toHaveLength(16);
    expect(await auditActions()).toEqual([]);
  });

  it("changes both Booking Horizons, and enforcement and the day strip follow", async () => {
    const listed = await httpGet(horizonsRoute, "/api/staff/horizons", cookieFor(DESK));
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual({
      horizons: { casualHorizonDays: 7, memberHorizonDays: 14 },
    });

    atMinute(1);
    const changed = await httpPut(
      horizonsRoute,
      "/api/staff/horizons",
      { casualHorizonDays: 3, memberHorizonDays: 5 },
      cookieFor(DESK),
    );
    expect(changed.status).toBe(200);
    expect(await changed.json()).toEqual({
      horizons: { casualHorizonDays: 3, memberHorizonDays: 5 },
    });

    // The day strip spans the member horizon, and marks the days only Members
    // reach with the day they open to everyone.
    const grid = await httpGet(availabilityRoute, "/api/availability", cookieFor(PLAYER));
    const body = await grid.json();
    expect(body.horizons).toEqual({ casualDays: 3, memberDays: 5 });
    expect(body.days).toHaveLength(5);
    expect(body.days.slice(0, 3).every((day: { memberOnly: boolean }) => !day.memberOnly)).toBe(
      true,
    );
    expect(body.days[3]).toMatchObject({ memberOnly: true, bookable: false });

    // Enforcement follows too: the fourth day is now outside a casual player's
    // horizon, and it was inside the old one.
    const refused = await httpPost(
      bookingsRoute,
      "/api/bookings",
      { courtId: 1, startsAt: "2026-08-24T03:00:00.000Z", durationHours: 1 },
      cookieFor(PLAYER),
    );
    expect(refused.status).toBe(400);
    expect(await refused.json()).toEqual({ error: "outside_horizon" });

    const inside = await httpPost(
      bookingsRoute,
      "/api/bookings",
      { courtId: 1, startsAt: "2026-08-23T03:00:00.000Z", durationHours: 1 },
      cookieFor(PLAYER),
    );
    expect(inside.status).toBe(201);

    const log = await httpGet(auditLogRoute, "/api/staff/audit-log", cookieFor(DESK));
    const { entries } = await log.json();
    expect(entries[entries.length - 1]).toMatchObject({
      action: "booking_horizons_changed",
      staff: { id: DESK.playerId, displayName: DESK.displayName },
      details: {
        casualHorizonDays: 3,
        memberHorizonDays: 5,
        previousCasualHorizonDays: 7,
        previousMemberHorizonDays: 14,
      },
    });
  });

  it("refuses Booking Horizons the app cannot mean", async () => {
    const refusals = [
      // A Member must reach at least as far as a casual player.
      { casualHorizonDays: 10, memberHorizonDays: 7 },
      { casualHorizonDays: 0, memberHorizonDays: 14 },
      { casualHorizonDays: -1, memberHorizonDays: 14 },
      { casualHorizonDays: 7, memberHorizonDays: 400 },
      { casualHorizonDays: 7.5, memberHorizonDays: 14 },
      { casualHorizonDays: 7 },
      { memberHorizonDays: 14 },
    ];
    for (const body of refusals) {
      const response = await httpPut(
        horizonsRoute,
        "/api/staff/horizons",
        body,
        cookieFor(DESK),
      );
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_request" });
    }

    const fromPlayer = await httpPut(
      horizonsRoute,
      "/api/staff/horizons",
      { casualHorizonDays: 7, memberHorizonDays: 14 },
      cookieFor(PLAYER),
    );
    expect(fromPlayer.status).toBe(403);
    const anonymous = await httpGet(horizonsRoute, "/api/staff/horizons");
    expect(anonymous.status).toBe(401);

    const grid = await httpGet(availabilityRoute, "/api/availability");
    expect((await grid.json()).horizons).toEqual({ casualDays: 7, memberDays: 14 });
    expect(await auditActions()).toEqual([]);
  });
});
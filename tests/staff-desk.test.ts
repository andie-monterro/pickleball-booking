import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as meRoute from "@/app/api/auth/me/route";
import * as signUpRoute from "@/app/api/auth/signup/request-code/route";
import * as verifyRoute from "@/app/api/auth/verify/route";
import * as availabilityRoute from "@/app/api/availability/route";
import * as bookingsRoute from "@/app/api/bookings/route";
import * as auditLogRoute from "@/app/api/staff/audit-log/route";
import * as staffBookingsRoute from "@/app/api/staff/bookings/route";
import * as staffPlayersRoute from "@/app/api/staff/players/route";
import * as staffScheduleRoute from "@/app/api/staff/schedule/route";
import { resetOtpProvider, setOtpProvider } from "@/lib/auth/otp-provider";
import { fixedClock, resetClock, setClock } from "@/lib/clock";
import { getPool } from "@/lib/db";
import { FakeOtpProvider } from "./fakes/fake-otp-provider";
import { httpDelete, httpGet, httpPost } from "./harness/http";

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

// 2026-08-21 14:00 and 15:00 venue time, inside Opening Hours and inside every
// standing's horizon.
const SLOT = "2026-08-21T07:00:00.000Z";
const NEXT_SLOT = "2026-08-21T08:00:00.000Z";

const WALK_IN = { displayName: "Bao Pham", phone: "+84902000003" };

// 14:00 venue time on the first day past each horizon: 2026-08-28 is day 8 (past
// a casual player's 7 days), 2026-09-04 is day 15 (past a Member's 14 days).
const OUTSIDE_CASUAL_HORIZON = "2026-08-28T07:00:00.000Z";
const OUTSIDE_MEMBER_HORIZON = "2026-09-04T07:00:00.000Z";

type Account = typeof STAFF;

function deskBooking(fields: Record<string, unknown>): Record<string, unknown> {
  return { courtId: 1, startsAt: SLOT, durationHours: 1, ...fields };
}

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
  let otp: FakeOtpProvider;

  beforeEach(async () => {
    setClock(fixedClock(NOW));
    otp = new FakeOtpProvider();
    setOtpProvider(otp);
    await resetStaffDeskData();
  });

  afterEach(async () => {
    resetOtpProvider();
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

  it("refuses a desk Booking outside the named Player's own horizon", async () => {
    const casualRefused = await httpPost(
      staffBookingsRoute,
      "/api/staff/bookings",
      deskBooking({
        playerId: PLAYER.playerId,
        startsAt: OUTSIDE_CASUAL_HORIZON,
      }),
      cookieFor(STAFF),
    );
    expect(casualRefused.status).toBe(400);
    expect(await casualRefused.json()).toEqual({ error: "outside_horizon" });

    // A refused attempt is no action, so it leaves no Audit Log entry.
    const log = await httpGet(auditLogRoute, "/api/staff/audit-log", cookieFor(STAFF));
    expect(await log.json()).toEqual({ entries: [] });

    // The same day is inside a Member's horizon. Staff standing never matters:
    // the named Booker's standing decides.
    await getPool().query("update players set member_until = $1 where id = $2", [
      "2026-08-21",
      PLAYER.playerId,
    ]);
    const memberAllowed = await httpPost(
      staffBookingsRoute,
      "/api/staff/bookings",
      deskBooking({
        playerId: PLAYER.playerId,
        startsAt: OUTSIDE_CASUAL_HORIZON,
      }),
      cookieFor(STAFF),
    );
    expect(memberAllowed.status).toBe(201);

    const memberRefused = await httpPost(
      staffBookingsRoute,
      "/api/staff/bookings",
      deskBooking({
        playerId: PLAYER.playerId,
        startsAt: OUTSIDE_MEMBER_HORIZON,
      }),
      cookieFor(STAFF),
    );
    expect(memberRefused.status).toBe(400);
    expect(await memberRefused.json()).toEqual({ error: "outside_horizon" });
  });

  it("creates a Booking naming an existing Player, held by that Player", async () => {
    const response = await httpPost(
      staffBookingsRoute,
      "/api/staff/bookings",
      deskBooking({ playerId: PLAYER.playerId }),
      cookieFor(STAFF),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      booking: {
        courtId: 1,
        courtName: "Court 1",
        startsAt: SLOT,
        endsAt: NEXT_SLOT,
      },
      booker: {
        id: PLAYER.playerId,
        displayName: PLAYER.displayName,
        phone: PLAYER.phone,
      },
    });

    // The named Player is the Booker: they see it and can cancel it themselves.
    const upcoming = await httpGet(bookingsRoute, "/api/bookings", cookieFor(PLAYER));
    expect(await upcoming.json()).toMatchObject({
      bookings: [{ courtName: "Court 1", startsAt: SLOT }],
    });

    // The public view still shows occupancy only.
    const availability = await httpGet(
      availabilityRoute,
      "/api/availability?date=2026-08-21",
    );
    const publicBody = await availability.text();
    expect(publicBody).toContain('"taken"');
    expect(publicBody).not.toContain(PLAYER.displayName);
    expect(publicBody).not.toContain(PLAYER.phone);
  });

  it("creates a light Player record and books for them in one flow", async () => {
    const response = await httpPost(
      staffBookingsRoute,
      "/api/staff/bookings",
      deskBooking({ newPlayer: WALK_IN }),
      cookieFor(STAFF),
    );

    expect(response.status).toBe(201);
    const { booker } = await response.json();
    expect(booker).toMatchObject({
      displayName: WALK_IN.displayName,
      phone: WALK_IN.phone,
    });

    // The record is unverified, so a later self-signup with the same phone
    // takes it over together with the desk-made Booking.
    const signupStart = await httpPost(
      signUpRoute,
      "/api/auth/signup/request-code",
      { displayName: "Bao P.", phone: WALK_IN.phone },
    );
    const { challengeId } = await signupStart.json();
    const verify = await httpPost(verifyRoute, "/api/auth/verify", {
      challengeId,
      code: otp.latestCode(WALK_IN.phone),
    });
    expect(verify.status).toBe(200);
    expect(await verify.json()).toMatchObject({ player: { id: booker.id } });

    const upcoming = await httpGet(bookingsRoute, "/api/bookings", {
      cookie: verify.headers.get("set-cookie")?.split(";", 1)[0] ?? "",
    });
    expect(await upcoming.json()).toMatchObject({
      bookings: [{ courtName: "Court 1", startsAt: SLOT }],
    });
  });

  it("reuses the existing Player record when the desk retypes a known phone", async () => {
    const response = await httpPost(
      staffBookingsRoute,
      "/api/staff/bookings",
      deskBooking({
        newPlayer: { displayName: "Lan N.", phone: PLAYER.phone },
      }),
      cookieFor(STAFF),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      booker: { id: PLAYER.playerId, displayName: PLAYER.displayName },
    });
  });

  it("cancels any Booking penalty-free, past the cutoff and after the start", async () => {
    const booked = await httpPost(
      bookingsRoute,
      "/api/bookings",
      { courtId: 1, startsAt: SLOT, durationHours: 1 },
      cookieFor(PLAYER),
    );
    const { booking } = await booked.json();

    // Past the 15-minute creation grace and inside the 6-hour cutoff, so the
    // Booker's own cancellation here would be a Late Cancel.
    setClock(fixedClock(new Date("2026-08-21T05:20:00.000Z")));
    const cancelled = await httpDelete(
      staffBookingsRoute,
      "/api/staff/bookings",
      { bookingId: booking.id },
      cookieFor(STAFF),
    );

    expect(cancelled.status).toBe(200);
    expect(await cancelled.json()).toMatchObject({
      cancellation: { bookingId: booking.id, kind: "penalty_free" },
    });

    // No Strike for the Booker, and the Slot reopens.
    const profile = await httpGet(meRoute, "/api/auth/me", cookieFor(PLAYER));
    expect(await profile.json()).toMatchObject({ player: { strikeCount: 0 } });
    const upcoming = await httpGet(bookingsRoute, "/api/bookings", cookieFor(PLAYER));
    expect(await upcoming.json()).toEqual({ bookings: [] });
    const availability = await httpGet(
      availabilityRoute,
      "/api/availability?date=2026-08-21",
    );
    const body = await availability.json();
    expect(
      body.slots.find(
        (slot: { courtId: number; start: string }) =>
          slot.courtId === 1 && slot.start === SLOT,
      ),
    ).toMatchObject({ status: "free" });

    // Cancelling the same Booking twice finds nothing left to cancel.
    const again = await httpDelete(
      staffBookingsRoute,
      "/api/staff/bookings",
      { bookingId: booking.id },
      cookieFor(STAFF),
    );
    expect(again.status).toBe(404);
    expect(await again.json()).toEqual({ error: "booking_not_found" });
  });

  it("cancels a Booking that has already started, freeing both its Slots", async () => {
    const booked = await httpPost(
      staffBookingsRoute,
      "/api/staff/bookings",
      deskBooking({ playerId: PLAYER.playerId, durationHours: 2 }),
      cookieFor(STAFF),
    );
    const { booking } = await booked.json();

    setClock(fixedClock(new Date("2026-08-21T07:30:00.000Z")));
    const playerAttempt = await httpDelete(
      bookingsRoute,
      "/api/bookings",
      { bookingId: booking.id },
      cookieFor(PLAYER),
    );
    expect(playerAttempt.status).toBe(409);
    expect(await playerAttempt.json()).toEqual({ error: "booking_started" });

    const staffCancel = await httpDelete(
      staffBookingsRoute,
      "/api/staff/bookings",
      { bookingId: booking.id },
      cookieFor(STAFF),
    );
    expect(staffCancel.status).toBe(200);
    expect(await staffCancel.json()).toMatchObject({
      cancellation: { kind: "penalty_free" },
    });

    const availability = await httpGet(
      availabilityRoute,
      "/api/availability?date=2026-08-21",
    );
    const body = await availability.json();
    expect(
      body.slots.filter(
        (slot: { courtId: number; start: string; status: string }) =>
          slot.courtId === 1 &&
          [SLOT, NEXT_SLOT].includes(slot.start) &&
          slot.status === "free",
      ),
    ).toHaveLength(2);
  });

  it("refuses a staff cancellation from a player session and for an unknown Booking", async () => {
    const booked = await httpPost(
      bookingsRoute,
      "/api/bookings",
      { courtId: 1, startsAt: SLOT, durationHours: 1 },
      cookieFor(PLAYER),
    );
    const { booking } = await booked.json();

    const fromPlayer = await httpDelete(
      staffBookingsRoute,
      "/api/staff/bookings",
      { bookingId: booking.id },
      cookieFor(PLAYER),
    );
    expect(fromPlayer.status).toBe(403);
    expect(await fromPlayer.json()).toEqual({ error: "staff_only" });

    const unknown = await httpDelete(
      staffBookingsRoute,
      "/api/staff/bookings",
      { bookingId: "no-such-booking" },
      cookieFor(STAFF),
    );
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: "booking_not_found" });

    const upcoming = await httpGet(bookingsRoute, "/api/bookings", cookieFor(PLAYER));
    expect(await upcoming.json()).toMatchObject({ bookings: [{ id: booking.id }] });
  });

  it("records every staff creation and cancellation in the Audit Log", async () => {
    const created = await httpPost(
      staffBookingsRoute,
      "/api/staff/bookings",
      deskBooking({ newPlayer: WALK_IN }),
      cookieFor(STAFF),
    );
    const { booking, booker } = await created.json();

    const cancelledAt = new Date("2026-08-21T05:30:00.000Z");
    setClock(fixedClock(cancelledAt));
    await httpDelete(
      staffBookingsRoute,
      "/api/staff/bookings",
      { bookingId: booking.id },
      cookieFor(STAFF),
    );

    const log = await httpGet(auditLogRoute, "/api/staff/audit-log", cookieFor(STAFF));
    expect(log.status).toBe(200);
    const { entries } = await log.json();
    expect(entries).toHaveLength(2);
    // Newest first.
    expect(entries[0]).toMatchObject({
      action: "booking_cancelled",
      occurredAt: cancelledAt.toISOString(),
      staff: { id: STAFF.playerId, displayName: STAFF.displayName },
      bookingId: booking.id,
      subjectPlayerId: booker.id,
      details: {
        courtName: "Court 1",
        startsAt: SLOT,
        endsAt: NEXT_SLOT,
        bookerName: WALK_IN.displayName,
        bookerPhone: WALK_IN.phone,
      },
    });
    expect(entries[1]).toMatchObject({
      action: "booking_created",
      occurredAt: NOW.toISOString(),
      staff: { id: STAFF.playerId, displayName: STAFF.displayName },
      bookingId: booking.id,
      subjectPlayerId: booker.id,
      details: { courtName: "Court 1", bookerName: WALK_IN.displayName },
    });

    // Only Staff may read the log.
    const playerRead = await httpGet(
      auditLogRoute,
      "/api/staff/audit-log",
      cookieFor(PLAYER),
    );
    expect(playerRead.status).toBe(403);
  });

  // A database invariant, like the no-double-booking constraint: the Audit Log
  // exists so disputes stay resolvable, so no code path may rewrite it.
  it("keeps the Audit Log append-only in the database", async () => {
    await httpPost(
      staffBookingsRoute,
      "/api/staff/bookings",
      deskBooking({ playerId: PLAYER.playerId }),
      cookieFor(STAFF),
    );

    const pool = getPool();
    await expect(
      pool.query("update audit_log_entries set action = 'booking_cancelled'"),
    ).rejects.toThrow(/append-only/);
    await expect(pool.query("delete from audit_log_entries")).rejects.toThrow(
      /append-only/,
    );

    const log = await httpGet(auditLogRoute, "/api/staff/audit-log", cookieFor(STAFF));
    const { entries } = await log.json();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ action: "booking_created" });
  });

  it("shows booker identity on the staff schedule while the public view stays anonymous", async () => {
    await httpPost(
      staffBookingsRoute,
      "/api/staff/bookings",
      deskBooking({ playerId: PLAYER.playerId, durationHours: 2 }),
      cookieFor(STAFF),
    );

    const schedule = await httpGet(
      staffScheduleRoute,
      "/api/staff/schedule?date=2026-08-21",
      cookieFor(STAFF),
    );
    expect(schedule.status).toBe(200);
    const body = await schedule.json();
    expect(body).toMatchObject({ date: "2026-08-21", timeZone: "Asia/Ho_Chi_Minh" });

    const taken = body.slots.filter(
      (slot: { status: string }) => slot.status === "taken",
    );
    expect(taken).toHaveLength(2);
    expect(taken[0]).toMatchObject({
      courtId: 1,
      courtName: "Court 1",
      start: SLOT,
      booking: {
        bookerId: PLAYER.playerId,
        bookerName: PLAYER.displayName,
        bookerPhone: PLAYER.phone,
        startsAt: SLOT,
      },
    });
    expect(
      body.slots.find(
        (slot: { courtId: number; start: string }) =>
          slot.courtId === 2 && slot.start === SLOT,
      ),
    ).toEqual({
      courtId: 2,
      courtName: "Court 2",
      hour: "14:00",
      start: SLOT,
      status: "free",
    });

    const publicView = await httpGet(
      availabilityRoute,
      "/api/availability?date=2026-08-21",
    );
    const publicBody = await publicView.text();
    expect(publicBody).toContain('"taken"');
    expect(publicBody).not.toContain(PLAYER.displayName);
    expect(publicBody).not.toContain(PLAYER.phone);

    const playerRead = await httpGet(
      staffScheduleRoute,
      "/api/staff/schedule?date=2026-08-21",
      cookieFor(PLAYER),
    );
    expect(playerRead.status).toBe(403);
    const anonymousRead = await httpGet(
      staffScheduleRoute,
      "/api/staff/schedule?date=2026-08-21",
    );
    expect(anonymousRead.status).toBe(401);
  });

  it("shows the staff schedule for a day past the Staff member's own horizon", async () => {
    // The desk books for the named Player, so a Staff member's own standing
    // never hides a day from them.
    const publicView = await httpGet(
      availabilityRoute,
      "/api/availability?date=2026-08-28",
      cookieFor(STAFF),
    );
    const publicBody = await publicView.json();
    expect(publicBody.slots[0]).toMatchObject({ status: "outside_horizon" });

    const schedule = await httpGet(
      staffScheduleRoute,
      "/api/staff/schedule?date=2026-08-28",
      cookieFor(STAFF),
    );
    const body = await schedule.json();
    expect(body.date).toBe("2026-08-28");
    expect(
      body.slots.every((slot: { status: string }) => slot.status === "free"),
    ).toBe(true);
  });

  it("lets Staff look up an existing Player to book for", async () => {
    await getPool().query("update players set member_until = $1 where id = $2", [
      "2026-09-30",
      PLAYER.playerId,
    ]);

    const all = await httpGet(staffPlayersRoute, "/api/staff/players", cookieFor(STAFF));
    expect(all.status).toBe(200);
    expect((await all.json()).players).toEqual([
      { id: STAFF.playerId, displayName: STAFF.displayName, phone: STAFF.phone, memberUntil: null },
      {
        id: PLAYER.playerId,
        displayName: PLAYER.displayName,
        phone: PLAYER.phone,
        memberUntil: "2026-09-30",
      },
    ]);

    const byName = await httpGet(
      staffPlayersRoute,
      "/api/staff/players?search=lan",
      cookieFor(STAFF),
    );
    expect((await byName.json()).players).toEqual([
      expect.objectContaining({ id: PLAYER.playerId }),
    ]);

    const byPhone = await httpGet(
      staffPlayersRoute,
      `/api/staff/players?search=${encodeURIComponent(STAFF.phone.slice(-6))}`,
      cookieFor(STAFF),
    );
    expect((await byPhone.json()).players).toEqual([
      expect.objectContaining({ id: STAFF.playerId }),
    ]);

    const fromPlayer = await httpGet(
      staffPlayersRoute,
      "/api/staff/players",
      cookieFor(PLAYER),
    );
    expect(fromPlayer.status).toBe(403);
  });

  it("refuses a desk Booking without a named Player, and one from a player session", async () => {
    const unnamed = await httpPost(
      staffBookingsRoute,
      "/api/staff/bookings",
      deskBooking({}),
      cookieFor(STAFF),
    );
    expect(unnamed.status).toBe(400);
    expect(await unnamed.json()).toEqual({ error: "invalid_request" });

    const unknown = await httpPost(
      staffBookingsRoute,
      "/api/staff/bookings",
      deskBooking({ playerId: "no-such-player" }),
      cookieFor(STAFF),
    );
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: "player_not_found" });

    const badPhone = await httpPost(
      staffBookingsRoute,
      "/api/staff/bookings",
      deskBooking({ newPlayer: { displayName: "Bao Pham", phone: "0901234567" } }),
      cookieFor(STAFF),
    );
    expect(badPhone.status).toBe(400);
    expect(await badPhone.json()).toEqual({ error: "invalid_phone" });

    const blankName = await httpPost(
      staffBookingsRoute,
      "/api/staff/bookings",
      deskBooking({ newPlayer: { displayName: "  ", phone: WALK_IN.phone } }),
      cookieFor(STAFF),
    );
    expect(blankName.status).toBe(400);
    expect(await blankName.json()).toEqual({ error: "invalid_display_name" });

    const fromPlayer = await httpPost(
      staffBookingsRoute,
      "/api/staff/bookings",
      deskBooking({ playerId: PLAYER.playerId }),
      cookieFor(PLAYER),
    );
    expect(fromPlayer.status).toBe(403);
    expect(await fromPlayer.json()).toEqual({ error: "staff_only" });

    const availability = await httpGet(
      availabilityRoute,
      "/api/availability?date=2026-08-21",
    );
    const body = await availability.json();
    expect(
      body.slots.find(
        (slot: { courtId: number; start: string }) =>
          slot.courtId === 1 && slot.start === SLOT,
      ),
    ).toMatchObject({ status: "free" });
  });
});

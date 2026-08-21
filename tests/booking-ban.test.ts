import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as meRoute from "@/app/api/auth/me/route";
import * as bookingsRoute from "@/app/api/bookings/route";
import * as staffBookingsRoute from "@/app/api/staff/bookings/route";
import { fixedClock, resetClock, setClock } from "@/lib/clock";
import { getPool } from "@/lib/db";
import { httpDelete, httpGet, httpPost } from "./harness/http";

const PLAYER = {
  id: "ban-player",
  displayName: "Lan Nguyen",
  phone: "+84904000001",
  sessionToken: "ban-player-session",
};
const COOKIE = { cookie: `pb_session=${PLAYER.sessionToken}` };

const STAFF = {
  id: "ban-staff",
  displayName: "Desk One",
  phone: "+84904000002",
  sessionToken: "ban-staff-session",
};
const STAFF_COOKIE = { cookie: `pb_session=${STAFF.sessionToken}` };

// A Strike is earned the way the app really earns one: a Booking created inside
// the 6-hour Cancellation Cutoff, then cancelled after the 15-minute creation
// grace. Both instants come from the injectable clock, so a test decides to the
// millisecond when each Strike was earned.
const CREATED_TIME = "T05:01:00.000Z"; // 12:01 venue time
const SLOT_TIME = "T06:00:00.000Z"; // 13:00 venue time, inside Opening Hours
const AFTER_GRACE_MS = 15 * 60 * 1000 + 1;

// Days used by the boundary tests. 2026-05-23 is exactly 90 days before
// 2026-08-21, so a Strike earned on the first counts for a Strike earned on the
// last only if the trailing 90-day window includes its own edge.
const DAY_0 = "2026-05-23";
const DAY_88 = "2026-08-19";
const DAY_89 = "2026-08-20";
const DAY_90 = "2026-08-21";
// 14 days after DAY_90: the venue day the ban runs out on.
const BAN_END_DAY = "2026-09-04";

const BAN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

type Account = typeof PLAYER;

async function insertAccount(account: Account, at: Date): Promise<void> {
  const pool = getPool();
  await pool.query(
    `insert into players (id, display_name, phone, created_at)
     values ($1, $2, $3, $4)`,
    [account.id, account.displayName, account.phone, at],
  );
  await pool.query(
    `insert into player_sessions (token_hash, player_id, expires_at, created_at)
     values ($1, $2, $3, $4)`,
    [
      createHash("sha256").update(account.sessionToken).digest("hex"),
      account.id,
      new Date("2027-01-01T00:00:00.000Z"),
      at,
    ],
  );
}

async function resetBanData(): Promise<void> {
  const pool = getPool();
  await pool.query("truncate audit_log_entries");
  await pool.query("delete from slot_claims");
  await pool.query("delete from strikes");
  await pool.query("delete from bookings");
  await pool.query("delete from staff_accounts");
  await pool.query("delete from player_sessions");
  await pool.query("delete from player_signups");
  await pool.query("delete from players");
  await pool.query("delete from opening_hours");
  await pool.query(
    `insert into opening_hours (day_of_week, start_hour, end_hour)
     select day, 6, 22 from generate_series(0, 6) as day`,
  );
  const createdAt = new Date(Date.parse(`${DAY_0}${CREATED_TIME}`));
  await insertAccount(PLAYER, createdAt);
  await insertAccount(STAFF, createdAt);
  await pool.query(
    "insert into staff_accounts (player_id, granted_at) values ($1, $2)",
    [STAFF.id, createdAt],
  );
}

// Earns one Strike for the Player and returns the instant it was earned.
// `shiftMs` moves the whole Booking, and so the Strike, off the whole minute —
// that is how the 90-day boundary is probed a millisecond at a time.
async function earnStrike(day: string, shiftMs = 0): Promise<Date> {
  const createdAt = new Date(Date.parse(`${day}${CREATED_TIME}`) + shiftMs);
  setClock(fixedClock(createdAt));
  const createResponse = await httpPost(
    bookingsRoute,
    "/api/bookings",
    { courtId: 1, startsAt: `${day}${SLOT_TIME}`, durationHours: 1 },
    COOKIE,
  );
  expect(createResponse.status).toBe(201);
  const { booking } = await createResponse.json();

  const earnedAt = new Date(createdAt.getTime() + AFTER_GRACE_MS);
  setClock(fixedClock(earnedAt));
  const cancelResponse = await httpDelete(
    bookingsRoute,
    "/api/bookings",
    { bookingId: booking.id, confirmLateCancel: true },
    COOKIE,
  );
  expect(cancelResponse.status).toBe(200);
  expect(await cancelResponse.json()).toMatchObject({
    cancellation: { kind: "late_cancel" },
  });
  return earnedAt;
}

// A self-service Booking attempt on a free Slot, two hours after the Strike
// Bookings, on the venue day the clock currently sits in.
function attemptBooking(day: string): Promise<Response> {
  return httpPost(
    bookingsRoute,
    "/api/bookings",
    { courtId: 2, startsAt: `${day}T08:00:00.000Z`, durationHours: 1 },
    COOKIE,
  );
}

describe("Booking Ban", () => {
  beforeEach(async () => {
    await resetBanData();
  });

  afterEach(async () => {
    resetClock();
    const pool = getPool();
    await pool.query("delete from slot_claims");
    await pool.query("delete from strikes");
    await pool.query("delete from bookings");
  });

  it("starts a 14-day ban on the Strike that reaches three within 90 days", async () => {
    await earnStrike(DAY_88);
    await earnStrike(DAY_89);
    const thirdEarnedAt = await earnStrike(DAY_90);
    const banEndsAt = new Date(thirdEarnedAt.getTime() + BAN_DAYS_MS);

    const attempt = await attemptBooking(DAY_90);

    expect(attempt.status).toBe(403);
    expect(await attempt.json()).toEqual({
      error: "booking_banned",
      banEndsAt: banEndsAt.toISOString(),
    });

    const profile = await httpGet(meRoute, "/api/auth/me", COOKIE);
    expect(await profile.json()).toMatchObject({
      player: { strikeCount: 3, bookingBanEndsAt: banEndsAt.toISOString() },
    });
  });

  it("does not ban a Player who has only two Strikes", async () => {
    await earnStrike(DAY_89);
    await earnStrike(DAY_90);

    const attempt = await attemptBooking(DAY_90);

    expect(attempt.status).toBe(201);

    const profile = await httpGet(meRoute, "/api/auth/me", COOKIE);
    expect(await profile.json()).toMatchObject({
      player: { strikeCount: 2, bookingBanEndsAt: null },
    });
  });

  it("counts a Strike earned exactly 90 days before the third one", async () => {
    await earnStrike(DAY_0);
    await earnStrike(DAY_89);
    const thirdEarnedAt = await earnStrike(DAY_90);

    const attempt = await attemptBooking(DAY_90);

    expect(attempt.status).toBe(403);
    expect(await attempt.json()).toEqual({
      error: "booking_banned",
      banEndsAt: new Date(thirdEarnedAt.getTime() + BAN_DAYS_MS).toISOString(),
    });
  });

  it("does not count a Strike earned a millisecond past 90 days", async () => {
    await earnStrike(DAY_0, -1);
    await earnStrike(DAY_89);
    await earnStrike(DAY_90);

    const attempt = await attemptBooking(DAY_90);

    expect(attempt.status).toBe(201);

    const profile = await httpGet(meRoute, "/api/auth/me", COOKIE);
    expect(await profile.json()).toMatchObject({
      player: { strikeCount: 2, bookingBanEndsAt: null },
    });
  });

  it("holds the ban to its last millisecond and lifts it after exactly 14 days", async () => {
    await earnStrike(DAY_88);
    await earnStrike(DAY_89);
    const thirdEarnedAt = await earnStrike(DAY_90);
    const banEndsAt = new Date(thirdEarnedAt.getTime() + BAN_DAYS_MS);

    setClock(fixedClock(new Date(banEndsAt.getTime() - 1)));
    const lastMoment = await attemptBooking(BAN_END_DAY);

    expect(lastMoment.status).toBe(403);
    expect(await lastMoment.json()).toEqual({
      error: "booking_banned",
      banEndsAt: banEndsAt.toISOString(),
    });

    setClock(fixedClock(banEndsAt));
    const afterBan = await attemptBooking(BAN_END_DAY);

    expect(afterBan.status).toBe(201);

    const profile = await httpGet(meRoute, "/api/auth/me", COOKIE);
    expect(await profile.json()).toMatchObject({
      player: { strikeCount: 3, bookingBanEndsAt: null },
    });
  });

  it("keeps a banned Player's existing Bookings and still lets them cancel", async () => {
    await earnStrike(DAY_88);
    await earnStrike(DAY_89);

    // Made while two Strikes stand, so before the ban exists.
    setClock(fixedClock(new Date(`${DAY_90}T00:00:00.000Z`)));
    const createResponse = await httpPost(
      bookingsRoute,
      "/api/bookings",
      { courtId: 3, startsAt: `${DAY_90}T12:00:00.000Z`, durationHours: 1 },
      COOKIE,
    );
    expect(createResponse.status).toBe(201);
    const { booking } = await createResponse.json();

    await earnStrike(DAY_90);

    const upcoming = await httpGet(bookingsRoute, "/api/bookings", COOKIE);
    expect(await upcoming.json()).toMatchObject({ bookings: [{ id: booking.id }] });

    const refused = await attemptBooking(DAY_90);
    expect(refused.status).toBe(403);

    const cancelResponse = await httpDelete(
      bookingsRoute,
      "/api/bookings",
      { bookingId: booking.id },
      COOKIE,
    );

    expect(cancelResponse.status).toBe(200);
    expect(await cancelResponse.json()).toEqual({
      cancellation: { bookingId: booking.id, kind: "penalty_free" },
      strikeCount: 3,
    });
  });

  it("still lets Staff book for a banned Player at the desk", async () => {
    await earnStrike(DAY_88);
    await earnStrike(DAY_89);
    await earnStrike(DAY_90);

    const selfService = await attemptBooking(DAY_90);
    expect(selfService.status).toBe(403);

    const deskBooking = await httpPost(
      staffBookingsRoute,
      "/api/staff/bookings",
      {
        playerId: PLAYER.id,
        courtId: 2,
        startsAt: `${DAY_90}T08:00:00.000Z`,
        durationHours: 1,
      },
      STAFF_COOKIE,
    );

    expect(deskBooking.status).toBe(201);
    expect(await deskBooking.json()).toMatchObject({
      booker: { id: PLAYER.id },
      booking: { courtId: 2, startsAt: `${DAY_90}T08:00:00.000Z` },
    });
  });
});

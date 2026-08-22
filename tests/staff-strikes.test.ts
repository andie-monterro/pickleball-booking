import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as meRoute from "@/app/api/auth/me/route";
import * as bookingsRoute from "@/app/api/bookings/route";
import * as auditLogRoute from "@/app/api/staff/audit-log/route";
import * as staffBookingsRoute from "@/app/api/staff/bookings/route";
import * as noShowsRoute from "@/app/api/staff/no-shows/route";
import * as strikesRoute from "@/app/api/staff/strikes/route";
import * as waiversRoute from "@/app/api/staff/waivers/route";
import { fixedClock, resetClock, setClock } from "@/lib/clock";
import { getPool } from "@/lib/db";
import { httpDelete, httpGet, httpPost } from "./harness/http";

// Opening Hours are 06:00–22:00 every day, so 09:00 and 10:00 venue time
// (Asia/Ho_Chi_Minh, UTC+7) are both real Slots.
const BOOKED_AT = new Date("2026-08-21T02:00:00.000Z"); // 09:00 venue time
const SLOT = "2026-08-21T03:00:00.000Z"; // 10:00 venue time
const AFTER_START = new Date("2026-08-21T03:30:00.000Z"); // 10:30 venue time
const SLOT_START = new Date(SLOT);

// Free Slots later the same day, used to probe whether the Player may book.
const LATER_SLOT = "2026-08-21T07:00:00.000Z"; // 14:00 venue time
const DESK_SLOT = "2026-08-21T08:00:00.000Z"; // 15:00 venue time
const AFTER_UNDO_SLOT = "2026-08-21T09:00:00.000Z"; // 16:00 venue time

// Past the 15-minute creation grace, so the cancellation is a Late Cancel.
const AFTER_GRACE_MS = 15 * 60 * 1000 + 1;
const BAN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

const STAFF = {
  playerId: "strikes-staff",
  displayName: "Desk One",
  phone: "+84905000001",
  sessionToken: "strikes-staff-session",
};

const PLAYER = {
  playerId: "strikes-player",
  displayName: "Lan Nguyen",
  phone: "+84905000002",
  sessionToken: "strikes-player-session",
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
    [account.playerId, account.displayName, account.phone, BOOKED_AT],
  );
  await pool.query(
    "insert into player_signups (player_id, completed_at) values ($1, $2)",
    [account.playerId, BOOKED_AT],
  );
  await pool.query(
    `insert into player_sessions (token_hash, player_id, expires_at, created_at)
     values ($1, $2, $3, $4)`,
    [
      createHash("sha256").update(account.sessionToken).digest("hex"),
      account.playerId,
      new Date("2026-10-21T05:00:00.000Z"),
      BOOKED_AT,
    ],
  );
}

async function clearStrikeData(): Promise<void> {
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

async function resetStrikeData(): Promise<void> {
  const pool = getPool();
  await clearStrikeData();
  await pool.query("delete from opening_hours");
  await pool.query(
    `insert into opening_hours (day_of_week, start_hour, end_hour)
     select day, 6, 22 from generate_series(0, 6) as day`,
  );
  await insertAccount(STAFF);
  await insertAccount(PLAYER);
  await pool.query(
    "insert into staff_accounts (player_id, granted_at) values ($1, $2)",
    [STAFF.playerId, BOOKED_AT],
  );
}

// A Booking the Player made themselves, on the Slot that starts at `startsAt`.
async function bookSlot(startsAt = SLOT, courtId = 1): Promise<string> {
  const response = await httpPost(
    bookingsRoute,
    "/api/bookings",
    { courtId, startsAt, durationHours: 1 },
    cookieFor(PLAYER),
  );
  expect(response.status).toBe(201);
  const { booking } = await response.json();
  return booking.id;
}

// One Late Cancel Strike, earned the way the app really earns one: a Booking
// created inside the 6-hour Cancellation Cutoff, cancelled after the 15-minute
// creation grace.
async function earnLateCancelStrike(courtId: number): Promise<void> {
  setClock(fixedClock(BOOKED_AT));
  const bookingId = await bookSlot(SLOT, courtId);
  setClock(fixedClock(new Date(BOOKED_AT.getTime() + AFTER_GRACE_MS)));
  const cancelled = await httpDelete(
    bookingsRoute,
    "/api/bookings",
    { bookingId, confirmLateCancel: true },
    cookieFor(PLAYER),
  );
  expect(cancelled.status).toBe(200);
  expect(await cancelled.json()).toMatchObject({
    cancellation: { kind: "late_cancel" },
  });
}

function attemptSelfServiceBooking(startsAt: string): Promise<Response> {
  return httpPost(
    bookingsRoute,
    "/api/bookings",
    { courtId: 4, startsAt, durationHours: 1 },
    cookieFor(PLAYER),
  );
}

function markNoShow(bookingId: string, account: Account = STAFF): Promise<Response> {
  return httpPost(
    noShowsRoute,
    "/api/staff/no-shows",
    { bookingId },
    cookieFor(account),
  );
}

function undoNoShow(bookingId: string, account: Account = STAFF): Promise<Response> {
  return httpDelete(
    noShowsRoute,
    "/api/staff/no-shows",
    { bookingId },
    cookieFor(account),
  );
}

function waiveStrike(strikeId: string, account: Account = STAFF): Promise<Response> {
  return httpPost(
    waiversRoute,
    "/api/staff/waivers",
    { strikeId },
    cookieFor(account),
  );
}

async function readStrikes(playerId = PLAYER.playerId): Promise<
  { id: string; reason: string; earnedAt: string; waivedAt: string | null }[]
> {
  const response = await httpGet(
    strikesRoute,
    `/api/staff/strikes?playerId=${playerId}`,
    cookieFor(STAFF),
  );
  expect(response.status).toBe(200);
  return (await response.json()).strikes;
}

async function playerProfile(): Promise<{
  strikeCount: number;
  bookingBanEndsAt: string | null;
}> {
  const response = await httpGet(meRoute, "/api/auth/me", cookieFor(PLAYER));
  expect(response.status).toBe(200);
  return (await response.json()).player;
}

describe("No-show marking", () => {
  beforeEach(async () => {
    setClock(fixedClock(BOOKED_AT));
    await resetStrikeData();
  });

  afterEach(async () => {
    resetClock();
    await clearStrikeData();
  });

  it("marks a started Booking as a No-show and raises the Booker's Strike count", async () => {
    const bookingId = await bookSlot();

    setClock(fixedClock(AFTER_START));
    const marked = await markNoShow(bookingId);

    expect(marked.status).toBe(201);
    expect(await marked.json()).toMatchObject({
      strike: {
        bookingId,
        playerId: PLAYER.playerId,
        reason: "no_show",
        earnedAt: AFTER_START.toISOString(),
        waivedAt: null,
        courtName: "Court 1",
        startsAt: SLOT,
      },
      player: { id: PLAYER.playerId, displayName: PLAYER.displayName },
      strikeCount: 1,
      bookingBanEndsAt: null,
    });
    expect(await playerProfile()).toMatchObject({ strikeCount: 1 });
  });

  it("refuses a No-show mark before the Booking starts and allows it from the start instant", async () => {
    const bookingId = await bookSlot();

    const early = await markNoShow(bookingId);

    expect(early.status).toBe(409);
    expect(await early.json()).toEqual({ error: "booking_not_started" });
    expect(await playerProfile()).toMatchObject({ strikeCount: 0 });

    // "Any time after it starts" includes the start instant itself, the same
    // boundary the Booker's own cancellation already refuses at.
    setClock(fixedClock(SLOT_START));
    const atStart = await markNoShow(bookingId);

    expect(atStart.status).toBe(201);
    expect(await playerProfile()).toMatchObject({ strikeCount: 1 });
  });
});

describe("Undoing a No-show", () => {
  beforeEach(async () => {
    setClock(fixedClock(BOOKED_AT));
    await resetStrikeData();
  });

  afterEach(async () => {
    resetClock();
    await clearStrikeData();
  });

  it("removes the Strike it created and lifts the ban that only existed because of it", async () => {
    await earnLateCancelStrike(2);
    await earnLateCancelStrike(3);
    setClock(fixedClock(BOOKED_AT));
    const bookingId = await bookSlot();

    setClock(fixedClock(AFTER_START));
    const marked = await markNoShow(bookingId);
    const banEndsAt = new Date(AFTER_START.getTime() + BAN_DAYS_MS).toISOString();

    expect(marked.status).toBe(201);
    expect(await marked.json()).toMatchObject({
      strikeCount: 3,
      bookingBanEndsAt: banEndsAt,
    });
    expect(await playerProfile()).toEqual({
      id: PLAYER.playerId,
      displayName: PLAYER.displayName,
      phone: PLAYER.phone,
      strikeCount: 3,
      bookingBanEndsAt: banEndsAt,
      role: "player",
    });

    const banned = await attemptSelfServiceBooking(LATER_SLOT);
    expect(banned.status).toBe(403);
    expect(await banned.json()).toEqual({
      error: "booking_banned",
      banEndsAt,
    });

    // The ban gates self-service only, so the desk still books for this Player.
    const deskBooking = await httpPost(
      staffBookingsRoute,
      "/api/staff/bookings",
      {
        playerId: PLAYER.playerId,
        courtId: 4,
        startsAt: DESK_SLOT,
        durationHours: 1,
      },
      cookieFor(STAFF),
    );
    expect(deskBooking.status).toBe(201);
    expect(await deskBooking.json()).toMatchObject({
      booker: { id: PLAYER.playerId },
      booking: { startsAt: DESK_SLOT },
    });

    const undone = await undoNoShow(bookingId);

    expect(undone.status).toBe(200);
    expect(await undone.json()).toEqual({
      bookingId,
      player: {
        id: PLAYER.playerId,
        displayName: PLAYER.displayName,
        phone: PLAYER.phone,
      },
      strikeCount: 2,
      bookingBanEndsAt: null,
    });
    expect(await playerProfile()).toMatchObject({
      strikeCount: 2,
      bookingBanEndsAt: null,
    });
    expect(await readStrikes()).toHaveLength(2);

    const afterUndo = await attemptSelfServiceBooking(AFTER_UNDO_SLOT);
    expect(afterUndo.status).toBe(201);
  });

  it("refuses a second mark on the same Booking and an undo when nothing is marked", async () => {
    const bookingId = await bookSlot();

    const beforeMark = await undoNoShow(bookingId);
    expect(beforeMark.status).toBe(404);
    expect(await beforeMark.json()).toEqual({ error: "no_show_not_marked" });

    setClock(fixedClock(AFTER_START));
    expect((await markNoShow(bookingId)).status).toBe(201);

    const again = await markNoShow(bookingId);
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: "no_show_already_marked" });
    expect(await playerProfile()).toMatchObject({ strikeCount: 1 });

    expect((await undoNoShow(bookingId)).status).toBe(200);

    // Undone, so the same Booking may be marked again.
    expect((await markNoShow(bookingId)).status).toBe(201);
    expect(await playerProfile()).toMatchObject({ strikeCount: 1 });
  });

  it("refuses a No-show on a cancelled or unknown Booking, and from anyone but Staff", async () => {
    const bookingId = await bookSlot();
    const cancelled = await httpDelete(
      staffBookingsRoute,
      "/api/staff/bookings",
      { bookingId },
      cookieFor(STAFF),
    );
    expect(cancelled.status).toBe(200);

    setClock(fixedClock(AFTER_START));
    // A cancelled Booking was never played, so a Late Cancel — not a No-show —
    // is the Strike that fits it.
    const onCancelled = await markNoShow(bookingId);
    expect(onCancelled.status).toBe(409);
    expect(await onCancelled.json()).toEqual({ error: "booking_cancelled" });

    const unknown = await markNoShow("no-such-booking");
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: "booking_not_found" });

    const fromPlayer = await markNoShow(bookingId, PLAYER);
    expect(fromPlayer.status).toBe(403);
    expect(await fromPlayer.json()).toEqual({ error: "staff_only" });

    const fromNobody = await httpPost(noShowsRoute, "/api/staff/no-shows", {
      bookingId,
    });
    expect(fromNobody.status).toBe(401);
    expect(await fromNobody.json()).toEqual({ error: "unauthorized" });

    const withoutBooking = await markNoShow("");
    expect(withoutBooking.status).toBe(400);
    expect(await withoutBooking.json()).toEqual({ error: "invalid_request" });
  });
});

describe("Strike waivers", () => {
  beforeEach(async () => {
    setClock(fixedClock(BOOKED_AT));
    await resetStrikeData();
  });

  afterEach(async () => {
    resetClock();
    await clearStrikeData();
  });

  it("waives a Late Cancel Strike, so it stops counting and the ban it caused ends", async () => {
    await earnLateCancelStrike(2);
    await earnLateCancelStrike(3);
    setClock(fixedClock(BOOKED_AT));
    const bookingId = await bookSlot();
    setClock(fixedClock(AFTER_START));
    expect((await markNoShow(bookingId)).status).toBe(201);
    expect((await attemptSelfServiceBooking(LATER_SLOT)).status).toBe(403);

    const strikes = await readStrikes();
    expect(strikes).toHaveLength(3);
    // Newest first, and the mark is the latest Strike.
    expect(strikes[0]).toMatchObject({ reason: "no_show", waivedAt: null });
    expect(strikes[2]).toMatchObject({ reason: "late_cancel", waivedAt: null });

    const waived = await waiveStrike(strikes[2].id);

    expect(waived.status).toBe(201);
    expect(await waived.json()).toMatchObject({
      strike: {
        id: strikes[2].id,
        reason: "late_cancel",
        waivedAt: AFTER_START.toISOString(),
      },
      player: { id: PLAYER.playerId },
      strikeCount: 2,
      bookingBanEndsAt: null,
    });
    expect(await playerProfile()).toMatchObject({
      strikeCount: 2,
      bookingBanEndsAt: null,
    });
    // The Strike stays on the record; it only stops counting.
    expect(await readStrikes()).toHaveLength(3);

    const afterWaiver = await attemptSelfServiceBooking(AFTER_UNDO_SLOT);
    expect(afterWaiver.status).toBe(201);
  });

  it("waives a No-show Strike too, and refuses a second waiver or an unknown Strike", async () => {
    const bookingId = await bookSlot();
    setClock(fixedClock(AFTER_START));
    expect((await markNoShow(bookingId)).status).toBe(201);
    const [strike] = await readStrikes();

    const waived = await waiveStrike(strike.id);

    expect(waived.status).toBe(201);
    expect(await waived.json()).toMatchObject({
      strike: { reason: "no_show", waivedAt: AFTER_START.toISOString() },
      strikeCount: 0,
    });
    expect(await playerProfile()).toMatchObject({ strikeCount: 0 });

    const again = await waiveStrike(strike.id);
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: "strike_already_waived" });

    const unknown = await waiveStrike("no-such-strike");
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: "strike_not_found" });

    const fromPlayer = await waiveStrike(strike.id, PLAYER);
    expect(fromPlayer.status).toBe(403);
    expect(await fromPlayer.json()).toEqual({ error: "staff_only" });

    // A waived No-show mark is still a mark, so Staff may still undo it.
    expect((await undoNoShow(bookingId)).status).toBe(200);
    expect(await readStrikes()).toHaveLength(0);
  });

  it("keeps the Strike list behind a Staff session and needs a Player", async () => {
    const withoutPlayer = await httpGet(
      strikesRoute,
      "/api/staff/strikes",
      cookieFor(STAFF),
    );
    expect(withoutPlayer.status).toBe(400);
    expect(await withoutPlayer.json()).toEqual({ error: "invalid_request" });

    const fromPlayer = await httpGet(
      strikesRoute,
      `/api/staff/strikes?playerId=${PLAYER.playerId}`,
      cookieFor(PLAYER),
    );
    expect(fromPlayer.status).toBe(403);

    const fromNobody = await httpGet(
      strikesRoute,
      `/api/staff/strikes?playerId=${PLAYER.playerId}`,
    );
    expect(fromNobody.status).toBe(401);
  });
});

describe("Audit Log for No-shows and waivers", () => {
  beforeEach(async () => {
    setClock(fixedClock(BOOKED_AT));
    await resetStrikeData();
  });

  afterEach(async () => {
    resetClock();
    await clearStrikeData();
  });

  it("records the mark, the undo and the waiver under the acting Staff account", async () => {
    const bookingId = await bookSlot();
    setClock(fixedClock(AFTER_START));
    expect((await markNoShow(bookingId)).status).toBe(201);
    const [strike] = await readStrikes();
    // Each judgement gets its own minute, so the log's newest-first order is the
    // order the desk acted in.
    const waivedAt = new Date(AFTER_START.getTime() + 60 * 1000);
    setClock(fixedClock(waivedAt));
    expect((await waiveStrike(strike.id)).status).toBe(201);
    const undoneAt = new Date(AFTER_START.getTime() + 2 * 60 * 1000);
    setClock(fixedClock(undoneAt));
    expect((await undoNoShow(bookingId)).status).toBe(200);

    const log = await httpGet(
      auditLogRoute,
      "/api/staff/audit-log",
      cookieFor(STAFF),
    );
    const { entries } = await log.json();

    expect(entries).toHaveLength(3);
    const staff = { id: STAFF.playerId, displayName: STAFF.displayName };
    const bookingDetails = {
      courtName: "Court 1",
      startsAt: SLOT,
      bookerName: PLAYER.displayName,
      bookerPhone: PLAYER.phone,
    };
    expect(entries.map((entry: { action: string }) => entry.action)).toEqual([
      "no_show_undone",
      "strike_waived",
      "no_show_marked",
    ]);
    expect(entries[0]).toMatchObject({
      action: "no_show_undone",
      occurredAt: undoneAt.toISOString(),
      staff,
      bookingId,
      subjectPlayerId: PLAYER.playerId,
      details: bookingDetails,
    });
    expect(entries[1]).toMatchObject({
      action: "strike_waived",
      occurredAt: waivedAt.toISOString(),
      staff,
      // A Strike belongs to exactly one Booking, so the Booking id points at the
      // Strike even after its row is gone.
      bookingId,
      subjectPlayerId: PLAYER.playerId,
      details: {
        strikeReason: "no_show",
        earnedAt: AFTER_START.toISOString(),
        playerName: PLAYER.displayName,
        playerPhone: PLAYER.phone,
      },
    });
    expect(entries[2]).toMatchObject({
      action: "no_show_marked",
      occurredAt: AFTER_START.toISOString(),
      staff,
      bookingId,
      subjectPlayerId: PLAYER.playerId,
      details: bookingDetails,
    });
  });
});

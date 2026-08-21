import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as availabilityRoute from "@/app/api/availability/route";
import * as bookingsRoute from "@/app/api/bookings/route";
import * as auditLogRoute from "@/app/api/staff/audit-log/route";
import * as staffBlocksRoute from "@/app/api/staff/blocks/route";
import * as staffBookingsRoute from "@/app/api/staff/bookings/route";
import * as staffScheduleRoute from "@/app/api/staff/schedule/route";
import { fixedClock, resetClock, setClock } from "@/lib/clock";
import { getPool } from "@/lib/db";
import { httpDelete, httpGet, httpPost } from "./harness/http";

// 2026-08-21 12:00 venue time (Asia/Ho_Chi_Minh, UTC+7). Opening Hours are
// 06:00–22:00 every day, so the venue day's Slots start at 06:00 and the last
// one starts at 21:00.
const NOW = new Date("2026-08-21T05:00:00.000Z");
const DATE = "2026-08-21";

const STAFF = {
  playerId: "blocks-staff",
  displayName: "Desk One",
  phone: "+84904000001",
  sessionToken: "blocks-staff-session",
};

const PLAYER = {
  playerId: "blocks-player",
  displayName: "Lan Nguyen",
  phone: "+84904000002",
  sessionToken: "blocks-player-session",
};

// 14:00, 15:00 and 16:00 venue time: three consecutive Slots inside Opening
// Hours and inside every standing's horizon.
const SLOT = "2026-08-21T07:00:00.000Z";
const NEXT_SLOT = "2026-08-21T08:00:00.000Z";
const THIRD_SLOT = "2026-08-21T09:00:00.000Z";
const FOURTH_SLOT = "2026-08-21T10:00:00.000Z";

// 21:00 venue time, the venue day's last Slot: the hour after it is outside
// Opening Hours.
const LAST_SLOT = "2026-08-21T14:00:00.000Z";

type Account = typeof STAFF;

type SlotView = {
  courtId: number;
  start: string;
  status: string;
  label?: string;
  block?: { id: string; startsAt: string; endsAt: string };
};

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

async function clearBlockData(): Promise<void> {
  const pool = getPool();
  // The Audit Log is append-only, so nothing may delete from it. Tests reset it
  // with truncate, which the append-only trigger does not see.
  await pool.query("truncate audit_log_entries");
  await pool.query("delete from slot_claims");
  await pool.query("delete from blocks");
  await pool.query("delete from strikes");
  await pool.query("delete from bookings");
  await pool.query("delete from staff_accounts");
  await pool.query("delete from player_sessions");
  await pool.query("delete from player_signups");
  await pool.query("delete from players");
}

async function resetBlockData(): Promise<void> {
  const pool = getPool();
  await clearBlockData();
  await pool.query("delete from opening_hours");
  await pool.query(
    `insert into opening_hours (day_of_week, start_hour, end_hour)
     select day, 6, 22 from generate_series(0, 6) as day`,
  );
  await insertAccount(STAFF);
  await insertAccount(PLAYER);
  await pool.query(
    "insert into staff_accounts (player_id, granted_at) values ($1, $2)",
    [STAFF.playerId, NOW],
  );
}

function placeBlock(
  body: Record<string, unknown>,
  account: Account = STAFF,
): Promise<Response> {
  return httpPost(
    staffBlocksRoute,
    "/api/staff/blocks",
    { courtId: 1, startsAt: SLOT, slotCount: 1, ...body },
    cookieFor(account),
  );
}

async function publicSlots(): Promise<SlotView[]> {
  const response = await httpGet(
    availabilityRoute,
    `/api/availability?date=${DATE}`,
  );
  return (await response.json()).slots;
}

async function staffSlots(): Promise<SlotView[]> {
  const response = await httpGet(
    staffScheduleRoute,
    `/api/staff/schedule?date=${DATE}`,
    cookieFor(STAFF),
  );
  return (await response.json()).slots;
}

function onCourt(slots: SlotView[], courtId: number, starts: string[]): SlotView[] {
  return slots.filter(
    (slot) => slot.courtId === courtId && starts.includes(slot.start),
  );
}

describe("staff Block HTTP API", () => {
  beforeEach(async () => {
    setClock(fixedClock(NOW));
    await resetBlockData();
  });

  afterEach(async () => {
    resetClock();
    await clearBlockData();
  });

  it("places a Block on a range of free Slots, which the public grid shows as blocked", async () => {
    const response = await placeBlock({ startsAt: SLOT, slotCount: 3 });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      block: {
        courtId: 1,
        courtName: "Court 1",
        startsAt: SLOT,
        endsAt: FOURTH_SLOT,
        slotCount: 3,
      },
    });

    const blocked = onCourt(await publicSlots(), 1, [SLOT, NEXT_SLOT, THIRD_SLOT]);
    expect(blocked).toHaveLength(3);
    expect(blocked.every((slot) => slot.status === "blocked")).toBe(true);
    expect(blocked.every((slot) => slot.label === "Blocked")).toBe(true);

    // A Block takes one Court out of booking, not the venue.
    expect(onCourt(await publicSlots(), 2, [SLOT])).toEqual([
      expect.objectContaining({ status: "free" }),
    ]);
    // The hour after the range stays free.
    expect(onCourt(await publicSlots(), 1, [FOURTH_SLOT])).toEqual([
      expect.objectContaining({ status: "free" }),
    ]);
  });

  it("refuses a booking attempt on a blocked Slot, from a Player and from the desk", async () => {
    await placeBlock({ startsAt: SLOT, slotCount: 2 });

    const playerAttempt = await httpPost(
      bookingsRoute,
      "/api/bookings",
      { courtId: 1, startsAt: SLOT, durationHours: 1 },
      cookieFor(PLAYER),
    );
    expect(playerAttempt.status).toBe(409);
    expect(await playerAttempt.json()).toEqual({ error: "slot_taken" });

    // A two-hour Booking that only overlaps the Block's second Slot is refused
    // whole: a Booking claims every Slot it covers or none.
    const overlapping = await httpPost(
      bookingsRoute,
      "/api/bookings",
      { courtId: 1, startsAt: NEXT_SLOT, durationHours: 2 },
      cookieFor(PLAYER),
    );
    expect(overlapping.status).toBe(409);

    const deskAttempt = await httpPost(
      staffBookingsRoute,
      "/api/staff/bookings",
      {
        courtId: 1,
        startsAt: SLOT,
        durationHours: 1,
        playerId: PLAYER.playerId,
      },
      cookieFor(STAFF),
    );
    expect(deskAttempt.status).toBe(409);
    expect(await deskAttempt.json()).toEqual({ error: "slot_taken" });

    const upcoming = await httpGet(bookingsRoute, "/api/bookings", cookieFor(PLAYER));
    expect(await upcoming.json()).toEqual({ bookings: [] });
    // The refused Booking left the Block untouched, and its Slots still blocked.
    expect(
      onCourt(await publicSlots(), 1, [SLOT, NEXT_SLOT, THIRD_SLOT]).map(
        (slot) => slot.status,
      ),
    ).toEqual(["blocked", "blocked", "free"]);
  });

  it("refuses a Block over a range holding a Booking, and takes the same Block once Staff cancel it", async () => {
    const booked = await httpPost(
      bookingsRoute,
      "/api/bookings",
      { courtId: 1, startsAt: NEXT_SLOT, durationHours: 1 },
      cookieFor(PLAYER),
    );
    expect(booked.status).toBe(201);
    const { booking } = await booked.json();

    const refused = await placeBlock({ startsAt: SLOT, slotCount: 3 });
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: "slot_taken" });

    // No player's Booking silently disappears, and a refused Block claims
    // nothing at all — not even the free Slots in its range.
    expect(
      onCourt(await publicSlots(), 1, [SLOT, NEXT_SLOT, THIRD_SLOT]).map(
        (slot) => slot.status,
      ),
    ).toEqual(["free", "taken", "free"]);
    const upcoming = await httpGet(bookingsRoute, "/api/bookings", cookieFor(PLAYER));
    expect(await upcoming.json()).toMatchObject({ bookings: [{ id: booking.id }] });

    const cancelled = await httpDelete(
      staffBookingsRoute,
      "/api/staff/bookings",
      { bookingId: booking.id },
      cookieFor(STAFF),
    );
    expect(cancelled.status).toBe(200);

    const accepted = await placeBlock({ startsAt: SLOT, slotCount: 3 });
    expect(accepted.status).toBe(201);
    expect(
      onCourt(await publicSlots(), 1, [SLOT, NEXT_SLOT, THIRD_SLOT]).map(
        (slot) => slot.status,
      ),
    ).toEqual(["blocked", "blocked", "blocked"]);
  });

  it("removes a Block, reopening its Slots immediately", async () => {
    const placed = await placeBlock({ startsAt: SLOT, slotCount: 2 });
    const { block } = await placed.json();

    // The desk finds the Block on the schedule, which carries its id.
    const scheduled = onCourt(await staffSlots(), 1, [SLOT, NEXT_SLOT]);
    expect(scheduled).toEqual([
      expect.objectContaining({
        status: "blocked",
        block: { id: block.id, startsAt: SLOT, endsAt: THIRD_SLOT },
      }),
      expect.objectContaining({
        status: "blocked",
        block: { id: block.id, startsAt: SLOT, endsAt: THIRD_SLOT },
      }),
    ]);

    const removed = await httpDelete(
      staffBlocksRoute,
      "/api/staff/blocks",
      { blockId: block.id },
      cookieFor(STAFF),
    );
    expect(removed.status).toBe(200);
    expect(await removed.json()).toMatchObject({
      block: { id: block.id, courtName: "Court 1", startsAt: SLOT },
    });

    expect(
      onCourt(await publicSlots(), 1, [SLOT, NEXT_SLOT]).map((slot) => slot.status),
    ).toEqual(["free", "free"]);

    // A reopened Slot is bookable again.
    const booked = await httpPost(
      bookingsRoute,
      "/api/bookings",
      { courtId: 1, startsAt: SLOT, durationHours: 2 },
      cookieFor(PLAYER),
    );
    expect(booked.status).toBe(201);

    // Removing the same Block twice finds nothing left to remove.
    const again = await httpDelete(
      staffBlocksRoute,
      "/api/staff/blocks",
      { blockId: block.id },
      cookieFor(STAFF),
    );
    expect(again.status).toBe(404);
    expect(await again.json()).toEqual({ error: "block_not_found" });
  });

  // The same database invariant that stops double-bookings: one row per
  // (court, slot start), so a Block and a Booking racing for a Slot cannot both
  // win.
  it("lets Postgres resolve a Block and a Booking racing for the same Slot", async () => {
    const responses = await Promise.all([
      placeBlock({ courtId: 3, startsAt: SLOT, slotCount: 1 }),
      httpPost(
        bookingsRoute,
        "/api/bookings",
        { courtId: 3, startsAt: SLOT, durationHours: 1 },
        cookieFor(PLAYER),
      ),
    ]);
    const [blockResponse, bookingResponse] = responses;

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const loser = responses.find((response) => response.status === 409);
    expect(await loser?.json()).toEqual({ error: "slot_taken" });

    // Exactly one claim survives, and it is the winner's.
    const slot = onCourt(await publicSlots(), 3, [SLOT])[0];
    expect(slot.status).toBe(blockResponse.status === 201 ? "blocked" : "taken");

    const upcoming = await httpGet(bookingsRoute, "/api/bookings", cookieFor(PLAYER));
    expect((await upcoming.json()).bookings).toHaveLength(
      bookingResponse.status === 201 ? 1 : 0,
    );
  });

  it("records placing and removing a Block in the Audit Log with staff identity", async () => {
    const placed = await placeBlock({ startsAt: SLOT, slotCount: 2 });
    const { block } = await placed.json();

    const removedAt = new Date("2026-08-21T05:30:00.000Z");
    setClock(fixedClock(removedAt));
    await httpDelete(
      staffBlocksRoute,
      "/api/staff/blocks",
      { blockId: block.id },
      cookieFor(STAFF),
    );

    const log = await httpGet(auditLogRoute, "/api/staff/audit-log", cookieFor(STAFF));
    const { entries } = await log.json();
    expect(entries).toHaveLength(2);
    // Newest first.
    expect(entries[0]).toMatchObject({
      action: "block_removed",
      occurredAt: removedAt.toISOString(),
      staff: { id: STAFF.playerId, displayName: STAFF.displayName },
      blockId: block.id,
      details: { courtName: "Court 1", startsAt: SLOT, endsAt: THIRD_SLOT },
    });
    expect(entries[1]).toMatchObject({
      action: "block_placed",
      occurredAt: NOW.toISOString(),
      staff: { id: STAFF.playerId, displayName: STAFF.displayName },
      blockId: block.id,
      details: { courtName: "Court 1", startsAt: SLOT, endsAt: THIRD_SLOT },
    });
    // A Block has no Booker, so no entry names a Player.
    expect(entries.every((entry: { subjectPlayerId: null }) => entry.subjectPlayerId === null)).toBe(true);
  });

  it("refuses a Block from a player session, from nobody, and outside Opening Hours", async () => {
    const fromPlayer = await placeBlock({}, PLAYER);
    expect(fromPlayer.status).toBe(403);
    expect(await fromPlayer.json()).toEqual({ error: "staff_only" });

    const anonymous = await httpPost(staffBlocksRoute, "/api/staff/blocks", {
      courtId: 1,
      startsAt: SLOT,
      slotCount: 1,
    });
    expect(anonymous.status).toBe(401);
    expect(await anonymous.json()).toEqual({ error: "unauthorized" });

    const removalFromPlayer = await httpDelete(
      staffBlocksRoute,
      "/api/staff/blocks",
      { blockId: "no-such-block" },
      cookieFor(PLAYER),
    );
    expect(removalFromPlayer.status).toBe(403);

    // A range that runs past closing time has no Slot to claim in that hour.
    const pastClosing = await placeBlock({ startsAt: LAST_SLOT, slotCount: 2 });
    expect(pastClosing.status).toBe(400);
    expect(await pastClosing.json()).toEqual({ error: "outside_opening_hours" });

    const unknownCourt = await placeBlock({ courtId: 99 });
    expect(unknownCourt.status).toBe(404);
    expect(await unknownCourt.json()).toEqual({ error: "court_not_found" });

    for (const invalid of [
      { slotCount: 0 },
      { slotCount: 1.5 },
      { slotCount: "2" },
      { slotCount: undefined },
      { startsAt: "2026-08-21T07:30:00.000Z" },
      { startsAt: "not-a-time" },
      { courtId: 0 },
    ]) {
      const response = await placeBlock(invalid);
      expect(await response.json()).toEqual({ error: "invalid_request" });
      expect(response.status).toBe(400);
    }

    const noId = await httpDelete(
      staffBlocksRoute,
      "/api/staff/blocks",
      {},
      cookieFor(STAFF),
    );
    expect(noId.status).toBe(400);
    expect(await noId.json()).toEqual({ error: "invalid_request" });

    // Nothing above claimed a Slot.
    expect(onCourt(await publicSlots(), 1, [SLOT])).toEqual([
      expect.objectContaining({ status: "free" }),
    ]);
  });
});

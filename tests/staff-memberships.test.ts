import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as availabilityRoute from "@/app/api/availability/route";
import * as auditLogRoute from "@/app/api/staff/audit-log/route";
import * as membershipsRoute from "@/app/api/staff/memberships/route";
import * as playersRoute from "@/app/api/staff/players/route";
import { fixedClock, resetClock, setClock } from "@/lib/clock";
import { getPool } from "@/lib/db";
import { httpGet, httpPut } from "./harness/http";

// 2026-08-21 12:00 venue time (Asia/Ho_Chi_Minh, UTC+7).
const NOW = new Date("2026-08-21T05:00:00.000Z");
const TODAY = "2026-08-21";
const YESTERDAY = "2026-08-20";

const DESK = {
  playerId: "memberships-desk",
  displayName: "Desk One",
  phone: "+84905000001",
  sessionToken: "memberships-desk-session",
};

const PLAYER = {
  playerId: "memberships-player",
  displayName: "Lan Nguyen",
  phone: "+84905000002",
  sessionToken: "memberships-player-session",
};

type Account = typeof DESK;

function cookieFor(account: Account): { cookie: string } {
  return { cookie: `pb_session=${account.sessionToken}` };
}

function atMinute(minute: number): void {
  setClock(fixedClock(new Date(NOW.getTime() + minute * 60 * 1000)));
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

async function clearMembershipData(): Promise<void> {
  const pool = getPool();
  // The Audit Log is append-only, so nothing may delete from it. Tests reset it
  // with truncate, which the append-only trigger does not see.
  await pool.query("truncate audit_log_entries");
  await pool.query("delete from staff_accounts");
  await pool.query("delete from player_sessions");
  await pool.query("delete from players");
}

// The standing the app reads for this Player right now, and how far ahead they
// may book: both come out of the availability read, which is where a Player
// sees their own membership at work.
async function standingOfPlayer(): Promise<{ viewer: string; days: number }> {
  const response = await httpGet(availabilityRoute, "/api/availability", cookieFor(PLAYER));
  expect(response.status).toBe(200);
  const body = await response.json();
  return {
    viewer: body.viewer,
    days: body.days.filter((day: { bookable: boolean }) => day.bookable).length,
  };
}

async function setMemberUntil(memberUntil: string | null): Promise<Response> {
  return httpPut(
    membershipsRoute,
    "/api/staff/memberships",
    { playerId: PLAYER.playerId, memberUntil },
    cookieFor(DESK),
  );
}

describe("membership dates HTTP API", () => {
  beforeEach(async () => {
    setClock(fixedClock(NOW));
    await clearMembershipData();
    await insertAccount(DESK);
    await insertAccount(PLAYER);
    await getPool().query(
      "insert into staff_accounts (player_id, granted_at) values ($1, $2)",
      [DESK.playerId, NOW],
    );
  });

  afterEach(async () => {
    resetClock();
    await clearMembershipData();
  });

  it("makes a Player a Member until the date Staff set", async () => {
    expect(await standingOfPlayer()).toEqual({ viewer: "casual", days: 7 });

    const sold = await setMemberUntil("2026-09-30");
    expect(sold.status).toBe(200);
    expect(await sold.json()).toEqual({
      player: {
        id: PLAYER.playerId,
        displayName: PLAYER.displayName,
        phone: PLAYER.phone,
        memberUntil: "2026-09-30",
      },
    });
    expect(await standingOfPlayer()).toEqual({ viewer: "member", days: 14 });

    // The desk's own Player lookup says the same, so Staff can see why a day is
    // inside or outside this Player's horizon.
    const lookup = await httpGet(playersRoute, "/api/staff/players", cookieFor(DESK));
    expect((await lookup.json()).players).toContainEqual(
      expect.objectContaining({ id: PLAYER.playerId, memberUntil: "2026-09-30" }),
    );
  });

  it("keeps the Player a Member for the whole of the last day, and not after it", async () => {
    const lastDay = await setMemberUntil(TODAY);
    expect(lastDay.status).toBe(200);
    expect(await standingOfPlayer()).toEqual({ viewer: "member", days: 14 });

    const overSince = await setMemberUntil(YESTERDAY);
    expect(overSince.status).toBe(200);
    expect(await standingOfPlayer()).toEqual({ viewer: "casual", days: 7 });
  });

  it("clears a membership date, which makes the Player a casual player again", async () => {
    await setMemberUntil("2026-09-30");

    const cleared = await setMemberUntil(null);
    expect(cleared.status).toBe(200);
    expect(await cleared.json()).toMatchObject({ player: { memberUntil: null } });
    expect(await standingOfPlayer()).toEqual({ viewer: "casual", days: 7 });
  });

  it("records every membership change in the Audit Log with the Staff identity", async () => {
    await setMemberUntil("2026-09-30");
    atMinute(1);
    await setMemberUntil("2026-12-31");
    atMinute(2);
    await setMemberUntil(null);

    const log = await httpGet(auditLogRoute, "/api/staff/audit-log", cookieFor(DESK));
    const { entries } = await log.json();
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      action: "membership_changed",
      staff: { id: DESK.playerId, displayName: DESK.displayName },
      subjectPlayerId: PLAYER.playerId,
      details: {
        playerName: PLAYER.displayName,
        playerPhone: PLAYER.phone,
        memberUntil: null,
        previousMemberUntil: "2026-12-31",
      },
    });
    expect(entries[2]).toMatchObject({
      details: { memberUntil: "2026-09-30", previousMemberUntil: null },
    });
  });

  it("refuses a membership change it cannot carry out", async () => {
    const unknownPlayer = await httpPut(
      membershipsRoute,
      "/api/staff/memberships",
      { playerId: "nobody", memberUntil: "2026-09-30" },
      cookieFor(DESK),
    );
    expect(unknownPlayer.status).toBe(404);
    expect(await unknownPlayer.json()).toEqual({ error: "player_not_found" });

    for (const memberUntil of ["30-09-2026", "2026-09-31", "2026-9-3", "soon", 20260930]) {
      const response = await httpPut(
        membershipsRoute,
        "/api/staff/memberships",
        { playerId: PLAYER.playerId, memberUntil },
        cookieFor(DESK),
      );
      expect(response.status, JSON.stringify(memberUntil)).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_request" });
    }

    const noPlayer = await httpPut(
      membershipsRoute,
      "/api/staff/memberships",
      { memberUntil: "2026-09-30" },
      cookieFor(DESK),
    );
    expect(noPlayer.status).toBe(400);

    const fromPlayer = await httpPut(
      membershipsRoute,
      "/api/staff/memberships",
      { playerId: PLAYER.playerId, memberUntil: "2026-09-30" },
      cookieFor(PLAYER),
    );
    expect(fromPlayer.status).toBe(403);
    expect(await fromPlayer.json()).toEqual({ error: "staff_only" });

    const anonymous = await httpPut(membershipsRoute, "/api/staff/memberships", {
      playerId: PLAYER.playerId,
      memberUntil: "2026-09-30",
    });
    expect(anonymous.status).toBe(401);

    // A refused attempt is no action, so nothing changed and nothing is logged.
    expect(await standingOfPlayer()).toEqual({ viewer: "casual", days: 7 });
    const log = await httpGet(auditLogRoute, "/api/staff/audit-log", cookieFor(DESK));
    expect(await log.json()).toEqual({ entries: [] });
  });
});

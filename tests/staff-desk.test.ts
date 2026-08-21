import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as meRoute from "@/app/api/auth/me/route";
import * as signUpRoute from "@/app/api/auth/signup/request-code/route";
import * as verifyRoute from "@/app/api/auth/verify/route";
import * as availabilityRoute from "@/app/api/availability/route";
import * as bookingsRoute from "@/app/api/bookings/route";
import * as auditLogRoute from "@/app/api/staff/audit-log/route";
import * as staffBookingsRoute from "@/app/api/staff/bookings/route";
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

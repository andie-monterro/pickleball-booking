import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as availabilityRoute from "@/app/api/availability/route";
import * as bookingsRoute from "@/app/api/bookings/route";
import { fixedClock, resetClock, setClock } from "@/lib/clock";
import { getPool } from "@/lib/db";
import { httpGet, httpPost } from "./harness/http";

// 2026-08-19 12:00 venue time (Asia/Ho_Chi_Minh, UTC+7). Venue date is 2026-08-19,
// so a casual player's 7-day horizon covers 2026-08-19..2026-08-25 and a Member's
// 14-day horizon covers 2026-08-19..2026-09-01.
const NOW = new Date("2026-08-19T05:00:00.000Z");

// Slot starts written as UTC instants, with the venue-local time they mean.
const INSIDE_CASUAL_HORIZON = "2026-08-25T03:00:00.000Z"; // 2026-08-25 10:00 venue
const OUTSIDE_CASUAL_HORIZON = "2026-08-26T03:00:00.000Z"; // 2026-08-26 10:00 venue
const INSIDE_MEMBER_HORIZON = "2026-09-01T03:00:00.000Z"; // 2026-09-01 10:00 venue
const OUTSIDE_MEMBER_HORIZON = "2026-09-02T03:00:00.000Z"; // 2026-09-02 10:00 venue

const CASUAL = {
  playerId: "horizon-casual-player",
  phone: "+84901000001",
  sessionToken: "horizon-casual-session",
};

const MEMBER = {
  playerId: "horizon-member-player",
  phone: "+84901000002",
  sessionToken: "horizon-member-session",
};

// Staff set the "member until" date; seed data stands in until the staff UI lands.
function setMemberUntil(player: { playerId: string }, memberUntil: string): Promise<unknown> {
  return getPool().query("update players set member_until = $1 where id = $2", [
    memberUntil,
    player.playerId,
  ]);
}

// Blocks and Opening Hours aside, the venue can open around the clock, which is
// the only way a 2-hour Booking can reach across a venue midnight.
function openAllHours(): Promise<unknown> {
  return getPool().query("update opening_hours set start_hour = 0, end_hour = 24");
}

function cookieFor(player: { sessionToken: string }): { cookie: string } {
  return { cookie: `pb_session=${player.sessionToken}` };
}

function book(
  player: { sessionToken: string },
  startsAt: string,
  durationHours: 1 | 2 = 1,
  courtId = 1,
): Promise<Response> {
  return httpPost(
    bookingsRoute,
    "/api/bookings",
    { courtId, startsAt, durationHours },
    cookieFor(player),
  );
}

async function resetHorizonData(): Promise<void> {
  const pool = getPool();
  await pool.query("delete from slot_claims");
  await pool.query("delete from bookings");
  await pool.query("delete from player_sessions");
  await pool.query("delete from player_signups");
  await pool.query("delete from players");
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

  for (const player of [CASUAL, MEMBER]) {
    await pool.query(
      `insert into players (id, display_name, phone, created_at)
       values ($1, $2, $3, $4)`,
      [player.playerId, player.playerId, player.phone, NOW],
    );
    await pool.query(
      `insert into player_sessions (token_hash, player_id, expires_at, created_at)
       values ($1, $2, $3, $4)`,
      [
        createHash("sha256").update(player.sessionToken).digest("hex"),
        player.playerId,
        new Date("2026-12-31T00:00:00.000Z"),
        NOW,
      ],
    );
  }
}

describe("Booking Horizon enforcement", () => {
  beforeEach(async () => {
    setClock(fixedClock(NOW));
    await resetHorizonData();
  });

  afterEach(async () => {
    resetClock();
    const pool = getPool();
    await pool.query("delete from slot_claims");
    await pool.query("delete from bookings");
  });

  it("lets a casual player book the last day inside the casual horizon", async () => {
    const response = await book(CASUAL, INSIDE_CASUAL_HORIZON);

    expect(response.status).toBe(201);
  });

  it("refuses a casual player the first day outside the casual horizon", async () => {
    const response = await book(CASUAL, OUTSIDE_CASUAL_HORIZON);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "outside_horizon" });
  });

  it("lets a Member book the last day inside the member horizon", async () => {
    await setMemberUntil(MEMBER, "2026-12-31");

    const response = await book(MEMBER, INSIDE_MEMBER_HORIZON);

    expect(response.status).toBe(201);
  });

  it("refuses a Member the first day outside the member horizon", async () => {
    await setMemberUntil(MEMBER, "2026-12-31");

    const response = await book(MEMBER, OUTSIDE_MEMBER_HORIZON);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "outside_horizon" });
  });

  it("treats the \"member until\" date itself as the last day of membership", async () => {
    await setMemberUntil(MEMBER, "2026-08-19");

    const response = await book(MEMBER, INSIDE_MEMBER_HORIZON);

    expect(response.status).toBe(201);
  });

  it("opens a day at the start of the venue day it enters the horizon", async () => {
    setClock(fixedClock(new Date("2026-08-19T23:59:59+07:00")));
    const beforeMidnight = await book(CASUAL, OUTSIDE_CASUAL_HORIZON);
    expect(beforeMidnight.status).toBe(400);
    expect(await beforeMidnight.json()).toEqual({ error: "outside_horizon" });

    setClock(fixedClock(new Date("2026-08-20T00:00:00+07:00")));
    const afterMidnight = await book(CASUAL, OUTSIDE_CASUAL_HORIZON);
    expect(afterMidnight.status).toBe(201);
  });

  it("opens or closes a whole venue day, never part of one", async () => {
    // The last hour of the last day inside the horizon, and the first hour of
    // the day after it.
    const lastHourInside = await book(CASUAL, "2026-08-25T14:00:00.000Z"); // 2026-08-25 21:00 venue
    expect(lastHourInside.status).toBe(201);

    const firstHourOutside = await book(CASUAL, "2026-08-25T23:00:00.000Z"); // 2026-08-26 06:00 venue
    expect(firstHourOutside.status).toBe(400);
    expect(await firstHourOutside.json()).toEqual({ error: "outside_horizon" });
  });

  it("refuses a two-hour Booking that would reach past the last day inside the horizon", async () => {
    await openAllHours();

    const straddling = await book(CASUAL, "2026-08-25T16:00:00.000Z", 2); // 2026-08-25 23:00 venue
    expect(straddling.status).toBe(400);
    expect(await straddling.json()).toEqual({ error: "outside_horizon" });

    const insideHorizon = await book(CASUAL, "2026-08-24T16:00:00.000Z", 2); // 2026-08-24 23:00 venue
    expect(insideHorizon.status).toBe(201);
  });

  it("keeps a Booking valid when the membership ends before play", async () => {
    await setMemberUntil(MEMBER, "2026-08-20");
    const createResponse = await book(MEMBER, INSIDE_MEMBER_HORIZON);
    expect(createResponse.status).toBe(201);

    // Membership has now passed, but the Booking was made while it stood.
    setClock(fixedClock(new Date("2026-08-21T12:00:00+07:00")));
    const upcomingResponse = await httpGet(bookingsRoute, "/api/bookings", cookieFor(MEMBER));

    expect(upcomingResponse.status).toBe(200);
    expect(await upcomingResponse.json()).toMatchObject({
      bookings: [{ startsAt: INSIDE_MEMBER_HORIZON }],
    });
  });

  it("enforces the horizon lengths held in venue settings", async () => {
    await getPool().query(
      "update venue_settings set casual_horizon_days = 3, member_horizon_days = 20 where id = 1",
    );
    await setMemberUntil(MEMBER, "2026-12-31");

    const casualInside = await book(CASUAL, "2026-08-21T03:00:00.000Z"); // 2026-08-21 10:00 venue
    expect(casualInside.status).toBe(201);

    const casualOutside = await book(CASUAL, "2026-08-22T03:00:00.000Z"); // 2026-08-22 10:00 venue
    expect(casualOutside.status).toBe(400);
    expect(await casualOutside.json()).toEqual({ error: "outside_horizon" });

    const memberInside = await book(MEMBER, "2026-09-07T03:00:00.000Z"); // 2026-09-07 10:00 venue
    expect(memberInside.status).toBe(201);

    const memberOutside = await book(MEMBER, "2026-09-08T03:00:00.000Z"); // 2026-09-08 10:00 venue
    expect(memberOutside.status).toBe(400);
    expect(await memberOutside.json()).toEqual({ error: "outside_horizon" });
  });

  it("shows a signed-in Member the days only their horizon reaches", async () => {
    await setMemberUntil(MEMBER, "2026-12-31");

    const memberResponse = await httpGet(
      availabilityRoute,
      "/api/availability?date=2026-09-01",
      cookieFor(MEMBER),
    );

    expect(memberResponse.status).toBe(200);
    const memberBody = await memberResponse.json();
    expect(memberBody.viewer).toBe("member");
    expect(new Set(memberBody.slots.map((slot: { status: string }) => slot.status))).toEqual(
      new Set(["free"]),
    );
    // Days 8..14 stay member-only days, and a Member may book every one of them.
    expect(memberBody.days).toHaveLength(14);
    expect(memberBody.days.slice(7)).toEqual([
      { date: "2026-08-26", memberOnly: true, bookable: true, opensToEveryoneOn: "2026-08-20" },
      { date: "2026-08-27", memberOnly: true, bookable: true, opensToEveryoneOn: "2026-08-21" },
      { date: "2026-08-28", memberOnly: true, bookable: true, opensToEveryoneOn: "2026-08-22" },
      { date: "2026-08-29", memberOnly: true, bookable: true, opensToEveryoneOn: "2026-08-23" },
      { date: "2026-08-30", memberOnly: true, bookable: true, opensToEveryoneOn: "2026-08-24" },
      { date: "2026-08-31", memberOnly: true, bookable: true, opensToEveryoneOn: "2026-08-25" },
      { date: "2026-09-01", memberOnly: true, bookable: true, opensToEveryoneOn: "2026-08-26" },
    ]);
    expect(memberBody.days.slice(0, 7).every((day: { bookable: boolean }) => day.bookable)).toBe(
      true,
    );

    const casualResponse = await httpGet(
      availabilityRoute,
      "/api/availability?date=2026-09-01",
      cookieFor(CASUAL),
    );

    const casualBody = await casualResponse.json();
    expect(casualBody.viewer).toBe("casual");
    expect(new Set(casualBody.slots.map((slot: { status: string }) => slot.status))).toEqual(
      new Set(["outside_horizon"]),
    );
    expect(
      casualBody.days
        .slice(7)
        .every((day: { memberOnly: boolean; bookable: boolean }) => day.memberOnly && !day.bookable),
    ).toBe(true);
    expect(casualBody.days.slice(0, 7).every((day: { bookable: boolean }) => day.bookable)).toBe(
      true,
    );
  });

  it("treats a Player whose membership has passed as a casual player", async () => {
    await setMemberUntil(MEMBER, "2026-08-18");

    const response = await book(MEMBER, OUTSIDE_CASUAL_HORIZON);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "outside_horizon" });
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as availabilityRoute from "@/app/api/availability/route";
import { fixedClock, resetClock, setClock } from "@/lib/clock";
import { getPool } from "@/lib/db";
import { httpGet } from "./harness/http";

const SEED_COURTS = ["Court 1", "Court 2", "Court 3", "Court 4"];

async function resetVenueData(): Promise<void> {
  const pool = getPool();
  await pool.query("delete from slot_claims");
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
    `insert into venue_settings (id, venue_time_zone, casual_horizon_days, member_horizon_days)
     values (1, 'Asia/Ho_Chi_Minh', 7, 14)
     on conflict (id) do update
       set venue_time_zone = excluded.venue_time_zone,
           casual_horizon_days = excluded.casual_horizon_days,
           member_horizon_days = excluded.member_horizon_days`,
  );
}

describe("GET /api/availability", () => {
  beforeEach(async () => {
    setClock(fixedClock(new Date("2026-08-19T05:00:00+07:00")));
    await resetVenueData();
  });

  afterEach(() => {
    resetClock();
  });

  it("returns a public courts by hours grid from venue settings", async () => {
    const response = await httpGet(availabilityRoute, "/api/availability?date=2026-08-19");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      date: "2026-08-19",
      timeZone: "Asia/Ho_Chi_Minh",
      viewer: "casual",
      horizons: { casualDays: 7, memberDays: 14 },
    });
    expect(body.courts.map((court: { name: string }) => court.name)).toEqual(SEED_COURTS);
    expect(body.hours).toEqual([
      "06:00",
      "07:00",
      "08:00",
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00",
      "21:00",
    ]);
    expect(body.slots).toHaveLength(64);
    expect(body.slots[0]).toMatchObject({
      courtName: "Court 1",
      hour: "06:00",
      start: "2026-08-18T23:00:00.000Z",
      status: "free",
    });
  });

  it("marks days 8 through 14 as member-only with their casual open date", async () => {
    const response = await httpGet(availabilityRoute, "/api/availability?date=2026-08-19");

    const body = await response.json();
    expect(body.days).toHaveLength(14);
    expect(body.days.slice(0, 7).every((day: { memberOnly: boolean }) => !day.memberOnly)).toBe(true);
    expect(body.days.slice(7).map((day: { date: string; memberOnly: boolean; opensToEveryoneOn: string }) => day)).toEqual([
      { date: "2026-08-26", memberOnly: true, opensToEveryoneOn: "2026-08-19" },
      { date: "2026-08-27", memberOnly: true, opensToEveryoneOn: "2026-08-20" },
      { date: "2026-08-28", memberOnly: true, opensToEveryoneOn: "2026-08-21" },
      { date: "2026-08-29", memberOnly: true, opensToEveryoneOn: "2026-08-22" },
      { date: "2026-08-30", memberOnly: true, opensToEveryoneOn: "2026-08-23" },
      { date: "2026-08-31", memberOnly: true, opensToEveryoneOn: "2026-08-24" },
      { date: "2026-09-01", memberOnly: true, opensToEveryoneOn: "2026-08-25" },
    ]);
  });

  it("applies the casual horizon at each Slot instant", async () => {
    setClock(fixedClock(new Date("2026-08-19T12:00:00+07:00")));

    const response = await httpGet(availabilityRoute, "/api/availability?date=2026-08-26");

    const body = await response.json();
    expect(body.slots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ courtName: "Court 1", hour: "12:00", status: "free" }),
        expect.objectContaining({ courtName: "Court 1", hour: "13:00", status: "outside_horizon" }),
      ]),
    );
  });

  it("distinguishes free, taken, blocked, and outside-horizon Slots", async () => {
    const pool = getPool();
    await pool.query(
      "insert into slot_claims (court_id, slot_starts_at, source_kind, source_id) values ($1, $2, $3, $4), ($5, $6, $7, $8)",
      [1, "2026-08-18T23:00:00.000Z", "booking", "booking-1", 2, "2026-08-19T00:00:00.000Z", "block", "block-1"],
    );

    const response = await httpGet(availabilityRoute, "/api/availability?date=2026-08-26");

    const body = await response.json();
    const statuses = new Set(body.slots.map((slot: { status: string }) => slot.status));
    expect(statuses).toEqual(new Set(["outside_horizon"]));

    const todayResponse = await httpGet(availabilityRoute, "/api/availability?date=2026-08-19");
    const todayBody = await todayResponse.json();
    expect(todayBody.slots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ courtName: "Court 1", hour: "06:00", status: "taken" }),
        expect.objectContaining({ courtName: "Court 2", hour: "07:00", status: "blocked" }),
        expect.objectContaining({ courtName: "Court 3", hour: "06:00", status: "free" }),
      ]),
    );
  });

  it("reflects database changes to Courts and Opening Hours", async () => {
    const pool = getPool();
    await pool.query("insert into courts (name) values ('Court 5')");
    await pool.query("update opening_hours set start_hour = 8, end_hour = 10 where day_of_week = 3");

    const response = await httpGet(availabilityRoute, "/api/availability?date=2026-08-19");

    const body = await response.json();
    expect(body.courts.map((court: { name: string }) => court.name)).toContain("Court 5");
    expect(body.hours).toEqual(["08:00", "09:00"]);
    expect(body.slots).toHaveLength(10);
  });
});

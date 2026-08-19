import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as availabilityRoute from "@/app/api/availability/route";
import * as bookingsRoute from "@/app/api/bookings/route";
import { fixedClock, resetClock, setClock } from "@/lib/clock";
import { getPool } from "@/lib/db";
import { httpGet, httpPost } from "./harness/http";

const NOW = new Date("2026-08-19T05:00:00.000Z");
const SESSION_TOKEN = "booking-test-session";
const SESSION_COOKIE = `pb_session=${SESSION_TOKEN}`;
const PLAYER_ID = "booking-player";

async function resetBookingData(): Promise<void> {
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
    `insert into players (id, display_name, phone, created_at)
     values ($1, $2, $3, $4)`,
    [PLAYER_ID, "Lan Nguyen", "+84901234567", NOW],
  );
  await pool.query(
    `insert into player_sessions (token_hash, player_id, expires_at, created_at)
     values ($1, $2, $3, $4)`,
    [
      createHash("sha256").update(SESSION_TOKEN).digest("hex"),
      PLAYER_ID,
      new Date("2026-09-19T05:00:00.000Z"),
      NOW,
    ],
  );
}

describe("booking HTTP API", () => {
  beforeEach(async () => {
    setClock(fixedClock(NOW));
    await resetBookingData();
  });

  afterEach(async () => {
    resetClock();
    const pool = getPool();
    await pool.query("delete from slot_claims");
    await pool.query("delete from bookings");
  });

  it("lets a signed-in Player book a free Slot and then see the Booking", async () => {
    const createResponse = await httpPost(
      bookingsRoute,
      "/api/bookings",
      {
        courtId: 1,
        startsAt: "2026-08-19T06:00:00.000Z",
        durationHours: 1,
      },
      { cookie: SESSION_COOKIE },
    );

    expect(createResponse.status).toBe(201);
    expect(await createResponse.json()).toMatchObject({
      booking: {
        courtId: 1,
        courtName: "Court 1",
        startsAt: "2026-08-19T06:00:00.000Z",
        endsAt: "2026-08-19T07:00:00.000Z",
      },
    });

    const availabilityResponse = await httpGet(
      availabilityRoute,
      "/api/availability?date=2026-08-19",
    );
    const availability = await availabilityResponse.json();
    expect(
      availability.slots.find(
        (slot: { courtId: number; start: string }) =>
          slot.courtId === 1 && slot.start === "2026-08-19T06:00:00.000Z",
      ),
    ).toMatchObject({ status: "taken", label: "Taken" });
    const publicBody = JSON.stringify(availability);
    expect(publicBody).not.toContain(PLAYER_ID);
    expect(publicBody).not.toContain("Lan Nguyen");
    expect(publicBody).not.toContain("+84901234567");

    const upcomingResponse = await httpGet(bookingsRoute, "/api/bookings", {
      cookie: SESSION_COOKIE,
    });
    expect(upcomingResponse.status).toBe(200);
    expect(await upcomingResponse.json()).toMatchObject({
      bookings: [
        {
          courtId: 1,
          courtName: "Court 1",
          startsAt: "2026-08-19T06:00:00.000Z",
          endsAt: "2026-08-19T07:00:00.000Z",
        },
      ],
    });
  });

  it("claims both consecutive Slots for a two-hour Booking", async () => {
    const createResponse = await httpPost(
      bookingsRoute,
      "/api/bookings",
      {
        courtId: 2,
        startsAt: "2026-08-19T07:00:00.000Z",
        durationHours: 2,
      },
      { cookie: SESSION_COOKIE },
    );

    expect(createResponse.status).toBe(201);
    expect(await createResponse.json()).toMatchObject({
      booking: {
        courtId: 2,
        startsAt: "2026-08-19T07:00:00.000Z",
        endsAt: "2026-08-19T09:00:00.000Z",
      },
    });

    const availabilityResponse = await httpGet(
      availabilityRoute,
      "/api/availability?date=2026-08-19",
    );
    const availability = await availabilityResponse.json();
    const selectedSlots = availability.slots.filter(
      (slot: { courtId: number; start: string }) =>
        slot.courtId === 2 &&
        [
          "2026-08-19T07:00:00.000Z",
          "2026-08-19T08:00:00.000Z",
        ].includes(slot.start),
    );
    expect(selectedSlots).toHaveLength(2);
    expect(selectedSlots).toEqual([
      expect.objectContaining({ status: "taken" }),
      expect.objectContaining({ status: "taken" }),
    ]);
  });

  it("lets Postgres resolve simultaneous claims on the same Slot", async () => {
    const bookingInput = {
      courtId: 3,
      startsAt: "2026-08-19T08:00:00.000Z",
      durationHours: 1,
    };
    const responses = await Promise.all([
      httpPost(bookingsRoute, "/api/bookings", bookingInput, {
        cookie: SESSION_COOKIE,
      }),
      httpPost(bookingsRoute, "/api/bookings", bookingInput, {
        cookie: SESSION_COOKIE,
      }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);

    const loser = responses.find((response) => response.status === 409);
    expect(await loser?.json()).toEqual({ error: "slot_taken" });

    const upcomingResponse = await httpGet(bookingsRoute, "/api/bookings", {
      cookie: SESSION_COOKIE,
    });
    const upcoming = await upcomingResponse.json();
    expect(upcoming.bookings).toHaveLength(1);
  });

  it("accepts a Booking at its exact start time but rejects it after", async () => {
    const bookingInput = {
      courtId: 4,
      startsAt: "2026-08-19T06:00:00.000Z",
      durationHours: 1,
    };
    setClock(fixedClock(new Date(bookingInput.startsAt)));
    const availabilityResponse = await httpGet(
      availabilityRoute,
      "/api/availability?date=2026-08-19",
    );
    const availability = await availabilityResponse.json();
    expect(
      availability.slots.find(
        (slot: { courtId: number; start: string }) =>
          slot.courtId === 4 && slot.start === bookingInput.startsAt,
      ),
    ).toMatchObject({ status: "free", label: "Free" });

    const atStartResponse = await httpPost(
      bookingsRoute,
      "/api/bookings",
      bookingInput,
      { cookie: SESSION_COOKIE },
    );
    expect(atStartResponse.status).toBe(201);

    setClock(fixedClock(new Date("2026-08-19T06:00:00.001Z")));
    const afterStartResponse = await httpPost(
      bookingsRoute,
      "/api/bookings",
      { ...bookingInput, courtId: 3 },
      { cookie: SESSION_COOKIE },
    );
    expect(afterStartResponse.status).toBe(400);
    expect(await afterStartResponse.json()).toEqual({ error: "slot_in_past" });
  });
});

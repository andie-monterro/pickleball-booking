import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import * as availabilityRoute from "@/app/api/availability/route";
import { fixedClock, resetClock, setClock } from "@/lib/clock";
import { getPool } from "@/lib/db";
import { httpGet } from "./harness/http";

// Everything time-dependent is read against this instant: 10:00 on Wednesday
// 19 August 2026 in venue time (UTC+7), so "today" is 2026-08-19.
const NOW = new Date("2026-08-19T03:00:00Z");

interface SlotView {
  courtId: number;
  hour: number;
  startsAt: string;
  occupancy: string;
}

interface AvailabilityView {
  date: string;
  today: string;
  standing: string;
  courts: { id: number; name: string }[];
  hours: number[];
  slots: SlotView[];
  days: { date: string; memberOnly: boolean; opensToAllOn: string | null }[];
}

async function getAvailability(
  query = "",
): Promise<{ status: number; body: AvailabilityView }> {
  const response = await httpGet(
    availabilityRoute,
    `/api/availability${query}`,
  );
  return { status: response.status, body: await response.json() };
}

function slotAt(
  body: AvailabilityView,
  courtId: number,
  hour: number,
): SlotView {
  const slot = body.slots.find(
    (candidate) => candidate.courtId === courtId && candidate.hour === hour,
  );
  if (!slot) {
    throw new Error(`No slot for court ${courtId} at hour ${hour}`);
  }
  return slot;
}

async function firstCourtId(): Promise<number> {
  const { body } = await getAvailability();
  const court = body.courts[0];
  if (!court) {
    throw new Error("The venue has no seeded courts");
  }
  return court.id;
}

describe("GET /api/availability", () => {
  beforeAll(() => {
    setClock(fixedClock(NOW));
  });

  afterAll(async () => {
    resetClock();
    // Leave the venue's seeded Opening Hours as the migration seeded them.
    await getPool().query(
      `insert into opening_hours (day_of_week, opens_hour, closes_hour)
         values (5, 6, 22)
         on conflict (day_of_week) do update
           set opens_hour = 6, closes_hour = 22`,
    );
  });

  afterEach(async () => {
    await getPool().query("delete from slot_claims");
  });

  it("serves the seeded grid to a visitor with no session", async () => {
    const { status, body } = await getAvailability();

    expect(status).toBe(200);
    expect(body.date).toBe("2026-08-19");
    expect(body.standing).toBe("casual");
    // Courts and Opening Hours come from the seeded venue settings.
    expect(body.courts.length).toBeGreaterThan(0);
    expect(body.hours.length).toBeGreaterThan(0);
    expect(body.slots).toHaveLength(body.courts.length * body.hours.length);
    // Occupancy only — the read model never carries booker identity.
    expect(Object.keys(body.slots[0]).sort()).toEqual([
      "courtId",
      "hour",
      "occupancy",
      "startsAt",
    ]);
  });

  it("rejects a date that is not a venue date", async () => {
    const response = await httpGet(
      availabilityRoute,
      "/api/availability?date=19-08-2026",
    );

    expect(response.status).toBe(400);
  });

  it("derives Slots only inside Opening Hours, on the hour in venue time", async () => {
    // Friday 2026-08-21 is day of week 5. Open 06:00, close 08:00.
    await getPool().query(
      `insert into opening_hours (day_of_week, opens_hour, closes_hour)
         values (5, 6, 8)
         on conflict (day_of_week) do update
           set opens_hour = 6, closes_hour = 8`,
    );

    const { body } = await getAvailability("?date=2026-08-21");

    expect(body.hours).toEqual([6, 7]);
    const courtId = body.courts[0].id;
    // 06:00 and 07:00 venue time on 2026-08-21 are 23:00 and 00:00 UTC.
    expect(slotAt(body, courtId, 6).startsAt).toBe("2026-08-20T23:00:00.000Z");
    expect(slotAt(body, courtId, 7).startsAt).toBe("2026-08-21T00:00:00.000Z");
  });

  it("reports no Slots on a day of week the venue is closed", async () => {
    await getPool().query("delete from opening_hours where day_of_week = 5");

    const { body } = await getAvailability("?date=2026-08-21");

    expect(body.hours).toEqual([]);
    expect(body.slots).toEqual([]);
  });

  it("follows the venue settings data when a Court is added and removed", async () => {
    const before = await getAvailability();

    await getPool().query("insert into courts (name) values ('Court 99')");
    const withExtraCourt = await getAvailability();

    expect(withExtraCourt.body.courts.map((court) => court.name)).toContain(
      "Court 99",
    );
    expect(withExtraCourt.body.courts).toHaveLength(
      before.body.courts.length + 1,
    );
    expect(withExtraCourt.body.slots).toHaveLength(
      withExtraCourt.body.courts.length * withExtraCourt.body.hours.length,
    );

    await getPool().query("delete from courts where name = 'Court 99'");
    const after = await getAvailability();

    expect(after.body.courts.map((court) => court.name)).not.toContain(
      "Court 99",
    );
  });

  describe("the day strip", () => {
    it("covers the member Booking Horizon of 14 days from today", async () => {
      const { body } = await getAvailability();

      expect(body.days).toHaveLength(14);
      expect(body.days.map((day) => day.date)).toEqual([
        "2026-08-19",
        "2026-08-20",
        "2026-08-21",
        "2026-08-22",
        "2026-08-23",
        "2026-08-24",
        "2026-08-25",
        "2026-08-26",
        "2026-08-27",
        "2026-08-28",
        "2026-08-29",
        "2026-08-30",
        "2026-08-31",
        "2026-09-01",
      ]);
    });

    it("marks the days beyond the casual horizon member-only, with the date they open to everyone", async () => {
      const { body } = await getAvailability();

      // Days 1-7 are open to everyone; days 8-14 are member-only.
      expect(body.days.filter((day) => !day.memberOnly)).toHaveLength(7);
      expect(body.days[6]).toEqual({
        date: "2026-08-25",
        memberOnly: false,
        opensToAllOn: null,
      });
      expect(body.days[7]).toEqual({
        date: "2026-08-26",
        memberOnly: true,
        opensToAllOn: "2026-08-20",
      });
      expect(body.days[13]).toEqual({
        date: "2026-09-01",
        memberOnly: true,
        opensToAllOn: "2026-08-26",
      });
    });
  });

  describe("occupancy", () => {
    it("reports a Slot free on the last day of the casual horizon", async () => {
      const { body } = await getAvailability("?date=2026-08-25");

      expect(slotAt(body, body.courts[0].id, 9).occupancy).toBe("free");
    });

    it("reports a Slot outside the horizon on the first day beyond it", async () => {
      const { body } = await getAvailability("?date=2026-08-26");

      expect(slotAt(body, body.courts[0].id, 9).occupancy).toBe(
        "outside_horizon",
      );
    });

    it("reports today's Slots outside the horizon once they have started", async () => {
      const { body } = await getAvailability("?date=2026-08-19");
      const courtId = body.courts[0].id;

      // It is 10:00 in venue time. A Slot may be booked until it starts.
      expect(slotAt(body, courtId, 9).occupancy).toBe("outside_horizon");
      expect(slotAt(body, courtId, 10).occupancy).toBe("outside_horizon");
      expect(slotAt(body, courtId, 11).occupancy).toBe("free");
    });

    it("reports a Slot taken when a Booking claims it", async () => {
      const courtId = await firstCourtId();
      await getPool().query(
        `insert into slot_claims (court_id, starts_at, kind)
           values ($1, $2, 'booking')`,
        [courtId, "2026-08-20T04:00:00Z"],
      );

      const { body } = await getAvailability("?date=2026-08-20");

      // 04:00 UTC is 11:00 in venue time.
      expect(slotAt(body, courtId, 11).occupancy).toBe("taken");
      expect(slotAt(body, courtId, 12).occupancy).toBe("free");
    });

    it("reports a Slot blocked when a Block claims it", async () => {
      const courtId = await firstCourtId();
      await getPool().query(
        `insert into slot_claims (court_id, starts_at, kind)
           values ($1, $2, 'block')`,
        [courtId, "2026-08-20T04:00:00Z"],
      );

      const { body } = await getAvailability("?date=2026-08-20");

      expect(slotAt(body, courtId, 11).occupancy).toBe("blocked");
    });

    it("distinguishes all four states inside one response", async () => {
      const courtId = await firstCourtId();
      await getPool().query(
        `insert into slot_claims (court_id, starts_at, kind) values
           ($1, '2026-08-19T05:00:00Z', 'booking'),
           ($1, '2026-08-19T06:00:00Z', 'block')`,
        [courtId],
      );

      // It is 10:00 in venue time, so 12:00 is booked and 13:00 is blocked.
      const { body } = await getAvailability("?date=2026-08-19");

      expect(slotAt(body, courtId, 12).occupancy).toBe("taken");
      expect(slotAt(body, courtId, 13).occupancy).toBe("blocked");
      expect(slotAt(body, courtId, 14).occupancy).toBe("free");
      expect(slotAt(body, courtId, 6).occupancy).toBe("outside_horizon");
    });

    it("keeps a claim visible on a day beyond the viewer's horizon", async () => {
      const courtId = await firstCourtId();
      await getPool().query(
        `insert into slot_claims (court_id, starts_at, kind)
           values ($1, $2, 'booking')`,
        [courtId, "2026-08-26T04:00:00Z"],
      );

      const { body } = await getAvailability("?date=2026-08-26");

      expect(slotAt(body, courtId, 11).occupancy).toBe("taken");
      expect(slotAt(body, courtId, 12).occupancy).toBe("outside_horizon");
    });
  });
});

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPool } from "@/lib/db";

let app: ChildProcessWithoutNullStreams;
let baseUrl: string;
let serverOutput = "";

async function unusedPort(): Promise<number> {
  const { promise, resolve, reject } = Promise.withResolvers<number>();
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      reject(new Error("Could not allocate a port for the test app"));
      return;
    }
    server.close((error) => (error ? reject(error) : resolve(address.port)));
  });
  return promise;
}

function waitUntilReady(): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const captureOutput = (chunk: Buffer): void => {
    serverOutput += chunk.toString();
    if (serverOutput.includes("Ready in")) {
      resolve();
    }
  };
  app.stdout.on("data", captureOutput);
  app.stderr.on("data", captureOutput);
  app.once("exit", (code) => {
    reject(new Error(`Next.js exited with code ${code} before becoming ready.\n${serverOutput}`));
  });
  return promise;
}

beforeAll(async () => {
  const port = await unusedPort();
  baseUrl = `http://127.0.0.1:${port}`;
  app = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: process.cwd(),
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: "pipe",
    },
  );
  await waitUntilReady();
}, 60_000);

afterAll(() => {
  app.kill("SIGTERM");
});

describe("app shell", () => {
  it("keeps public availability on the home page and hosts authentication at /sign-in", async () => {
    const homeResponse = await fetch(baseUrl);
    const home = await homeResponse.text();

    expect(homeResponse.status).toBe(200);
    expect(home).toContain("Pickleball Booking");
    expect(home).toContain('aria-label="Choose a day"');
    expect(home).toContain('aria-label="Availability for');
    expect(home).toContain('href="/sign-in"');
    expect(home).not.toContain("Checking your session");

    const signInResponse = await fetch(`${baseUrl}/sign-in`);

    expect(signInResponse.status).toBe(200);
  });

  it("opens the staff desk for a Staff session and refuses a player session", async () => {
    const pool = getPool();
    const accounts = [
      { id: "shell-staff", name: "Desk One", phone: "+84903000001", token: "shell-staff-session" },
      { id: "shell-player", name: "Lan Nguyen", phone: "+84903000002", token: "shell-player-session" },
    ];
    const now = new Date();
    try {
      for (const account of accounts) {
        await pool.query(
          `insert into players (id, display_name, phone, created_at)
           values ($1, $2, $3, $4)`,
          [account.id, account.name, account.phone, now],
        );
        await pool.query(
          `insert into player_sessions (token_hash, player_id, expires_at, created_at)
           values ($1, $2, $3, $4)`,
          [
            createHash("sha256").update(account.token).digest("hex"),
            account.id,
            new Date(now.getTime() + 60 * 60 * 1000),
            now,
          ],
        );
      }
      await pool.query(
        "insert into staff_accounts (player_id, granted_at) values ($1, $2)",
        [accounts[0].id, now],
      );

      const staffCookie = `pb_session=${accounts[0].token}`;
      const deskResponse = await fetch(`${baseUrl}/staff`, {
        headers: { cookie: staffCookie },
      });
      const desk = await deskResponse.text();
      expect(deskResponse.status).toBe(200);
      expect(desk).toContain('aria-label="Staff schedule for');
      expect(desk).toContain("Audit Log");
      // Staff manage Staff accounts from the desk itself.
      expect(desk).toContain("Staff accounts");
      expect(desk).toContain("Onboard a front-desk person");
      // ...and the venue data the app runs on.
      expect(desk).toContain("Venue settings");
      expect(desk).toContain("Courts");
      expect(desk).toContain("Opening Hours");
      expect(desk).toContain("Booking Horizons");
      expect(desk).toContain("Membership dates");

      // A Block reaches the desk as something Staff can remove. This test runs
      // on the real clock, so it picks 09:00 venue time on the current venue
      // day, which is inside Opening Hours.
      const venueDate = new Date(now.getTime() + 7 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const placed = await fetch(`${baseUrl}/api/staff/blocks`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: staffCookie },
        body: JSON.stringify({
          courtId: 4,
          startsAt: `${venueDate}T02:00:00.000Z`,
          slotCount: 2,
        }),
      });
      expect(placed.status).toBe(201);

      const blockedDesk = await fetch(`${baseUrl}/staff?date=${venueDate}`, {
        headers: { cookie: staffCookie },
      });
      expect(await blockedDesk.text()).toContain(
        'aria-label="Remove the Block on Court 4 at 09:00"',
      );

      const playerResponse = await fetch(`${baseUrl}/staff`, {
        headers: { cookie: `pb_session=${accounts[1].token}` },
      });
      const playerPage = await playerResponse.text();
      expect(playerPage).toContain("This page is for Staff.");
      expect(playerPage).not.toContain('aria-label="Staff schedule for');
      expect(playerPage).not.toContain("Onboard a front-desk person");
    } finally {
      await pool.query("delete from slot_claims where source_kind = 'block'");
      await pool.query("delete from blocks");
      await pool.query("delete from player_sessions where player_id = any($1)", [
        accounts.map((account) => account.id),
      ]);
      await pool.query("delete from staff_accounts where player_id = any($1)", [
        accounts.map((account) => account.id),
      ]);
      await pool.query("delete from players where id = any($1)", [
        accounts.map((account) => account.id),
      ]);
    }
  });

  it("offers a No-show mark on a started Booking and shows the mark at the desk", async () => {
    const pool = getPool();
    const staff = {
      id: "shell-noshow-staff",
      name: "Desk Two",
      phone: "+84903000004",
      token: "shell-noshow-staff-session",
    };
    const booker = {
      id: "shell-noshow-player",
      name: "Bao Pham",
      phone: "+84903000005",
    };
    const bookingId = "shell-noshow-booking";
    const now = new Date();
    // The venue day before this one, at 10:00 venue time: a Slot inside Opening
    // Hours that has certainly started, whatever time this test runs at. The
    // desk reaches a past day through the date parameter.
    const yesterday = new Date(now.getTime() + 7 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const slotStart = `${yesterday}T03:00:00.000Z`;
    try {
      for (const account of [staff, booker]) {
        await pool.query(
          `insert into players (id, display_name, phone, created_at)
           values ($1, $2, $3, $4)`,
          [account.id, account.name, account.phone, now],
        );
      }
      await pool.query(
        `insert into player_sessions (token_hash, player_id, expires_at, created_at)
         values ($1, $2, $3, $4)`,
        [
          createHash("sha256").update(staff.token).digest("hex"),
          staff.id,
          new Date(now.getTime() + 60 * 60 * 1000),
          now,
        ],
      );
      await pool.query(
        "insert into staff_accounts (player_id, granted_at) values ($1, $2)",
        [staff.id, now],
      );
      await pool.query(
        `insert into bookings (id, booker_id, court_id, starts_at, duration_hours, created_at)
         values ($1, $2, 3, $3, 1, $4)`,
        [bookingId, booker.id, slotStart, now],
      );
      await pool.query(
        `insert into slot_claims (court_id, slot_starts_at, source_kind, source_id)
         values (3, $1, 'booking', $2)`,
        [slotStart, bookingId],
      );

      const staffCookie = `pb_session=${staff.token}`;
      const desk = await fetch(`${baseUrl}/staff?date=${yesterday}`, {
        headers: { cookie: staffCookie },
      });
      const deskPage = await desk.text();
      expect(desk.status).toBe(200);
      expect(deskPage).toContain(
        'aria-label="Manage Bao Pham on Court 3 at 10:00"',
      );
      // Staff waive Strikes from the desk itself.
      expect(deskPage).toContain("Strikes and waivers");

      const marked = await fetch(`${baseUrl}/api/staff/no-shows`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: staffCookie },
        body: JSON.stringify({ bookingId }),
      });
      expect(marked.status).toBe(201);

      const markedDesk = await fetch(`${baseUrl}/staff?date=${yesterday}`, {
        headers: { cookie: staffCookie },
      });
      const markedPage = await markedDesk.text();
      // The grid says which Bookings are marked, and the Audit Log on the same
      // page says who marked them.
      expect(markedPage).toContain("No-show");
      expect(markedPage).toContain("marked a No-show");
      expect(markedPage).toContain("Desk Two");
    } finally {
      await pool.query("truncate audit_log_entries");
      await pool.query("delete from strikes where booking_id = $1", [bookingId]);
      await pool.query("delete from slot_claims where source_id = $1", [bookingId]);
      await pool.query("delete from bookings where id = $1", [bookingId]);
      await pool.query("delete from staff_accounts where player_id = $1", [staff.id]);
      await pool.query("delete from player_sessions where player_id = $1", [staff.id]);
      await pool.query("delete from players where id = any($1)", [
        [staff.id, booker.id],
      ]);
    }
  });

  it("adds a Court from the desk and shows it in the grid and the Audit Log", async () => {
    const pool = getPool();
    const staff = {
      id: "shell-settings-staff",
      name: "Desk Three",
      phone: "+84903000006",
      token: "shell-settings-staff-session",
    };
    const now = new Date();
    try {
      await pool.query(
        `insert into players (id, display_name, phone, created_at)
         values ($1, $2, $3, $4)`,
        [staff.id, staff.name, staff.phone, now],
      );
      await pool.query(
        `insert into player_sessions (token_hash, player_id, expires_at, created_at)
         values ($1, $2, $3, $4)`,
        [
          createHash("sha256").update(staff.token).digest("hex"),
          staff.id,
          new Date(now.getTime() + 60 * 60 * 1000),
          now,
        ],
      );
      await pool.query(
        "insert into staff_accounts (player_id, granted_at) values ($1, $2)",
        [staff.id, now],
      );

      const staffCookie = `pb_session=${staff.token}`;
      const added = await fetch(`${baseUrl}/api/staff/courts`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: staffCookie },
        body: JSON.stringify({ name: "Shell Court" }),
      });
      expect(added.status).toBe(201);

      const desk = await fetch(`${baseUrl}/staff`, { headers: { cookie: staffCookie } });
      const deskPage = await desk.text();
      // The new Court is a column of the schedule at once, and the Audit Log on
      // the same page says who added it.
      expect(deskPage).toContain("Shell Court");
      expect(deskPage).toContain("added a Court");
      expect(deskPage).toContain("Desk Three");

      const home = await fetch(baseUrl);
      expect(await home.text()).toContain("Shell Court");
    } finally {
      await pool.query("truncate audit_log_entries");
      await pool.query("delete from courts where name = $1", ["Shell Court"]);
      await pool.query("delete from staff_accounts where player_id = $1", [staff.id]);
      await pool.query("delete from player_sessions where player_id = $1", [staff.id]);
      await pool.query("delete from players where id = $1", [staff.id]);
    }
  });

  it("shows a banned Player the ban end date instead of bookable Slots", async () => {
    const pool = getPool();
    const account = {
      id: "shell-banned",
      name: "Bao Pham",
      phone: "+84903000003",
      token: "shell-banned-session",
    };
    // Real time, not the injectable clock: this page is rendered by a separate
    // `next dev` process, which has its own clock.
    const now = new Date();
    const banEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    try {
      await pool.query(
        `insert into players (id, display_name, phone, created_at)
         values ($1, $2, $3, $4)`,
        [account.id, account.name, account.phone, now],
      );
      await pool.query(
        `insert into player_sessions (token_hash, player_id, expires_at, created_at)
         values ($1, $2, $3, $4)`,
        [
          createHash("sha256").update(account.token).digest("hex"),
          account.id,
          new Date(now.getTime() + 60 * 60 * 1000),
          now,
        ],
      );
      // Three Strikes earned now, each on its own cancelled Booking, which is
      // the shape a Late Cancel leaves behind.
      for (const suffix of [1, 2, 3]) {
        const bookingId = `shell-banned-booking-${suffix}`;
        await pool.query(
          `insert into bookings
             (id, booker_id, court_id, starts_at, duration_hours, created_at,
              cancelled_at, cancellation_kind)
           values ($1, $2, 1, date_trunc('hour', $3::timestamptz - interval '1 day'),
                   1, $3, $3, 'late_cancel')`,
          [bookingId, account.id, now],
        );
        await pool.query(
          `insert into strikes (id, player_id, booking_id, reason, earned_at)
           values ($1, $2, $3, 'late_cancel', $4)`,
          [`shell-banned-strike-${suffix}`, account.id, bookingId, now],
        );
      }

      const response = await fetch(baseUrl, {
        headers: { cookie: `pb_session=${account.token}` },
      });
      const page = await response.text();

      expect(response.status).toBe(200);
      expect(page).toContain("Booking Ban");
      expect(page).toContain(banEndsAt.toISOString());
      // The grid still shows availability, but no Slot is bookable while the
      // ban stands.
      expect(page).toContain('aria-label="Availability for');
      expect(page).not.toContain('aria-label="Book ');
    } finally {
      await pool.query("delete from strikes where player_id = $1", [account.id]);
      await pool.query("delete from bookings where booker_id = $1", [account.id]);
      await pool.query("delete from player_sessions where player_id = $1", [account.id]);
      await pool.query("delete from players where id = $1", [account.id]);
    }
  });

  it("keeps the staff desk behind a Staff session", async () => {
    const response = await fetch(`${baseUrl}/staff`);
    const page = await response.text();

    expect(response.status).toBe(200);
    expect(page).toContain("Staff desk");
    expect(page).toContain("href=\"/sign-in?returnTo=%2Fstaff\"");
    // The desk is the only place booker identity appears, so an anonymous
    // visitor must not get a schedule at all.
    expect(page).not.toContain('aria-label="Staff schedule');
  });

  it.each(["/\\evil.example", "http://app.local//evil.example"])(
    "defaults unsafe post-auth target %s to the home page",
    async (unsafeTarget) => {
      const response = await fetch(`${baseUrl}/sign-in?returnTo=${encodeURIComponent(unsafeTarget)}`);
      const page = await response.text();

      expect(response.status).toBe(200);
      expect(page).toContain('\\"returnTo\\":\\"/\\"');
    },
  );
});

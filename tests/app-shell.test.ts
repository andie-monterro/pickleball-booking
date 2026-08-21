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

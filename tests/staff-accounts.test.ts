import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as meRoute from "@/app/api/auth/me/route";
import * as signInRoute from "@/app/api/auth/sign-in/request-code/route";
import * as verifyRoute from "@/app/api/auth/verify/route";
import * as staffAccountsRoute from "@/app/api/staff/accounts/route";
import * as auditLogRoute from "@/app/api/staff/audit-log/route";
import { resetOtpProvider, setOtpProvider } from "@/lib/auth/otp-provider";
import { fixedClock, resetClock, setClock } from "@/lib/clock";
import { getPool } from "@/lib/db";
import { FakeOtpProvider } from "./fakes/fake-otp-provider";
import { httpDelete, httpGet, httpPost } from "./harness/http";

// 2026-08-21 12:00 venue time (Asia/Ho_Chi_Minh, UTC+7).
const NOW = new Date("2026-08-21T05:00:00.000Z");

// The Staff member doing the onboarding and offboarding. A single Staff role:
// every Staff account may manage Staff accounts, including its own.
const DESK = {
  playerId: "staff-accounts-desk",
  displayName: "Desk One",
  phone: "+84903000001",
  sessionToken: "staff-accounts-desk-session",
};

// A second Staff account, so offboarding never runs into the last-account
// guard by accident.
const COLLEAGUE = {
  playerId: "staff-accounts-colleague",
  displayName: "Desk Two",
  phone: "+84903000002",
  sessionToken: "staff-accounts-colleague-session",
};

const PLAYER = {
  playerId: "staff-accounts-player",
  displayName: "Lan Nguyen",
  phone: "+84903000003",
  sessionToken: "staff-accounts-player-session",
};

// The front-desk person being onboarded: a phone number the app has never seen.
const RECRUIT = { displayName: "Mai Tran", phone: "+84903000004" };

type Account = typeof DESK;

function cookieFor(account: Account): { cookie: string } {
  return { cookie: `pb_session=${account.sessionToken}` };
}

function sessionFrom(response: Response): { cookie: string } {
  return { cookie: response.headers.get("set-cookie")?.split(";", 1)[0] ?? "" };
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

async function clearStaffAccountData(): Promise<void> {
  const pool = getPool();
  // The Audit Log is append-only, so nothing may delete from it. Tests reset it
  // with truncate, which the append-only trigger does not see.
  await pool.query("truncate audit_log_entries");
  await pool.query("delete from staff_accounts");
  await pool.query("delete from player_sessions");
  await pool.query("delete from player_signups");
  await pool.query("delete from players");
}

async function resetStaffAccountData(): Promise<void> {
  await clearStaffAccountData();
  await insertAccount(DESK);
  await insertAccount(COLLEAGUE);
  await insertAccount(PLAYER);
  await getPool().query(
    `insert into staff_accounts (player_id, granted_at)
     values ($1, $2), ($3, $2)`,
    [DESK.playerId, NOW, COLLEAGUE.playerId],
  );
}

async function accountsOf(account: Account): Promise<
  { id: string; displayName: string; phone: string; grantedAt: string }[]
> {
  const response = await httpGet(
    staffAccountsRoute,
    "/api/staff/accounts",
    cookieFor(account),
  );
  expect(response.status).toBe(200);
  return (await response.json()).accounts;
}

describe("staff account management HTTP API", () => {
  let otp: FakeOtpProvider;

  beforeEach(async () => {
    setClock(fixedClock(NOW));
    otp = new FakeOtpProvider();
    setOtpProvider(otp);
    await resetStaffAccountData();
  });

  afterEach(async () => {
    resetOtpProvider();
    resetClock();
    await clearStaffAccountData();
  });

  it("onboards a Staff account that then signs in by phone OTP", async () => {
    const created = await httpPost(
      staffAccountsRoute,
      "/api/staff/accounts",
      RECRUIT,
      cookieFor(DESK),
    );
    expect(created.status).toBe(201);
    const { account } = await created.json();
    expect(account).toMatchObject({
      displayName: RECRUIT.displayName,
      phone: RECRUIT.phone,
      grantedAt: NOW.toISOString(),
    });

    expect(await accountsOf(DESK)).toEqual([
      expect.objectContaining({ id: DESK.playerId }),
      expect.objectContaining({ id: COLLEAGUE.playerId }),
      expect.objectContaining({ id: account.id, phone: RECRUIT.phone }),
    ]);

    // Staff sign in through the ordinary phone OTP flow — there is no separate
    // staff sign-in, and no signup step for an account the desk created.
    const codeRequest = await httpPost(
      signInRoute,
      "/api/auth/sign-in/request-code",
      { phone: RECRUIT.phone },
    );
    expect(codeRequest.status).toBe(202);
    const { challengeId } = await codeRequest.json();
    const verify = await httpPost(verifyRoute, "/api/auth/verify", {
      challengeId,
      code: otp.latestCode(RECRUIT.phone),
    });
    expect(verify.status).toBe(200);
    expect(await verify.json()).toMatchObject({
      player: { id: account.id, displayName: RECRUIT.displayName, role: "staff" },
    });

    const reachesStaffEndpoints = await httpGet(
      auditLogRoute,
      "/api/staff/audit-log",
      sessionFrom(verify),
    );
    expect(reachesStaffEndpoints.status).toBe(200);
  });

  it("offboards a Staff account, closing the staff endpoints to them at once", async () => {
    const stillStaff = await httpGet(
      auditLogRoute,
      "/api/staff/audit-log",
      cookieFor(COLLEAGUE),
    );
    expect(stillStaff.status).toBe(200);

    const deactivated = await httpDelete(
      staffAccountsRoute,
      "/api/staff/accounts",
      { playerId: COLLEAGUE.playerId },
      cookieFor(DESK),
    );
    expect(deactivated.status).toBe(200);
    expect(await deactivated.json()).toMatchObject({
      account: { id: COLLEAGUE.playerId, phone: COLLEAGUE.phone },
    });

    // The session they already hold keeps working as a Player session — the role
    // is read from the grant on every request, so the desk closes at once.
    const refused = await httpGet(
      auditLogRoute,
      "/api/staff/audit-log",
      cookieFor(COLLEAGUE),
    );
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ error: "staff_only" });

    // They are still a Player, with their record and history intact.
    const profile = await httpGet(meRoute, "/api/auth/me", cookieFor(COLLEAGUE));
    expect(await profile.json()).toMatchObject({
      player: { id: COLLEAGUE.playerId, displayName: COLLEAGUE.displayName, role: "player" },
    });

    expect(await accountsOf(DESK)).toEqual([
      expect.objectContaining({ id: DESK.playerId }),
    ]);

    const again = await httpDelete(
      staffAccountsRoute,
      "/api/staff/accounts",
      { playerId: COLLEAGUE.playerId },
      cookieFor(DESK),
    );
    expect(again.status).toBe(404);
    expect(await again.json()).toEqual({ error: "staff_account_not_found" });
  });

  it("keeps a deactivated account's past Audit Log entries attributed to them", async () => {
    const created = await httpPost(
      staffAccountsRoute,
      "/api/staff/accounts",
      RECRUIT,
      cookieFor(COLLEAGUE),
    );
    expect(created.status).toBe(201);

    const offboardedAt = new Date("2026-08-21T06:00:00.000Z");
    setClock(fixedClock(offboardedAt));
    const deactivated = await httpDelete(
      staffAccountsRoute,
      "/api/staff/accounts",
      { playerId: COLLEAGUE.playerId },
      cookieFor(DESK),
    );
    expect(deactivated.status).toBe(200);

    const log = await httpGet(auditLogRoute, "/api/staff/audit-log", cookieFor(DESK));
    const { entries } = await log.json();
    expect(entries).toHaveLength(2);
    expect(entries[1]).toMatchObject({
      action: "staff_account_created",
      staff: { id: COLLEAGUE.playerId, displayName: COLLEAGUE.displayName },
      details: { accountName: RECRUIT.displayName, accountPhone: RECRUIT.phone },
    });
  });

  it("records onboarding and offboarding in the Audit Log", async () => {
    const created = await httpPost(
      staffAccountsRoute,
      "/api/staff/accounts",
      RECRUIT,
      cookieFor(DESK),
    );
    const { account } = await created.json();

    const offboardedAt = new Date("2026-08-21T06:30:00.000Z");
    setClock(fixedClock(offboardedAt));
    await httpDelete(
      staffAccountsRoute,
      "/api/staff/accounts",
      { playerId: account.id },
      cookieFor(DESK),
    );

    const log = await httpGet(auditLogRoute, "/api/staff/audit-log", cookieFor(DESK));
    const { entries } = await log.json();
    expect(entries).toHaveLength(2);
    // Newest first.
    expect(entries[0]).toEqual({
      id: expect.any(String),
      action: "staff_account_deactivated",
      occurredAt: offboardedAt.toISOString(),
      staff: { id: DESK.playerId, displayName: DESK.displayName },
      bookingId: null,
      blockId: null,
      subjectPlayerId: account.id,
      details: { accountName: RECRUIT.displayName, accountPhone: RECRUIT.phone },
    });
    expect(entries[1]).toMatchObject({
      action: "staff_account_created",
      occurredAt: NOW.toISOString(),
      staff: { id: DESK.playerId, displayName: DESK.displayName },
      bookingId: null,
      blockId: null,
      subjectPlayerId: account.id,
      details: { accountName: RECRUIT.displayName, accountPhone: RECRUIT.phone },
    });
  });

  it("grants the role to the Player record that already holds the phone number", async () => {
    // A light Player record made at the desk: known by phone, never signed up.
    const pool = getPool();
    await pool.query(
      `insert into players (id, display_name, phone, created_at)
       values ($1, $2, $3, $4)`,
      ["staff-accounts-walk-in", "Bao Pham", RECRUIT.phone, NOW],
    );

    const created = await httpPost(
      staffAccountsRoute,
      "/api/staff/accounts",
      // A name typed here does not rename an existing Player.
      RECRUIT,
      cookieFor(DESK),
    );
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      account: {
        id: "staff-accounts-walk-in",
        displayName: "Bao Pham",
        phone: RECRUIT.phone,
      },
    });

    // Staff sign in, so the grant makes the record a signed-up one: the person
    // gets a code straight away, and nobody can claim the number by signing up.
    const codeRequest = await httpPost(
      signInRoute,
      "/api/auth/sign-in/request-code",
      { phone: RECRUIT.phone },
    );
    expect(codeRequest.status).toBe(202);
    const { challengeId } = await codeRequest.json();
    const verify = await httpPost(verifyRoute, "/api/auth/verify", {
      challengeId,
      code: otp.latestCode(RECRUIT.phone),
    });
    expect(await verify.json()).toMatchObject({
      player: { id: "staff-accounts-walk-in", role: "staff" },
    });
  });

  it("re-onboards a person whose account was deactivated before", async () => {
    await httpDelete(
      staffAccountsRoute,
      "/api/staff/accounts",
      { playerId: COLLEAGUE.playerId },
      cookieFor(DESK),
    );

    const regrantedAt = new Date("2026-08-22T05:00:00.000Z");
    setClock(fixedClock(regrantedAt));
    const created = await httpPost(
      staffAccountsRoute,
      "/api/staff/accounts",
      { phone: COLLEAGUE.phone },
      cookieFor(DESK),
    );
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      account: { id: COLLEAGUE.playerId, grantedAt: regrantedAt.toISOString() },
    });

    const reopened = await httpGet(
      auditLogRoute,
      "/api/staff/audit-log",
      cookieFor(COLLEAGUE),
    );
    expect(reopened.status).toBe(200);
  });

  it("refuses staff account changes that are not a Staff member's to make", async () => {
    const fromPlayer = await httpPost(
      staffAccountsRoute,
      "/api/staff/accounts",
      RECRUIT,
      cookieFor(PLAYER),
    );
    expect(fromPlayer.status).toBe(403);
    expect(await fromPlayer.json()).toEqual({ error: "staff_only" });

    const anonymousCreate = await httpPost(
      staffAccountsRoute,
      "/api/staff/accounts",
      RECRUIT,
    );
    expect(anonymousCreate.status).toBe(401);
    expect(await anonymousCreate.json()).toEqual({ error: "unauthorized" });

    const playerDeactivate = await httpDelete(
      staffAccountsRoute,
      "/api/staff/accounts",
      { playerId: DESK.playerId },
      cookieFor(PLAYER),
    );
    expect(playerDeactivate.status).toBe(403);

    const anonymousList = await httpGet(staffAccountsRoute, "/api/staff/accounts");
    expect(anonymousList.status).toBe(401);
    const playerList = await httpGet(
      staffAccountsRoute,
      "/api/staff/accounts",
      cookieFor(PLAYER),
    );
    expect(playerList.status).toBe(403);

    // None of the refused calls changed anything.
    expect(await accountsOf(DESK)).toHaveLength(2);
  });

  it("refuses an onboarding it cannot carry out", async () => {
    const alreadyStaff = await httpPost(
      staffAccountsRoute,
      "/api/staff/accounts",
      { phone: COLLEAGUE.phone },
      cookieFor(DESK),
    );
    expect(alreadyStaff.status).toBe(409);
    expect(await alreadyStaff.json()).toEqual({ error: "staff_account_exists" });

    const badPhone = await httpPost(
      staffAccountsRoute,
      "/api/staff/accounts",
      { displayName: "Mai Tran", phone: "0903000004" },
      cookieFor(DESK),
    );
    expect(badPhone.status).toBe(400);
    expect(await badPhone.json()).toEqual({ error: "invalid_phone" });

    // The phone number is new, so the name is required.
    const namelessNewPhone = await httpPost(
      staffAccountsRoute,
      "/api/staff/accounts",
      { phone: RECRUIT.phone },
      cookieFor(DESK),
    );
    expect(namelessNewPhone.status).toBe(400);
    expect(await namelessNewPhone.json()).toEqual({ error: "invalid_display_name" });

    const blankName = await httpPost(
      staffAccountsRoute,
      "/api/staff/accounts",
      { displayName: "  ", phone: RECRUIT.phone },
      cookieFor(DESK),
    );
    expect(blankName.status).toBe(400);
    expect(await blankName.json()).toEqual({ error: "invalid_display_name" });

    const noPhone = await httpPost(
      staffAccountsRoute,
      "/api/staff/accounts",
      { displayName: "Mai Tran" },
      cookieFor(DESK),
    );
    expect(noPhone.status).toBe(400);
    expect(await noPhone.json()).toEqual({ error: "invalid_phone" });

    const unknownAccount = await httpDelete(
      staffAccountsRoute,
      "/api/staff/accounts",
      { playerId: PLAYER.playerId },
      cookieFor(DESK),
    );
    expect(unknownAccount.status).toBe(404);
    expect(await unknownAccount.json()).toEqual({
      error: "staff_account_not_found",
    });

    const noPlayerId = await httpDelete(
      staffAccountsRoute,
      "/api/staff/accounts",
      {},
      cookieFor(DESK),
    );
    expect(noPlayerId.status).toBe(400);
    expect(await noPlayerId.json()).toEqual({ error: "invalid_request" });

    // A refused attempt is no action, so the Audit Log stays empty.
    const log = await httpGet(auditLogRoute, "/api/staff/audit-log", cookieFor(DESK));
    expect(await log.json()).toEqual({ entries: [] });
    expect(await accountsOf(DESK)).toHaveLength(2);
  });

  it("keeps the last Staff account, so the venue cannot lock itself out", async () => {
    await httpDelete(
      staffAccountsRoute,
      "/api/staff/accounts",
      { playerId: COLLEAGUE.playerId },
      cookieFor(DESK),
    );

    // A Staff member may deactivate their own account, but not the last one:
    // nobody would be left to grant the role back.
    const lastOne = await httpDelete(
      staffAccountsRoute,
      "/api/staff/accounts",
      { playerId: DESK.playerId },
      cookieFor(DESK),
    );
    expect(lastOne.status).toBe(409);
    expect(await lastOne.json()).toEqual({ error: "last_staff_account" });
    expect(await accountsOf(DESK)).toEqual([
      expect.objectContaining({ id: DESK.playerId }),
    ]);
  });

  it("lets a Staff member deactivate their own account once someone else can", async () => {
    const selfOffboarded = await httpDelete(
      staffAccountsRoute,
      "/api/staff/accounts",
      { playerId: DESK.playerId },
      cookieFor(DESK),
    );
    expect(selfOffboarded.status).toBe(200);

    const closed = await httpGet(
      staffAccountsRoute,
      "/api/staff/accounts",
      cookieFor(DESK),
    );
    expect(closed.status).toBe(403);
    expect(await accountsOf(COLLEAGUE)).toEqual([
      expect.objectContaining({ id: COLLEAGUE.playerId }),
    ]);
  });
});

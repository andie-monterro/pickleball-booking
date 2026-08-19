import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as meRoute from "@/app/api/auth/me/route";
import * as signInRoute from "@/app/api/auth/sign-in/request-code/route";
import * as signUpRoute from "@/app/api/auth/signup/request-code/route";
import * as verifyRoute from "@/app/api/auth/verify/route";
import { fixedClock, resetClock, setClock } from "@/lib/clock";
import { getPool } from "@/lib/db";
import { resetOtpProvider, setOtpProvider } from "@/lib/auth/otp-provider";
import { FakeOtpProvider } from "./fakes/fake-otp-provider";
import { httpGet, httpPost } from "./harness/http";

const NOW = new Date("2026-08-19T05:00:00.000Z");
const NEW_PHONE = "+84901234567";

function sessionCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("Expected a session cookie");
  }
  return setCookie.split(";", 1)[0];
}

describe("phone OTP authentication", () => {
  let otp: FakeOtpProvider;

  beforeEach(async () => {
    setClock(fixedClock(NOW));
    otp = new FakeOtpProvider();
    setOtpProvider(otp);

    const pool = getPool();
    await pool.query("delete from player_sessions");
    await pool.query("delete from auth_challenges");
    await pool.query("delete from player_signups");
    await pool.query("delete from players");
  });

  afterEach(() => {
    resetOtpProvider();
    resetClock();
  });

  it("signs up a new Player with a verified phone and session", async () => {
    const startResponse = await httpPost(
      signUpRoute,
      "/api/auth/signup/request-code",
      { displayName: "Lan Nguyen", phone: NEW_PHONE },
    );

    expect(startResponse.status).toBe(202);
    const { challengeId } = await startResponse.json();
    const verifyResponse = await httpPost(verifyRoute, "/api/auth/verify", {
      challengeId,
      code: otp.latestCode(NEW_PHONE),
    });

    expect(verifyResponse.status).toBe(200);
    expect(await verifyResponse.json()).toMatchObject({
      player: { displayName: "Lan Nguyen", phone: NEW_PHONE },
    });

    const meResponse = await httpGet(meRoute, "/api/auth/me", {
      cookie: sessionCookie(verifyResponse),
    });
    expect(meResponse.status).toBe(200);
    expect(await meResponse.json()).toMatchObject({
      player: { displayName: "Lan Nguyen", phone: NEW_PHONE },
    });
  });

  it("signs in a returning Player without creating a second Player", async () => {
    const signupStart = await httpPost(signUpRoute, "/api/auth/signup/request-code", {
      displayName: "Minh Tran",
      phone: NEW_PHONE,
    });
    const signupChallenge = await signupStart.json();
    const signupVerify = await httpPost(verifyRoute, "/api/auth/verify", {
      challengeId: signupChallenge.challengeId,
      code: otp.latestCode(NEW_PHONE),
    });
    const signedUp = await signupVerify.json();

    const signInStart = await httpPost(signInRoute, "/api/auth/sign-in/request-code", {
      phone: NEW_PHONE,
    });
    expect(signInStart.status).toBe(202);
    const signInChallenge = await signInStart.json();
    const signInVerify = await httpPost(verifyRoute, "/api/auth/verify", {
      challengeId: signInChallenge.challengeId,
      code: otp.latestCode(NEW_PHONE),
    });

    expect(signInVerify.status).toBe(200);
    const signedIn = await signInVerify.json();
    expect(signedIn.player.id).toBe(signedUp.player.id);
  });

  it("takes over a desk-created Player record without losing its identity", async () => {
    await getPool().query(
      `insert into players (id, display_name, phone, created_at)
       values ($1, $2, $3, $4)`,
      ["desk-player-42", "Lan at desk", NEW_PHONE, NOW],
    );

    const startResponse = await httpPost(signUpRoute, "/api/auth/signup/request-code", {
      displayName: "Lan Nguyen",
      phone: NEW_PHONE,
    });
    const { challengeId } = await startResponse.json();
    const verifyResponse = await httpPost(verifyRoute, "/api/auth/verify", {
      challengeId,
      code: otp.latestCode(NEW_PHONE),
    });

    expect(verifyResponse.status).toBe(200);
    expect(await verifyResponse.json()).toEqual({
      player: {
        id: "desk-player-42",
        displayName: "Lan Nguyen",
        phone: NEW_PHONE,
      },
    });
  });

  it("rejects a wrong OTP without issuing a session", async () => {
    const startResponse = await httpPost(signUpRoute, "/api/auth/signup/request-code", {
      displayName: "Lan Nguyen",
      phone: NEW_PHONE,
    });
    const { challengeId } = await startResponse.json();

    const verifyResponse = await httpPost(verifyRoute, "/api/auth/verify", {
      challengeId,
      code: "000000",
    });

    expect(verifyResponse.status).toBe(400);
    expect(await verifyResponse.json()).toEqual({ error: "invalid_code" });
    expect(verifyResponse.headers.has("set-cookie")).toBe(false);
  });

  it("rejects an expired OTP challenge", async () => {
    const startResponse = await httpPost(signUpRoute, "/api/auth/signup/request-code", {
      displayName: "Lan Nguyen",
      phone: NEW_PHONE,
    });
    const { challengeId } = await startResponse.json();
    setClock(fixedClock(new Date(NOW.getTime() + 10 * 60 * 1000 + 1)));

    const verifyResponse = await httpPost(verifyRoute, "/api/auth/verify", {
      challengeId,
      code: otp.latestCode(NEW_PHONE),
    });

    expect(verifyResponse.status).toBe(400);
    expect(await verifyResponse.json()).toEqual({ error: "expired_code" });
    expect(verifyResponse.headers.has("set-cookie")).toBe(false);
  });

  it("rejects a challenge that expires while the provider checks the OTP", async () => {
    const startResponse = await httpPost(signUpRoute, "/api/auth/signup/request-code", {
      displayName: "Lan Nguyen",
      phone: NEW_PHONE,
    });
    const { challengeId } = await startResponse.json();
    const code = otp.latestCode(NEW_PHONE);
    otp = new FakeOtpProvider(() => {
      setClock(fixedClock(new Date(NOW.getTime() + 10 * 60 * 1000 + 1)));
    });
    await otp.sendCode(NEW_PHONE);
    setOtpProvider(otp);

    const verifyResponse = await httpPost(verifyRoute, "/api/auth/verify", {
      challengeId,
      code,
    });

    expect(verifyResponse.status).toBe(400);
    expect(await verifyResponse.json()).toEqual({ error: "expired_code" });
    expect(verifyResponse.headers.has("set-cookie")).toBe(false);
  });

  it("rejects missing and invalid sessions on a non-public route", async () => {
    const missingResponse = await httpGet(meRoute, "/api/auth/me");
    expect(missingResponse.status).toBe(401);
    expect(await missingResponse.json()).toEqual({ error: "unauthorized" });

    const invalidResponse = await httpGet(meRoute, "/api/auth/me", {
      cookie: "pb_session=not-a-valid-session",
    });
    expect(invalidResponse.status).toBe(401);
    expect(await invalidResponse.json()).toEqual({ error: "unauthorized" });
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as meRoute from "@/app/api/auth/me/route";
import * as requestCodeRoute from "@/app/api/auth/request-code/route";
import * as verifyRoute from "@/app/api/auth/verify/route";
import { resetClock } from "@/lib/clock";
import { FakeSmsProvider } from "@/lib/sms/fake";
import { resetSmsProvider, setSmsProvider } from "@/lib/sms/provider";
import { httpGet, httpPost } from "./harness/http";

// Turns a Set-Cookie header into the Cookie header a browser would send back.
function cookieFrom(setCookie: string | null): string {
  if (!setCookie) throw new Error("expected a Set-Cookie header");
  return setCookie.split(";")[0];
}

describe("phone OTP signup and sign-in", () => {
  let fakeSms: FakeSmsProvider;

  beforeEach(() => {
    fakeSms = new FakeSmsProvider();
    setSmsProvider(fakeSms);
  });

  afterEach(() => {
    resetSmsProvider();
    resetClock();
  });

  it("a new player completes name + phone + OTP and ends up with a session and a Player", async () => {
    const phone = "+84901000001";

    const requested = await httpPost(requestCodeRoute, "/api/auth/request-code", {
      phone,
    });
    expect(requested.status).toBe(204);

    const code = fakeSms.lastCodeFor(phone);
    expect(code).toMatch(/^\d{6}$/);

    const verified = await httpPost(verifyRoute, "/api/auth/verify", {
      phone,
      code,
      name: "Linh",
    });
    expect(verified.status).toBe(200);
    const setCookie = verified.headers.get("set-cookie");
    expect(setCookie).toContain("session=");
    const body = await verified.json();
    expect(body.player).toMatchObject({ displayName: "Linh", phone });

    const me = await httpGet(meRoute, "/api/auth/me", {
      headers: { cookie: cookieFrom(setCookie) },
    });
    expect(me.status).toBe(200);
    const meBody = await me.json();
    expect(meBody.player).toMatchObject({ displayName: "Linh", phone });
  });
});

import { afterEach, describe, expect, it } from "vitest";
import * as healthRoute from "@/app/api/health/route";
import { fixedClock, resetClock, setClock } from "@/lib/clock";
import { httpGet } from "./harness/http";

describe("injectable clock", () => {
  afterEach(() => {
    resetClock();
  });

  it("lets a test set the current time, observable over the HTTP seam", async () => {
    setClock(fixedClock(new Date("2026-08-19T05:00:00Z")));

    const response = await httpGet(healthRoute, "/api/health");

    const body = await response.json();
    expect(body.time).toBe("2026-08-19T05:00:00.000Z");
  });
});

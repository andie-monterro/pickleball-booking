import { describe, expect, it } from "vitest";
import * as healthRoute from "@/app/api/health/route";
import { httpGet } from "./harness/http";

describe("GET /api/health", () => {
  it("reports the app and the database as healthy", async () => {
    const response = await httpGet(healthRoute, "/api/health");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ status: "ok", db: "ok" });
  });
});

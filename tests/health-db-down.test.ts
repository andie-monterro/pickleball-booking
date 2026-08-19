import { afterEach, describe, expect, it } from "vitest";
import { httpGet } from "./harness/http";

// Lives in its own file: it poisons DATABASE_URL before the route module
// (and its lazy pool) first loads, which needs a fresh module registry.
describe("GET /api/health with the database unreachable", () => {
  const realDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.DATABASE_URL = realDatabaseUrl;
  });

  it("reports db error with a 503", async () => {
    process.env.DATABASE_URL = "postgres://nobody:nope@127.0.0.1:1/none";
    const healthRoute = await import("@/app/api/health/route");

    const response = await httpGet(healthRoute, "/api/health");

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ status: "error", db: "error" });
  });
});

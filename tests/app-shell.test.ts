import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

  it("defaults an unsafe post-auth return target to the home page", async () => {
    const response = await fetch(`${baseUrl}/sign-in?returnTo=%2F%5Cevil.example`);
    const page = await response.text();

    expect(response.status).toBe(200);
    expect(page).toContain('\\"returnTo\\":\\"/\\"');
  });
});

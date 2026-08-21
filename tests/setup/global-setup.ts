import { randomBytes } from "node:crypto";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { runner } from "node-pg-migrate";
import { Client } from "pg";

// Provides a real, freshly migrated Postgres for the whole test run.
// Workers inherit DATABASE_URL because they are spawned after this runs.
//
// Two ways to get one:
//   - Default: start a throwaway container with testcontainers. Needs a Docker
//     daemon, which is how tests run on a developer machine and in CI.
//   - TEST_PG_ADMIN_URL set: create a throwaway database on that server
//     instead. The Sandcastle sandboxes use this — they are containers with no
//     Docker daemon of their own, so they share one long-lived Postgres and
//     each run carves out its own database inside it.
let container: StartedPostgreSqlContainer | undefined;
let scratchDatabase: { adminUrl: string; name: string } | undefined;

async function provisionDatabase(): Promise<string> {
  const adminUrl = process.env.TEST_PG_ADMIN_URL;

  if (!adminUrl) {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();
    return container.getConnectionUri();
  }

  const name = `test_${randomBytes(8).toString("hex")}`;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE ${name}`);
  } finally {
    await admin.end();
  }
  scratchDatabase = { adminUrl, name };

  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

export async function setup(): Promise<void> {
  const databaseUrl = await provisionDatabase();
  process.env.DATABASE_URL = databaseUrl;

  await runner({
    databaseUrl,
    dir: "migrations",
    direction: "up",
    migrationsTable: "pgmigrations",
    log: () => {},
  });
}

export async function teardown(): Promise<void> {
  if (container) {
    await container.stop();
    return;
  }

  if (scratchDatabase) {
    const admin = new Client({ connectionString: scratchDatabase.adminUrl });
    await admin.connect();
    try {
      // FORCE closes any connection a worker left behind.
      await admin.query(`DROP DATABASE ${scratchDatabase.name} WITH (FORCE)`);
    } finally {
      await admin.end();
    }
  }
}

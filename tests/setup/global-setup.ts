import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { runner } from "node-pg-migrate";

// Starts a real throwaway Postgres for the whole test run and migrates it.
// Workers inherit DATABASE_URL because they are spawned after this runs.
let container: StartedPostgreSqlContainer;

export async function setup(): Promise<void> {
  container = await new PostgreSqlContainer("postgres:17-alpine").start();
  const databaseUrl = container.getConnectionUri();
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
  await container.stop();
}

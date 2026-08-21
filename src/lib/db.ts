import { Pool, type PoolClient } from "pg";

// Either the pool or one transaction's client. A policy check that has to see
// rows written earlier in the same transaction — a light Player record and the
// horizon check on it, for instance — must run on that transaction's client.
export type Queryable = Pool | PoolClient;

let pool: Pool | undefined;

// Lazy so the pool picks up DATABASE_URL at first use (tests set it in
// global setup, after modules are loaded).
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new Pool({ connectionString, max: 5 });
  }
  return pool;
}

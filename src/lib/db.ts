import { Pool } from "pg";

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

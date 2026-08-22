import { Pool, type PoolClient } from "pg";

const UNIQUE_VIOLATION = "23505";

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

// Every write that has to land together with its Audit Log entry — and every
// read that has to lock rows before writing them — runs inside one of these, so
// no path repeats the begin/commit/rollback boilerplate or forgets to release
// the client.
export async function runInTransaction<T>(
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await run(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

// A uniqueness constraint refused the write. Which one is the caller's to know:
// the Slot claim that keeps two Bookings off one Slot, a Court name, a phone
// number. The database is where these facts are decided, so the code that asks
// only has to recognize its answer.
export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === UNIQUE_VIOLATION;
}

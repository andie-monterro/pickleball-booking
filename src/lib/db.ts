import { Pool, type PoolClient } from "pg";

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

import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  var nyayaFlowPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required outside demo mode.");
  return new Pool({
    connectionString,
    max: 12,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false,
  });
}

export function dbPool() {
  if (!global.nyayaFlowPool) global.nyayaFlowPool = createPool();
  return global.nyayaFlowPool;
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return dbPool().query<T>(text, values);
}

export async function withActor<T>(userId: string, operation: (client: PoolClient) => Promise<T>) {
  const client = await dbPool().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.user_id', $1, true)", [userId]);
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/** Executes as a client portal identity. This never sets app.user_id, so staff RLS cannot apply. */
export async function withPortalClient<T>(clientId: string, operation: (client: PoolClient) => Promise<T>) {
  const client = await dbPool().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.portal_client_id', $1, true)", [clientId]);
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally { client.release(); }
}

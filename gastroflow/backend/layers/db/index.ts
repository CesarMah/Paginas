import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.log(JSON.stringify({ level: 'error', message: 'Unexpected pool error', error: err.message }));
      pool = null;
    });
  }
  return pool;
}

export async function getDbClient(tenantId: string): Promise<PoolClient> {
  const client = await getPool().connect();
  try {
    await client.query(`SET app.current_tenant = '${tenantId}'`);
    return client;
  } catch (err) {
    client.release();
    throw err;
  }
}

export type { PoolClient };

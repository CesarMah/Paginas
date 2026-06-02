import { Pool, PoolClient } from 'pg';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

let pool: Pool | null = null;
const smClient = new SecretsManagerClient({});

async function buildConnectionString(): Promise<string> {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const secretArn = process.env.DB_SECRET_ARN!;
  const host = process.env.DB_HOST!;

  const { SecretString } = await smClient.send(
    new GetSecretValueCommand({ SecretId: secretArn })
  );
  const { username, password } = JSON.parse(SecretString!) as {
    username: string;
    password: string;
  };

  return `postgresql://${username}:${encodeURIComponent(password)}@${host}:5432/gastroflow?sslmode=require`;
}

async function getPool(): Promise<Pool> {
  if (pool) return pool;

  const connectionString = await buildConnectionString();
  pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    console.log(JSON.stringify({ level: 'error', message: 'Pool error', error: err.message }));
    pool = null;
  });

  return pool;
}

export async function getDbClient(tenantId: string): Promise<PoolClient> {
  const p = await getPool();
  const client = await p.connect();
  try {
    await client.query(`SET app.current_tenant = '${tenantId}'`);
    return client;
  } catch (err) {
    client.release();
    throw err;
  }
}

export type { PoolClient };

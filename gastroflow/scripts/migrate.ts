/**
 * Script de migración — ejecutar después del deploy CDK.
 * Uso: npx ts-node scripts/migrate.ts
 * Lee las credenciales de Secrets Manager y aplica las migraciones en orden.
 */
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const REGION  = process.env.AWS_DEFAULT_REGION || 'us-east-1';
const STAGE   = process.env.STAGE || 'dev';
const DB_HOST = process.env.DB_HOST!;

async function run() {
  if (!DB_HOST) {
    console.error('❌  Falta DB_HOST. Ejecútalo así:\n  DB_HOST=<endpoint> STAGE=dev npx ts-node scripts/migrate.ts');
    process.exit(1);
  }

  const sm = new SecretsManagerClient({ region: REGION });
  const { SecretString } = await sm.send(
    new GetSecretValueCommand({ SecretId: `gastroflow/${STAGE}/db-credentials` })
  );
  const { username, password } = JSON.parse(SecretString!) as { username: string; password: string };

  const client = new Client({
    host: DB_HOST,
    port: 5432,
    database: 'gastroflow',
    user: username,
    password,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('✅  Conectado a PostgreSQL:', DB_HOST);

  // Tabla de control de migraciones
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const migrationsDir = path.join(__dirname, '../db/migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  for (const file of files) {
    if (!file.endsWith('.sql')) continue;

    const version = file.replace('.sql', '');
    const { rows } = await client.query('SELECT 1 FROM _migrations WHERE version = $1', [version]);
    if (rows.length > 0) {
      console.log(`⏭️   Ya aplicada: ${version}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`🔄  Aplicando: ${version}...`);
    await client.query(sql);
    await client.query('INSERT INTO _migrations (version) VALUES ($1)', [version]);
    console.log(`✅  Completada: ${version}`);
  }

  await client.end();
  console.log('\n🎉  Todas las migraciones aplicadas.');
}

run().catch((err) => {
  console.error('❌  Error en migración:', err.message);
  process.exit(1);
});

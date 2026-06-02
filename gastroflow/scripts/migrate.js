'use strict';
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const REGION  = process.env.AWS_DEFAULT_REGION || 'us-east-1';
const STAGE   = process.env.STAGE || 'dev';
const DB_HOST = process.env.DB_HOST;

async function run() {
  if (!DB_HOST) {
    console.error('❌  Falta DB_HOST.');
    process.exit(1);
  }

  const sm = new SecretsManagerClient({ region: REGION });
  const { SecretString } = await sm.send(
    new GetSecretValueCommand({ SecretId: `gastroflow/${STAGE}/db-credentials` })
  );
  const { username, password } = JSON.parse(SecretString);

  const client = new Client({
    host: DB_HOST, port: 5432, database: 'gastroflow',
    user: username, password,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('✅  Conectado a PostgreSQL:', DB_HOST);

  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const migrationsDir = path.join(__dirname, '../db/migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const version = file.replace('.sql', '');
    const { rows } = await client.query('SELECT 1 FROM _migrations WHERE version = $1', [version]);
    if (rows.length > 0) { console.log(`⏭️   Ya aplicada: ${version}`); continue; }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`🔄  Aplicando: ${version}...`);
    await client.query(sql);
    await client.query('INSERT INTO _migrations (version) VALUES ($1)', [version]);
    console.log(`✅  Completada: ${version}`);
  }

  await client.end();
  console.log('\n🎉  Todas las migraciones aplicadas.');
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });

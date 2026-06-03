'use strict';
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');

const REGION    = 'us-east-1';
const DB_HOST   = process.env.DB_HOST;
const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const USERS = [
  { sub: process.env.MESERO_SUB, email: 'mesero@calico.mx', name: 'Mesero Calico' },
  { sub: process.env.COCINA_SUB, email: 'cocina@calico.mx', name: 'Cocina Calico' },
];

async function run() {
  const sm = new SecretsManagerClient({ region: REGION });
  const { SecretString } = await sm.send(
    new GetSecretValueCommand({ SecretId: 'gastroflow/dev/db-credentials' })
  );
  const { username, password } = JSON.parse(SecretString);
  const db = new Client({
    host: DB_HOST, port: 5432, database: 'gastroflow',
    user: username, password,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();
  await db.query(`SET app.current_tenant = '${TENANT_ID}'`);

  for (const u of USERS) {
    await db.query(
      `INSERT INTO users (tenant_id, cognito_sub, role, email, name)
       VALUES ($1, $2, 'staff', $3, $4)
       ON CONFLICT (cognito_sub) DO NOTHING`,
      [TENANT_ID, u.sub, u.email, u.name]
    );
    console.log(`✅  Registrado en DB: ${u.email}`);
  }

  await db.end();
  console.log('\n🎉  Listo.');
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

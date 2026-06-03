'use strict';
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');

async function run() {
  const sm = new SecretsManagerClient({ region: 'us-east-1' });
  const { SecretString } = await sm.send(
    new GetSecretValueCommand({ SecretId: 'gastroflow/dev/db-credentials' })
  );
  const { username, password } = JSON.parse(SecretString);
  const db = new Client({
    host: process.env.DB_HOST, port: 5432, database: 'gastroflow',
    user: username, password, ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  // Actualizar rol del usuario de cocina en la tabla users
  const result = await db.query(
    `UPDATE users SET role = 'kitchen' WHERE email = 'cocina@calico.mx' RETURNING email, role`
  );

  if (result.rowCount > 0) {
    console.log(`✅ DB actualizada: ${result.rows[0].email} → role=${result.rows[0].role}`);
  } else {
    console.log('⚠️  Usuario no encontrado en DB');
  }

  await db.end();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

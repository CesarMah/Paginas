/**
 * Seed inicial — crea tenant Calico y usuario admin en Cognito + DB.
 * Uso: DB_HOST=<endpoint> USER_POOL_ID=<id> npx ts-node scripts/seed.ts
 */
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { Client } from 'pg';

const REGION      = process.env.AWS_DEFAULT_REGION || 'us-east-1';
const STAGE       = process.env.STAGE || 'dev';
const DB_HOST     = process.env.DB_HOST!;
const USER_POOL   = process.env.USER_POOL_ID!;
const TENANT_ID   = '00000000-0000-0000-0000-000000000001';
const ADMIN_EMAIL = 'cessarmah@mirestaurante.mx';
const ADMIN_PASS  = 'Kali-1234.';

async function run() {
  if (!DB_HOST || !USER_POOL) {
    console.error('❌  Faltan variables: DB_HOST y USER_POOL_ID son requeridas.');
    process.exit(1);
  }

  // --- 1. Conectar a DB ---
  const sm = new SecretsManagerClient({ region: REGION });
  const { SecretString } = await sm.send(
    new GetSecretValueCommand({ SecretId: `gastroflow/${STAGE}/db-credentials` })
  );
  const { username, password } = JSON.parse(SecretString!) as { username: string; password: string };

  const db = new Client({
    host: DB_HOST, port: 5432, database: 'gastroflow',
    user: username, password,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  // --- 2. Crear tenant ---
  await db.query(`
    INSERT INTO tenants (id, name, plan)
    VALUES ($1, 'Calico', 'business')
    ON CONFLICT (id) DO NOTHING
  `, [TENANT_ID]);
  console.log('✅  Tenant "Calico" creado (id:', TENANT_ID, ')');

  // --- 3. Crear usuario en Cognito ---
  const cognito = new CognitoIdentityProviderClient({ region: REGION });

  try {
    await cognito.send(new AdminCreateUserCommand({
      UserPoolId: USER_POOL,
      Username: ADMIN_EMAIL,
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email',             Value: ADMIN_EMAIL },
        { Name: 'email_verified',    Value: 'true' },
        { Name: 'custom:role',       Value: 'owner' },
        { Name: 'custom:tenantId',   Value: TENANT_ID },
      ],
    }));
    console.log('✅  Usuario creado en Cognito:', ADMIN_EMAIL);
  } catch (e: unknown) {
    if ((e as { name?: string }).name === 'UsernameExistsException') {
      console.log('⚠️   Usuario ya existía en Cognito, continuando...');
    } else throw e;
  }

  await cognito.send(new AdminSetUserPasswordCommand({
    UserPoolId: USER_POOL,
    Username: ADMIN_EMAIL,
    Password: ADMIN_PASS,
    Permanent: true,
  }));
  console.log('✅  Contraseña establecida');

  // --- 4. Obtener sub de Cognito y crear registro en DB ---
  const { CognitoIdentityProviderClient: CIC, AdminGetUserCommand } =
    await import('@aws-sdk/client-cognito-identity-provider');

  const c2 = new CIC({ region: REGION });
  const userInfo = await c2.send(new AdminGetUserCommand({
    UserPoolId: USER_POOL,
    Username: ADMIN_EMAIL,
  }));
  const sub = userInfo.UserAttributes?.find(a => a.Name === 'sub')?.Value ?? '';

  await db.query(`
    INSERT INTO users (tenant_id, cognito_sub, role, email, name)
    VALUES ($1, $2, 'owner', $3, 'Admin Calico')
    ON CONFLICT (cognito_sub) DO NOTHING
  `, [TENANT_ID, sub, ADMIN_EMAIL]);
  console.log('✅  Usuario registrado en DB (sub:', sub, ')');

  await db.end();
  console.log('\n🎉  Seed completado. Accede con:', ADMIN_EMAIL, '/', ADMIN_PASS);
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });

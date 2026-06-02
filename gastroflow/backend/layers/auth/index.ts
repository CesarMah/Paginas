import jwt from 'jsonwebtoken';
import jwksClient, { JwksClient, SigningKey } from 'jwks-rsa';

export interface CognitoPayload {
  sub: string;
  email: string;
  'custom:tenantId': string;
  'custom:role': string;
  exp: number;
  aud: string;
}

let client: JwksClient | null = null;

function getJwksClient(): JwksClient {
  if (!client) {
    const region = process.env.AWS_REGION || 'us-east-1';
    const userPoolId = process.env.USER_POOL_ID!;
    client = jwksClient({
      jwksUri: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 86400000, // 24h
    });
  }
  return client;
}

export async function verifyToken(token: string): Promise<CognitoPayload> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
    throw new Error('Token inválido');
  }

  const key: SigningKey = await getJwksClient().getSigningKey(decoded.header.kid);
  const publicKey = key.getPublicKey();

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      publicKey,
      {
        algorithms: ['RS256'],
        audience: process.env.USER_POOL_CLIENT_ID,
      },
      (err, payload) => {
        if (err) return reject(err);
        resolve(payload as CognitoPayload);
      }
    );
  });
}

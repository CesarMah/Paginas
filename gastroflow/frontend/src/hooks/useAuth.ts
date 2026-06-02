import {
  CognitoUser,
  CognitoUserPool,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { useAuthStore } from '../stores/useAuthStore';

const userPool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID as string,
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID as string,
});

let currentUser: CognitoUser | null = null;
let refreshInterval: ReturnType<typeof setInterval> | null = null;

function extractClaims(session: CognitoUserSession) {
  const payload = session.getIdToken().decodePayload();
  return {
    token: session.getIdToken().getJwtToken(),
    role: payload['custom:role'] as string,
    tenantId: payload['custom:tenantId'] as string,
  };
}

export function signIn(email: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    const auth = new AuthenticationDetails({ Username: email, Password: password });

    user.authenticateUser(auth, {
      onSuccess(session) {
        currentUser = user;
        const { token, role, tenantId } = extractClaims(session);
        useAuthStore.getState().setAuth(token, role, tenantId);
        scheduleRefresh(user);
        resolve();
      },
      onFailure(err) {
        reject(err);
      },
    });
  });
}

export function signOut(): void {
  if (refreshInterval) clearInterval(refreshInterval);
  currentUser?.signOut();
  currentUser = null;
  useAuthStore.getState().clearAuth();
}

export function refreshSession(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!currentUser) return reject(new Error('No hay sesión activa'));

    currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session) return reject(err || new Error('Sin sesión'));
      const { token, role, tenantId } = extractClaims(session);
      useAuthStore.getState().setAuth(token, role, tenantId);
      resolve();
    });
  });
}

function scheduleRefresh(user: CognitoUser) {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session) return;
      const { token, role, tenantId } = extractClaims(session);
      useAuthStore.getState().setAuth(token, role, tenantId);
    });
  }, 55 * 60 * 1000);
}

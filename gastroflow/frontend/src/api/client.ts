import { useAuthStore } from '../stores/useAuthStore';

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE_URL = import.meta.env.VITE_API_URL as string;

async function attempt(path: string, options: RequestInit): Promise<Response> {
  const token = useAuthStore.getState().token;
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${BASE_URL}${path}`, { ...options, headers });
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;

  try {
    res = await attempt(path, options);
  } catch {
    throw new NetworkError('Sin conexión a la red');
  }

  if (res.status === 401) {
    const { refreshSession } = await import('../hooks/useAuth');
    try {
      await refreshSession();
      try {
        res = await attempt(path, options);
      } catch {
        throw new NetworkError('Sin conexión a la red');
      }
    } catch {
      useAuthStore.getState().clearAuth();
      throw new ApiError('UNAUTHORIZED', 'Sesión expirada');
    }
  }

  if (!res.ok) {
    let body: { error?: string; details?: unknown } = {};
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(body.error || 'API_ERROR', `Error ${res.status}`, body.details);
  }

  return res.json() as Promise<T>;
}

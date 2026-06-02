import { create } from 'zustand';

interface AuthState {
  token: string | null;
  role: string | null;
  tenantId: string | null;
  setAuth: (token: string, role: string, tenantId: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  role: null,
  tenantId: null,
  setAuth: (token, role, tenantId) => set({ token, role, tenantId }),
  clearAuth: () => set({ token: null, role: null, tenantId: null }),
}));

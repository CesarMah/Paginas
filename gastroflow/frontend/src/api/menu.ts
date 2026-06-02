import { apiFetch } from './client';
import { MenuItem } from '../stores/useMenuStore';

export const menuApi = {
  list: () => apiFetch<MenuItem[]>('/menu-items'),

  create: (body: Partial<MenuItem> & { hasImage?: boolean }) =>
    apiFetch<MenuItem & { uploadUrl?: string }>('/menu-items', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),

  update: (id: string, body: Partial<MenuItem> & { hasImage?: boolean }) =>
    apiFetch<MenuItem & { uploadUrl?: string }>(`/menu-items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
};

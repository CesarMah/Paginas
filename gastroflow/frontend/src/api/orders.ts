import { apiFetch } from './client';
import { Order } from '../stores/useOrderStore';

export interface ListOrdersParams {
  status?: string;
  date?: string;
  limit?: number;
  cursor?: string;
}

export interface ListOrdersResponse {
  orders: Order[];
  nextCursor: string | null;
  total: number;
}

export const ordersApi = {
  list: (params: ListOrdersParams = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.date) qs.set('date', params.date);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.cursor) qs.set('cursor', params.cursor);
    return apiFetch<ListOrdersResponse>(`/orders?${qs}`);
  },

  create: (body: Omit<Order, 'id' | 'tenant_id' | 'total' | 'status' | 'created_at' | 'updated_at'>) =>
    apiFetch<Order>('/orders', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),

  updateStatus: (id: string, status: Order['status']) =>
    apiFetch<Order>(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }), headers: { 'Content-Type': 'application/json' } }),
};

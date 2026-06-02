import { create } from 'zustand';

export interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  tenant_id: string;
  items: OrderItem[];
  total: number;
  status: 'new' | 'cooking' | 'ready' | 'delivered' | 'cancelled';
  table_number?: string;
  notes?: string;
  customer_email?: string;
  created_at: string;
  updated_at: string;
}

interface OrderState {
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (order: Order) => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  orders: [],
  setOrders: (orders) => set({ orders }),
  addOrder: (order) => set((s) => ({ orders: [order, ...s.orders] })),
  updateOrder: (order) =>
    set((s) => ({
      orders: s.orders.map((o) => (o.id === order.id ? order : o)),
    })),
}));

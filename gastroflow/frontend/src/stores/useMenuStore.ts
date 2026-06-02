import { create } from 'zustand';

export interface MenuItem {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  image_key?: string;
  available: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface MenuState {
  items: MenuItem[];
  setItems: (items: MenuItem[]) => void;
  upsertItem: (item: MenuItem) => void;
}

export const useMenuStore = create<MenuState>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  upsertItem: (item) =>
    set((s) => {
      const exists = s.items.find((i) => i.id === item.id);
      if (exists) {
        return { items: s.items.map((i) => (i.id === item.id ? item : i)) };
      }
      return { items: [item, ...s.items] };
    }),
}));

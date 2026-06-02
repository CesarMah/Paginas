import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../../api/orders';
import { useOrderStore, Order } from '../../stores/useOrderStore';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';

const KDS_COLUMNS: { status: Order['status']; label: string; next: Order['status'] | null }[] = [
  { status: 'new', label: 'Nuevo', next: 'cooking' },
  { status: 'cooking', label: 'En cocina', next: 'ready' },
  { status: 'ready', label: 'Listo', next: 'delivered' },
];

function elapsed(createdAt: string): string {
  const secs = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function OrderCard({ order, nextStatus }: { order: Order; nextStatus: Order['status'] | null }) {
  const [, setTick] = useState(0);
  const qc = useQueryClient();

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const mutation = useMutation({
    mutationFn: (status: Order['status']) => ordersApi.updateStatus(order.id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders-kds'] }),
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-gray-400">#{order.id.slice(0, 8)}</span>
        <span className="text-sm font-semibold text-orange-500">{elapsed(order.created_at)}</span>
      </div>
      {order.table_number && (
        <p className="text-sm font-medium text-gray-700">Mesa {order.table_number}</p>
      )}
      <ul className="space-y-1">
        {order.items.map((item, i) => (
          <li key={i} className="text-sm text-gray-600 flex justify-between">
            <span>{item.name}</span>
            <span className="font-medium">×{item.quantity}</span>
          </li>
        ))}
      </ul>
      {order.notes && <p className="text-xs text-gray-400 italic">{order.notes}</p>}
      {nextStatus && (
        <Button
          size="sm"
          className="w-full"
          loading={mutation.isPending}
          onClick={() => mutation.mutate(nextStatus)}
        >
          {nextStatus === 'cooking' ? 'Iniciar cocción' : nextStatus === 'ready' ? 'Marcar listo' : 'Entregar'}
        </Button>
      )}
    </div>
  );
}

export function KitchenPage() {
  const qc = useQueryClient();
  const orders = useOrderStore((s) => s.orders);
  const setOrders = useOrderStore((s) => s.setOrders);

  useQuery({
    queryKey: ['orders-kds'],
    queryFn: async () => {
      const all = await Promise.all([
        ordersApi.list({ status: 'new', limit: 50 }),
        ordersApi.list({ status: 'cooking', limit: 50 }),
        ordersApi.list({ status: 'ready', limit: 50 }),
      ]);
      const merged = [...all[0].orders, ...all[1].orders, ...all[2].orders];
      setOrders(merged);
      return merged;
    },
    refetchInterval: 30000,
  });

  return (
    <PageWrapper title="Cocina — KDS">
      <div className="grid grid-cols-3 gap-4 h-full">
        {KDS_COLUMNS.map((col) => (
          <div key={col.status} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
              <h2 className="font-semibold text-gray-700">{col.label}</h2>
              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                {orders.filter((o) => o.status === col.status).length}
              </span>
            </div>
            <div className="space-y-3 overflow-y-auto">
              {orders
                .filter((o) => o.status === col.status)
                .map((order) => (
                  <OrderCard key={order.id} order={order} nextStatus={col.next} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}

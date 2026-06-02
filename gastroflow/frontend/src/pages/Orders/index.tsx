import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../../api/orders';
import { Order } from '../../stores/useOrderStore';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

const STATUS_OPTIONS = ['', 'new', 'cooking', 'ready', 'delivered', 'cancelled'];
const STATUS_LABELS: Record<string, string> = {
  '': 'Todos',
  new: 'Nuevo',
  cooking: 'En cocina',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};
const NEXT_STATUS: Partial<Record<Order['status'], Order['status']>> = {
  new: 'cooking',
  cooking: 'ready',
  ready: 'delivered',
};

export function OrdersPage() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [confirmOrder, setConfirmOrder] = useState<Order | null>(null);
  const [pendingStatus, setPendingStatus] = useState<Order['status'] | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', filterStatus, filterDate],
    queryFn: () =>
      ordersApi.list({
        status: filterStatus || undefined,
        date: filterDate || undefined,
        limit: 50,
      }),
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Order['status'] }) =>
      ordersApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      setConfirmOrder(null);
    },
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

  return (
    <PageWrapper title="Órdenes">
      <div className="space-y-4">
        <div className="flex gap-3 flex-wrap">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-4 border-orange-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">ID</th>
                  <th className="px-5 py-3 text-left">Mesa</th>
                  <th className="px-5 py-3 text-left">Ítems</th>
                  <th className="px-5 py-3 text-left">Total</th>
                  <th className="px-5 py-3 text-left">Estado</th>
                  <th className="px-5 py-3 text-left">Fecha</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-xs">{order.id.slice(0, 8)}</td>
                    <td className="px-5 py-3">{order.table_number ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{order.items.length} ítem(s)</td>
                    <td className="px-5 py-3 font-medium">{fmt(order.total)}</td>
                    <td className="px-5 py-3"><Badge status={order.status} /></td>
                    <td className="px-5 py-3 text-gray-400">
                      {new Date(order.created_at).toLocaleString('es-MX')}
                    </td>
                    <td className="px-5 py-3">
                      {NEXT_STATUS[order.status] && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setConfirmOrder(order);
                            setPendingStatus(NEXT_STATUS[order.status] ?? null);
                          }}
                        >
                          Avanzar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal
        open={!!confirmOrder}
        onClose={() => setConfirmOrder(null)}
        title="Confirmar cambio de estado"
      >
        <p className="text-sm text-gray-600 mb-4">
          ¿Cambiar la orden <span className="font-mono">{confirmOrder?.id.slice(0, 8)}</span> a{' '}
          <strong>{pendingStatus ? STATUS_LABELS[pendingStatus] : ''}</strong>?
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setConfirmOrder(null)}>Cancelar</Button>
          <Button
            loading={mutation.isPending}
            onClick={() => {
              if (confirmOrder && pendingStatus) {
                mutation.mutate({ id: confirmOrder.id, status: pendingStatus });
              }
            }}
          >
            Confirmar
          </Button>
        </div>
      </Modal>
    </PageWrapper>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../api/client';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  min_quantity: number;
  updated_at: string;
}

export function InventoryPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, string>>({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => apiFetch<InventoryItem[]>('/inventory'),
  });

  const mutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      apiFetch<InventoryItem>(`/inventory/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setEditing({});
    },
  });

  return (
    <PageWrapper title="Inventario">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-6 h-6 border-4 border-orange-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Insumo</th>
                <th className="px-5 py-3 text-left">Unidad</th>
                <th className="px-5 py-3 text-left">Cantidad actual</th>
                <th className="px-5 py-3 text-left">Mínimo</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => {
                const lowStock = item.quantity < item.min_quantity;
                return (
                  <tr key={item.id} className={lowStock ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="px-5 py-3 font-medium text-gray-800">
                      {item.name}
                      {lowStock && <span className="ml-2 text-xs text-red-600 font-semibold">⚠ Stock bajo</span>}
                    </td>
                    <td className="px-5 py-3 text-gray-500">{item.unit}</td>
                    <td className="px-5 py-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editing[item.id] ?? String(item.quantity)}
                        onChange={(e) => setEditing({ ...editing, [item.id]: e.target.value })}
                        className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-5 py-3 text-gray-500">{item.min_quantity}</td>
                    <td className="px-5 py-3">
                      {editing[item.id] !== undefined && (
                        <Button
                          size="sm"
                          loading={mutation.isPending}
                          onClick={() =>
                            mutation.mutate({ id: item.id, quantity: parseFloat(editing[item.id]) })
                          }
                        >
                          Guardar
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </PageWrapper>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../api/client';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  min_quantity: number;
  updated_at: string;
}

// ─── Modal de reabastecimiento ────────────────────────────────────────────────
function RestockModal({
  item,
  onClose,
}: {
  item: InventoryItem | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'choose' | 'supplier' | 'internal' | 'done'>('choose');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);

  if (!item) return null;

  const shortage = Math.max(0, item.min_quantity * 2 - item.quantity);
  const suggestedQty = shortage > 0 ? String(Math.ceil(shortage)) : '10';

  const handleSupplierSend = async () => {
    setSending(true);
    // Simula el envío — en producción llamaría a una Lambda de emails
    await new Promise((r) => setTimeout(r, 1200));
    setSending(false);
    setMode('done');
  };

  const handleInternalNotify = async () => {
    setSending(true);
    await new Promise((r) => setTimeout(r, 800));
    setSending(false);
    setMode('done');
  };

  const handleClose = () => {
    setMode('choose');
    setSupplierEmail('');
    setSupplierName('');
    setQuantity('');
    setNotes('');
    onClose();
  };

  return (
    <Modal open={!!item} onClose={handleClose} title={`Reabastecer — ${item.name}`}>
      {/* ── Elegir método ── */}
      {mode === 'choose' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
            <p className="font-medium text-amber-800">Stock actual: {item.quantity} {item.unit}</p>
            <p className="text-amber-600">Mínimo requerido: {item.min_quantity} {item.unit}</p>
            {item.quantity < item.min_quantity && (
              <p className="text-red-600 font-semibold mt-1">
                ⚠️ Déficit: {(item.min_quantity - item.quantity).toFixed(2)} {item.unit}
              </p>
            )}
          </div>

          <p className="text-sm text-gray-600">¿Cómo quieres gestionar el reabastecimiento?</p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setQuantity(suggestedQty); setMode('supplier'); }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200
                         hover:border-orange-400 hover:bg-orange-50 transition-all text-center"
            >
              <span className="text-3xl">📧</span>
              <span className="text-sm font-semibold text-gray-700">Contactar proveedor</span>
              <span className="text-xs text-gray-400">Enviar pedido por correo</span>
            </button>

            <button
              onClick={() => { setQuantity(suggestedQty); setMode('internal'); }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200
                         hover:border-blue-400 hover:bg-blue-50 transition-all text-center"
            >
              <span className="text-3xl">🔔</span>
              <span className="text-sm font-semibold text-gray-700">Aviso interno</span>
              <span className="text-xs text-gray-400">Notificar al encargado</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Formulario proveedor ── */}
      {mode === 'supplier' && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            Se generará un correo de pedido al proveedor con los detalles del producto.
          </div>
          <Input
            label="Nombre del proveedor"
            placeholder="Ej: Distribuidora Ramírez"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
          />
          <Input
            label="Correo del proveedor"
            type="email"
            placeholder="proveedor@ejemplo.com"
            value={supplierEmail}
            onChange={(e) => setSupplierEmail(e.target.value)}
          />
          <Input
            label={`Cantidad a pedir (${item.unit})`}
            type="number"
            min="0"
            step="0.5"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Notas adicionales</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instrucciones especiales, urgencia, etc."
              rows={2}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none
                         focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
            />
          </div>

          {/* Vista previa del pedido */}
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
            <p className="font-semibold text-gray-700">Vista previa del correo:</p>
            <p>Para: {supplierEmail || 'proveedor@...'}</p>
            <p>Asunto: Pedido urgente — {item.name}</p>
            <p className="text-gray-500">
              Estimado {supplierName || 'proveedor'}, solicitamos {quantity || '?'} {item.unit} de {item.name}.
              Stock actual: {item.quantity} {item.unit} (mínimo: {item.min_quantity}).
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" onClick={() => setMode('choose')}>← Atrás</Button>
            <Button
              loading={sending}
              disabled={!supplierEmail || !quantity}
              onClick={handleSupplierSend}
            >
              📧 Enviar pedido
            </Button>
          </div>
        </div>
      )}

      {/* ── Aviso interno ── */}
      {mode === 'internal' && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            Se registrará una solicitud de reabastecimiento visible para el encargado.
          </div>
          <Input
            label={`Cantidad sugerida (${item.unit})`}
            type="number"
            min="0"
            step="0.5"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Mensaje al encargado</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={`Se necesita reabastecer ${item.name}...`}
              rows={3}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none
                         focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
              defaultValue={`Se necesita reabastecer ${item.name}. Stock: ${item.quantity} ${item.unit} (mín. ${item.min_quantity}).`}
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" onClick={() => setMode('choose')}>← Atrás</Button>
            <Button loading={sending} onClick={handleInternalNotify}>
              🔔 Enviar aviso
            </Button>
          </div>
        </div>
      )}

      {/* ── Confirmación ── */}
      {mode === 'done' && (
        <div className="flex flex-col items-center py-6 gap-4 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl">
            ✅
          </div>
          <div>
            <p className="font-semibold text-gray-800">¡Solicitud enviada!</p>
            <p className="text-sm text-gray-500 mt-1">
              {mode === 'done' && 'El aviso de reabastecimiento fue registrado correctamente.'}
            </p>
          </div>
          <Button onClick={handleClose}>Cerrar</Button>
        </div>
      )}
    </Modal>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export function InventoryPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [filterLow, setFilterLow] = useState(false);

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

  const displayed = filterLow
    ? items.filter((i) => i.quantity < i.min_quantity)
    : items;

  const lowCount = items.filter((i) => i.quantity < i.min_quantity).length;

  return (
    <PageWrapper title="Inventario">
      <div className="space-y-4">
        {/* Barra de controles */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {lowCount > 0 && (
              <button
                onClick={() => setFilterLow((f) => !f)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
                            transition-colors border
                            ${filterLow
                              ? 'bg-red-500 text-white border-red-500'
                              : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'}`}
              >
                ⚠️ {lowCount} con stock bajo
                {filterLow && ' (mostrando)'}
              </button>
            )}
          </div>
          <p className="text-sm text-gray-400">{items.length} insumos en total</p>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin w-6 h-6 border-4 border-orange-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">Insumo</th>
                  <th className="px-5 py-3 text-left">Unidad</th>
                  <th className="px-5 py-3 text-center">Actual</th>
                  <th className="px-5 py-3 text-center">Mínimo</th>
                  <th className="px-5 py-3 text-center">Estado</th>
                  <th className="px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayed.map((item) => {
                  const lowStock = item.quantity < item.min_quantity;
                  const pct = item.min_quantity > 0
                    ? Math.min(100, (item.quantity / item.min_quantity) * 100)
                    : 100;

                  return (
                    <tr key={item.id} className={lowStock ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      {/* Nombre */}
                      <td className="px-5 py-3">
                        <span className="font-medium text-gray-800">{item.name}</span>
                      </td>

                      {/* Unidad */}
                      <td className="px-5 py-3 text-gray-500">{item.unit}</td>

                      {/* Cantidad editable */}
                      <td className="px-5 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editing[item.id] ?? String(item.quantity)}
                          onChange={(e) => setEditing({ ...editing, [item.id]: e.target.value })}
                          className={`w-20 rounded border px-2 py-1 text-sm text-center
                            focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none
                            ${lowStock ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                        />
                      </td>

                      {/* Mínimo */}
                      <td className="px-5 py-3 text-center text-gray-500">{item.min_quantity}</td>

                      {/* Barra de nivel */}
                      <td className="px-5 py-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all
                                ${pct < 50 ? 'bg-red-500' : pct < 80 ? 'bg-yellow-400' : 'bg-green-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          {lowStock && (
                            <span className="text-xs text-red-600 font-medium whitespace-nowrap">
                              ⚠️ Stock bajo
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
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
                          <Button
                            size="sm"
                            variant={lowStock ? 'danger' : 'secondary'}
                            onClick={() => setRestockItem(item)}
                          >
                            🛒 Reabastecer
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <RestockModal item={restockItem} onClose={() => setRestockItem(null)} />
    </PageWrapper>
  );
}

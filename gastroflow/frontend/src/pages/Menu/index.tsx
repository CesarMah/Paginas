import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { menuApi } from '../../api/menu';
import { MenuItem } from '../../stores/useMenuStore';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';

const EMPTY_FORM = { name: '', description: '', price: '', category: '', available: true };

export function MenuPage() {
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: () => menuApi.list(),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        category: form.category,
        available: form.available,
        hasImage: !!imageFile,
      };
      const res = editItem
        ? await menuApi.update(editItem.id, payload)
        : await menuApi.create(payload);

      if (imageFile && res.uploadUrl) {
        await fetch(res.uploadUrl, { method: 'PUT', body: imageFile, headers: { 'Content-Type': 'image/webp' } });
      }
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-items'] });
      setShowModal(false);
      setForm(EMPTY_FORM);
      setEditItem(null);
      setImageFile(null);
    },
  });

  const openCreate = () => { setEditItem(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (item: MenuItem) => {
    setEditItem(item);
    setForm({ name: item.name, description: item.description ?? '', price: String(item.price), category: item.category ?? '', available: item.available });
    setShowModal(true);
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

  return (
    <PageWrapper title="Menú">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={openCreate}>+ Nuevo producto</Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-6 h-6 border-4 border-orange-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="h-32 bg-gray-100 flex items-center justify-center text-4xl">
                  {item.image_key ? '🖼️' : '🍽️'}
                </div>
                <div className="p-4 space-y-2">
                  <p className="font-medium text-gray-800 truncate">{item.name}</p>
                  {item.category && <p className="text-xs text-gray-400">{item.category}</p>}
                  <p className="font-semibold text-orange-500">{fmt(item.price)}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${item.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.available ? 'Disponible' : 'No disponible'}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>Editar</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? 'Editar producto' : 'Nuevo producto'}
      >
        <div className="space-y-3">
          <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Precio" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
          <Input label="Categoría" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="available" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} />
            <label htmlFor="available" className="text-sm text-gray-700">Disponible</label>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Imagen (WebP)</label>
            <input type="file" accept="image/webp,image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} className="text-sm" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}

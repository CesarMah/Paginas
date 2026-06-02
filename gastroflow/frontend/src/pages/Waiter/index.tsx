import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { menuApi } from '../../api/menu';
import { ordersApi } from '../../api/orders';
import { MenuItem } from '../../stores/useMenuStore';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

// ─── Item card del menú ───────────────────────────────────────────────────────

function MenuCard({
  item,
  quantity,
  onAdd,
  onRemove,
}: {
  item: MenuItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all
      ${quantity > 0 ? 'border-orange-400 ring-1 ring-orange-300' : 'border-gray-100'}`}>
      <div className="h-24 bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center text-3xl">
        🍽️
      </div>
      <div className="p-3 space-y-2">
        <p className="font-semibold text-gray-800 text-sm leading-tight line-clamp-2">{item.name}</p>
        {item.description && (
          <p className="text-xs text-gray-400 line-clamp-1">{item.description}</p>
        )}
        <p className="text-orange-500 font-bold text-sm">
          {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(item.price)}
        </p>
        <div className="flex items-center justify-between pt-1">
          {quantity === 0 ? (
            <button
              onClick={onAdd}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium
                         py-1.5 rounded-lg transition-colors"
            >
              + Agregar
            </button>
          ) : (
            <div className="flex items-center gap-2 w-full justify-between">
              <button
                onClick={onRemove}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-gray-700 text-lg
                           flex items-center justify-center transition-colors"
              >
                −
              </button>
              <span className="font-bold text-gray-800 text-base">{quantity}</span>
              <button
                onClick={onAdd}
                className="w-8 h-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg
                           flex items-center justify-center transition-colors"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Carrito ──────────────────────────────────────────────────────────────────

function Cart({
  cart,
  tableNumber,
  notes,
  onTableChange,
  onNotesChange,
  onSubmit,
  loading,
  onClear,
}: {
  cart: CartItem[];
  tableNumber: string;
  notes: string;
  onTableChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  onClear: () => void;
}) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-800">Orden</h2>
          <p className="text-xs text-gray-400">{itemCount} ítem{itemCount !== 1 ? 's' : ''}</p>
        </div>
        {cart.length > 0 && (
          <button onClick={onClear} className="text-xs text-red-400 hover:text-red-600 transition-colors">
            Limpiar
          </button>
        )}
      </div>

      {/* Items del carrito */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10 text-gray-400">
            <span className="text-4xl mb-3">🛒</span>
            <p className="text-sm">Selecciona platillos<br />del menú</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.menuItemId} className="flex items-center justify-between
                                                  bg-gray-50 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                <p className="text-xs text-gray-400">{fmt(item.price)} c/u</p>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <span className="text-xs text-gray-500">×{item.quantity}</span>
                <span className="text-sm font-semibold text-orange-500 ml-2">
                  {fmt(item.price * item.quantity)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer con formulario y total */}
      {cart.length > 0 && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          <Input
            label="Número de mesa"
            placeholder="Ej: 5, Terraza-2, Barra"
            value={tableNumber}
            onChange={(e) => onTableChange(e.target.value)}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Sin cebolla, extra picante..."
              rows={2}
              maxLength={500}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none
                         focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <span className="text-sm font-medium text-gray-600">Total</span>
            <span className="text-lg font-bold text-gray-900">{fmt(total)}</span>
          </div>

          <Button
            className="w-full"
            size="lg"
            loading={loading}
            disabled={!tableNumber.trim()}
            onClick={onSubmit}
          >
            Enviar orden a cocina
          </Button>
          {!tableNumber.trim() && (
            <p className="text-xs text-center text-gray-400">Ingresa el número de mesa para continuar</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Confirmación de orden enviada ────────────────────────────────────────────

function OrderConfirmed({ orderId, onNew }: { orderId: string; onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-12 space-y-4">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl">
        ✅
      </div>
      <div>
        <h3 className="text-xl font-bold text-gray-800">¡Orden enviada!</h3>
        <p className="text-sm text-gray-500 mt-1">Folio: <span className="font-mono font-medium">{orderId.slice(0, 8).toUpperCase()}</span></p>
        <p className="text-sm text-gray-400 mt-0.5">La cocina ya recibió el pedido</p>
      </div>
      <Button onClick={onNew} variant="primary" size="lg" className="mt-2">
        Nueva orden
      </Button>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function WaiterPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);

  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: () => menuApi.list(),
  });

  // Categorías únicas del menú
  const categories = useMemo(() => {
    const cats = [...new Set(menuItems.map((i) => i.category ?? 'Sin categoría'))].sort();
    return ['Todos', ...cats];
  }, [menuItems]);

  // Filtro por categoría y búsqueda
  const filtered = useMemo(() => {
    return menuItems
      .filter((i) => i.available)
      .filter((i) => activeCategory === 'Todos' || (i.category ?? 'Sin categoría') === activeCategory)
      .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
  }, [menuItems, activeCategory, search]);

  const mutation = useMutation({
    mutationFn: () =>
      ordersApi.create({
        items: cart,
        table_number: tableNumber.trim(),
        notes: notes.trim() || undefined,
      }),
    onSuccess: (order) => {
      setConfirmedOrderId(order.id);
    },
  });

  const getQty = (id: string) => cart.find((c) => c.menuItemId === id)?.quantity ?? 0;

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const removeFromCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (!existing) return prev;
      if (existing.quantity === 1) return prev.filter((c) => c.menuItemId !== item.id);
      return prev.map((c) =>
        c.menuItemId === item.id ? { ...c, quantity: c.quantity - 1 } : c
      );
    });
  };

  const handleNewOrder = () => {
    setCart([]);
    setTableNumber('');
    setNotes('');
    setSearch('');
    setConfirmedOrderId(null);
    mutation.reset();
  };

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <PageWrapper title="Tomar orden">
      <div className="flex gap-5 h-[calc(100vh-8rem)]">

        {/* ── Panel izquierdo: Menú ── */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">

          {/* Buscador */}
          <Input
            placeholder="Buscar platillo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />

          {/* Filtro por categoría */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                  ${activeCategory === cat
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid de platillos */}
          {isLoading ? (
            <div className="flex items-center justify-center flex-1">
              <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-gray-400">
              <span className="text-4xl mb-2">🔍</span>
              <p className="text-sm">Sin resultados para "{search}"</p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1 -mr-2 pr-2">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pb-2">
                {filtered.map((item) => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    quantity={getQty(item.id)}
                    onAdd={() => addToCart(item)}
                    onRemove={() => removeFromCart(item)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Panel derecho: Carrito ── */}
        <div className="w-72 flex-shrink-0 relative">
          {/* Badge flotante de cantidad */}
          {totalItems > 0 && !confirmedOrderId && (
            <div className="absolute -top-2 -left-2 z-10 bg-orange-500 text-white text-xs
                            font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">
              {totalItems}
            </div>
          )}

          {confirmedOrderId ? (
            <div className="h-full bg-white rounded-2xl border border-gray-100 shadow-sm">
              <OrderConfirmed orderId={confirmedOrderId} onNew={handleNewOrder} />
            </div>
          ) : (
            <Cart
              cart={cart}
              tableNumber={tableNumber}
              notes={notes}
              onTableChange={setTableNumber}
              onNotesChange={setNotes}
              onSubmit={() => mutation.mutate()}
              loading={mutation.isPending}
              onClear={handleNewOrder}
            />
          )}
        </div>
      </div>
    </PageWrapper>
  );
}

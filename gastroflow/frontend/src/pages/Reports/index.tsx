import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { analyticsApi } from '../../api/analytics';
import { apiFetch } from '../../api/client';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  min_quantity: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });

// ─── Generador de PDF ─────────────────────────────────────────────────────────
async function generatePDF(
  endDate: string,
  weeklyData: { date: string; revenue: number; orders: number }[],
  dailyData: {
    totalRevenue: number;
    totalOrders: number;
    avgTicket: number;
    topProducts: { name: string; count: number; revenue: number }[];
    statusBreakdown: Record<string, number>;
  } | undefined,
  inventory: InventoryItem[]
) {
  const { jsPDF } = await import('jspdf');
  const autoTable  = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

  // ── Encabezado ──────────────────────────────────────────────────────────
  doc.setFillColor(249, 115, 22); // orange-500
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('GastroFlow — Reporte de Ventas', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Restaurante: Calico  |  Generado: ${today}  |  Período: últimos 7 días hasta ${endDate}`, 14, 22);

  let y = 36;

  // ── Resumen ejecutivo ────────────────────────────────────────────────────
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen ejecutivo', 14, y);
  y += 6;

  const totalRevenue = weeklyData.reduce((s, d) => s + d.revenue, 0);
  const totalOrders  = weeklyData.reduce((s, d) => s + d.orders, 0);
  const avgTicket    = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  autoTable(doc, {
    startY: y,
    head: [['Indicador', 'Valor']],
    body: [
      ['Ventas totales (7 días)',  fmt(totalRevenue)],
      ['Pedidos totales (7 días)', String(totalOrders)],
      ['Ticket promedio',          fmt(avgTicket)],
      ['Ventas hoy',               fmt(dailyData?.totalRevenue ?? 0)],
      ['Pedidos hoy',              String(dailyData?.totalOrders ?? 0)],
      ['Cancelados hoy',           String(dailyData?.statusBreakdown?.cancelled ?? 0)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [249, 115, 22] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ── Ventas diarias ───────────────────────────────────────────────────────
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Ventas por día', 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Ventas', 'Pedidos', 'Ticket prom.']],
    body: weeklyData.map((d) => [
      fmtDate(d.date),
      fmt(d.revenue),
      String(d.orders),
      d.orders > 0 ? fmt(d.revenue / d.orders) : '$0.00',
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [249, 115, 22] },
    margin: { left: 14, right: 14 },
  });

  y = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ── Top productos ────────────────────────────────────────────────────────
  if (dailyData?.topProducts && dailyData.topProducts.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Productos más vendidos (hoy)', 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Producto', 'Cantidad vendida', 'Ingresos']],
      body: dailyData.topProducts.slice(0, 10).map((p) => [
        p.name,
        String(p.count),
        fmt(p.revenue),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [249, 115, 22] },
      margin: { left: 14, right: 14 },
    });

    y = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ── Estado de órdenes ────────────────────────────────────────────────────
  if (dailyData?.statusBreakdown) {
    if (y > 220) { doc.addPage(); y = 20; }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Flujo de órdenes (hoy)', 14, y);
    y += 6;

    const statusLabels: Record<string, string> = {
      new: 'Nuevas', cooking: 'En cocina', ready: 'Listas',
      delivered: 'Entregadas', cancelled: 'Canceladas',
    };
    const breakdown = dailyData.statusBreakdown;

    autoTable(doc, {
      startY: y,
      head: [['Estado', 'Cantidad', '% del total']],
      body: Object.entries(statusLabels).map(([key, label]) => {
        const count = breakdown[key] ?? 0;
        const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
        return [label, String(count), total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0%'];
      }),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [249, 115, 22] },
      margin: { left: 14, right: 14 },
    });

    y = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ── Inventario ───────────────────────────────────────────────────────────
  if (inventory.length > 0) {
    doc.addPage();
    y = 20;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Estado del inventario', 14, y);
    y += 6;

    const lowStock  = inventory.filter((i) => i.quantity < i.min_quantity);
    const okStock   = inventory.filter((i) => i.quantity >= i.min_quantity);

    if (lowStock.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(200, 30, 30);
      doc.text(`⚠️  ${lowStock.length} insumos con stock bajo`, 14, y);
      doc.setTextColor(30, 30, 30);
      y += 5;

      autoTable(doc, {
        startY: y,
        head: [['Insumo', 'Unidad', 'Stock actual', 'Mínimo', 'Déficit']],
        body: lowStock.map((i) => [
          i.name, i.unit,
          String(i.quantity), String(i.min_quantity),
          String((i.min_quantity - i.quantity).toFixed(2)),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [220, 53, 69] },
        bodyStyles: { textColor: [180, 30, 30] },
        margin: { left: 14, right: 14 },
      });

      y = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    autoTable(doc, {
      startY: y,
      head: [['Insumo', 'Unidad', 'Stock actual', 'Mínimo', 'Estado']],
      body: okStock.map((i) => [
        i.name, i.unit, String(i.quantity), String(i.min_quantity), '✓ OK',
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [249, 115, 22] },
      margin: { left: 14, right: 14 },
    });
  }

  // ── Pie de página en todas las páginas ──────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(`GastroFlow — Reporte confidencial — Página ${i} de ${pages}`, 14, 290);
    doc.text('Generado automáticamente. No requiere firma.', W - 14, 290, { align: 'right' });
  }

  doc.save(`GastroFlow-Reporte-${endDate}.pdf`);
}

// ─── Página de reportes ───────────────────────────────────────────────────────
export function ReportsPage() {
  const [endDate, setEndDate]     = useState(new Date().toISOString().split('T')[0]);
  const [generating, setGenerating] = useState(false);

  const { data: weekly, isLoading: loadingWeekly } = useQuery({
    queryKey: ['weekly-report', endDate],
    queryFn: () => analyticsApi.weekly(endDate),
  });

  const today = new Date().toISOString().split('T')[0];
  const { data: daily } = useQuery({
    queryKey: ['daily-report', today],
    queryFn: () => analyticsApi.daily(today),
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => apiFetch<InventoryItem[]>('/inventory'),
  });

  const totalRevenue = weekly?.dailyData.reduce((s, d) => s + d.revenue, 0) ?? 0;
  const totalOrders  = weekly?.dailyData.reduce((s, d) => s + d.orders, 0) ?? 0;
  const avgTicket    = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const lowStock     = inventory.filter((i) => i.quantity < i.min_quantity).length;

  const handleDownloadPDF = async () => {
    setGenerating(true);
    try {
      await generatePDF(endDate, weekly?.dailyData ?? [], daily, inventory);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <PageWrapper title="Reportes">
      <div className="space-y-5">

        {/* Controles */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Fecha fin:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <Button
            onClick={handleDownloadPDF}
            loading={generating}
            disabled={loadingWeekly}
            variant="primary"
          >
            📄 Descargar reporte PDF
          </Button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Ventas (7 días)',  value: fmt(totalRevenue), icon: '💰' },
            { label: 'Pedidos (7 días)', value: String(totalOrders), icon: '🧾' },
            { label: 'Ticket promedio',  value: fmt(avgTicket), icon: '🎯' },
            { label: 'Stock bajo',       value: String(lowStock), icon: '⚠️',
              alert: lowStock > 0 },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className={`bg-white rounded-xl p-5 shadow-sm border
                ${kpi.alert ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{kpi.icon}</span>
                <p className="text-xs text-gray-500">{kpi.label}</p>
              </div>
              <p className={`text-2xl font-bold mt-2 ${kpi.alert ? 'text-red-600' : 'text-gray-900'}`}>
                {kpi.value}
              </p>
            </div>
          ))}
        </div>

        {/* Gráfica de ventas semanales */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Ventas diarias — últimos 7 días</h2>
          {loadingWeekly ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin w-6 h-6 border-4 border-orange-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weekly?.dailyData ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v: number) => `$${v}`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={fmtDate} />
                <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} name="Ventas" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Gráfica de pedidos por día */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Pedidos por día</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weekly?.dailyData ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={fmtDate} />
              <Bar dataKey="orders" fill="#f97316" radius={[4, 4, 0, 0]} name="Pedidos" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Inventario con stock bajo */}
        {lowStock > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-red-100">
            <h2 className="text-sm font-semibold text-red-700 mb-3">
              ⚠️ Insumos con stock bajo ({lowStock})
            </h2>
            <div className="space-y-2">
              {inventory
                .filter((i) => i.quantity < i.min_quantity)
                .map((item) => (
                  <div key={item.id} className="flex items-center justify-between
                                                bg-red-50 rounded-lg px-4 py-2">
                    <span className="text-sm font-medium text-gray-800">{item.name}</span>
                    <span className="text-sm text-red-600">
                      {item.quantity} / {item.min_quantity} {item.unit}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}

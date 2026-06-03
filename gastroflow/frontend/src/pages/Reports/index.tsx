import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { analyticsApi, RangeReport } from '../../api/analytics';
import { apiFetch } from '../../api/client';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';

interface InventoryItem {
  id: string; name: string; unit: string; quantity: number; min_quantity: number;
}

// ─── Utilidades de fecha ──────────────────────────────────────────────────────
const toISO   = (d: Date) => d.toISOString().split('T')[0];
const today   = () => toISO(new Date());
const daysAgo = (n: number) => toISO(new Date(Date.now() - n * 86_400_000));

const fmtMXN = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });

const diffDays = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1;

// ─── Presets de rango rápido ──────────────────────────────────────────────────
const PRESETS = [
  { label: 'Hoy',         start: () => today(),       end: () => today() },
  { label: '7 días',      start: () => daysAgo(6),    end: () => today() },
  { label: '15 días',     start: () => daysAgo(14),   end: () => today() },
  { label: 'Este mes',
    start: () => toISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    end:   () => today(),
  },
  { label: 'Mes anterior',
    start: () => toISO(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)),
    end:   () => toISO(new Date(new Date().getFullYear(), new Date().getMonth(), 0)),
  },
  { label: '3 meses',     start: () => daysAgo(89),   end: () => today() },
];

// ─── Generador de PDF ─────────────────────────────────────────────────────────
async function generatePDF(report: RangeReport, inventory: InventoryItem[]) {
  const { jsPDF }  = await import('jspdf');
  const autoTable  = (await import('jspdf-autotable')).default;

  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W    = doc.internal.pageSize.getWidth();
  const days = diffDays(report.startDate, report.endDate);
  const now  = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

  type DocWithTable = typeof doc & { lastAutoTable: { finalY: number } };

  // ── Encabezado ───────────────────────────────────────────────────────────
  doc.setFillColor(249, 115, 22);
  doc.rect(0, 0, W, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text('GastroFlow — Reporte de Ventas', 14, 11);
  doc.setFontSize(9);  doc.setFont('helvetica', 'normal');
  doc.text(`Restaurante: Calico  |  Generado: ${now}`, 14, 19);
  doc.text(
    `Período: ${fmtDate(report.startDate)} al ${fmtDate(report.endDate)} (${days} día${days !== 1 ? 's' : ''})`,
    14, 26
  );

  let y = 38;

  // ── Resumen ejecutivo ────────────────────────────────────────────────────
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text('Resumen ejecutivo', 14, y); y += 5;

  autoTable(doc, {
    startY: y,
    head: [['Indicador', 'Valor']],
    body: [
      ['Ventas totales del período',   fmtMXN(report.totalRevenue)],
      ['Pedidos completados',          String(report.totalOrders)],
      ['Pedidos cancelados',           String(report.cancelledOrders)],
      ['Ticket promedio',              fmtMXN(report.avgTicket)],
      ['Promedio de ventas diarias',   fmtMXN(report.totalRevenue / (days || 1))],
      ['Promedio de pedidos diarios',  (report.totalOrders / (days || 1)).toFixed(1)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [249, 115, 22] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 85 } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as DocWithTable).lastAutoTable.finalY + 8;

  // ── Ventas por día ───────────────────────────────────────────────────────
  if (y > 220) { doc.addPage(); y = 20; }
  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text('Ventas por día', 14, y); y += 5;

  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Ventas', 'Pedidos', 'Ticket promedio']],
    body: report.dailyData.map((d) => [
      fmtDate(d.date),
      fmtMXN(d.revenue),
      String(d.orders),
      d.orders > 0 ? fmtMXN(d.revenue / d.orders) : '$0.00',
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [249, 115, 22] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as DocWithTable).lastAutoTable.finalY + 8;

  // ── Top productos ────────────────────────────────────────────────────────
  if (report.topProducts.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('Productos más vendidos del período', 14, y); y += 5;

    autoTable(doc, {
      startY: y,
      head: [['#', 'Producto', 'Unidades vendidas', 'Ingresos']],
      body: report.topProducts.map((p, i) => [
        String(i + 1), p.name, String(p.count), fmtMXN(p.revenue),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [249, 115, 22] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as DocWithTable).lastAutoTable.finalY + 8;
  }

  // ── Flujo de órdenes ─────────────────────────────────────────────────────
  if (y > 220) { doc.addPage(); y = 20; }
  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text('Flujo de órdenes del período', 14, y); y += 5;

  const statusLabels: Record<string, string> = {
    new: 'Nuevas', cooking: 'En cocina', ready: 'Listas',
    delivered: 'Entregadas', cancelled: 'Canceladas',
  };
  const totalAll = Object.values(report.statusBreakdown).reduce((a, b) => a + b, 0);

  autoTable(doc, {
    startY: y,
    head: [['Estado', 'Cantidad', '% del total']],
    body: Object.entries(statusLabels).map(([key, label]) => {
      const count = report.statusBreakdown[key] ?? 0;
      return [label, String(count), totalAll > 0 ? `${((count / totalAll) * 100).toFixed(1)}%` : '0%'];
    }),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [249, 115, 22] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as DocWithTable).lastAutoTable.finalY + 8;

  // ── Inventario ───────────────────────────────────────────────────────────
  if (inventory.length > 0) {
    doc.addPage(); y = 20;
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('Estado del inventario al cierre del período', 14, y); y += 5;

    const low = inventory.filter((i) => i.quantity < i.min_quantity);
    const ok  = inventory.filter((i) => i.quantity >= i.min_quantity);

    if (low.length > 0) {
      doc.setFontSize(10); doc.setTextColor(200, 30, 30);
      doc.text(`⚠  ${low.length} insumos con stock bajo`, 14, y);
      doc.setTextColor(30, 30, 30); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Insumo', 'Unidad', 'Actual', 'Mínimo', 'Déficit']],
        body: low.map((i) => [
          i.name, i.unit, String(i.quantity), String(i.min_quantity),
          String((i.min_quantity - i.quantity).toFixed(2)),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [220, 53, 69] },
        bodyStyles: { textColor: [180, 30, 30] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as DocWithTable).lastAutoTable.finalY + 8;
    }

    autoTable(doc, {
      startY: y,
      head: [['Insumo', 'Unidad', 'Actual', 'Mínimo', 'Estado']],
      body: ok.map((i) => [i.name, i.unit, String(i.quantity), String(i.min_quantity), '✓ OK']),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [249, 115, 22] },
      margin: { left: 14, right: 14 },
    });
  }

  // ── Pie de página ────────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(160, 160, 160);
    doc.text(`GastroFlow — Reporte ${report.startDate} al ${report.endDate} — Pág. ${i}/${pages}`, 14, 290);
    doc.text('Generado automáticamente', W - 14, 290, { align: 'right' });
  }

  doc.save(`GastroFlow-${report.startDate}_${report.endDate}.pdf`);
}

// ─── Página de reportes ───────────────────────────────────────────────────────
export function ReportsPage() {
  const [startDate, setStartDate] = useState(daysAgo(6));
  const [endDate,   setEndDate]   = useState(today());
  const [activePreset, setActivePreset] = useState('7 días');
  const [generating, setGenerating]     = useState(false);

  const { data: report, isLoading, isFetching } = useQuery<RangeReport>({
    queryKey: ['range-report', startDate, endDate],
    queryFn: () => analyticsApi.range(startDate, endDate),
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => apiFetch<InventoryItem[]>('/inventory'),
  });

  const lowStock = inventory.filter((i) => i.quantity < i.min_quantity).length;
  const days     = diffDays(startDate, endDate);

  const applyPreset = (p: typeof PRESETS[0]) => {
    const s = p.start();
    const e = p.end();
    setStartDate(s);
    setEndDate(e);
    setActivePreset(p.label);
  };

  const handleDateChange = (field: 'start' | 'end', val: string) => {
    if (field === 'start') { setStartDate(val); setActivePreset(''); }
    else                   { setEndDate(val);   setActivePreset(''); }
  };

  const handlePDF = async () => {
    if (!report) return;
    setGenerating(true);
    try { await generatePDF(report, inventory); }
    finally { setGenerating(false); }
  };

  const loading = isLoading || isFetching;

  return (
    <PageWrapper title="Reportes">
      <div className="space-y-5">

        {/* ── Selector de rango ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Seleccionar período</h2>

          {/* Presets rápidos */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                  ${activePreset === p.label
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Rango personalizado */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Desde</label>
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => handleDateChange('start', e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm
                           focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
              />
            </div>
            <span className="text-gray-400 mt-5">→</span>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Hasta</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={today()}
                onChange={(e) => handleDateChange('end', e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm
                           focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
              />
            </div>
            <div className="mt-5 flex items-center gap-2">
              {loading && (
                <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              )}
              <span className="text-sm text-gray-400">
                {days} día{days !== 1 ? 's' : ''} seleccionado{days !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="mt-5 ml-auto">
              <Button
                onClick={handlePDF}
                loading={generating}
                disabled={!report || loading}
              >
                📄 Descargar PDF
              </Button>
            </div>
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Ventas del período',  value: fmtMXN(report?.totalRevenue ?? 0),   icon: '💰' },
            { label: 'Pedidos completados', value: String(report?.totalOrders ?? 0),     icon: '🧾' },
            { label: 'Ticket promedio',     value: fmtMXN(report?.avgTicket ?? 0),       icon: '🎯' },
            { label: 'Stock bajo',          value: String(lowStock), icon: '⚠️', alert: lowStock > 0 },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className={`bg-white rounded-xl p-5 shadow-sm border transition-all
                ${kpi.alert ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{kpi.icon}</span>
                <p className="text-xs text-gray-500">{kpi.label}</p>
              </div>
              {loading ? (
                <div className="h-8 bg-gray-100 rounded mt-2 animate-pulse" />
              ) : (
                <p className={`text-2xl font-bold mt-2 ${kpi.alert ? 'text-red-600' : 'text-gray-900'}`}>
                  {kpi.value}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* ── Gráfica de ventas ── */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              Ventas diarias — {fmtDate(startDate)} al {fmtDate(endDate)}
            </h2>
            {loading && <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />}
          </div>
          {report?.dailyData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <span className="text-4xl mb-2">📭</span>
              <p className="text-sm">Sin ventas en este período</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={report?.dailyData ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v: number) => `$${v}`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmtMXN(v)} labelFormatter={fmtDate} />
                <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2}
                  dot={days <= 31 ? { r: 4 } : false} name="Ventas" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Gráfica de pedidos por día ── */}
        {(report?.dailyData.length ?? 0) > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Pedidos por día</h2>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={report?.dailyData ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={fmtDate} />
                <Bar dataKey="orders" fill="#f97316" radius={[4, 4, 0, 0]} name="Pedidos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Top productos ── */}
        {(report?.topProducts.length ?? 0) > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Top productos del período</h2>
            <div className="space-y-2">
              {report!.topProducts.slice(0, 8).map((p, i) => {
                const maxCount = report!.topProducts[0].count;
                return (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm text-gray-700 truncate">{p.name}</span>
                        <span className="text-sm font-medium text-gray-800 ml-2 whitespace-nowrap">
                          {fmtMXN(p.revenue)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-400 rounded-full"
                            style={{ width: `${(p.count / maxCount) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">{p.count} uds.</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Stock bajo ── */}
        {lowStock > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-red-100">
            <h2 className="text-sm font-semibold text-red-700 mb-3">
              ⚠️ Insumos con stock bajo ({lowStock})
            </h2>
            <div className="space-y-2">
              {inventory.filter((i) => i.quantity < i.min_quantity).map((item) => (
                <div key={item.id}
                  className="flex items-center justify-between bg-red-50 rounded-lg px-4 py-2">
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

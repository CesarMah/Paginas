import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { analyticsApi, DailyReport } from '../../api/analytics';
import { ordersApi } from '../../api/orders';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Badge } from '../../components/ui/Badge';

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export function DashboardPage() {
  const today = new Date().toISOString().split('T')[0];

  const { data: report, isLoading } = useQuery<DailyReport>({
    queryKey: ['daily-report', today],
    queryFn: () => analyticsApi.daily(today),
  });

  const { data: recentOrders } = useQuery({
    queryKey: ['orders-recent'],
    queryFn: () => ordersApi.list({ limit: 10 }),
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

  return (
    <PageWrapper title="Dashboard">
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Ventas hoy" value={fmt(report?.totalRevenue ?? 0)} />
            <KpiCard label="Pedidos hoy" value={String(report?.totalOrders ?? 0)} />
            <KpiCard label="Ticket promedio" value={fmt(report?.avgTicket ?? 0)} />
            <KpiCard
              label="Cancelados"
              value={String(report?.statusBreakdown?.cancelled ?? 0)}
            />
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Ventas por hora</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={report?.hourlyRevenue ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tickFormatter={(h: number) => `${h}h`} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v: number) => `$${v}`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={(l: number) => `${l}:00 hrs`} />
                <Bar dataKey="revenue" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Órdenes recientes</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">ID</th>
                  <th className="px-5 py-3 text-left">Mesa</th>
                  <th className="px-5 py-3 text-left">Total</th>
                  <th className="px-5 py-3 text-left">Estado</th>
                  <th className="px-5 py-3 text-left">Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentOrders?.orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-xs">{order.id.slice(0, 8)}</td>
                    <td className="px-5 py-3">{order.table_number ?? '—'}</td>
                    <td className="px-5 py-3">{fmt(order.total)}</td>
                    <td className="px-5 py-3"><Badge status={order.status} /></td>
                    <td className="px-5 py-3 text-gray-400">
                      {new Date(order.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}

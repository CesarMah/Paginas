import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { analyticsApi } from '../../api/analytics';
import { PageWrapper } from '../../components/layout/PageWrapper';

export function ReportsPage() {
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: weekly, isLoading } = useQuery({
    queryKey: ['weekly-report', endDate],
    queryFn: () => analyticsApi.weekly(endDate),
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

  const totalRevenue = weekly?.dailyData.reduce((s, d) => s + d.revenue, 0) ?? 0;
  const totalOrders = weekly?.dailyData.reduce((s, d) => s + d.orders, 0) ?? 0;

  return (
    <PageWrapper title="Reportes">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Fecha fin:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Ventas (últimos 7 días)</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(totalRevenue)}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Pedidos (últimos 7 días)</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalOrders}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Ventas diarias</h2>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin w-6 h-6 border-4 border-orange-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={weekly?.dailyData ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v: number) => `$${v}`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}

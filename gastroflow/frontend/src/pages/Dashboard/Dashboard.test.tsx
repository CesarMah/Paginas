import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './index';

// Mock hooks that require network/WS
vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: () => ({ connectionStatus: 'connected' }),
}));

vi.mock('../../hooks/useAuth', () => ({
  signOut: vi.fn(),
}));

const mockReport = {
  date: '2026-06-02',
  totalRevenue: 5400,
  totalOrders: 48,
  avgTicket: 112.5,
  topProducts: [],
  hourlyRevenue: [
    { hour: 12, revenue: 1200 },
    { hour: 13, revenue: 1800 },
  ],
  statusBreakdown: { new: 5, cooking: 3, ready: 2, delivered: 35, cancelled: 3 },
};

function wrapper(children: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DashboardPage', () => {
  it('muestra estado de carga mientras la query está pendiente', () => {
    vi.mock('../../api/analytics', () => ({
      analyticsApi: { daily: () => new Promise(() => {}) },
    }));
    vi.mock('../../api/orders', () => ({
      ordersApi: { list: () => new Promise(() => {}) },
    }));

    render(wrapper(<DashboardPage />));
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renderiza las 4 KPI cards con datos mockeados', async () => {
    vi.mock('../../api/analytics', () => ({
      analyticsApi: { daily: () => Promise.resolve(mockReport) },
    }));
    vi.mock('../../api/orders', () => ({
      ordersApi: { list: () => Promise.resolve({ orders: [], nextCursor: null, total: 0 }) },
    }));

    const { findByText } = render(wrapper(<DashboardPage />));

    expect(await findByText('Ventas hoy')).toBeTruthy();
    expect(await findByText('Pedidos hoy')).toBeTruthy();
    expect(await findByText('Ticket promedio')).toBeTruthy();
    expect(await findByText('Cancelados')).toBeTruthy();
  });
});

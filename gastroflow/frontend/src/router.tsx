import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './stores/useAuthStore';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { OrdersPage } from './pages/Orders';
import { KitchenPage } from './pages/Kitchen';
import { MenuPage } from './pages/Menu';
import { InventoryPage } from './pages/Inventory';
import { ReportsPage } from './pages/Reports';
import { WaiterPage } from './pages/Waiter';

function defaultRoute(role: string): string {
  if (role === 'staff') return '/waiter';
  return '/dashboard';
}

function RequireAuth({ children, roles }: { children: JSX.Element; roles: string[] }) {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role) ?? '';

  if (!token) return <Navigate to="/login" replace />;
  if (!roles.includes(role)) return <Navigate to={defaultRoute(role)} replace />;
  return children;
}

export function AppRouter() {
  const token = useAuthStore((s) => s.token);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth roles={['owner', 'manager']}>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/orders"
        element={
          <RequireAuth roles={['owner', 'manager']}>
            <OrdersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/waiter"
        element={
          <RequireAuth roles={['owner', 'manager', 'staff']}>
            <WaiterPage />
          </RequireAuth>
        }
      />
      <Route
        path="/kitchen"
        element={
          <RequireAuth roles={['owner', 'manager', 'staff']}>
            <KitchenPage />
          </RequireAuth>
        }
      />
      <Route
        path="/menu"
        element={
          <RequireAuth roles={['owner', 'manager']}>
            <MenuPage />
          </RequireAuth>
        }
      />
      <Route
        path="/inventory"
        element={
          <RequireAuth roles={['owner', 'manager']}>
            <InventoryPage />
          </RequireAuth>
        }
      />
      <Route
        path="/reports"
        element={
          <RequireAuth roles={['owner', 'manager']}>
            <ReportsPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to={token ? defaultRoute(useAuthStore.getState().role ?? '') : '/login'} replace />} />
    </Routes>
  );
}

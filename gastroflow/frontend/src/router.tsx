import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './stores/useAuthStore';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { OrdersPage } from './pages/Orders';
import { KitchenPage } from './pages/Kitchen';
import { MenuPage } from './pages/Menu';
import { InventoryPage } from './pages/Inventory';
import { ReportsPage } from './pages/Reports';

function RequireAuth({ children, roles }: { children: JSX.Element; roles: string[] }) {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role) ?? '';

  if (!token) return <Navigate to="/login" replace />;
  if (!roles.includes(role)) return <Navigate to="/dashboard" replace />;
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
      <Route path="*" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}

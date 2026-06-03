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

// ─── Permisos por rol ───────────────────────────────────────────────────────
//
//  owner / manager  →  Todas las páginas
//  staff            →  /waiter + /orders + /kitchen
//                      (meseros y personal de cocina comparten rol staff)
//
// ───────────────────────────────────────────────────────────────────────────

const ROLES_FULL   = ['owner', 'manager'];
const ROLES_STAFF  = ['owner', 'manager', 'staff'];

function defaultRoute(role: string): string {
  return role === 'staff' ? '/waiter' : '/dashboard';
}

function RequireAuth({ children, roles }: { children: JSX.Element; roles: string[] }) {
  const token = useAuthStore((s) => s.token);
  const role  = useAuthStore((s) => s.role) ?? '';

  if (!token) return <Navigate to="/login" replace />;
  if (!roles.includes(role)) return <Navigate to={defaultRoute(role)} replace />;
  return children;
}

export function AppRouter() {
  const token = useAuthStore((s) => s.token);
  const role  = useAuthStore((s) => s.role) ?? '';

  return (
    <Routes>
      {/* ── Público ── */}
      <Route path="/login" element={<LoginPage />} />

      {/* ── Solo owner / manager ── */}
      <Route path="/dashboard" element={<RequireAuth roles={ROLES_FULL}><DashboardPage /></RequireAuth>} />
      <Route path="/kitchen"   element={<RequireAuth roles={ROLES_STAFF}><KitchenPage /></RequireAuth>} />
      <Route path="/menu"      element={<RequireAuth roles={ROLES_FULL}><MenuPage /></RequireAuth>} />
      <Route path="/inventory" element={<RequireAuth roles={ROLES_FULL}><InventoryPage /></RequireAuth>} />
      <Route path="/reports"   element={<RequireAuth roles={ROLES_FULL}><ReportsPage /></RequireAuth>} />

      {/* ── Todos los roles autenticados ── */}
      <Route path="/waiter"    element={<RequireAuth roles={ROLES_STAFF}><WaiterPage /></RequireAuth>} />
      <Route path="/orders"    element={<RequireAuth roles={ROLES_STAFF}><OrdersPage /></RequireAuth>} />

      {/* ── Catch-all ── */}
      <Route
        path="*"
        element={<Navigate to={token ? defaultRoute(role) : '/login'} replace />}
      />
    </Routes>
  );
}

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
//  staff  (mesero)  →  /waiter + /orders
//  kitchen (cocina) →  /kitchen + /orders
//
// ───────────────────────────────────────────────────────────────────────────

const ROLES_FULL    = ['owner', 'manager'];
const ROLES_WAITER  = ['owner', 'manager', 'staff'];
const ROLES_KITCHEN = ['owner', 'manager', 'kitchen'];
const ROLES_ORDERS  = ['owner', 'manager', 'staff', 'kitchen'];

/** Página de inicio según rol después del login */
export function homeForRole(role: string | null): string {
  if (role === 'staff')   return '/waiter';
  if (role === 'kitchen') return '/kitchen';
  return '/dashboard';
}

function RequireAuth({ children, roles }: { children: JSX.Element; roles: string[] }) {
  const token = useAuthStore((s) => s.token);
  const role  = useAuthStore((s) => s.role) ?? '';

  if (!token) return <Navigate to="/login" replace />;
  if (!roles.includes(role)) return <Navigate to={homeForRole(role)} replace />;
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
      <Route path="/menu"      element={<RequireAuth roles={ROLES_FULL}><MenuPage /></RequireAuth>} />
      <Route path="/inventory" element={<RequireAuth roles={ROLES_FULL}><InventoryPage /></RequireAuth>} />
      <Route path="/reports"   element={<RequireAuth roles={ROLES_FULL}><ReportsPage /></RequireAuth>} />

      {/* ── Mesero (staff) ── */}
      <Route path="/waiter"    element={<RequireAuth roles={ROLES_WAITER}><WaiterPage /></RequireAuth>} />

      {/* ── Cocina (kitchen) ── */}
      <Route path="/kitchen"   element={<RequireAuth roles={ROLES_KITCHEN}><KitchenPage /></RequireAuth>} />

      {/* ── Órdenes: todos los roles operativos ── */}
      <Route path="/orders"    element={<RequireAuth roles={ROLES_ORDERS}><OrdersPage /></RequireAuth>} />

      {/* ── Catch-all ── */}
      <Route
        path="*"
        element={<Navigate to={token ? homeForRole(role) : '/login'} replace />}
      />
    </Routes>
  );
}

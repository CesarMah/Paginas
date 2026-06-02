import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { signOut } from '../../hooks/useAuth';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles: string[];
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard',    icon: '📊', roles: ['owner', 'manager'] },
  { to: '/waiter',    label: 'Tomar orden',  icon: '📝', roles: ['owner', 'manager', 'staff'] },
  { to: '/orders',    label: 'Órdenes',      icon: '🧾', roles: ['owner', 'manager'] },
  { to: '/kitchen',   label: 'Cocina',       icon: '👨‍🍳', roles: ['owner', 'manager', 'staff'] },
  { to: '/menu', label: 'Menú', icon: '🍽️', roles: ['owner', 'manager'] },
  { to: '/inventory', label: 'Inventario', icon: '📦', roles: ['owner', 'manager'] },
  { to: '/reports', label: 'Reportes', icon: '📈', roles: ['owner', 'manager'] },
];

export function Sidebar() {
  const role = useAuthStore((s) => s.role) ?? '';

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col min-h-screen">
      <div className="px-4 py-5 border-b border-gray-700">
        <span className="text-xl font-bold text-orange-400">GastroFlow</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems
          .filter((item) => item.roles.includes(role))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                ${isActive ? 'bg-orange-500 text-white' : 'text-gray-300 hover:bg-gray-800'}`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
      </nav>
      <div className="p-3 border-t border-gray-700">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 transition-colors"
        >
          <span>🚪</span> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

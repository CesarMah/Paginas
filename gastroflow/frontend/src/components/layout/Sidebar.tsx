import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLayoutStore } from '../../stores/useLayoutStore';
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
  { to: '/kitchen',   label: 'Cocina',       icon: '👨‍🍳', roles: ['owner', 'manager', 'kitchen'] },
  { to: '/orders',    label: 'Órdenes',      icon: '🧾', roles: ['owner', 'manager', 'staff', 'kitchen'] },
  { to: '/menu',      label: 'Menú',         icon: '🍽️', roles: ['owner', 'manager'] },
  { to: '/inventory', label: 'Inventario',   icon: '📦', roles: ['owner', 'manager'] },
  { to: '/reports',   label: 'Reportes',     icon: '📈', roles: ['owner', 'manager'] },
];

export function Sidebar() {
  const role        = useAuthStore((s) => s.role) ?? '';
  const sidebarOpen = useLayoutStore((s) => s.sidebarOpen);

  const visible = navItems.filter((item) => item.roles.includes(role));

  return (
    <>
      {/* Overlay en móvil cuando el sidebar está abierto */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => useLayoutStore.getState().closeSidebar()}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full z-30 bg-gray-900 text-white flex flex-col
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-56' : 'w-0 lg:w-16'}
          overflow-hidden
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-700 min-h-[64px]">
          <span className="text-xl flex-shrink-0">🍴</span>
          {sidebarOpen && (
            <span className="text-lg font-bold text-orange-400 whitespace-nowrap">
              GastroFlow
            </span>
          )}
        </div>

        {/* Navegación */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden">
          {visible.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={!sidebarOpen ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                 ${isActive
                   ? 'bg-orange-500 text-white'
                   : 'text-gray-300 hover:bg-gray-800'
                 }`
              }
            >
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              {sidebarOpen && (
                <span className="whitespace-nowrap">{item.label}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Cerrar sesión */}
        <div className="p-2 border-t border-gray-700">
          <button
            onClick={signOut}
            title={!sidebarOpen ? 'Cerrar sesión' : undefined}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                       text-gray-300 hover:bg-gray-800 transition-colors"
          >
            <span className="text-lg flex-shrink-0">🚪</span>
            {sidebarOpen && <span className="whitespace-nowrap">Cerrar sesión</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

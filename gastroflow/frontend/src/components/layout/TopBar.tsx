import { useWebSocket } from '../../hooks/useWebSocket';
import { useLayoutStore } from '../../stores/useLayoutStore';

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  const { connectionStatus } = useWebSocket();
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);
  const sidebarOpen   = useLayoutStore((s) => s.sidebarOpen);

  const statusColor =
    connectionStatus === 'connected'    ? 'bg-green-400' :
    connectionStatus === 'connecting'   ? 'bg-yellow-400 animate-pulse' :
                                          'bg-red-400';

  const statusLabel =
    connectionStatus === 'connected'    ? 'Tiempo real activo' :
    connectionStatus === 'connecting'   ? 'Conectando...' :
                                          'Sin conexión';

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
      {/* Botón hamburguesa */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
          className="w-9 h-9 flex flex-col items-center justify-center gap-1.5
                     rounded-lg hover:bg-gray-100 transition-colors group"
        >
          <span className={`block w-5 h-0.5 bg-gray-600 transition-all duration-300
            ${sidebarOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-5 h-0.5 bg-gray-600 transition-all duration-300
            ${sidebarOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 bg-gray-600 transition-all duration-300
            ${sidebarOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
        <h1 className="text-base font-semibold text-gray-800">{title}</h1>
      </div>

      {/* Estado WebSocket */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className={`w-2 h-2 rounded-full ${statusColor}`} />
        <span className="hidden sm:inline">{statusLabel}</span>
      </div>
    </header>
  );
}

import { useWebSocket } from '../../hooks/useWebSocket';

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  const { connectionStatus } = useWebSocket();

  const statusColor =
    connectionStatus === 'connected'
      ? 'bg-green-400'
      : connectionStatus === 'connecting'
      ? 'bg-yellow-400 animate-pulse'
      : 'bg-red-400';

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className={`w-2 h-2 rounded-full ${statusColor}`} />
        {connectionStatus === 'connected' ? 'Tiempo real activo' : connectionStatus === 'connecting' ? 'Conectando...' : 'Sin conexión'}
      </div>
    </header>
  );
}

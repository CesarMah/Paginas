import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useLayoutStore } from '../../stores/useLayoutStore';

interface PageWrapperProps {
  title: string;
  children: ReactNode;
}

export function PageWrapper({ title, children }: PageWrapperProps) {
  const sidebarOpen = useLayoutStore((s) => s.sidebarOpen);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      {/* Contenido principal — se desplaza según el ancho del sidebar */}
      <div
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-300
          ${sidebarOpen ? 'lg:ml-56' : 'lg:ml-16'} ml-0`}
      >
        <TopBar title={title} />
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

type BadgeVariant = 'new' | 'cooking' | 'ready' | 'delivered' | 'cancelled' | 'default';

const styles: Record<BadgeVariant, string> = {
  new: 'bg-blue-100 text-blue-800',
  cooking: 'bg-yellow-100 text-yellow-800',
  ready: 'bg-green-100 text-green-800',
  delivered: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
  default: 'bg-gray-100 text-gray-700',
};

const labels: Record<string, string> = {
  new: 'Nuevo',
  cooking: 'En cocina',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

interface BadgeProps {
  status: string;
}

export function Badge({ status }: BadgeProps) {
  const variant = (status in styles ? status : 'default') as BadgeVariant;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${styles[variant]}`}>
      {labels[status] ?? status}
    </span>
  );
}

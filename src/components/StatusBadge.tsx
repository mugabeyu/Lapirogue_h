interface StatusBadgeProps {
  status: string;
}

const statusStyles: Record<string, string> = {
  AVAILABLE: 'bg-success/10 text-success',
  OCCUPIED: 'bg-primary/10 text-primary',
  CLEANING: 'bg-warning/10 text-warning',
  MAINTENANCE: 'bg-danger/10 text-danger',
  CHECKED_IN: 'bg-success/10 text-success',
  CHECKED_OUT: 'bg-sand-100 text-ink-600',
  RESERVED: 'bg-primary/10 text-primary',
  CONFIRMED: 'bg-success/10 text-success',
  CANCELLED: 'bg-danger/10 text-danger',
  PENDING: 'bg-warning/10 text-warning',
  PARTIALLY_PAID: 'bg-warning/10 text-warning',
  PAID: 'bg-success/10 text-success',
  REFUNDED: 'bg-sand-100 text-ink-600',
  COMPLETED: 'bg-success/10 text-success',
  ACTIVE: 'bg-success/10 text-success',
  INACTIVE: 'bg-sand-100 text-ink-600',
  FULL: 'bg-warning/10 text-warning',
  READ: 'bg-sand-100 text-ink-600',
  UNREAD: 'bg-primary/10 text-primary',
  UNAVAILABLE: 'bg-danger/10 text-danger',
  DEFAULT: 'bg-sand-100 text-ink-600',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = statusStyles[status] || statusStyles.DEFAULT;
  
  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${style}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

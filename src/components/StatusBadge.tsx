interface StatusBadgeProps {
  status: string;
}

const statusStyles: Record<string, string> = {
  AVAILABLE: 'bg-success/10 text-success',
  OCCUPIED: 'bg-button-primary/10 text-button-primary',
  CLEANING: 'bg-warning/10 text-warning',
  MAINTENANCE: 'bg-danger/10 text-danger',
  CHECKED_IN: 'bg-success/10 text-success',
  CHECKED_OUT: 'bg-surface-secondary text-[var(--color-text-secondary)]',
  RESERVED: 'bg-button-primary/10 text-button-primary',
  CONFIRMED: 'bg-success/10 text-success',
  CANCELLED: 'bg-danger/10 text-danger',
  PENDING: 'bg-warning/10 text-warning',
  PARTIALLY_PAID: 'bg-warning/10 text-warning',
  PAID: 'bg-success/10 text-success',
  REFUNDED: 'bg-surface-secondary text-[var(--color-text-secondary)]',
  COMPLETED: 'bg-success/10 text-success',
  ACTIVE: 'bg-success/10 text-success',
  INACTIVE: 'bg-surface-secondary text-[var(--color-text-secondary)]',
  FULL: 'bg-warning/10 text-warning',
  READ: 'bg-surface-secondary text-[var(--color-text-secondary)]',
  UNREAD: 'bg-button-primary/10 text-button-primary',
  UNAVAILABLE: 'bg-danger/10 text-danger',
  DEFAULT: 'bg-surface-secondary text-[var(--color-text-secondary)]',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = statusStyles[status] || statusStyles.DEFAULT;
  
  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-xl ${style}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

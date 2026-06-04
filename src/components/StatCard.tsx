import { ArrowUp, ArrowDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  trend?: number;
  trendLabel?: string;
  subtext?: string;
  variant?: 'default' | 'primary';
  isSecondary?: boolean;
  isEmpty?: boolean;
  emptyStateAction?: React.ReactNode;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  trend,
  trendLabel,
  subtext,
  variant = 'default',
  isSecondary = false,
  isEmpty = false,
  emptyStateAction,
  onClick,
}: StatCardProps) {
  const isPositive = typeof trend === 'number' && trend > 0;
  const isNegative = typeof trend === 'number' && trend < 0;

  const base = `rounded-2xl p-6 transition-transform duration-200 bg-surface border border-border`;
  const interactive = onClick ? 'cursor-pointer hover:-translate-y-1' : '';

  if (isEmpty) {
    return (
      <div className={`${base} ${interactive} text-center`} onClick={onClick}>
        <div className="flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-[var(--color-text-secondary)]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="text-[var(--color-text-secondary)] mb-3">No data available</div>
        {emptyStateAction && <div className="justify-center">{emptyStateAction}</div>}
      </div>
    );
  }

  return (
    <div className={`${base} ${interactive}`} onClick={onClick}>
      <div className="text-sm text-[var(--color-text-secondary)]">{label}</div>
      <div className="mt-2 mb-1 font-display text-2xl text-[var(--color-text-primary)]">{value}</div>

      {trend !== undefined && (
        <div className="mt-1 flex items-center gap-2 text-sm font-medium">
          <span className={`${isPositive ? 'text-[var(--color-success)]' : isNegative ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'}`}>
            {isPositive ? <ArrowUp className="inline-block h-4 w-4" /> : isNegative ? <ArrowDown className="inline-block h-4 w-4" /> : null}
          </span>
          <span className={`${isPositive ? 'text-[var(--color-success)]' : isNegative ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'}`}>
            {isPositive ? '+' : ''}{trend}%
          </span>
          <span className="text-[var(--color-text-secondary)]">{trendLabel ?? 'vs last week'}</span>
        </div>
      )}

      {subtext && <div className="mt-3 text-xs text-[var(--color-text-secondary)]">{subtext}</div>}
    </div>
  );
}
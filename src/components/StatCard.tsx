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
  onClick 
}: StatCardProps) {
  const isPositive = trend && trend > 0;
  const isNegative = trend && trend < 0;

  // Determine base classes
  const baseClasses = `
    rounded-xl
    ${isSecondary ? 'border-t border-sand-200 pt-4' : 'border border-sand-200'}
    ${isSecondary ? 'bg-transparent' : 'bg-white'}
    ${variant === 'primary' && !isSecondary ? 'bg-primary/90' : ''}
    ${onClick ? 'hover:bg-gray-50 cursor-pointer' : ''}
  `;

  // Determine text colors based on variant and state
  const getTextColors = () => {
    if (isEmpty) {
      return {
        label: 'text-ink-400',
        value: 'text-ink-500',
        trend: 'text-ink-400',
        subtext: 'text-ink-400'
      };
    }
    if (variant === 'primary') {
      return {
        label: 'text-sand-300',
        value: 'text-sand-50',
        trend: isPositive ? 'text-success/80' : isNegative ? 'text-danger/80' : 'text-sand-300',
        subtext: 'text-sand-300'
      };
    }
    return {
      label: 'text-ink-600',
      value: 'text-ink-900',
      trend: isPositive ? 'text-success' : isNegative ? 'text-danger' : 'text-ink-400',
      subtext: 'text-ink-400'
    };
  };

  const colors = getTextColors();

  if (isEmpty) {
    return (
      <div 
        className={`${baseClasses} p-6 text-center`}
        onClick={onClick}
      >
        <div className="flex items-center justify-center mb-4">
          {/* Using AlertCircle from lucide-react for empty state icon */}
          <span className="h-6 w-6 text-ink-400 mr-3">
            {/* We'll render a simple circle icon for now - in practice import from lucide-react */}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
        </div>
        <div className="text-ink-500 mb-3">No data available</div>
        {emptyStateAction && (
          <div className="justify-center">
            {emptyStateAction}
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`${baseClasses} p-6 transition-all duration-200`}
      onClick={onClick}
    >
      <div className="mb-2">{label}</div>
      <div className="mb-2 font-display text-2xl">{value}</div>
      {trend !== undefined && (
        <div className={`mb-2 text-sm font-medium ${colors.trend}`}>
          {isPositive ? '+' : ''}
          {trend}% {trendLabel ?? 'from last week'}
        </div>
      )}
      {subtext && <div className="text-xs">{subtext}</div>}
    </div>
  );
}
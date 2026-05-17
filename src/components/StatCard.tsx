interface StatCardProps {
  label: string;
  value: string;
  trend?: number;
  trendLabel?: string;
  subtext?: string;
}

export function StatCard({ label, value, trend, trendLabel, subtext }: StatCardProps) {
  const isPositive = trend && trend > 0;
  const isNegative = trend && trend < 0;

  return (
    <div className="card p-5">
      <div className="text-sm text-ink-600 mb-2">{label}</div>
      <div className="font-display text-2xl text-ink-900 mb-2">{value}</div>
      {trend !== undefined && (
        <div className={`text-sm font-medium ${isPositive ? 'text-success' : isNegative ? 'text-danger' : 'text-ink-400'}`}>
          {isPositive ? '+' : ''}
          {trend}% {trendLabel ?? 'from last month'}
        </div>
      )}
      {subtext && <div className="text-xs text-ink-400 mt-1">{subtext}</div>}
    </div>
  );
}

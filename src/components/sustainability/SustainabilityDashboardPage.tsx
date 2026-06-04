'use client';

import useSWR from 'swr';
import { ArrowDown, ArrowUp, Award, Leaf, TrendingUp } from 'lucide-react';
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/PageHeader';

type SustainabilityResponse = {
  success: boolean;
  data: {
    summary: {
      totalEcoPoints: number;
      totalEcoPointsTrend: number | null;
      activeParticipants: number;
      activeParticipantsTrend: number | null;
      carbonOffsetKg: number;
      carbonOffsetTrend: number | null;
    };
    leaderboard: Array<{
      rank: number;
      guestId: string;
      name: string;
      initials: string;
      tier: string;
      points: number;
    }>;
    activityDistribution: Array<{ name: string; color: string; points: number }>;
    monthlyTrend: Array<{ month: string; points: number }>;
  };
};

async function fetchSustainability(url: string) {
  const response = await fetch(url);
  return response.json() as Promise<SustainabilityResponse>;
}

function TrendBadge({ value }: { value: number | null }) {
  if (value === null || value === 0) return null;
  const positive = value > 0;
  const Icon = positive ? ArrowUp : ArrowDown;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
      <Icon className="h-3 w-3" strokeWidth={2} />
      {Math.abs(Math.round(value))}%
    </span>
  );
}

function formatPoints(value: number) {
  return value.toLocaleString('en-US');
}

export default function SustainabilityDashboardPage() {
  const { data, isLoading } = useSWR('/api/sustainability', fetchSustainability);
  const payload = data?.data;
  const summary = payload?.summary;
  const leaderboard = payload?.leaderboard ?? [];
  const activityDistribution = payload?.activityDistribution ?? [];
  const monthlyTrend = payload?.monthlyTrend ?? [];

  const statCards: Array<{
    label: string;
    value: string;
    unit?: string;
    trend: number | null;
    icon: typeof Leaf;
  }> = [
    {
      label: 'Total Eco-Points Issued',
      value: summary ? formatPoints(summary.totalEcoPoints) : '—',
      trend: summary?.totalEcoPointsTrend ?? null,
      icon: Leaf,
    },
    {
      label: 'Active Participants',
      value: summary ? formatPoints(summary.activeParticipants) : '—',
      trend: summary?.activeParticipantsTrend ?? null,
      icon: Award,
    },
    {
      label: 'Carbon Offset',
      value: summary ? formatPoints(summary.carbonOffsetKg) : '—',
      unit: 'kg',
      trend: summary?.carbonOffsetTrend ?? null,
      icon: TrendingUp,
    },
  ];

  const yMax = Math.max(...monthlyTrend.map((row) => row.points), 1);
  const yAxisMax = Math.ceil(yMax / 2500) * 2500 || 10000;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Sustainability"
        subtitle="Eco-points earned by guests and environmental impact"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <Icon className="h-5 w-5 text-[var(--color-text-primary)]" strokeWidth={2} />
                <TrendBadge value={card.trend} />
              </div>
              <p className="mt-4 text-sm text-[var(--color-text-secondary)]">{card.label}</p>
              <p className="mt-1 font-display text-3xl font-semibold text-[var(--color-text-primary)]">
                {card.value}
                {card.unit ? (
                  <span className="ml-1 text-base font-normal text-[var(--color-text-secondary)]">({card.unit})</span>
                ) : null}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,1fr)_minmax(0,2fr)]">
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm" aria-labelledby="guest-leaderboard-heading">
          <h2 id="guest-leaderboard-heading" className="font-display text-lg font-semibold text-ink-900">
            Guest Leaderboard
          </h2>
          {isLoading && <p className="mt-6 text-sm text-[var(--color-text-secondary)]">Loading leaderboard...</p>}
          {!isLoading && leaderboard.length === 0 && (
            <p className="mt-6 text-sm text-[var(--color-text-secondary)]">No eco-points recorded yet.</p>
          )}
          <ol className="mt-5 space-y-4">
            {leaderboard.map((entry) => (
              <li key={entry.guestId} className="flex items-center gap-3">
                <span className="w-8 text-sm font-medium text-ink-500">#{entry.rank}</span>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {entry.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[var(--color-text-primary)]">{entry.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{entry.tier} Tier</p>
                </div>
                <span className="shrink-0 font-semibold text-primary">{formatPoints(entry.points)} pts</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm" aria-labelledby="activity-distribution-heading">
            <h2 id="activity-distribution-heading" className="font-display text-lg font-semibold text-ink-900">
              Points Distribution by Activity
            </h2>
            {isLoading && <p className="mt-6 text-sm text-[var(--color-text-secondary)]">Loading chart...</p>}
            {!isLoading && activityDistribution.length === 0 && (
              <p className="mt-6 text-sm text-[var(--color-text-secondary)]">No activity data yet.</p>
            )}
            {!isLoading && activityDistribution.length > 0 && (
              <div className="mt-4 grid items-center gap-6 md:grid-cols-[1fr_200px]">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={activityDistribution}
                        dataKey="points"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={92}
                        paddingAngle={2}
                      >
                        {activityDistribution.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${formatPoints(value)} pts`, 'Points']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-3 text-sm">
                  {activityDistribution.map((entry) => (
                    <li key={entry.name} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        {entry.name}
                      </span>
                      <span className="font-medium text-[var(--color-text-primary)]">{formatPoints(entry.points)} pts</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm" aria-labelledby="monthly-trend-heading">
            <h2 id="monthly-trend-heading" className="font-display text-lg font-semibold text-[var(--color-text-primary)]">
              Monthly Eco-Points Trend
            </h2>
            {isLoading && <p className="mt-6 text-sm text-[var(--color-text-secondary)]">Loading trend...</p>}
            {!isLoading && monthlyTrend.every((row) => row.points === 0) && (
              <p className="mt-6 text-sm text-[var(--color-text-secondary)]">No monthly data yet.</p>
            )}
            {!isLoading && monthlyTrend.some((row) => row.points > 0) && (
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
                    <YAxis
                      domain={[0, yAxisMax]}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                      tickFormatter={(value) => formatPoints(Number(value))}
                    />
                    <Tooltip formatter={(value: number) => [`${formatPoints(value)} pts`, 'Eco-points']} />
                    <Line
                      type="monotone"
                      dataKey="points"
                      stroke="var(--color-primary)"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: 'var(--color-primary)', strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

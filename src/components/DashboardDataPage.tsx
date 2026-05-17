'use client';

import { StatCard } from '@/components/StatCard';
import { PageHeader } from '@/components/PageHeader';
import { useApi } from '@/hooks/useApi';

type DashboardData = {
  stats: {
    totalGuests: number;
    activeReservations: number;
    roomOccupancy: {
      available: number;
      total: number;
      percentage: number;
    };
    todayRevenue: number;
    todaysArrivals: number;
    totalActivities: number;
    pendingFoodOrders: number;
    pendingPayments: number;
  };
};

export default function DashboardDataPage() {
  const { data, isLoading } = useApi<DashboardData>('/api/dashboard');
  const stats = data?.stats;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Dashboard"
        subtitle="Live operational summary from the database."
      />

      {isLoading && <div className="card p-6 text-ink-600">Loading dashboard...</div>}

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <StatCard label="Total Guests" value={String(stats.totalGuests)} />
          <StatCard label="Active Reservations" value={String(stats.activeReservations)} />
          <StatCard
            label="Available Rooms"
            value={`${stats.roomOccupancy.available} / ${stats.roomOccupancy.total}`}
            subtext={`${stats.roomOccupancy.percentage}% available`}
          />
          <StatCard label="Revenue Today" value={`Rs ${stats.todayRevenue.toLocaleString()}`} />
          <StatCard label="Arrivals Today" value={String(stats.todaysArrivals)} />
          <StatCard label="Activities" value={String(stats.totalActivities)} />
          <StatCard label="Pending Food Orders" value={String(stats.pendingFoodOrders)} />
          <StatCard label="Pending Payments" value={String(stats.pendingPayments)} />
        </div>
      )}
    </div>
  );
}

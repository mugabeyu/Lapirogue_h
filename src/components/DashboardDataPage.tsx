'use client';

import Link from 'next/link';
import { Bed, Calendar, CreditCard, Shield, Building2, Users, Star } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { GuestNameCell } from '@/components/ui/GuestNameCell';
import useSWR from 'swr';
import { useApi } from '@/hooks/useApi';
import { ApiResponse, User } from '@/types';

async function dashboardFetcher(url: string) {
  const response = await fetch(url, { credentials: 'include' });
  return response.json();
}

type DashboardData = {
  stats: Record<string, number | string>;
  todaysCheckins: Array<{
    id: string;
    check_in?: string | null;
    check_out?: string | null;
    guests?: { first_name?: string | null; last_name?: string | null; image_path?: string | null } | null;
    rooms?: { room_number?: string | null; type?: string | null } | null;
  }>;
  todaysCheckouts: Array<{
    id: string;
    check_in?: string | null;
    check_out?: string | null;
    guests?: { first_name?: string | null; last_name?: string | null; image_path?: string | null } | null;
    rooms?: { room_number?: string | null; type?: string | null } | null;
  }>;
};

function formatCurrency(value: number) {
  return `Rs ${value.toLocaleString()}`;
}

function formatShortDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
  });
}

function AdminDashboard() {
  const { data, error, isLoading } = useSWR<ApiResponse<DashboardData>>('/api/dashboard', dashboardFetcher, {
    revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30000,
  });
  const stats = data?.data?.stats as { totalManagers?: number; activeDepartments?: number; todayAuditEvents?: number } | undefined;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-500">Failed to load dashboard</p>}
      {isLoading && !data && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-card-border rounded w-20 mb-3" />
              <div className="h-8 bg-card-border rounded w-16 mb-2" />
              <div className="h-3 bg-card-border rounded w-24" />
            </div>
          ))}
        </div>
      )}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Active Managers" value={String(stats.totalManagers ?? 0)} subtext="Manager accounts" />
          <StatCard label="Active Departments" value={String(stats.activeDepartments ?? 0)} subtext="Hotel departments" />
          <StatCard label="Today's Audit Events" value={String(stats.todayAuditEvents ?? 0)} subtext="System activity log" />
        </div>
      )}
    </div>
  );
}

function ManagerDashboard() {
  const { data, error, isLoading } = useSWR<ApiResponse<DashboardData>>('/api/dashboard', dashboardFetcher, {
    revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30000,
  });
  const stats = data?.data?.stats as {
    totalRooms?: number; occupiedRooms?: number; availableRooms?: number;
    occupancyRate?: number; totalGuests?: number; activeReservations?: number;
    checkinsToday?: number; checkoutsToday?: number;
    totalRevenue?: number; pendingPayments?: number;
    activeReceptionists?: number; averageFeedback?: number;
    roomStatusBreakdown?: { available: number; occupied: number; cleaning: number; maintenance: number };
  } | undefined;
  const todaysCheckins = data?.data?.todaysCheckins ?? [];
  const todaysCheckouts = data?.data?.todaysCheckouts ?? [];

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-500">Failed to load dashboard</p>}
      {isLoading && !data && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-card-border rounded w-20 mb-3" />
              <div className="h-8 bg-card-border rounded w-16 mb-2" />
              <div className="h-3 bg-card-border rounded w-24" />
            </div>
          ))}
        </div>
      )}
      {stats && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active Receptionists" value={String(stats.activeReceptionists ?? 0)} subtext="Front desk staff" />
            <StatCard label="Total Guests" value={String(stats.totalGuests ?? 0)} subtext="Registered guests" />
            <StatCard label="Active Reservations" value={String(stats.activeReservations ?? 0)} subtext="Current stays" />
            <StatCard label="Avg Feedback" value={String(stats.averageFeedback ?? 0)} subtext="Guest satisfaction" />
            <StatCard label="Occupancy Rate" value={`${stats.occupancyRate ?? 0}%`} subtext={stats.occupancyRate && stats.occupancyRate > 70 ? 'High occupancy' : stats.occupancyRate && stats.occupancyRate > 40 ? 'Moderate' : 'Low'} />
            <StatCard label="Check-ins Today" value={String(stats.checkinsToday ?? 0)} subtext="Expected arrivals" />
            <StatCard label="Check-outs Today" value={String(stats.checkoutsToday ?? 0)} subtext="Departures today" />
            <StatCard label="Occupied Rooms" value={`${stats.occupiedRooms ?? 0}/${stats.totalRooms ?? 0}`} subtext={`${stats.availableRooms ?? 0} available`} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-xl text-[var(--color-text-primary)]">Revenue Summary</h3>
                  <CreditCard className="h-5 w-5 text-[var(--color-text-secondary)]" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-[var(--color-text-secondary)] mb-1">Total Revenue</div>
                    <div className="font-display text-3xl text-[var(--color-success)]">{formatCurrency(stats.totalRevenue ?? 0)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-[var(--color-text-secondary)] mb-1">Pending Payments</div>
                    <div className="font-display text-3xl text-amber-500">{formatCurrency(stats.pendingPayments ?? 0)}</div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-1">awaiting processing</div>
                  </div>
                </div>
              </div>

              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-xl text-[var(--color-text-primary)]">Room Status</h3>
                  <Bed className="h-5 w-5 text-[var(--color-text-secondary)]" />
                </div>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div>
                    <div className="text-xs text-[var(--color-text-secondary)] uppercase">Available</div>
                    <div className="font-display text-lg text-[var(--color-success)]">{stats.roomStatusBreakdown?.available ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--color-text-secondary)] uppercase">Occupied</div>
                    <div className="font-display text-lg text-[var(--color-danger)]">{stats.roomStatusBreakdown?.occupied ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--color-text-secondary)] uppercase">Cleaning</div>
                    <div className="font-display text-lg text-amber-500">{stats.roomStatusBreakdown?.cleaning ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--color-text-secondary)] uppercase">Maintenance</div>
                    <div className="font-display text-lg text-gray-500">{stats.roomStatusBreakdown?.maintenance ?? 0}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <section className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-card-border">
                  <h3 className="font-display text-lg text-[var(--color-text-primary)]">Today's Check-ins</h3>
                </div>
                <div className="divide-y divide-card-border max-h-80 overflow-y-auto">
                  {todaysCheckins.length === 0 ? (
                    <div className="p-8 text-center text-[var(--color-text-secondary)]">
                      <Calendar className="h-8 w-8 mx-auto mb-3" />
                      No check-ins today
                    </div>
                  ) : todaysCheckins.map((checkin) => (
                    <div key={checkin.id} className="flex items-center justify-between gap-4 p-4 hover:bg-surface-secondary">
                      <div>
                        <GuestNameCell
                          name={[checkin.guests?.first_name, checkin.guests?.last_name].filter(Boolean).join(' ') || 'Guest'}
                          imageUrl={checkin.guests?.image_path ?? null}
                          size="sm"
                        />
                        <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          {checkin.rooms?.room_number} &middot; {checkin.rooms?.type}
                        </div>
                      </div>
                      <span className="rounded-xl border px-3 py-1 text-xs font-medium text-[var(--color-success)]">Arrival</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ReceptionistDashboard() {
  const { data, error, isLoading } = useSWR<ApiResponse<DashboardData>>('/api/dashboard', dashboardFetcher, {
    revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30000,
  });
  const stats = data?.data?.stats as {
    totalRooms?: number; availableRooms?: number; occupiedRooms?: number;
    cleaningRooms?: number; maintenanceRooms?: number;
    checkinsToday?: number; checkoutsToday?: number;
    roomStatusBreakdown?: { available: number; occupied: number; cleaning: number; maintenance: number };
  } | undefined;
  const todaysCheckins = data?.data?.todaysCheckins ?? [];
  const todaysCheckouts = data?.data?.todaysCheckouts ?? [];

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-500">Failed to load dashboard</p>}
      {isLoading && !data && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-card-border rounded w-20 mb-3" />
              <div className="h-8 bg-card-border rounded w-16 mb-2" />
              <div className="h-3 bg-card-border rounded w-24" />
            </div>
          ))}
        </div>
      )}
      {stats && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Check-ins Today" value={String(stats.checkinsToday ?? 0)} subtext="Arrivals" variant="primary" />
            <StatCard label="Check-outs Today" value={String(stats.checkoutsToday ?? 0)} subtext="Departures" />
            <StatCard label="Available Rooms" value={String(stats.availableRooms ?? 0)} subtext={`${stats.totalRooms ?? 0} total rooms`} />
            <StatCard label="Cleaning" value={String(stats.cleaningRooms ?? 0)} subtext="Rooms being prepared" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card p-6">
              <h3 className="font-display text-lg text-[var(--color-text-primary)] mb-4">Room Status Breakdown</h3>
              <div className="flex gap-1 h-10 rounded-lg overflow-hidden mb-4">
                {stats.roomStatusBreakdown && (
                  <>
                    {stats.roomStatusBreakdown.available > 0 && (
                      <div className="bg-[var(--color-success)] transition-all" style={{ width: `${(stats.roomStatusBreakdown.available / (stats.totalRooms ?? 1)) * 100}%` }} title={`${stats.roomStatusBreakdown.available} Available`} />
                    )}
                    {stats.roomStatusBreakdown.occupied > 0 && (
                      <div className="bg-[var(--color-danger)] transition-all" style={{ width: `${(stats.roomStatusBreakdown.occupied / (stats.totalRooms ?? 1)) * 100}%` }} title={`${stats.roomStatusBreakdown.occupied} Occupied`} />
                    )}
                    {stats.roomStatusBreakdown.cleaning > 0 && (
                      <div className="bg-amber-500 transition-all" style={{ width: `${(stats.roomStatusBreakdown.cleaning / (stats.totalRooms ?? 1)) * 100}%` }} title={`${stats.roomStatusBreakdown.cleaning} Cleaning`} />
                    )}
                    {stats.roomStatusBreakdown.maintenance > 0 && (
                      <div className="bg-gray-500 transition-all" style={{ width: `${(stats.roomStatusBreakdown.maintenance / (stats.totalRooms ?? 1)) * 100}%` }} title={`${stats.roomStatusBreakdown.maintenance} Maintenance`} />
                    )}
                  </>
                )}
              </div>
              <div className="grid grid-cols-4 gap-3 text-center text-sm">
                <div><span className="text-[var(--color-success)] font-bold">{stats.roomStatusBreakdown?.available ?? 0}</span> Available</div>
                <div><span className="text-[var(--color-danger)] font-bold">{stats.roomStatusBreakdown?.occupied ?? 0}</span> Occupied</div>
                <div><span className="text-amber-500 font-bold">{stats.roomStatusBreakdown?.cleaning ?? 0}</span> Cleaning</div>
                <div><span className="text-gray-500 font-bold">{stats.roomStatusBreakdown?.maintenance ?? 0}</span> Maintenance</div>
              </div>
            </div>

            <section className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-card-border">
                <h3 className="font-display text-lg text-[var(--color-text-primary)]">Today's Check-ins</h3>
              </div>
              <div className="divide-y divide-card-border max-h-80 overflow-y-auto">
                {todaysCheckins.length === 0 ? (
                  <div className="p-8 text-center">
                    <Calendar className="h-8 w-8 mx-auto mb-3 text-[var(--color-text-secondary)]" />
                    <p className="text-[var(--color-text-secondary)]">No check-ins today</p>
                    <Link href="/reservations/new" className="btn-primary inline-flex px-6 py-2 mt-3">New Reservation</Link>
                  </div>
                ) : todaysCheckins.map((checkin) => (
                  <div key={checkin.id} className="flex items-center justify-between gap-4 p-4 hover:bg-surface-secondary">
                    <div>
                      <GuestNameCell
                        name={[checkin.guests?.first_name, checkin.guests?.last_name].filter(Boolean).join(' ') || 'Guest'}
                        imageUrl={checkin.guests?.image_path ?? null}
                        size="sm"
                      />
                      <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        {checkin.rooms?.room_number} &middot; {checkin.rooms?.type}
                      </div>
                    </div>
                    <span className="rounded-xl border px-3 py-1 text-xs font-medium text-[var(--color-success)]">Arrival</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardDataPage() {
  const { data: currentUser } = useApi<User>('/api/auth/me');
  const role = currentUser?.role;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Dashboard"
        subtitle={
          role === 'ADMIN' ? 'System health and user management overview' :
          role === 'MANAGER' ? 'Revenue, staff metrics, and performance analytics' :
          'Arrivals, departures, and room cleanliness status'
        }
      />

      {!role && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-card-border rounded w-20 mb-3" />
              <div className="h-8 bg-card-border rounded w-16 mb-2" />
              <div className="h-3 bg-card-border rounded w-24" />
            </div>
          ))}
        </div>
      )}

      {role === 'ADMIN' && <AdminDashboard />}
      {role === 'MANAGER' && <ManagerDashboard />}
      {role === 'RECEPTIONIST' && <ReceptionistDashboard />}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { Bed, Calendar, CreditCard } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { GuestNameCell } from '@/components/ui/GuestNameCell';
import useSWR from 'swr';
import { ApiResponse } from '@/types';

async function dashboardFetcher(url: string) {
  const response = await fetch(url, { credentials: 'include' });
  return response.json();
}

type DashboardData = {
  stats: {
    totalRooms: number;
    occupiedRooms: number;
    availableRooms: number;
    occupancyRate: number;
    totalGuests: number;
    activeReservations: number;
    checkinsToday: number;
    checkoutsToday: number;
    totalRevenue: number;
    pendingPayments: number;
    roomStatusBreakdown: {
      available: number;
      occupied: number;
      cleaning: number;
      maintenance: number;
    };
  };
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

export default function DashboardDataPage() {
  const { data, error, isLoading } = useSWR<ApiResponse<DashboardData>>('/api/dashboard', dashboardFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30000,
  });
  const stats = data?.data?.stats;
  const todaysCheckins = data?.data?.todaysCheckins ?? [];
  const todaysCheckouts = data?.data?.todaysCheckouts ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader title="Dashboard" subtitle="Overview of today's operations" />

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

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
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Rooms"
              value={String(stats.totalRooms)}
              subtext="All rooms in inventory"
            />
            <StatCard
              label="Occupied"
              value={`${stats.occupiedRooms}/${stats.totalRooms}`}
              subtext={`${stats.occupancyRate}% occupancy`}
              variant="primary"
            />
            <StatCard
              label="Available"
              value={`${stats.availableRooms}/${stats.totalRooms}`}
              subtext={`${stats.totalRooms - stats.occupiedRooms} ready`}
            />
            <StatCard
              label="Occupancy Rate"
              value={`${stats.occupancyRate}%`}
              subtext={stats.occupancyRate > 70 ? 'High occupancy' : stats.occupancyRate > 40 ? 'Moderate occupancy' : 'Low occupancy'}
            />
            <StatCard
              label="Total Guests"
              value={String(stats.totalGuests)}
              subtext="Registered guests"
            />
            <StatCard
              label="Active Reservations"
              value={String(stats.activeReservations)}
              subtext="Current stays"
            />
            <StatCard
              label="Check-ins Today"
              value={String(stats.checkinsToday)}
              subtext="Expected arrivals"
            />
            <StatCard
              label="Check-outs Today"
              value={String(stats.checkoutsToday)}
              subtext="Departures today"
            />
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
                    <div className="font-display text-3xl text-[var(--color-success)]">{formatCurrency(stats.totalRevenue)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-[var(--color-text-secondary)] mb-1">Pending Payments</div>
                    <div className="font-display text-3xl text-amber-500">{formatCurrency(stats.pendingPayments)}</div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-1">payments awaiting processing</div>
                  </div>
                </div>
              </div>

              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-xl text-[var(--color-text-primary)]">Room Status Breakdown</h3>
                  <Bed className="h-5 w-5 text-[var(--color-text-secondary)]" />
                </div>
                
                <div className="flex gap-1 h-10 rounded-lg overflow-hidden mb-4">
                  {stats.roomStatusBreakdown.available > 0 && (
                    <div
                      className="bg-[var(--color-success)] transition-all duration-300"
                      style={{ width: `${(stats.roomStatusBreakdown.available / stats.totalRooms) * 100}%` }}
                      title={`${stats.roomStatusBreakdown.available} Available`}
                    />
                  )}
                  {stats.roomStatusBreakdown.occupied > 0 && (
                    <div
                      className="bg-[var(--color-danger)] transition-all duration-300"
                      style={{ width: `${(stats.roomStatusBreakdown.occupied / stats.totalRooms) * 100}%` }}
                      title={`${stats.roomStatusBreakdown.occupied} Occupied`}
                    />
                  )}
                  {stats.roomStatusBreakdown.cleaning > 0 && (
                    <div
                      className="bg-amber-500 transition-all duration-300"
                      style={{ width: `${(stats.roomStatusBreakdown.cleaning / stats.totalRooms) * 100}%` }}
                      title={`${stats.roomStatusBreakdown.cleaning} Cleaning`}
                    />
                  )}
                  {stats.roomStatusBreakdown.maintenance > 0 && (
                    <div
                      className="bg-gray-500 transition-all duration-300"
                      style={{ width: `${(stats.roomStatusBreakdown.maintenance / stats.totalRooms) * 100}%` }}
                      title={`${stats.roomStatusBreakdown.maintenance} Maintenance`}
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div>
                    <div className="text-xs text-[var(--color-text-secondary)] uppercase">Available</div>
                    <div className="font-display text-lg text-[var(--color-success)]">{stats.roomStatusBreakdown.available}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--color-text-secondary)] uppercase">Occupied</div>
                    <div className="font-display text-lg text-[var(--color-danger)]">{stats.roomStatusBreakdown.occupied}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--color-text-secondary)] uppercase">Cleaning</div>
                    <div className="font-display text-lg text-amber-500">{stats.roomStatusBreakdown.cleaning}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--color-text-secondary)] uppercase">Maintenance</div>
                    <div className="font-display text-lg text-gray-500">{stats.roomStatusBreakdown.maintenance}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <section className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-card-border">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-display text-xl text-[var(--color-text-primary)]">Today's Check-ins</h3>
                    <div className="rounded-xl border border-card-border bg-surface-secondary px-3 py-1 text-xs font-medium text-[var(--color-text-primary)]">
                      {stats.checkinsToday} expected
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-card-border max-h-80 overflow-y-auto">
                  {todaysCheckins.length === 0 ? (
                    <div className="p-8 text-center">
                      <div className="flex items-center justify-center mb-4">
                        <Calendar className="h-8 w-8 text-[var(--color-text-secondary)]" />
                      </div>
                      <div className="text-[var(--color-text-secondary)] mb-3">No check-ins scheduled today</div>
                      <Link href="/reservations/new" className="btn-primary inline-flex px-6 py-2">
                        New Reservation
                      </Link>
                    </div>
                  ) : (
                    todaysCheckins.map((checkin) => {
                      const guestName = [checkin.guests?.first_name, checkin.guests?.last_name]
                        .filter(Boolean).join(' ') || 'Guest';
                      const roomLabel = checkin.rooms?.room_number || 'Room pending';
                      const roomType = checkin.rooms?.type || 'Standard';

                      return (
                        <div
                          key={checkin.id}
                          className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-secondary"
                        >
                        <div>
                          <GuestNameCell
                            name={guestName}
                            imageUrl={checkin.guests?.image_path ?? null}
                            size="sm"
                          />
                          <div className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            {roomLabel} &middot; {roomType}
                          </div>
                          <div className="mt-2 flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
                            <span>Check-in {formatShortDate(checkin.check_in)}</span>
                            <span>Check-out {formatShortDate(checkin.check_out)}</span>
                          </div>
                        </div>
                          <div className="rounded-xl border border-card-border bg-surface-secondary px-3 py-1 text-xs font-medium text-[var(--color-success)]">
                            Arrival
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-card-border">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-display text-xl text-[var(--color-text-primary)]">Today's Check-outs</h3>
                    <div className="rounded-xl border border-card-border bg-surface-secondary px-3 py-1 text-xs font-medium text-[var(--color-text-primary)]">
                      {stats.checkoutsToday} departures
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-card-border max-h-80 overflow-y-auto">
                  {todaysCheckouts.length === 0 ? (
                    <div className="p-8 text-center">
                      <div className="flex items-center justify-center mb-4">
                        <Calendar className="h-8 w-8 text-[var(--color-text-secondary)]" />
                      </div>
                      <div className="text-[var(--color-text-secondary)]">No check-outs scheduled today</div>
                    </div>
                  ) : (
                    todaysCheckouts.map((checkout) => {
                      const guestName = [checkout.guests?.first_name, checkout.guests?.last_name]
                        .filter(Boolean).join(' ') || 'Guest';
                      const roomLabel = checkout.rooms?.room_number || 'Room pending';
                      const roomType = checkout.rooms?.type || 'Standard';

                      return (
                        <div
                          key={checkout.id}
                          className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-secondary"
                        >
                        <div>
                          <GuestNameCell
                            name={guestName}
                            imageUrl={checkout.guests?.image_path ?? null}
                            size="sm"
                          />
                          <div className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            {roomLabel} &middot; {roomType}
                          </div>
                          <div className="mt-2 flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
                            <span>Check-in {formatShortDate(checkout.check_in)}</span>
                            <span>Check-out {formatShortDate(checkout.check_out)}</span>
                          </div>
                        </div>
                          <div className="rounded-xl border border-card-border bg-surface-secondary px-3 py-1 text-xs font-medium text-amber-500">
                            Departure
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
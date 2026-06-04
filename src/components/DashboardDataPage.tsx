'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  BedDouble,
  CalendarCheck2,
  CalendarPlus2,
  DoorOpen,
  UserPlus,
  UtensilsCrossed,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { useApi } from '@/hooks/useApi';
import { AddGuestModal } from '@/components/modals/AddGuestModal';
import { AddActivityModal } from '@/components/modals/AddActivityModal';

type DashboardData = {
  stats: {
    totalGuests: number;
    activeReservations: number;
    roomOccupancy: {
      available: number;
      total: number;
      percentage: number;
    };
    totalRevenue: number;
    todayRevenue: number;
    todaysArrivals: number;
    totalActivities: number;
    pendingFoodOrders: number;
    pendingPayments: number;
  };
  todaysArrivals: Array<{
    id: string;
    check_in?: string | null;
    check_out?: string | null;
    guests?: { first_name?: string | null; last_name?: string | null } | null;
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
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const { data } = useApi<DashboardData>('/api/dashboard');
  const stats = data?.stats;
  const todaysArrivals = data?.todaysArrivals ?? [];

  const occupiedPercent = stats?.roomOccupancy.total
    ? Math.round(((stats.roomOccupancy.total - stats.roomOccupancy.available) / stats.roomOccupancy.total) * 100)
    : 0;

  // Calculate week-over-week change for occupancy (mock data for now)
  const occupancyTrend = Math.round((Math.random() * 10 - 5) * 10) / 10; // Random between -5 and 5

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader title="Dashboard" />

      {stats && (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Link
              href="/reservations/new"
              className="group rounded-2xl border border-border bg-surface p-5 text-left transition-transform hover:-translate-y-1"
            >
              <CalendarPlus2 className="h-5 w-5 text-[var(--color-text-primary)]" strokeWidth={2} />
              <div className="mt-6 text-base font-display text-[var(--color-text-primary)]">
                Add Reservation
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setIsGuestModalOpen(true)}
              className="group rounded-2xl border border-border bg-surface p-5 text-left transition-transform hover:-translate-y-1"
            >
              <UserPlus className="h-5 w-5 text-[var(--color-text-primary)]" strokeWidth={2} />
              <div className="mt-6 text-base font-display text-[var(--color-text-primary)]">
                Register Guest
              </div>
            </button>

            <Link
              href="/rooms/assign"
              className="group rounded-2xl border border-border bg-surface p-5 text-left transition-transform hover:-translate-y-1"
            >
              <DoorOpen className="h-5 w-5 text-[var(--color-text-primary)]" strokeWidth={2} />
              <div className="mt-6 text-base font-display text-[var(--color-text-primary)]">
                Assign Room
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setIsActivityModalOpen(true)}
              className="group rounded-2xl border border-border bg-surface p-5 text-left transition-transform hover:-translate-y-1"
            >
              <Activity className="h-5 w-5 text-[var(--color-text-primary)]" strokeWidth={2} />
              <div className="mt-6 text-base font-display text-[var(--color-text-primary)]">
                Add Activity
              </div>
            </button>

            <Link
              href="/food-beverage/orders/new"
              className="group rounded-2xl border border-border bg-surface p-5 text-left transition-transform hover:-translate-y-1"
            >
              <UtensilsCrossed className="h-5 w-5 text-[var(--color-text-primary)]" strokeWidth={2} />
              <div className="mt-6 text-base font-display text-[var(--color-text-primary)]">
                Record F&B Order
              </div>
            </Link>
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-4 section-gap">
            <StatCard 
              label="Total Guests" 
              value={String(stats.totalGuests)} 
              subtext="All active guest records" 
              isSecondary={true}
            />
            <StatCard 
              label="Active Reservations" 
              value={String(stats.activeReservations)} 
              subtext="Currently checked in" 
              isSecondary={true}
            />
            <StatCard 
              label="Total Revenue" 
              value={formatCurrency(stats.totalRevenue)} 
              subtext={`Today: ${formatCurrency(stats.todayRevenue)}`} 
              isSecondary={true}
            />
            <StatCard 
              label="Activities" 
              value={String(stats.totalActivities)} 
              subtext="Live activity catalogue" 
              isSecondary={true}
            />
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr] section-gap">
            <section className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <h3 className="font-display text-xl text-[var(--color-text-primary)]">Operational summary</h3>
                </div>
              </div>

              <div className="grid p-5 sm:grid-cols-2 sm:divide-x sm:divide-border card-internal">
                <div className="pb-5 sm:pr-6 sm:pb-0">
                  <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
                    <span>Available rooms</span>
                    <BedDouble className="h-4 w-4" />
                  </div>
                  <div className="mt-4 flex items-end gap-3">
                    <div className="font-display text-4xl text-[var(--color-text-primary)]">{stats.roomOccupancy.available}</div>
                    <div className="pb-1 text-sm text-[var(--color-text-secondary)]">of {stats.roomOccupancy.total}</div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${stats.roomOccupancy.percentage}%` }} />
                  </div>
                  <div className="mt-2 text-xs text-[var(--color-text-secondary)]">{stats.roomOccupancy.percentage}% available</div>
                </div>

                <div className="pt-5 sm:pl-6 sm:pt-0">
                  <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
                    <span>Pending workload</span>
                    <CalendarCheck2 className="h-4 w-4" />
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-[var(--color-text-secondary)]">Food orders</span>
                      <span className="font-semibold text-[var(--color-text-primary)]">{stats.pendingFoodOrders}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border py-2">
                      <span className="text-sm text-[var(--color-text-secondary)]">Payments</span>
                      <span className="font-semibold text-[var(--color-text-primary)]">{stats.pendingPayments}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border py-2">
                      <span className="text-sm text-[var(--color-text-secondary)]">Activities</span>
                      <span className="font-semibold text-[var(--color-text-primary)]">{stats.totalActivities}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 border-t border-border p-5 md:grid-cols-3 card-internal">
                <div className="rounded-xl border border-border bg-surface-secondary p-6 hover:bg-surface cursor-pointer transition-colors">
                  <div className="mb-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">Occupancy Rate</div>
                    <div className="mt-2 text-3xl font-display text-[var(--color-text-primary)]">{occupiedPercent}%</div>
                    <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {occupancyTrend >= 0 ? '+' : ''}{occupancyTrend}% from last week
                    </div>
                  </div>
                  <div className="h-1.5 mt-3 rounded-full bg-border">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${occupiedPercent}%` }} />
                  </div>
                  <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
                    {stats.roomOccupancy.total - stats.roomOccupancy.available} of {stats.roomOccupancy.total} rooms occupied
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="border-t border-border pt-4">
                    <div className="mb-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">Availability</div>
                      <div className="mt-1 text-2xl font-display text-[var(--color-text-primary)]">{stats.roomOccupancy.available}</div>
                      <div className="text-sm text-[var(--color-text-secondary)]">rooms ready for check-in</div>
                    </div>
                  </div>
                  <div className="border-t border-border pt-4">
                    <div className="mb-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">Revenue</div>
                      <div className="mt-1 text-2xl font-display text-[var(--color-text-primary)]">{formatCurrency(stats.totalRevenue)}</div>
                      <div className="text-sm text-[var(--color-text-secondary)]">Recorded payments total · Today {formatCurrency(stats.todayRevenue)}</div>
                    </div>
                  </div>
                  <div className="border-t border-border pt-4">
                    <div className="mb-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">Occupancy</div>
                      <div className="mt-1 text-2xl font-display text-[var(--color-text-primary)]">{occupiedPercent}%</div>
                      <div className="text-sm text-[var(--color-text-secondary)]">rooms currently occupied</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="card overflow-hidden">
              <div className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display text-xl text-[var(--color-text-primary)]">Today's arrivals</h3>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-secondary px-3 py-1 text-xs font-medium text-[var(--color-text-primary)]">
                    {stats.todaysArrivals} expected
                  </div>
                </div>
              </div>

              <div className="divide-y divide-border">
                {todaysArrivals.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="flex items-center justify-center mb-4">
                        <span className="h-8 w-8 text-[var(--color-text-secondary)] mr-3">
                        {/* Using a simple icon for no data state */}
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.5 0-3 .5-4 1.5m9 8-8.618-8.618a1.875 1.875 0 00-2.652 0L6.367 16m9 8v2m-6-4h.008m.008 0H9.412a2.25 2.25 0 00-2.25 2.25 2.25 2.25 0 002.25 2.25h4.588a2.25 2.25 0 002.25-2.25v-1.5m-11.25 6c-1.113 0-2.25-.45-2.97-1.242l-.458-.48a1.125 1.125 0 011.5-1.5h9.75a1.125 1.125 0 011.5 1.5l-.458.48A2.25 2.25 0 0112.75 20h-.5z" />
                        </svg>
                      </span>
                    </div>
                    <div className="text-[var(--color-text-secondary)] mb-3">No arrivals scheduled today</div>
                    <Link href="/reservations/new" className="btn-primary inline-flex px-6 py-2">
                      New Reservation
                    </Link>
                  </div>
                ) : (
                  todaysArrivals.slice(0, 6).map((arrival) => {
                    const guestName = [arrival.guests?.first_name, arrival.guests?.last_name].filter(Boolean).join(' ') || 'Guest';
                    const roomLabel = arrival.rooms?.room_number || 'Room pending';
                    const roomType = arrival.rooms?.type || 'Standard';

                    return (
                      <div 
                        key={arrival.id} 
                        className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-secondary cursor-pointer"
                      >
                        <div>
                          <div className="font-medium text-[var(--color-text-primary)]">{guestName}</div>
                          <div className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            {roomLabel} · {roomType}
                          </div>
                          <div className="mt-2 flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
                            <span>Check-in {formatShortDate(arrival.check_in)}</span>
                            <span>Check-out {formatShortDate(arrival.check_out)}</span>
                          </div>
                        </div>
                        <div className="rounded-xl border border-border bg-surface-secondary px-3 py-1 text-xs font-medium text-[var(--color-text-primary)]">
                          Arrival
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      <AddGuestModal isOpen={isGuestModalOpen} onClose={() => setIsGuestModalOpen(false)} />
      <AddActivityModal isOpen={isActivityModalOpen} onClose={() => setIsActivityModalOpen(false)} />
    </div>
  );
}
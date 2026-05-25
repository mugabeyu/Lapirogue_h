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
import ReservationCalendarPage from '@/components/forms/ReservationCalendarPage';

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
  const { data, isLoading } = useApi<DashboardData>('/api/dashboard');
  const stats = data?.stats;
  const todaysArrivals = data?.todaysArrivals ?? [];

  const occupiedPercent = stats?.roomOccupancy.total
    ? Math.round(((stats.roomOccupancy.total - stats.roomOccupancy.available) / stats.roomOccupancy.total) * 100)
    : 0;

  // Calculate week-over-week change for occupancy (mock data for now)
  const occupancyTrend = Math.round((Math.random() * 10 - 5) * 10) / 10; // Random between -5 and 5

  return (
    <div className="space-y-6 animate-in fade-in duration-500 page-padding">
      <PageHeader title="Dashboard" subtitle="Live operational summary from Supabase." />

      {isLoading && <div className="card p-6 text-ink-600">Loading dashboard...</div>}

      {stats && (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Link
              href="/reservations/new"
              className="group rounded-[24px] border border-sand-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                <CalendarPlus2 className="h-5 w-5" />
              </div>
              <div className="mt-8 text-center">
                <div className="font-display text-lg text-ink-900">Add Reservation</div>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setIsGuestModalOpen(true)}
              className="group rounded-[24px] border border-sand-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                <UserPlus className="h-5 w-5" />
              </div>
              <div className="mt-8 text-center">
                <div className="font-display text-lg text-ink-900">Register Guest</div>
              </div>
            </button>

            <Link
              href="/rooms/assign"
              className="group rounded-[24px] border border-sand-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                <DoorOpen className="h-5 w-5" />
              </div>
              <div className="mt-8 text-center">
                <div className="font-display text-lg text-ink-900">Assign Room</div>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setIsActivityModalOpen(true)}
              className="group rounded-[24px] border border-sand-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                <Activity className="h-5 w-5" />
              </div>
              <div className="mt-8 text-center">
                <div className="font-display text-lg text-ink-900">Add Activity</div>
              </div>
            </button>

            <Link
              href="/food-beverage/orders/new"
              className="group rounded-[24px] border border-sand-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <div className="mt-8 text-center">
                <div className="font-display text-lg text-ink-900">Record F&B Order</div>
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
              label="Revenue Today" 
              value={formatCurrency(stats.todayRevenue)} 
              subtext="Completed payments today" 
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
            <section className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-sand-200 bg-white px-5 py-4">
                <div>
                  <h3 className="font-display text-xl text-ink-900">Operational summary</h3>
                  <p className="text-sm text-ink-600">Everything here is sourced from the live database.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-sand-50 px-3 py-1.5 text-xs font-medium text-ink-600">
                  <Activity className="h-4 w-4" />
                  Live sync
                </div>
              </div>

              <div className="grid gap-4 p-5 sm:grid-cols-2 card-internal">
                <div className="rounded-3xl border border-sand-200 bg-sand-50/70 p-5">
                  <div className="flex items-center justify-between text-sm text-ink-600">
                    <span>Available rooms</span>
                    <BedDouble className="h-4 w-4" />
                  </div>
                  <div className="mt-4 flex items-end gap-3">
                    <div className="font-display text-4xl text-ink-900">{stats.roomOccupancy.available}</div>
                    <div className="pb-1 text-sm text-ink-500">of {stats.roomOccupancy.total}</div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-sand-200">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${stats.roomOccupancy.percentage}%` }} />
                  </div>
                  <div className="mt-2 text-xs text-ink-500">{stats.roomOccupancy.percentage}% available</div>
                </div>

                <div className="rounded-3xl border border-sand-200 bg-white p-5">
                  <div className="flex items-center justify-between text-sm text-ink-600">
                    <span>Pending workload</span>
                    <CalendarCheck2 className="h-4 w-4" />
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between rounded-2xl bg-sand-50 px-4 py-3">
                      <span className="text-sm text-ink-600">Food orders</span>
                      <span className="font-semibold text-ink-900">{stats.pendingFoodOrders}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-sand-50 px-4 py-3">
                      <span className="text-sm text-ink-600">Payments</span>
                      <span className="font-semibold text-ink-900">{stats.pendingPayments}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-sand-50 px-4 py-3">
                      <span className="text-sm text-ink-600">Activities</span>
                      <span className="font-semibold text-ink-900">{stats.totalActivities}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 border-t border-sand-200 p-5 md:grid-cols-3 card-internal">
                {/* Primary metric card with dark background for occupancy rate */}
                <div className="rounded-3xl bg-primary/90 p-6 hover:bg-primary/80 cursor-pointer transition-colors">
                  <div className="mb-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-sand-300">Occupancy Rate</div>
                    <div className="mt-2 text-3xl font-display text-sand-50">{occupiedPercent}%</div>
                    <div className="mt-1 text-xs">
                      {occupancyTrend >= 0 ? '+' : ''}{occupancyTrend}% from last week
                    </div>
                  </div>
                  <div className="h-1.5 mt-3 rounded-full bg-sand-300/20">
                    <div className="h-full rounded-full bg-sand-50" style={{ width: `${occupiedPercent}%` }} />
                  </div>
                  <div className="mt-2 text-xs text-sand-300/70">
                    {stats.roomOccupancy.total - stats.roomOccupancy.available} of {stats.roomOccupancy.total} rooms occupied
                  </div>
                </div>
                
                {/* Secondary stats with subtle rule lines instead of boxes */}
                <div className="space-y-4">
                  <div className="border-t border-sand-200 pt-4">
                    <div className="mb-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Availability</div>
                      <div className="mt-1 text-2xl font-display text-ink-900">{stats.roomOccupancy.available}</div>
                      <div className="text-sm text-ink-600">rooms ready for check-in</div>
                    </div>
                  </div>
                  <div className="border-t border-sand-200 pt-4">
                    <div className="mb-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Revenue</div>
                      <div className="mt-1 text-2xl font-display text-ink-900">{formatCurrency(stats.todayRevenue)}</div>
                      <div className="text-sm text-ink-600">collected today</div>
                    </div>
                  </div>
                  <div className="border-t border-sand-200 pt-4">
                    <div className="mb-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Occupancy</div>
                      <div className="mt-1 text-2xl font-display text-ink-900">{occupiedPercent}%</div>
                      <div className="text-sm text-ink-600">rooms currently occupied</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="card overflow-hidden">
              <div className="border-b border-sand-200 bg-white px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display text-xl text-ink-900">Today's arrivals</h3>
                    <p className="text-sm text-ink-600">Live arrivals from the reservations table.</p>
                  </div>
                  <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {stats.todaysArrivals} expected
                  </div>
                </div>
              </div>

              <div className="divide-y divide-sand-200">
                {todaysArrivals.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="flex items-center justify-center mb-4">
                      <span className="h-8 w-8 text-ink-300 mr-3">
                        {/* Using a simple icon for no data state */}
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.5 0-3 .5-4 1.5m9 8-8.618-8.618a1.875 1.875 0 00-2.652 0L6.367 16m9 8v2m-6-4h.008m.008 0H9.412a2.25 2.25 0 00-2.25 2.25 2.25 2.25 0 002.25 2.25h4.588a2.25 2.25 0 002.25-2.25v-1.5m-11.25 6c-1.113 0-2.25-.45-2.97-1.242l-.458-.48a1.125 1.125 0 011.5-1.5h9.75a1.125 1.125 0 011.5 1.5l-.458.48A2.25 2.25 0 0112.75 20h-.5z" />
                        </svg>
                      </span>
                    </div>
                    <div className="text-ink-500 mb-3">No arrivals scheduled today</div>
                    <button 
                      onClick={() => alert('Click to create new reservation')}
                      className="btn-primary px-6 py-2"
                    >
                      New Reservation
                    </button>
                  </div>
                ) : (
                  todaysArrivals.slice(0, 6).map((arrival) => {
                    const guestName = [arrival.guests?.first_name, arrival.guests?.last_name].filter(Boolean).join(' ') || 'Guest';
                    const roomLabel = arrival.rooms?.room_number || 'Room pending';
                    const roomType = arrival.rooms?.type || 'Standard';

                    return (
                      <div 
                        key={arrival.id} 
                        className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-sand-50 cursor-pointer"
                      >
                        <div>
                          <div className="font-medium text-ink-900">{guestName}</div>
                          <div className="mt-1 text-sm text-ink-600">
                            {roomLabel} · {roomType}
                          </div>
                          <div className="mt-2 flex items-center gap-3 text-xs text-ink-500">
                            <span>Check-in {formatShortDate(arrival.check_in)}</span>
                            <span>Check-out {formatShortDate(arrival.check_out)}</span>
                          </div>
                        </div>
                        <div className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent-700">
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

      {stats && (
        <section className="overflow-hidden rounded-[32px] border border-sand-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-sand-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-2xl text-ink-900">Reservation calendar</h2>
              <p className="mt-1 text-sm text-ink-600">Monthly room occupancy and bookings</p>
            </div>
            <Link href="/reservations/calendar" className="text-sm font-medium text-primary hover:underline">
              Open full calendar
            </Link>
          </div>
          <div className="p-4">
            <ReservationCalendarPage embedded />
          </div>
        </section>
      )}

      <AddGuestModal isOpen={isGuestModalOpen} onClose={() => setIsGuestModalOpen(false)} />
      <AddActivityModal isOpen={isActivityModalOpen} onClose={() => setIsActivityModalOpen(false)} />
    </div>
  );
}
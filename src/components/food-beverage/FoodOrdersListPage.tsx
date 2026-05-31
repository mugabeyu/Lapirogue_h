'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Filter, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { formatMenuPrice } from '@/lib/menu';

type FoodOrder = {
  id: string;
  orderId: string | null;
  guest: string | null;
  room: string | null;
  itemsSummary: string;
  total: number;
  status: string | null;
  time: string;
};

type OrdersResponse = {
  success: boolean;
  data: FoodOrder[];
  stats?: {
    newOrders: number;
    preparing: number;
    delivered: number;
    completedToday: number;
  };
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-orange-100 text-orange-800',
  SERVED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-surface-secondary text-[var(--color-text-secondary)]',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'NEW',
  PREPARING: 'PREPARING',
  SERVED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
};

async function fetchOrders(url: string) {
  const response = await fetch(url);
  return response.json() as Promise<OrdersResponse>;
}

export default function FoodOrdersListPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    return `/api/food-orders?${params}`;
  }, [search, statusFilter]);

  const { data, isLoading } = useSWR(url, fetchOrders);
  const orders = data?.data ?? [];
  const stats = data?.stats;

  const statCards = [
    { label: 'New orders', value: stats?.newOrders ?? 0, hint: 'Pending' },
    { label: 'Preparing', value: stats?.preparing ?? 0, hint: 'In kitchen' },
    { label: 'Delivered', value: stats?.delivered ?? 0, hint: 'Served' },
    { label: 'Completed today', value: stats?.completedToday ?? 0, hint: 'Today' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Food & Beverage Orders"
        subtitle="Manage restaurant, bar, and room service orders"
        action={
          <Link href="/food-beverage/orders/new" className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Order
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{card.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold text-[var(--color-text-primary)]">{card.value}</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search orders by guest or room..."
            className="input-field w-full pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="input-field w-full sm:w-48"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="PENDING">New</option>
          <option value="PREPARING">Preparing</option>
          <option value="SERVED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <button type="button" className="btn-secondary inline-flex items-center justify-center gap-2 sm:w-auto">
          <Filter className="h-4 w-4" />
          Filter Status
        </button>
      </div>

      <section className="card" aria-labelledby="food-orders-table-heading">
        <div className="px-5 py-4 border-b border-border">
          <h2 id="food-orders-table-heading" className="font-display text-lg font-semibold text-[var(--color-text-primary)]">
            Order list
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Order ID, guest & room, items, total, kitchen status, time placed</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm" aria-label="Food and beverage orders">
            <thead>
              <tr className="bg-surface-secondary text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                <th scope="col" className="px-5 py-4 font-medium">Order ID</th>
                <th scope="col" className="px-5 py-4 font-medium">Guest & room</th>
                <th scope="col" className="px-5 py-4 font-medium">Items ordered</th>
                <th scope="col" className="px-5 py-4 font-medium">Order total</th>
                <th scope="col" className="px-5 py-4 font-medium">Kitchen status</th>
                <th scope="col" className="px-5 py-4 font-medium">Time placed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[var(--color-text-secondary)]">Loading orders...</td>
                </tr>
              )}
              {!isLoading && orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[var(--color-text-secondary)]">No orders found.</td>
                </tr>
              )}
              {orders.map((order) => {
                const statusKey = order.status ?? 'PENDING';
                return (
                  <tr key={order.id} className="hover:bg-surface-secondary">
                    <td className="px-5 py-4 font-medium text-[var(--color-text-primary)]">{order.orderId ?? order.id.slice(0, 8)}</td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-[var(--color-text-primary)]">{order.guest ?? 'Walk-in'}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{order.room ? `Room ${order.room}` : '—'}</p>
                    </td>
                    <td className="px-5 py-4 text-[var(--color-text-primary)]">{order.itemsSummary}</td>
                    <td className="px-5 py-4 font-medium text-[var(--color-text-primary)]">{formatMenuPrice(order.total)}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
                          STATUS_STYLES[statusKey] ?? STATUS_STYLES.PENDING
                        }`}
                      >
                        {STATUS_LABELS[statusKey] ?? statusKey}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[var(--color-text-secondary)]">{order.time}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

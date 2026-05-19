'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { useApi } from '@/hooks/useApi';
import { AddGuestModal } from '@/components/modals/AddGuestModal';
import { Guest } from '@/types';

function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function GuestsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '100');
    if (search.trim()) params.set('search', search.trim());
    return `/api/guests?${params.toString()}`;
  }, [search]);

  const { data, isLoading, mutate } = useApi<Guest[]>(url);
  const rows = data ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Guests"
        subtitle="Manage current, upcoming, and past guests."
        action={
          <button type="button" className="btn-primary" onClick={() => setIsRegisterOpen(true)}>
            Register Guest
          </button>
        }
      />

      <div className="overflow-hidden rounded-[24px] border border-sand-200 bg-white shadow-sm">
        <div className="border-b border-sand-200 bg-white p-4">
          <div className="relative w-full sm:w-96">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              placeholder="Search guests..."
              className="input-field pl-10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-sand-200 bg-sand-50 text-xs uppercase tracking-wider text-ink-600">
                <th className="px-6 py-4 font-medium">Guest ID</th>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Check-in</th>
                <th className="px-6 py-4 font-medium">Check-out</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-ink-500">
                    No guests found. Register a guest to get started.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer transition-colors hover:bg-sand-50/60"
                  onClick={() => router.push(`/guests/${row.id}`)}
                >
                  <td className="px-6 py-4 text-sm font-medium text-primary">{row.guestId}</td>
                  <td className="px-6 py-4 text-sm text-ink-700">
                    {row.firstName} {row.lastName}
                  </td>
                  <td className="px-6 py-4 text-sm text-ink-700">{row.email ?? '-'}</td>
                  <td className="px-6 py-4 text-sm text-ink-700">{formatDate(row.checkIn)}</td>
                  <td className="px-6 py-4 text-sm text-ink-700">{formatDate(row.checkOut)}</td>
                  <td className="px-6 py-4 text-sm text-ink-700">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-sand-200 bg-white p-4 text-sm text-ink-600">
          {isLoading ? 'Loading records...' : `${rows.length} records`}
        </div>
      </div>

      <AddGuestModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSaved={async () => {
          await mutate();
        }}
      />
    </div>
  );
}

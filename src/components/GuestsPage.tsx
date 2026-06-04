'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import Button from '@/components/ui/Button';
import { useApi } from '@/hooks/useApi';
import { AddGuestModal } from '@/components/modals/AddGuestModal';
import { LabeledTable } from '@/components/ui/LabeledTable';
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
  const PAGE_SIZE = 15;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Sync search state with URL query on mount
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    if (urlSearch) setSearch(urlSearch);
  }, [searchParams]);

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '100');
    if (search.trim()) params.set('search', search.trim());
    return `/api/guests?${params.toString()}`;
  }, [search]);

  const { data, isLoading, mutate } = useApi<Guest[]>(url);
  const rows = data ?? [];

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => {
      const fullName = `${row.firstName} ${row.lastName}`.toLowerCase();
      return [row.guestId, fullName, row.email ?? '', row.phone ?? '', row.roomNumber ?? '', row.roomType ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const paginatedRows = filteredRows.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Guests"
        subtitle="Manage current, upcoming, and past guests."
        action={
          <Button variant="primary" onClick={() => setIsRegisterOpen(true)}>
            Register Guest
          </Button>
        }
      />

      <div className="card mt-4 overflow-hidden">
        <div className="px-4 py-4">
          <label htmlFor="guest-search" className="sr-only">Search guests</label>
          <div className="relative w-full sm:w-96">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <input
              id="guest-search"
              type="search"
              placeholder="Search guests..."
              className="input-field pl-10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search guests"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <LabeledTable
            caption="Registered guests"
            footer={
              isLoading
                ? 'Loading guests...'
                : `Showing ${filteredRows.length === 0 ? 0 : start + 1}-${Math.min(start + PAGE_SIZE, filteredRows.length)} of ${filteredRows.length} ${filteredRows.length === 1 ? 'guest' : 'guests'}`
            }>

            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                <th scope="col" className="px-6 py-4 font-medium text-left">Photo</th>
                <th scope="col" className="px-6 py-4 font-medium text-left">Guest ID</th>
                <th scope="col" className="px-6 py-4 font-medium text-left">Full name</th>
                <th scope="col" className="px-6 py-4 font-medium text-left">Email</th>
                <th scope="col" className="px-6 py-4 font-medium text-left">Check-in</th>
                <th scope="col" className="px-6 py-4 font-medium text-left">Check-out</th>
                <th scope="col" className="px-6 py-4 font-medium text-left">Stay status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {!isLoading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-[var(--color-text-secondary)]">No guests found. Register a guest to get started.</td>
                </tr>
              )}

              {paginatedRows.map((row) => (
                <tr key={row.id} className="cursor-pointer transition-colors hover:bg-surface-secondary/50" onClick={() => router.push(`/guests/${row.id}`)}>
                  <td className="px-6 py-4 text-sm text-[var(--color-text-primary)]">
                    {row.imagePath ? (
                      <img src={row.imagePath} alt={`${row.firstName} ${row.lastName}`} className="h-12 w-12 rounded-full border border-border object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-secondary text-xs font-semibold text-[var(--color-text-secondary)]">{(row.firstName?.[0] ?? '') + (row.lastName?.[0] ?? '')}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-[var(--color-primary)]">{row.guestId}</td>
                  <td className="px-6 py-4 text-sm text-[var(--color-text-primary)]">{row.firstName} {row.lastName}</td>
                  <td className="px-6 py-4 text-sm text-[var(--color-text-primary)]">{row.email ?? '-'}</td>
                  <td className="px-6 py-4 text-sm text-[var(--color-text-primary)]">{formatDate(row.checkIn)}</td>
                  <td className="px-6 py-4 text-sm text-[var(--color-text-primary)]">{formatDate(row.checkOut)}</td>
                  <td className="px-6 py-4 text-sm text-[var(--color-text-primary)]"><StatusBadge status={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </LabeledTable>
        </div>
        {!isLoading && filteredRows.length > PAGE_SIZE ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            <span>Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                Previous
              </button>
              <button type="button" className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <AddGuestModal isOpen={isRegisterOpen} onClose={() => setIsRegisterOpen(false)} onSaved={async () => { await mutate(); }} />
    </div>
  );
}

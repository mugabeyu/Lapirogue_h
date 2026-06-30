'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { SearchIcon, ShieldAlert, ShieldBan, Snowflake } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import Button from '@/components/ui/Button';
import { useApi } from '@/hooks/useApi';
import { AddGuestModal } from '@/components/modals/AddGuestModal';
import { LabeledTable } from '@/components/ui/LabeledTable';
import { GuestNameCell } from '@/components/ui/GuestNameCell';
import { Guest, User } from '@/types';

function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function AccountStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { label: string; className: string; icon?: React.ReactNode }> = {
    ACTIVE: { label: 'Active', className: 'bg-emerald-100 text-emerald-800' },
    PENDING: { label: 'Pending', className: 'bg-amber-100 text-amber-800' },
    FROZEN: { label: 'Frozen', className: 'bg-blue-100 text-blue-800', icon: <Snowflake className="h-3 w-3" /> },
    BANNED: { label: 'Banned', className: 'bg-red-100 text-red-800', icon: <ShieldBan className="h-3 w-3" /> },
  };
  const s = styles[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}>
      {s.icon}{s.label}
    </span>
  );
}

export default function GuestsPage() {
  const PAGE_SIZE = 15;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    if (urlSearch) setSearch(urlSearch);
  }, [searchParams]);

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const { data: currentUser } = useApi<User>('/api/auth/me');

  const url = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '100');
    if (search.trim()) params.set('search', search.trim());
    return `/api/guests?${params.toString()}`;
  }, [search]);

  const { data, mutate } = useApi<Guest[]>(url);
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

  const isManager = currentUser?.role === 'MANAGER';
  const canRegister = currentUser?.role === 'RECEPTIONIST' || currentUser?.role === 'MANAGER';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Guests"
        subtitle={isManager ? 'Manage guest accounts and account statuses.' : 'Manage current, upcoming, and past guests.'}
        action={
          canRegister ? (
            <Button variant="primary" onClick={() => setIsRegisterOpen(true)}>
              Register Guest
            </Button>
          ) : undefined
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

        <div className="table-wrap">
          <LabeledTable
            caption="Registered guests"
            footer={
              `Showing ${filteredRows.length === 0 ? 0 : start + 1}-${Math.min(start + PAGE_SIZE, filteredRows.length)} of ${filteredRows.length} ${filteredRows.length === 1 ? 'guest' : 'guests'}`
            }>

            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                <th scope="col" className="px-6 py-4 font-medium">Guest</th>
                <th scope="col" className="border-l border-border px-6 py-4 font-medium">Guest ID</th>
                <th scope="col" className="border-l border-border px-6 py-4 font-medium">Email</th>
                <th scope="col" className="border-l border-border px-6 py-4 font-medium">Check-in</th>
                <th scope="col" className="border-l border-border px-6 py-4 font-medium">Check-out</th>
                <th scope="col" className="border-l border-border px-6 py-4 font-medium">Stay status</th>
                {isManager && (
                  <th scope="col" className="border-l border-border px-6 py-4 font-medium">Account</th>
                )}
              </tr>
            </thead>

            <tbody>
              { filteredRows.length === 0 && (
                <tr className="border-b border-border">
                  <td colSpan={isManager ? 7 : 6} className="px-6 py-12 text-center text-sm text-[var(--color-text-secondary)]">No guests found. Register a guest to get started.</td>
                </tr>
              )}

              {paginatedRows.map((row) => (
                <tr key={row.id} className="border-b border-border cursor-pointer transition-colors hover:bg-surface-secondary/50" onClick={() => router.push(`/guests/${row.id}`)}>
                  <td className="px-6 py-4 text-sm text-[var(--color-text-primary)]">
                    <GuestNameCell
                      name={`${row.firstName} ${row.lastName}`.trim()}
                      imageUrl={row.imagePath}
                      className="min-w-0"
                    />
                  </td>
                  <td className="border-l border-border px-6 py-4 text-sm font-medium text-[var(--color-primary)]">{row.guestId}</td>
                  <td className="border-l border-border px-6 py-4 text-sm text-[var(--color-text-primary)]">{row.email ?? '-'}</td>
                  <td className="border-l border-border px-6 py-4 text-sm text-[var(--color-text-primary)]">{formatDate(row.checkIn)}</td>
                  <td className="border-l border-border px-6 py-4 text-sm text-[var(--color-text-primary)]">{formatDate(row.checkOut)}</td>
                  <td className="border-l border-border px-6 py-4 text-sm text-[var(--color-text-primary)]"><StatusBadge status={row.status} /></td>
                  {isManager && (
                    <td className="border-l border-border px-6 py-4 text-sm text-[var(--color-text-primary)]">
                      <AccountStatusBadge status={row.accountStatus} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </LabeledTable>
        </div>
        {filteredRows.length > PAGE_SIZE ? (
          <div className="table-footer">
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

'use client';

import { BellIcon, MenuIcon, PlusIcon, UserIcon, UsersIcon } from 'lucide-react';

import { User } from '@/types';
import { useSidebar } from '@/contexts/SidebarContext';
import useSWR from 'swr';
import { AddGuestModal } from '@/components/modals/AddGuestModal';
import { useState } from 'react';
import Link from 'next/link';


function formatRole(role?: string) {
  if (!role) return '';
  if (role === 'MAIN_RECEPTIONIST') return 'Main Receptionist';
  if (role === 'RECEPTIONIST') return 'Receptionist';
  return role
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function formatTodayLabel(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).formatToParts(date);

  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const year = parts.find((part) => part.type === 'year')?.value ?? '';

  return `${weekday}, ${day} ${month} ${year}`;
}

async function fetcher(url: string) {
  const response = await fetch(url, { credentials: 'include' });
  return response.json();
}

export default function Topbar() {
  const { data: apiResponse } = useSWR<{ success: boolean; data: User }>('/api/auth/me', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000,
  });
  const user = apiResponse?.data;
  const { collapsed, toggle } = useSidebar();
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);

  const displayName = user?.name?.trim() || '';
  const displayRole = formatRole(user?.role);
  const todayLabel = formatTodayLabel(new Date());
  const avatarUrl = user?.avatarUrl?.trim() || '';
  const avatarLabel = displayName || '';
  const avatarInitials = avatarLabel
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);

  return (
    <header className="border-b border-card-border bg-surface px-6 lg:px-8">
      <div className="flex min-h-20 items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggle}
            className="flex items-center justify-center rounded-xl p-2 hover:bg-surface-secondary transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <MenuIcon className="h-5 w-5 text-icon-body" strokeWidth={1.5} />
          </button>
          <div className="hidden sm:flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <span>{todayLabel}</span>
          </div>
        </div>

        <nav className="flex items-center gap-3">
          <Link
            href="/reservations/new"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-button-primary)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-button-primary-hover)] active:bg-[var(--color-button-primary-active)]"
          >
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Add Reservation</span>
          </Link>
          <button
            type="button"
            onClick={() => setIsGuestModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-button-primary)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--color-button-primary)] transition-colors hover:bg-[var(--color-button-primary)]/10 active:bg-[var(--color-button-primary)]/20"
          >
            <UsersIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Register Guest</span>
          </button>
        </nav>

        <div className="flex items-center gap-4">
          <button className="relative rounded-xl p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-surface-secondary hover:text-[var(--color-nav-active)]">
            <BellIcon className="h-5 w-5 text-icon-body" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--color-button-primary)]"></span>
          </button>
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-card-border bg-surface-secondary text-base font-semibold text-[var(--color-text-primary)]">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName || ''} className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden="true">{avatarInitials || <UserIcon className="h-5 w-5 text-icon-body" />}</span>
            )}
          </div>
          <div className="hidden sm:block">
            {displayName && <div className="text-sm font-medium leading-tight text-[var(--color-text-primary)]">{displayName}</div>}
            {displayRole && <div className="text-xs text-[var(--color-text-secondary)]">{displayRole}</div>}
          </div>
        </div>
      </div>
      <AddGuestModal isOpen={isGuestModalOpen} onClose={() => setIsGuestModalOpen(false)} />
    </header>
  );
}
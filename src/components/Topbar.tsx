'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BellIcon, CalendarDaysIcon, SearchIcon, UserIcon } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { User } from '@/types';

function formatRole(role?: string) {
  if (!role) return '';
  if (role === 'MAIN_RECEPTIONIST') return 'Main receptionist';
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

export default function Topbar() {
  const router = useRouter();
  const { data: user } = useApi<User>('/api/auth/me');
  const [searchValue, setSearchValue] = useState('');

  const handleSearch = () => {
    const query = searchValue.trim();
    if (!query) return;
    // Navigate to guests page with search query
    router.push(`/guests?search=${encodeURIComponent(query)}`);
    setSearchValue('');
  };

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
    <header className="border-b border-border bg-surface px-6 lg:px-8">
      <div className="flex min-h-20 flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl flex-1">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
            <input
              type="text"
              placeholder="Search guests, rooms, reservations..."
              className="input-field w-full pl-10 text-sm"
              aria-label="Search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleSearch();
                }
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 lg:justify-end">
          <div className="hidden items-center gap-2 text-sm text-[var(--color-text-secondary)] sm:flex">
            <CalendarDaysIcon className="h-4 w-4" />
            <span>{todayLabel}</span>
          </div>

          

          <div className="flex items-center gap-3 border-l border-border pl-4">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[rgba(11,93,87,0.08)] bg-[rgba(11,93,87,0.04)] text-sm font-semibold text-[var(--color-primary)] shadow-sm">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName || ''} className="h-full w-full object-cover" />
              ) : (
                <span aria-hidden="true">{avatarInitials || <UserIcon className="h-5 w-5" />}</span>
              )}
            </div>
            <div className="hidden sm:block">
              {displayName ? <div className="text-base font-semibold leading-tight text-[var(--color-text-primary)]">{displayName}</div> : null}
              {displayRole ? <div className="text-xs tracking-wide text-[var(--color-text-secondary)]">{displayRole}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

'use client';

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
  const { data: user } = useApi<User>('/api/auth/me');
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
    <header className="border-b border-sand-200 bg-white/95 px-8 backdrop-blur-sm">
      <div className="flex min-h-20 flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl flex-1">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input
              type="text"
              placeholder="Search guests, rooms, reservations..."
              className="input-field w-full pl-10 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 lg:justify-end">
          <div className="hidden items-center gap-2 text-sm text-ink-600 sm:flex">
            <CalendarDaysIcon className="h-4 w-4" />
            <span>{todayLabel}</span>
          </div>

          <button className="relative rounded-lg p-2 text-ink-600 transition-colors hover:bg-sand-100 hover:text-primary">
            <BellIcon className="h-5 w-5" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent"></span>
          </button>

          <div className="flex items-center gap-3 border-l border-sand-200 pl-4">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-primary/10 bg-primary/10 text-sm font-semibold text-primary shadow-sm">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName || ''} className="h-full w-full object-cover" />
              ) : (
                <span aria-hidden="true">{avatarInitials || <UserIcon className="h-5 w-5" />}</span>
              )}
            </div>
            <div className="hidden sm:block text-slate-700">
              {displayName ? <div className="text-base font-semibold leading-tight text-ink-900">{displayName}</div> : null}
              {displayRole ? <div className="text-xs tracking-wide text-ink-500">{displayRole}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

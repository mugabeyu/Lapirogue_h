'use client';

import { BellIcon, CalendarDaysIcon, SearchIcon, UserIcon } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { User } from '@/types';

function formatRole(role?: string) {
  if (role === 'RECEPTIONIST') return 'Receptionist';
  return 'Receptionist';
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
          <div className="mt-2 flex items-center gap-2 text-xs text-ink-500">
            <CalendarDaysIcon className="w-4 h-4" />
            <span>{todayLabel}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 lg:justify-end">
          <button className="relative rounded-lg p-2 text-ink-600 transition-colors hover:bg-sand-100 hover:text-primary">
            <BellIcon className="h-5 w-5" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent"></span>
          </button>

          <div className="flex items-center gap-3 border-l border-sand-200 pl-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
              <UserIcon className="h-5 w-5" />
            </div>
            <div className="hidden sm:block">
              {displayName ? <div className="text-sm font-medium text-ink-900">{displayName}</div> : null}
              {displayRole ? <div className="text-xs text-ink-600">{displayRole}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

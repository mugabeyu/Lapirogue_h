'use client';

import { useRouter } from 'next/navigation';
import { BellIcon, UserIcon } from 'lucide-react';
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
      
      <div className="flex min-h-20 items-center justify-between py-4">
        
        <div className="hidden items-center gap-2 text-sm text-[var(--color-text-secondary)] sm:flex">
          <span>{todayLabel}</span>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-secondary text-base font-semibold text-[var(--color-text-primary)] shadow-sm">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName || ''} className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden="true">{avatarInitials || <UserIcon className="h-6 w-6" />}</span>
            )}
          </div>
          <div className="hidden sm:block">
            {displayName ? <div className="text-base leading-tight text-[var(--color-text-primary)]">{displayName}</div> : null}
            {displayRole ? <div className="text-xs tracking-wide text-[var(--color-text-secondary)]">{displayRole}</div> : null}
          </div>
        </div>
      </div>
    </header>
  );
}

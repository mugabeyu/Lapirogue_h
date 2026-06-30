'use client';

import { BellIcon, CalendarIcon, MenuIcon, UserIcon, UsersIcon } from 'lucide-react';

import { User } from '@/types';
import { useSidebar } from '@/contexts/SidebarContext';
import useSWR from 'swr';
import { AddGuestModal } from '@/components/modals/AddGuestModal';
import { GuestNameCell } from '@/components/ui/GuestNameCell';
import { useMemo, useState } from 'react';
import Link from 'next/link';


function formatRole(role?: string) {
  if (!role) return '';
  if (role === 'ADMIN') return 'Administrator';
  if (role === 'MANAGER') return 'Manager';
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

type MessageRow = {
  id: string;
  guestId: string;
  guestName?: string | null;
  guestImagePath?: string | null;
  senderType: 'guest' | 'staff' | 'admin' | 'receptionist';
  content: string;
  isRead: boolean;
  createdAt: string;
};

function formatNotificationTime(value: string) {
  const created = new Date(value).getTime();
  if (Number.isNaN(created)) return '';

  const diffMs = Date.now() - created;
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < minuteMs) return 'now';
  if (diffMs < hourMs) return `${Math.floor(diffMs / minuteMs)}m`;
  if (diffMs < dayMs) return `${Math.floor(diffMs / hourMs)}h`;

  return new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric' }).format(new Date(value));
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
  const { data: messagesResponse } = useSWR<{ success: boolean; data: MessageRow[] }>('/api/messages', fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 10000,
  });
  const { collapsed, toggle } = useSidebar();
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const isAdmin = user?.role === 'ADMIN';
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

  const incomingMessages = useMemo(
    () =>
      (messagesResponse?.success ? messagesResponse.data : [])
        .filter((message) => message.senderType === 'guest' && !message.isRead)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [messagesResponse],
  );

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

        {!isAdmin && (
          <nav className="flex items-center gap-3">
            <Link
              href="/schedule"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-button-primary)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-button-primary-hover)] active:bg-[var(--color-button-primary-active)]"
            >
              <CalendarIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Daily Schedules</span>
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
        )}

        <div className="flex items-center gap-4">
          {!isAdmin && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationsOpen((current) => !current)}
                className="relative rounded-xl p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-surface-secondary hover:text-[var(--color-nav-active)]"
                aria-haspopup="menu"
                aria-expanded={isNotificationsOpen}
              >
                <BellIcon className="h-5 w-5 text-icon-body" />
                {incomingMessages.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-button-primary)] px-1 text-[10px] font-semibold text-[var(--color-text-primary)]">
                    {incomingMessages.length > 99 ? '99+' : incomingMessages.length}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 z-50 mt-3 w-[min(92vw,420px)] rounded-2xl border border-card-border bg-surface shadow-xl">
                  <div className="flex items-center justify-between border-b border-card-border px-4 py-3">
                    <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Incoming messages</h2>
                    <span className="rounded-full bg-[var(--color-button-primary)]/10 px-2 py-1 text-xs font-semibold text-[var(--color-button-primary)]">
                      {incomingMessages.length}
                    </span>
                  </div>

                  <div className="max-h-[min(70vh,560px)] overflow-y-auto p-2">
                    {incomingMessages.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">No new messages</div>
                    ) : (
                      incomingMessages.map((message) => (
                        <Link
                          key={message.id}
                          href={`/messages?guestId=${message.guestId}`}
                          onClick={() => setIsNotificationsOpen(false)}
                          className="group flex gap-3 rounded-xl p-3 transition-colors hover:bg-surface-secondary"
                        >
                          <GuestNameCell name={message.guestName ?? message.guestId} imageUrl={message.guestImagePath} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                                {message.guestName ?? message.guestId}
                              </p>
                              <time className="shrink-0 text-xs text-[var(--color-text-secondary)]">
                                {formatNotificationTime(message.createdAt)}
                              </time>
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm text-[var(--color-text-secondary)]">{message.content}</p>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>

                  <Link
                    href="/messages?tab=unread"
                    onClick={() => setIsNotificationsOpen(false)}
                    className="block border-t border-card-border px-4 py-3 text-center text-sm font-medium text-[var(--color-button-primary)] transition-colors hover:bg-surface-secondary"
                  >
                    View all unread
                  </Link>
                </div>
              )}
            </div>
          )}
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
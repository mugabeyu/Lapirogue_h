'use client';

import { useEffect, useMemo, useState } from 'react';
import { BellIcon } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { PageHeader } from '@/components/PageHeader';

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  category?: string | null;
  status: 'READ' | 'UNREAD';
  createdAt: string;
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationsPage() {
  const PAGE_SIZE = 15;
  const { data, isLoading, mutate } = useApi<NotificationRow[]>('/api/notifications');
  const [page, setPage] = useState(1);

  const notifications = useMemo(
    () =>
      [...(data ?? [])].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    [data],
  );
  const unreadCount = notifications.filter((notification) => notification.status === 'UNREAD').length;
  const totalPages = Math.max(1, Math.ceil(notifications.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const paginatedNotifications = notifications.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function markRead(id: string) {
    await fetch(`/api/notifications?id=${id}`, { method: 'PATCH', credentials: 'include' });
    mutate();
  }

  async function markAllRead() {
    await fetch('/api/notifications?all=true', { method: 'PATCH', credentials: 'include' });
    mutate();
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Notifications"
        subtitle="Hotel notifications and operational updates."
        action={
          unreadCount > 0 ? (
            <button type="button" onClick={markAllRead} className="btn-secondary text-sm">
              Mark all read
            </button>
          ) : undefined
        }
      />

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-[var(--color-text-secondary)]">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center text-[var(--color-text-secondary)]">
            <BellIcon className="h-8 w-8" strokeWidth={1.5} />
            <p className="text-sm">No notifications yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {paginatedNotifications.map((notification) => (
              <li
                key={notification.id}
                className={`flex items-start gap-4 px-5 py-4 ${notification.status === 'UNREAD' ? 'bg-primary/5' : ''}`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-button-primary)]/10 text-[var(--color-button-primary)]">
                  <BellIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{notification.title}</p>
                    <time className="shrink-0 text-xs text-[var(--color-text-secondary)]">
                      {formatTimestamp(notification.createdAt)}
                    </time>
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{notification.message}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {notification.category && (
                      <span className="inline-flex rounded-full bg-surface-secondary px-2 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                        {notification.category}
                      </span>
                    )}
                    {notification.status === 'UNREAD' && (
                      <button
                        type="button"
                        onClick={() => markRead(notification.id)}
                        className="text-[11px] font-semibold text-[var(--color-button-primary)] hover:underline"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {notifications.length > PAGE_SIZE ? (
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
    </div>
  );
}

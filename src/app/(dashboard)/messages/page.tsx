'use client';

import { FormEvent, useState } from 'react';
import ProtectedPage from '@/components/ProtectedPage';
import { useApi, useApiMutation } from '@/hooks/useApi';
import { StatusBadge } from '@/components/StatusBadge';

type MessageRow = {
  id: string;
  guestId: string;
  guestName?: string;
  messageType: 'guest' | 'admin';
  subject?: string | null;
  content: string;
  attachmentUrl?: string | null;
  isRead: boolean;
  createdAt: string;
};

export default function MessagesPage() {
  const { data, mutate, isLoading } = useApi<MessageRow[]>('/api/messages');
  const { mutate: sendMessage } = useApiMutation('/api/messages');
  const [isSending, setIsSending] = useState(false);
  const [form, setForm] = useState({
    guestId: '',
    subject: '',
    content: '',
  });

  const rows = data ?? [];

  const unreadCount = rows.filter((row) => !row.isRead).length;

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSending(true);

    await sendMessage({
      guestId: form.guestId,
      messageType: 'admin',
      subject: form.subject,
      content: form.content,
    });

    setIsSending(false);
    setForm({ guestId: '', subject: '', content: '' });
    mutate();
  }

  async function markAsRead(id: string) {
    await fetch(`/api/messages?id=${id}`, { method: 'PATCH' });
    mutate();
  }

  return (
    <ProtectedPage>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="card p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-2xl text-ink-900">Messages</h1>
              <p className="text-ink-600 mt-1">Guest and admin chat synced with the mobile app.</p>
            </div>
            <div className="text-sm text-ink-600">Unread: {unreadCount}</div>
          </div>

          <form onSubmit={handleSend} className="mt-6 grid gap-4 lg:grid-cols-4">
            <input
              className="input-field lg:col-span-1"
              placeholder="Guest ID"
              value={form.guestId}
              onChange={(event) => setForm({ ...form, guestId: event.target.value })}
              required
            />
            <input
              className="input-field lg:col-span-1"
              placeholder="Subject"
              value={form.subject}
              onChange={(event) => setForm({ ...form, subject: event.target.value })}
            />
            <input
              className="input-field lg:col-span-1"
              placeholder="Message"
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
              required
            />
            <button type="submit" disabled={isSending} className="btn-primary lg:col-span-1 disabled:opacity-50">
              {isSending ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>

        <div className="card overflow-hidden">
          <div className="p-4 border-b border-sand-200 bg-white flex items-center justify-between">
            <div className="font-semibold">Inbox</div>
            <button type="button" className="btn-secondary" onClick={() => mutate()}>
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-sand-50 border-b border-sand-200 text-xs uppercase tracking-wider text-ink-600">
                  <th className="px-6 py-4 font-medium">Guest</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Subject</th>
                  <th className="px-6 py-4 font-medium">Content</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Created</th>
                  <th className="px-6 py-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {isLoading ? (
                  <tr>
                    <td className="px-6 py-6 text-ink-600" colSpan={7}>
                      Loading messages...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-6 text-ink-600" colSpan={7}>
                      No messages available.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="hover:bg-sand-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-ink-700">{row.guestName || row.guestId}</td>
                      <td className="px-6 py-4 text-sm text-ink-700">{row.messageType}</td>
                      <td className="px-6 py-4 text-sm text-ink-700">{row.subject || '-'}</td>
                      <td className="px-6 py-4 text-sm text-ink-700 max-w-lg truncate">{row.content}</td>
                      <td className="px-6 py-4 text-sm text-ink-700">
                        <StatusBadge status={row.isRead ? 'READ' : 'UNREAD'} />
                      </td>
                      <td className="px-6 py-4 text-sm text-ink-700">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-ink-700">
                        {!row.isRead ? (
                          <button type="button" className="btn-secondary" onClick={() => markAsRead(row.id)}>
                            Mark read
                          </button>
                        ) : (
                          <span className="text-ink-500">Done</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ProtectedPage>
  );
}
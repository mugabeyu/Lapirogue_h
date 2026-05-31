'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { MessageSquareIcon, RefreshCwIcon, SearchIcon, SendIcon, ShieldIcon } from 'lucide-react';
import { useApi, useApiMutation } from '@/hooks/useApi';
import { PageHeader } from '@/components/PageHeader';
import { toast } from 'sonner';

type MessageRow = {
  id: string;
  guestId: string;
  guestName?: string;
  messageType: 'guest' | 'receptionist';
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
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    guestId: '',
    subject: '',
    content: '',
  });

  const rows = useMemo(() => data ?? [], [data]);
  const unreadCount = rows.filter((row) => !row.isRead).length;

  const conversations = useMemo(() => {
    const map = new Map<
      string,
      { guestId: string; guestName: string; lastMessage: MessageRow; unreadCount: number; messages: MessageRow[] }
    >();

    rows.forEach((row) => {
      const current = map.get(row.guestId);
      if (current) {
        current.messages.push(row);
        current.unreadCount += row.isRead ? 0 : 1;

        if (new Date(row.createdAt).getTime() > new Date(current.lastMessage.createdAt).getTime()) {
          current.lastMessage = row;
          current.guestName = row.guestName || current.guestName;
        }

        return;
      }

      map.set(row.guestId, {
        guestId: row.guestId,
        guestName: row.guestName || row.guestId,
        lastMessage: row,
        unreadCount: row.isRead ? 0 : 1,
        messages: [row],
      });
    });

    return [...map.values()].sort(
      (left, right) => new Date(right.lastMessage.createdAt).getTime() - new Date(left.lastMessage.createdAt).getTime(),
    );
  }, [rows]);

  const visibleConversations = conversations.filter((conversation) => {
    const haystack = `${conversation.guestName} ${conversation.guestId} ${conversation.lastMessage.content}`.toLowerCase();
    return haystack.includes(searchTerm.toLowerCase());
  });

  const selectedConversation =
    conversations.find((conversation) => conversation.guestId === selectedGuestId) ?? conversations[0] ?? null;
  const selectedMessages = selectedConversation?.messages ?? [];

  useEffect(() => {
    if (!selectedGuestId && conversations[0]) {
      setSelectedGuestId(conversations[0].guestId);
      setForm((current) => ({ ...current, guestId: conversations[0].guestId }));
    }
  }, [conversations, selectedGuestId]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const guestId = form.guestId || selectedGuestId;

    if (!guestId) {
      toast.error('Select a conversation or enter a guest ID first.');
      return;
    }

    setIsSending(true);

    await sendMessage({
      guestId,
      messageType: 'receptionist',
      subject: form.subject,
      content: form.content,
    });

    setIsSending(false);
    setForm((current) => ({
      guestId: current.guestId || selectedGuestId,
      subject: '',
      content: '',
    }));
    mutate();
  }

  async function markAllAsRead() {
    await fetch('/api/messages?all=true', { method: 'PATCH' });
    mutate();
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Messages"
        subtitle="WhatsApp-style guest chat synced with Supabase."
        action={
          <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => mutate()}>
            <RefreshCwIcon className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <aside className="card overflow-hidden">
          <div className="border-b border-border bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-[var(--color-text-secondary)]">Inbox</div>
                <div className="mt-1 font-display text-2xl text-[var(--color-text-primary)]">{unreadCount} unread</div>
              </div>
              <button
                type="button"
                className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                onClick={markAllAsRead}
              >
                Mark all read
              </button>
            </div>

            <div className="relative mt-4">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-secondary)]" />
              <input
                className="input-field w-full pl-10"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>

          <div className="max-h-[720px] overflow-y-auto">
            {isLoading ? (
              <div className="p-5 text-sm text-[var(--color-text-secondary)]">Loading messages...</div>
            ) : visibleConversations.length === 0 ? (
              <div className="p-5 text-sm text-[var(--color-text-secondary)]">No messages available.</div>
            ) : (
              visibleConversations.map((conversation) => {
                const selected = conversation.guestId === selectedGuestId;
                const lastMessagePreview = conversation.lastMessage.content.slice(0, 70);
                const initials = conversation.guestName
                  .split(' ')
                  .map((part) => part.charAt(0))
                  .slice(0, 2)
                  .join('');

                return (
                  <button
                    key={conversation.guestId}
                    type="button"
                    onClick={() => {
                      setSelectedGuestId(conversation.guestId);
                      setForm((current) => ({ ...current, guestId: conversation.guestId }));
                    }}
                    className={`flex w-full items-start gap-3 border-b border-border px-5 py-4 text-left transition-colors ${selected ? 'bg-primary/5' : 'hover:bg-surface-secondary'}`}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                      {initials || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate font-medium text-[var(--color-text-primary)]">{conversation.guestName}</div>
                          <span className="text-[11px] text-[var(--color-text-secondary)]">
                          {new Date(conversation.lastMessage.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <p className="truncate text-sm text-[var(--color-text-secondary)]">{lastMessagePreview}</p>
                        {conversation.unreadCount > 0 ? (
                          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">
                            {conversation.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="card flex min-h-[760px] flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-4">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[var(--color-text-secondary)]">
                <ShieldIcon className="h-3.5 w-3.5" />
                Secure chat
              </div>
              <div className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">
                {selectedConversation ? selectedConversation.guestName : 'Select a conversation'}
              </div>
              <div className="text-sm text-[var(--color-text-secondary)]">
                {selectedConversation ? `Guest ID ${selectedConversation.guestId}` : 'Choose a guest to continue the conversation.'}
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-surface-secondary px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
              <MessageSquareIcon className="h-4 w-4" />
              {rows.length} total messages
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f8f5ef_0%,#fffdf8_100%)] p-5">
            {!selectedConversation ? (
              <div className="flex h-full min-h-[420px] items-center justify-center text-center text-[var(--color-text-secondary)]">
                Pick a guest from the inbox to view the thread.
              </div>
            ) : (
              <div className="space-y-4">
                {selectedMessages.map((message) => {
                  const isReceptionist = message.messageType === 'receptionist';

                  return (
                    <div key={message.id} className={`flex ${isReceptionist ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[82%] rounded-[24px] px-4 py-3 shadow-sm ${isReceptionist ? 'rounded-br-md bg-primary text-white' : 'rounded-bl-md bg-surface text-[var(--color-text-primary)]'}`}>
                        {message.subject ? (
                          <div className={`mb-1 text-xs uppercase tracking-[0.2em] ${isReceptionist ? 'text-white/65' : 'text-[var(--color-text-secondary)]'}`}>
                            {message.subject}
                          </div>
                        ) : null}
                        <p className="text-sm leading-6">{message.content}</p>
                        <div className={`mt-2 text-[11px] ${isReceptionist ? 'text-white/65' : 'text-[var(--color-text-secondary)]'}`}>
                          {new Date(message.createdAt).toLocaleString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="border-t border-border bg-surface p-5">
            <div className="grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
              <input
                className="input-field"
                placeholder="Guest ID"
                value={form.guestId || selectedGuestId}
                onChange={(event) => setForm({ ...form, guestId: event.target.value })}
              />
              <input
                className="input-field"
                placeholder="Subject (optional)"
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
              />
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <textarea
                className="input-field min-h-28 flex-1 resize-none"
                placeholder="Type a message to the guest..."
                value={form.content}
                onChange={(event) => setForm({ ...form, content: event.target.value })}
                required
              />
              <button type="submit" disabled={isSending} className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-50 sm:min-w-36">
                <SendIcon className="h-4 w-4" />
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

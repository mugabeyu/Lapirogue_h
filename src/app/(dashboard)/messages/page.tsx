'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCheckIcon, MessageSquareIcon, RefreshCwIcon, SearchIcon, SendIcon } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { PageHeader } from '@/components/PageHeader';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { toast } from 'sonner';
import { Guest } from '@/types';

type MessageRow = {
  id: string;
  guestId: string;
  guestName?: string;
  messageType: 'guest' | 'receptionist' | 'admin';
  subject?: string | null;
  content: string;
  attachmentUrl?: string | null;
  isRead: boolean;
  createdAt: string;
};

type ConversationSummary = {
  guestId: string;
  guestName: string;
  lastMessage: MessageRow;
  unreadCount: number;
  messages: MessageRow[];
};

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDayTime(value: string) {
  return new Date(value).toLocaleString([], {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MessagesPage() {
  const { data, mutate, isLoading } = useApi<MessageRow[]>('/api/messages');
  const { data: guestsData } = useApi<Guest[]>('/api/guests?limit=100');
  const [isSending, setIsSending] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [draft, setDraft] = useState('');

  const rows = useMemo(() => data ?? [], [data]);
  const guests = useMemo(() => guestsData ?? [], [guestsData]);
  const unreadCount = rows.filter((row) => row.messageType === 'guest' && !row.isRead).length;

  const conversations = useMemo<ConversationSummary[]>(() => {
    const map = new Map<
      string,
      { guestId: string; guestName: string; lastMessage: MessageRow; unreadCount: number; messages: MessageRow[] }
    >();

    rows.forEach((row) => {
      const current = map.get(row.guestId);
      if (current) {
        current.messages.push(row);
        if (row.messageType === 'guest' && !row.isRead) {
          current.unreadCount += 1;
        }

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
        unreadCount: row.messageType === 'guest' && !row.isRead ? 1 : 0,
        messages: [row],
      });
    });

    return [...map.values()]
      .map((conversation) => ({
        ...conversation,
        messages: [...conversation.messages].sort(
          (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
        ),
      }))
      .sort(
      (left, right) => new Date(right.lastMessage.createdAt).getTime() - new Date(left.lastMessage.createdAt).getTime(),
      );
  }, [rows]);

  const visibleConversations = conversations.filter((conversation) => {
    const haystack = `${conversation.guestName} ${conversation.guestId} ${conversation.lastMessage.content}`.toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.toLowerCase());
    const matchesTab = tab === 'all' ? true : conversation.unreadCount > 0;
    return matchesSearch && matchesTab;
  });

  const conversationGuestIds = useMemo(() => new Set(conversations.map((conversation) => conversation.guestId)), [conversations]);

  const searchableGuests = useMemo(() => {
    if (tab === 'unread') return [];
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return guests
      .filter((guest) => !conversationGuestIds.has(guest.id))
      .filter((guest) => {
        if (!normalizedSearch) return true;
        const guestName = `${guest.firstName} ${guest.lastName}`.trim().toLowerCase();
        const haystack = `${guestName} ${guest.guestId} ${guest.email ?? ''} ${guest.phone ?? ''}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .map((guest) => ({
        id: guest.id,
        name: `${guest.firstName} ${guest.lastName}`.trim() || guest.guestId,
      }));
  }, [conversationGuestIds, guests, searchTerm, tab]);

  const selectedConversation =
    conversations.find((conversation) => conversation.guestId === selectedGuestId) ?? conversations[0] ?? null;
  const selectedGuest = guests.find((guest) => guest.id === selectedGuestId) ?? null;
  const selectedMessages = selectedConversation?.messages ?? [];

  useEffect(() => {
    if (!selectedGuestId) {
      if (conversations[0]) {
        setSelectedGuestId(conversations[0].guestId);
        return;
      }

      if (guests[0]) {
        setSelectedGuestId(guests[0].id);
      }
    }
  }, [conversations, guests, selectedGuestId]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel('messages-realtime-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        mutate();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mutate]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      mutate();
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [mutate]);

  useEffect(() => {
    if (!selectedConversation) return;
    if (selectedConversation.unreadCount === 0) return;

    fetch(`/api/messages?guestId=${selectedConversation.guestId}`, { method: 'PATCH' })
      .then(() => mutate())
      .catch(() => null);
  }, [mutate, selectedConversation]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const guestId = selectedGuestId;

    if (!guestId || !draft.trim()) {
      toast.error('Select a conversation and enter a message first.');
      return;
    }

    setIsSending(true);

    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestId,
        messageType: 'admin',
        content: draft.trim(),
      }),
    });

    setIsSending(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast.error(payload.error || 'Failed to send message');
      return;
    }

    setDraft('');
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
        subtitle="Real-time admin and guest messaging."
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
            <div className="flex items-center justify-between gap-3 pb-4">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-[var(--color-text-secondary)]">Messages</div>
                <div className="mt-1 font-display text-2xl text-[var(--color-text-primary)]">{rows.length}</div>
              </div>
              <button
                type="button"
                className="rounded-xl border border-border bg-surface-secondary px-3 py-1 text-xs font-medium text-[var(--color-text-primary)]"
                onClick={markAllAsRead}
              >
                Mark all read
              </button>
            </div>

            <div className="mb-4 inline-flex rounded-xl bg-surface-secondary p-1 text-sm">
              <button
                type="button"
                onClick={() => setTab('all')}
                className={`rounded-lg px-3 py-1.5 ${tab === 'all' ? 'bg-surface text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-secondary)]'}`}
              >
                All ({conversations.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('unread')}
                className={`rounded-lg px-3 py-1.5 ${tab === 'unread' ? 'bg-surface text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-secondary)]'}`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            <div className="relative">
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
              ) : visibleConversations.length === 0 && searchableGuests.length === 0 ? (
                <div className="p-5 text-sm text-[var(--color-text-secondary)]">No messages or guests found.</div>
            ) : (
                <>
                  {visibleConversations.map((conversation) => {
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
                        }}
                        className={`flex w-full items-start gap-3 border-b border-border px-5 py-4 text-left transition-colors ${selected ? 'bg-primary/5' : 'hover:bg-surface-secondary'}`}
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-secondary text-sm font-semibold text-[var(--color-text-primary)]">
                          {initials || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="truncate font-medium text-[var(--color-text-primary)]">{conversation.guestName}</div>
                            <span className="text-[11px] text-[var(--color-text-secondary)]">{formatTime(conversation.lastMessage.createdAt)}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-3">
                            <p className="truncate text-sm text-[var(--color-text-secondary)]">{lastMessagePreview}</p>
                            {conversation.unreadCount > 0 ? (
                              <span className="rounded-xl border border-border bg-surface-secondary px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-primary)]">
                                {conversation.unreadCount}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {searchableGuests.map((guest) => {
                    const selected = guest.id === selectedGuestId;
                    const initials = guest.name
                      .split(' ')
                      .map((part) => part.charAt(0))
                      .slice(0, 2)
                      .join('');

                    return (
                      <button
                        key={guest.id}
                        type="button"
                        onClick={() => setSelectedGuestId(guest.id)}
                        className={`flex w-full items-start gap-3 border-b border-border px-5 py-4 text-left transition-colors ${selected ? 'bg-primary/5' : 'hover:bg-surface-secondary'}`}
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-secondary text-sm font-semibold text-[var(--color-text-primary)]">
                          {initials || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="truncate font-medium text-[var(--color-text-primary)]">{guest.name}</div>
                            <span className="text-[11px] text-[var(--color-text-secondary)]">New</span>
                          </div>
                          <div className="mt-1 text-sm text-[var(--color-text-secondary)]">Start a new conversation</div>
                        </div>
                      </button>
                    );
                  })}
                </>
            )}
          </div>
        </aside>

        <section className="card flex min-h-[760px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-4">
            <div>
              <div className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">
                {selectedConversation ? selectedConversation.guestName : selectedGuest ? `${selectedGuest.firstName} ${selectedGuest.lastName}`.trim() : 'Select a conversation'}
              </div>
              <div className="text-sm text-[var(--color-text-secondary)]">
                {selectedConversation
                  ? `${formatDayTime(selectedConversation.lastMessage.createdAt)} · Guest ID ${selectedConversation.guestId}`
                  : selectedGuestId
                    ? `Guest ID ${selectedGuestId}`
                    : 'Choose a guest to continue the conversation.'}
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-secondary px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
              <CheckCheckIcon className="h-4 w-4" />
              Real time
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-surface p-5">
            {!selectedConversation ? (
              <div className="flex h-full min-h-[420px] items-center justify-center text-center text-[var(--color-text-secondary)]">
                {selectedGuestId ? 'No messages yet. Send the first message to start this thread.' : 'Pick a guest from the inbox to view the thread.'}
              </div>
            ) : (
              <div className="space-y-4">
                {selectedMessages.map((message) => {
                  const isReceptionist = message.messageType !== 'guest';

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
                          {new Date(message.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="border-t border-border bg-surface p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <textarea
                className="input-field min-h-28 flex-1 resize-none"
                placeholder={selectedGuestId ? 'Type your message...' : 'Select a conversation to start messaging...'}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                disabled={!selectedGuestId}
                required
              />
              <button type="submit" disabled={isSending || !selectedGuestId} className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-50 sm:min-w-36">
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

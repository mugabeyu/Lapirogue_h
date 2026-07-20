'use client';

import { useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { SearchIcon, SendIcon } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { PageHeader } from '@/components/PageHeader';
import { GuestNameCell } from '@/components/ui/GuestNameCell';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { toast } from 'sonner';
import { Guest } from '@/types';

type MessageRow = {
  id: string;
  guestId: string;
  guestName?: string;
  senderType: 'guest' | 'staff' | 'admin' | 'receptionist';
  content: string;
  isRead: boolean;
  createdAt: string;
};

type MessageInsertResponse = {
  success: boolean;
  data?: MessageRow | null;
  error?: string;
};

type ConversationSummary = {
  guestId: string;
  guestName: string;
  guestImagePath?: string | null;
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
  const searchParams = useSearchParams();
  const [isSending, setIsSending] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [draft, setDraft] = useState('');

  const rows = useMemo(() => data ?? [], [data]);
  const guests = useMemo(() => guestsData ?? [], [guestsData]);
  const guestById = useMemo(() => new Map(guests.map((guest) => [guest.id, guest])), [guests]);
  const unreadCount = rows.filter((row) => row.senderType === 'guest' && !row.isRead).length;

  const conversations = useMemo<ConversationSummary[]>(() => {
    const map = new Map<
      string,
      { guestId: string; guestName: string; guestImagePath?: string | null; lastMessage: MessageRow; unreadCount: number; messages: MessageRow[] }
    >();

    rows.forEach((row) => {
      const current = map.get(row.guestId);
      if (current) {
        current.messages.push(row);
        if (row.senderType === 'guest' && !row.isRead) {
          current.unreadCount += 1;
        }

        if (new Date(row.createdAt).getTime() > new Date(current.lastMessage.createdAt).getTime()) {
          current.lastMessage = row;
          current.guestName = row.guestName || current.guestName;
          current.guestImagePath = guestById.get(row.guestId)?.imagePath ?? current.guestImagePath ?? null;
        }

        return;
      }

      map.set(row.guestId, {
        guestId: row.guestId,
        guestName: row.guestName || row.guestId,
        guestImagePath: guestById.get(row.guestId)?.imagePath ?? null,
        lastMessage: row,
        unreadCount: row.senderType === 'guest' && !row.isRead ? 1 : 0,
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
  }, [guestById, rows]);

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
        imagePath: guest.imagePath ?? null,
      }));
  }, [conversationGuestIds, guests, searchTerm, tab]);

  const selectedConversation = conversations.find((conversation) => conversation.guestId === selectedGuestId) ?? (selectedGuestId ? null : conversations[0] ?? null);
  const selectedGuest = guests.find((guest) => guest.id === selectedGuestId) ?? null;
  const selectedMessages = selectedGuestId
    ? rows
      .filter((message) => message.guestId === selectedGuestId)
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
    : selectedConversation?.messages ?? [];
  const activeGuestName = selectedConversation?.guestName ?? (selectedGuest ? `${selectedGuest.firstName} ${selectedGuest.lastName}`.trim() : null) ?? selectedMessages.find((message) => message.guestName)?.guestName ?? 'Select a conversation';

  useEffect(() => {
    const guestIdFromUrl = searchParams.get('guestId');
    const tabFromUrl = searchParams.get('tab');

    if (tabFromUrl === 'unread') {
      setTab('unread');
    } else if (tabFromUrl === 'all') {
      setTab('all');
    }

    if (guestIdFromUrl) {
      setSelectedGuestId(guestIdFromUrl);
      return;
    }

    if (!selectedGuestId) {
      if (conversations[0]) {
        setSelectedGuestId(conversations[0].guestId);
        return;
      }

      if (guests[0]) {
        setSelectedGuestId(guests[0].id);
      }
    }
  }, [conversations, guests, searchParams, selectedGuestId]);

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

    fetch(`/api/messages?guestId=${selectedConversation.guestId}`, { method: 'PATCH', credentials: 'include' })
      .then(() => mutate())
      .catch(() => null);
  }, [mutate, selectedConversation]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const guestId = selectedGuestId;

    if (!guestId || !draft.trim()) {
      toast.error('Select a conversation and enter a message.');
      return;
    }

    setIsSending(true);

    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestId,
        senderType: 'admin',
        content: draft.trim(),
      }),
      credentials: 'include',
    });

    const payload = await response.json().catch(() => ({})) as MessageInsertResponse;
    setIsSending(false);

    if (!response.ok) {
      toast.error(payload.error || 'Failed to send message');
      return;
    }

    if (payload.data) {
      const savedMessage: MessageRow = {
        id: payload.data.id,
        guestId: payload.data.guestId,
        guestName: payload.data.guestName,
        senderType: payload.data.senderType,
        content: payload.data.content,
        isRead: payload.data.isRead,
        createdAt: payload.data.createdAt,
      };

      const nextRows = rows.some((message) => message.id === savedMessage.id) ? rows : [savedMessage, ...rows];
      await mutate(
        {
          success: true,
          data: nextRows,
        },
        { revalidate: false },
      );
    } else {
      await mutate();
    }

    setDraft('');
  }

  async function markAllAsRead() {
    await fetch('/api/messages?all=true', { method: 'PATCH', credentials: 'include' });
    mutate();
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Messages"
        subtitle="Real-time admin and guest messaging."
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

                     return (
                       <button
                        key={conversation.guestId}
                        type="button"
                        onClick={() => {
                          setSelectedGuestId(conversation.guestId);
                        }}
                        className={`flex w-full items-start gap-3 border-b border-border px-5 py-4 text-left transition-colors ${selected ? 'bg-primary/5' : 'hover:bg-surface-secondary'}`}
                      >
                        <GuestNameCell
                          name={conversation.guestName}
                          imageUrl={conversation.guestImagePath ?? null}
                          size="lg"
                          className="min-w-0 flex-1"
                        />
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-[11px] text-[var(--color-text-secondary)]">{formatTime(conversation.lastMessage.createdAt)}</span>
                          {conversation.unreadCount > 0 ? (
                            <span className="rounded-xl border border-border bg-surface-secondary px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]">
                              {conversation.unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}

                   {searchableGuests.map((guest) => {
                     const selected = guest.id === selectedGuestId;

                     return (
                       <button
                        key={guest.id}
                        type="button"
                        onClick={() => setSelectedGuestId(guest.id)}
                        className={`flex w-full items-start gap-3 border-b border-border px-5 py-4 text-left transition-colors ${selected ? 'bg-primary/5' : 'hover:bg-surface-secondary'}`}
                      >
                        <GuestNameCell
                          name={guest.name}
                          imageUrl={guest.imagePath ?? null}
                          size="lg"
                          className="min-w-0 flex-1"
                        />
                        <span className="shrink-0 text-[11px] text-[var(--color-text-secondary)]">New</span>
                      </button>
                    );
                  })}
                </>
            )}
          </div>
        </aside>

        <section className="card flex min-h-[760px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-4">
            <div className="flex items-center gap-3">
              <GuestNameCell
                name={activeGuestName}
                imageUrl={selectedConversation ? (selectedConversation.guestImagePath ?? null) : (selectedGuest?.imagePath ?? null)}
                size="lg"
              />
              <div>
                <div className="text-sm text-[var(--color-text-secondary)]">
                  {selectedConversation
                    ? `${formatDayTime(selectedConversation.lastMessage.createdAt)} · Guest ID ${selectedConversation.guestId}`
                    : selectedGuestId
                      ? `Guest ID ${selectedGuestId}`
                      : 'Choose a guest to continue the conversation.'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-surface p-5">
            {!selectedGuestId && !selectedConversation ? (
              <div className="flex h-full min-h-[420px] items-center justify-center text-center text-[var(--color-text-secondary)]">
                {'Pick a guest from the inbox to view the thread.'}
              </div>
            ) : (
              <div className="space-y-4">
                {selectedMessages.map((message) => {
                  const isReceptionist = message.senderType !== 'guest';

                  return (
                    <div key={message.id} className={`flex ${isReceptionist ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[82%] rounded-[24px] px-4 py-3 shadow-sm ${isReceptionist ? 'rounded-br-md bg-primary text-[var(--color-text-primary)]' : 'rounded-bl-md bg-surface text-[var(--color-text-primary)]'}`}>
                          {message.content && <p className="text-sm leading-6">{message.content}</p>}
                          <div className={`mt-2 text-[11px] ${isReceptionist ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-secondary)]'}`}>
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
                className="input-field min-h-28 w-full resize-none"
                placeholder={selectedGuestId ? 'Type your message...' : 'Select a conversation to start messaging...'}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                disabled={!selectedGuestId}
              />
              <button type="submit" disabled={isSending || !selectedGuestId || !draft.trim()} className="btn-primary inline-flex items-center justify-center gap-2">
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

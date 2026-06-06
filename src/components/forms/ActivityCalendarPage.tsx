'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import { SESSION_COLOR_STYLES } from '@/lib/activities';

type CalendarDay = {
  date: string;
  weekday: string;
  day: number;
};

type CalendarSession = {
  id: string;
  activityName: string;
  colorKey: string;
  time: string;
  timeLabel: string;
  participants: number;
  capacity: number;
  bookedLabel: string;
  isFull: boolean;
  guideName: string;
  guests: { id: string; name: string }[];
};

type CalendarData = {
  anchor: string;
  today: string;
  weekLabel: string;
  days: CalendarDay[];
  categories: string[];
  sessionsByDay: Record<string, CalendarSession[]>;
  todaySessions: CalendarSession[];
};

function shiftWeek(anchor: string, direction: -1 | 1) {
  const date = new Date(anchor + 'T12:00:00');
  date.setDate(date.getDate() + direction * 7);
  return date.toISOString().slice(0, 10);
}

async function fetchCalendar(url: string) {
  const response = await fetch(url);
  return response.json() as Promise<{ success: boolean; data: CalendarData }>;
}

export default function ActivityCalendarPage() {
  const [anchor, setAnchor] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('All');
  const [selectedSession, setSelectedSession] = useState<CalendarSession | null>(null);

  const url = useMemo(() => {
    const params = new URLSearchParams({ anchor });
    if (category !== 'All') params.set('category', category);
    return `/api/activities/calendar?${params}`;
  }, [anchor, category]);

  const { data, isLoading } = useSWR(url, fetchCalendar);
  const calendar = data?.data;
  const today = calendar?.today ?? anchor;

  const todayLabel = useMemo(() => {
    const date = new Date(today + 'T12:00:00');
    return date.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' });
  }, [today]);

  const sidebarSessions = calendar?.todaySessions ?? [];
  const activeSession = selectedSession ?? sidebarSessions[0] ?? null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[var(--color-text-primary)]">Activity Calendar</h1>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAnchor((current) => shiftWeek(current, -1))}
              className="rounded-lg border border-border bg-surface p-2 hover:bg-surface-secondary"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[10rem] text-center text-sm font-medium text-[var(--color-text-primary)]">
              {calendar?.weekLabel ?? 'Loading...'}
            </span>
            <button
              type="button"
              onClick={() => setAnchor((current) => shiftWeek(current, 1))}
              className="rounded-lg border border-border bg-surface p-2 hover:bg-surface-secondary"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="ml-4 flex flex-wrap gap-2">
              {(calendar?.categories ?? ['All']).map((item) => {
                const active = item === category;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      active
                        ? 'bg-primary text-white'
                        : 'border border-border bg-surface text-[var(--color-text-primary)] hover:bg-surface-secondary'
                    }`}
                  >
                    {item === 'Water Sports' ? 'Water' : item === 'Island Tours' ? 'Tours' : item === 'Wellness & Spa' ? 'Spa' : item}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-text-primary)]">Today&apos;s Sessions</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">{todayLabel}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          {isLoading && <p className="p-6 text-sm text-[var(--color-text-secondary)]">Loading calendar...</p>}

          {!isLoading && calendar && (
            <div className="overflow-x-auto">
              <div className="grid min-w-[760px] grid-cols-7 border-b border-border bg-surface-secondary">
                {calendar.days.map((day) => (
                  <div
                    key={day.date}
                    className={`border-r border-border px-2 py-3 text-center last:border-r-0 ${day.date === today ? 'bg-surface-secondary' : ''}`}
                  >
                    <p className="text-xs text-[var(--color-text-secondary)]">{day.weekday}</p>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{day.day}</p>
                  </div>
                ))}
              </div>

              <div className="grid min-w-[760px] grid-cols-7">
                {calendar.days.map((day) => {
                  const sessions = calendar.sessionsByDay[day.date] ?? [];
                  return (
                    <div key={day.date} className={`min-h-[420px] space-y-2 border-r border-border p-2 last:border-r-0 ${day.date === today ? 'bg-surface-secondary/70' : ''}`}>
                      {sessions.map((session) => {
                        const colorClass = SESSION_COLOR_STYLES[session.colorKey] ?? SESSION_COLOR_STYLES.tours;
                        const fillPercent = Math.min(100, (session.participants / session.capacity) * 100);
                        return (
                          <button
                            key={session.id}
                            type="button"
                            onClick={() => setSelectedSession(session)}
                            className={`w-full rounded-xl border p-2.5 text-left text-xs shadow-sm transition hover:shadow ${colorClass}`}
                          >
                            <p className="font-semibold">{session.timeLabel}</p>
                            <p className="mt-1 font-display text-sm font-semibold leading-tight">{session.activityName}</p>
                            <p className="mt-2 flex items-center gap-1 text-[11px] text-[var(--color-text-secondary)]">
                              <User className="h-3 w-3" />
                              Guide: {session.guideName}
                            </p>
                            <div className="mt-2">
                              <p className="text-[11px] font-medium text-[var(--color-text-secondary)]">{session.isFull ? 'FULL' : session.bookedLabel}</p>
                              <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface/70">
                                <div className="h-full rounded-full bg-current opacity-60" style={{ width: `${fillPercent}%` }} />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-[var(--color-text-primary)]">Today&apos;s Sessions</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">{todayLabel}</p>
          </div>

          {sidebarSessions.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-[var(--color-text-secondary)]">No sessions scheduled for today.</div>
          )}

          {activeSession && (
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold text-[var(--color-text-primary)]">{activeSession.timeLabel}</p>
                  <p className="font-display text-lg font-semibold text-[var(--color-text-primary)]">{activeSession.activityName}</p>
                </div>
                <span className="rounded-full bg-surface-secondary px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">{activeSession.bookedLabel}</span>
              </div>

              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Attendance</p>
              <ul className="space-y-2">
                {activeSession.guests.slice(0, 3).map((guest) => (
                  <li key={guest.id} className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                    <input type="checkbox" className="h-4 w-4 rounded border-border" readOnly />
                    {guest.name}
                  </li>
                ))}
              </ul>

              {activeSession.guests.length > 3 && <button type="button" className="mt-3 text-sm font-medium text-primary">+ {activeSession.guests.length - 3} more guests</button>}
            </div>
          )}

          {sidebarSessions.length > 1 && (
            <div className="space-y-2">
              {sidebarSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setSelectedSession(session)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                    activeSession?.id === session.id ? 'border-primary bg-primary/5' : 'border-border bg-surface hover:bg-surface-secondary'
                  }`}
                >
                  <span className="font-medium">{session.timeLabel}</span> — {session.activityName}
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

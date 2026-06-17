'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  Clock,
  Grid3X3,
  LayoutList,
  MapPin,
  Plus,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { BookActivityModal } from '@/components/modals/BookActivityModal';
import Button from '@/components/ui/Button';
import {
  ACTIVITY_CATEGORIES,
  ActivityListItem,
  formatRs,
} from '@/lib/activities';

type ActivitiesResponse = {
  success: boolean;
  data: ActivityListItem[];
  categories?: string[];
};

type ViewMode = 'list' | 'grid';

async function fetchActivities(url: string) {
  const response = await fetch(url);
  return response.json() as Promise<ActivitiesResponse>;
}

function ActivityListCard({
  activity,
  onBook,
}: {
  activity: ActivityListItem;
  onBook: () => void;
}) {
  const scheduleLabel = activity.nextSession?.label ?? activity.meetingPoint ?? 'Schedule TBC';

  return (
    <article className="overflow-hidden rounded-xl border border-card-border bg-surface">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch">
        <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-xl bg-surface-secondary sm:h-auto sm:w-52">
          {activity.imagePath ? (
            <img src={activity.imagePath} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-[10rem] items-center justify-center text-sm text-[var(--color-text-secondary)]">
              No image
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-full bg-surface px-3 py-1 text-xs font-medium text-[var(--color-text-primary)]">
            {activity.category}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
          <div>
            <h3 className="font-display text-2xl text-[var(--color-text-primary)]">{activity.name}</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-[var(--color-text-secondary)]">
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--color-text-secondary)]" />
                {activity.durationLabel}
              </li>
              <li className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--color-text-secondary)]" />
                {activity.capacityLabel}
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[var(--color-text-secondary)]" />
                {scheduleLabel}
              </li>
            </ul>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="font-display text-lg text-[var(--color-text-primary)]">{formatRs(activity.price)}</p>
            <button type="button" onClick={onBook} className="text-sm text-[var(--color-primary)] hover:underline">
              Book Now →
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function ActivityGridCard({
  activity,
  onBook,
}: {
  activity: ActivityListItem;
  onBook: () => void;
}) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-card-border bg-surface">
      <div className="relative aspect-[16/10] bg-surface-secondary">
        {activity.imagePath ? (
          <img src={activity.imagePath} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-secondary)]">No image</div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-surface px-3 py-1 text-xs font-medium text-[var(--color-text-primary)]">
          {activity.category}
        </span>
      </div>
        <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-lg text-[var(--color-text-primary)]">{activity.name}</h3>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{activity.durationLabel}</p>
        <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
          <p className="font-display font-semibold text-[var(--color-text-primary)]">{formatRs(activity.price)}</p>
          <button type="button" onClick={onBook} className="text-sm text-[var(--color-primary)]">
            Book Now →
          </button>
        </div>
      </div>
    </article>
  );
}

export default function ActivitiesListPage() {
  const [category, setCategory] = useState('All');
  const [view, setView] = useState<ViewMode>('list');
  const [bookingActivity, setBookingActivity] = useState<ActivityListItem | null>(null);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (category !== 'All') params.set('category', category);
    return `/api/activities?${params}`;
  }, [category]);

  const { data, mutate } = useSWR(url, fetchActivities);
  const activities = data?.data ?? [];
  const categories = useMemo(() => {
    const fromApi = data?.categories ?? [];
    const merged = new Set<string>(['All', ...ACTIVITY_CATEGORIES, ...fromApi]);
    return Array.from(merged);
  }, [data?.categories]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Activities & Tours"
        subtitle="Manage hotel experiences and excursions"
        action={
          <Link href="/activities/new" className="inline-flex">
            <Button variant="primary">
              <Plus className="h-4 w-4" />
              Add Activity
            </Button>
          </Link>
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {categories.map((item) => {
            const active = item === category;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[var(--color-button-primary)] text-[var(--color-text-primary)]'
                    : 'border border-card-border bg-surface text-[var(--color-text-primary)] hover:bg-[var(--color-button-primary-hover)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-card-border bg-surface p-1">
          <button
            type="button"
            onClick={() => setView('grid')}
            className={`rounded-xl p-2 ${view === 'grid' ? 'bg-[var(--color-button-primary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}
            aria-label="Grid view"
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className={`rounded-xl p-2 ${view === 'list' ? 'bg-[var(--color-button-primary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}
            aria-label="List view"
          >
            <LayoutList className="h-4 w-4" />
          </button>
        </div>
      </div>

     
      { activities.length === 0 && (
        <div className="card rounded-xl border-dashed border-card-border px-6 py-16 text-center">
          <p className="text-[var(--color-text-secondary)]">No activities in this category yet.</p>
          <Link href="/activities/new" className="mt-4 inline-block">
            <Button variant="secondary">Add your first activity →</Button>
          </Link>
        </div>
      )}

      {view === 'list' && (
        <div className="space-y-4">
          {activities.map((activity) => (
            <ActivityListCard
              key={activity.id}
              activity={activity}
              onBook={() => setBookingActivity(activity)}
            />
          ))}
        </div>
      )}

      {view === 'grid' && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {activities.map((activity) => (
            <ActivityGridCard
              key={activity.id}
              activity={activity}
              onBook={() => setBookingActivity(activity)}
            />
          ))}
        </div>
      )}

      {bookingActivity && (
        <BookActivityModal
          isOpen={Boolean(bookingActivity)}
          onClose={() => setBookingActivity(null)}
          activity={bookingActivity}
          onBooked={() => {
            setBookingActivity(null);
            mutate();
          }}
        />
      )}
    </div>
  );
}

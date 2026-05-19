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
    <article className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch">
        <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-xl bg-sand-200 sm:h-auto sm:w-52">
          {activity.imagePath ? (
            <img src={activity.imagePath} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-[10rem] items-center justify-center text-sm text-ink-500">
              No image
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-ink-800 shadow-sm">
            {activity.category}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
          <div>
            <h3 className="font-display text-2xl font-semibold text-ink-900">{activity.name}</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-ink-600">
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-ink-400" />
                {activity.durationLabel}
              </li>
              <li className="flex items-center gap-2">
                <Users className="h-4 w-4 text-ink-400" />
                {activity.capacityLabel}
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-ink-400" />
                {scheduleLabel}
              </li>
            </ul>
          </div>

          <div className="flex items-center justify-between border-t border-sand-200 pt-4">
            <p className="font-display text-lg font-semibold text-ink-900">{formatRs(activity.price)}</p>
            <button type="button" onClick={onBook} className="text-sm font-semibold text-primary hover:underline">
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
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
      <div className="relative aspect-[16/10] bg-sand-200">
        {activity.imagePath ? (
          <img src={activity.imagePath} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-500">No image</div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-medium shadow-sm">
          {activity.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-lg font-semibold text-ink-900">{activity.name}</h3>
        <p className="mt-2 text-sm text-ink-600">{activity.durationLabel}</p>
        <div className="mt-auto flex items-center justify-between border-t border-sand-200 pt-4">
          <p className="font-display font-semibold">{formatRs(activity.price)}</p>
          <button type="button" onClick={onBook} className="text-sm font-semibold text-primary">
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

  const { data, isLoading, mutate } = useSWR(url, fetchActivities);
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
          <Link href="/activities/new" className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Activity
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
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary text-white'
                    : 'border border-sand-200 bg-white text-ink-700 hover:bg-sand-50'
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-sand-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setView('grid')}
            className={`rounded-md p-2 ${view === 'grid' ? 'bg-sand-100 text-ink-900' : 'text-ink-500'}`}
            aria-label="Grid view"
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className={`rounded-md p-2 ${view === 'list' ? 'bg-sand-100 text-ink-900' : 'text-ink-500'}`}
            aria-label="List view"
          >
            <LayoutList className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-ink-500">Loading activities...</p>}

      {!isLoading && activities.length === 0 && (
        <div className="rounded-2xl border border-dashed border-sand-200 bg-white px-6 py-16 text-center">
          <p className="text-ink-600">No activities in this category yet.</p>
          <Link href="/activities/new" className="mt-4 inline-block text-sm font-semibold text-primary">
            Add your first activity →
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

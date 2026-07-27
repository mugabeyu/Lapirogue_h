'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useApi } from '@/hooks/useApi';
import {
  Clock,
  Grid3X3,
  LayoutList,
  MapPin,
  Pencil,
  Plus,
  SearchIcon,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { BookActivityModal } from '@/components/modals/BookActivityModal';
import { ManageActivityModal } from '@/components/modals/ManageActivityModal';
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
  const response = await fetch(url, { credentials: 'include' });
  return response.json() as Promise<ActivitiesResponse>;
}

/**
 * Opens edit/delete for an activity. Shown only to managers — reception can
 * book an activity but not change the catalogue.
 */
function ManageActivityButton({ onManage, name }: { onManage: () => void; name: string }) {
  return (
    <button
      type="button"
      onClick={onManage}
      aria-label={`Edit ${name}`}
      title={`Edit ${name}`}
      className="rounded-xl border border-card-border bg-surface p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-surface-secondary hover:text-[var(--color-text-primary)]"
    >
      <Pencil className="h-4 w-4" />
    </button>
  );
}

function ActivityListCard({
  activity,
  onBook,
  onManage,
}: {
  activity: ActivityListItem;
  onBook: () => void;
  onManage?: () => void;
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
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-2xl text-[var(--color-text-primary)]">{activity.name}</h3>
              {onManage && <ManageActivityButton onManage={onManage} name={activity.name} />}
            </div>
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
  onManage,
}: {
  activity: ActivityListItem;
  onBook: () => void;
  onManage?: () => void;
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
        {onManage && (
          <div className="absolute right-3 top-3">
            <ManageActivityButton onManage={onManage} name={activity.name} />
          </div>
        )}
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
  const { data: currentUser } = useApi<{ role: string }>('/api/auth/me');
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('list');
  const [bookingActivity, setBookingActivity] = useState<ActivityListItem | null>(null);
  const [managingActivity, setManagingActivity] = useState<ActivityListItem | null>(null);

  // Debounced so typing doesn't fire a request per keystroke; the input stays
  // fully responsive because only the fetch key lags behind it.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (category !== 'All') params.set('category', category);
    if (debouncedSearch) params.set('search', debouncedSearch);
    return `/api/activities?${params}`;
  }, [category, debouncedSearch]);

  // keepPreviousData stops the list emptying out between keystrokes, which
  // otherwise flashes the "no activities match" state mid-search.
  const { data, mutate } = useSWR(url, fetchActivities, { keepPreviousData: true });
  const activities = data?.data ?? [];
  const isManager = currentUser?.role === 'MANAGER';
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
        action={isManager ? (
          <Link href="/activities/new" className="inline-flex">
            <Button variant="primary">
              <Plus className="h-4 w-4" />
              Add Activity
            </Button>
          </Link>
        ) : undefined}
      />

      <div>
        <label htmlFor="activity-search" className="sr-only">
          Search activities and tours
        </label>
        <div className="relative w-full sm:w-96">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            id="activity-search"
            type="search"
            placeholder="Search activities and tours..."
            className="input-field w-full pl-10"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

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
          <p className="text-[var(--color-text-secondary)]">
            {debouncedSearch
              ? `No activities match “${debouncedSearch}”.`
              : 'No activities in this category yet.'}
          </p>
          {isManager && !debouncedSearch && (
            <Link href="/activities/new" className="mt-4 inline-block">
              <Button variant="secondary">Add your first activity →</Button>
            </Link>
          )}
        </div>
      )}

      {view === 'list' && (
        <div className="space-y-4">
          {activities.map((activity) => (
            <ActivityListCard
              key={activity.id}
              activity={activity}
              onBook={() => setBookingActivity(activity)}
              onManage={isManager ? () => setManagingActivity(activity) : undefined}
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
              onManage={isManager ? () => setManagingActivity(activity) : undefined}
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

      {managingActivity && isManager && (
        <ManageActivityModal
          isOpen={Boolean(managingActivity)}
          onClose={() => setManagingActivity(null)}
          activity={managingActivity}
          onSaved={async () => {
            await mutate();
          }}
        />
      )}
    </div>
  );
}

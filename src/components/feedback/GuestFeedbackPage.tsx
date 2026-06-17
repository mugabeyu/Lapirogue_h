'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { ArrowDown, ArrowUp, ArrowUpDown, Send, Star } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

type SortKey = 'guest' | 'rating' | 'category' | 'comment' | 'date';
type SortOrder = 'asc' | 'desc';

type FeedbackReview = {
  id: string;
  guest: string;
  rating: number;
  category: string;
  comment: string;
  date: string;
};

type FeedbackResponse = {
  success: boolean;
  data: {
    summary: {
      averageRating: number;
      averageRatingTrend: number | null;
      totalReviews: number;
      totalReviewsTrend: number | null;
      responseRate: number;
      responseRateTrend: number | null;
    };
    distribution: Array<{ stars: number; count: number; percent: number }>;
    reviews: FeedbackReview[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
};

async function fetchFeedback(url: string) {
  const response = await fetch(url);
  return response.json() as Promise<FeedbackResponse>;
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => {
        const filled = index < value;
        return (
          <Star
            key={index}
            className={`h-4 w-4 ${filled ? 'fill-[var(--color-text-primary)] text-[var(--color-text-primary)]' : 'text-[var(--color-border)]'}`}
            strokeWidth={filled ? 0 : 1.5}
          />
        );
      })}
    </div>
  );
}

function TrendBadge({
  value,
  format,
}: {
  value: number | null;
  format: 'points' | 'percent' | 'pp';
}) {
  if (value === null || value === 0) return null;

  const positive = value > 0;
  const Icon = positive ? ArrowUp : ArrowDown;
  const formatted =
    format === 'points'
      ? `${positive ? '+' : ''}${value.toFixed(1)}`
      : format === 'pp'
        ? `${positive ? '+' : ''}${Math.round(value)}%`
        : `${positive ? '+' : ''}${Math.round(value)}%`;

  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
      <Icon className="h-3 w-3" />
      {formatted}
    </span>
  );
}

function SortableHeader({
  label,
  column,
  sort,
  order,
  onSort,
}: {
  label: string;
  column: SortKey;
  sort: SortKey;
  order: SortOrder;
  onSort: (column: SortKey) => void;
}) {
  const active = sort === column;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-[var(--color-text-primary)]"
    >
      {label}
      {active ? (
        order === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

function truncateComment(text: string, max = 48) {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

export default function GuestFeedbackPage() {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortKey>('date');
  const [order, setOrder] = useState<SortOrder>('desc');

  const url = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: '15',
      sort,
      order,
    });
    return `/api/feedback?${params}`;
  }, [page, sort, order]);

  const { data } = useSWR(url, fetchFeedback);
  const payload = data?.data;
  const summary = payload?.summary;
  const distribution = payload?.distribution ?? [];
  const reviews = payload?.reviews ?? [];
  const pagination = payload?.pagination;

  const handleSort = (column: SortKey) => {
    if (sort === column) {
      setOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(column);
      setOrder(column === 'guest' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const statCards = [
    {
      label: 'Average Rating',
      value: summary ? `${summary.averageRating}/5` : '—',
      trend: summary?.averageRatingTrend ?? null,
      trendFormat: 'points' as const,
      icon: Star,
      iconClass: 'bg-surface-secondary text-[var(--color-text-primary)] border border-border',
    },
    {
      label: 'Total Reviews',
      value: summary ? String(summary.totalReviews) : '—',
      trend: summary?.totalReviewsTrend ?? null,
      trendFormat: 'percent' as const,
      icon: Star,
      iconClass: 'bg-surface-secondary text-[var(--color-text-primary)] border border-border',
    },
    {
      label: 'Response Rate',
      value: summary ? `${summary.responseRate}%` : '—',
      trend: summary?.responseRateTrend ?? null,
      trendFormat: 'pp' as const,
      icon: Send,
      iconClass: 'bg-surface-secondary text-[var(--color-text-primary)] border border-border',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Guest Feedback"
        subtitle="Ratings and comments from guests during their stay"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${card.iconClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <TrendBadge value={card.trend} format={card.trendFormat} />
              </div>
              <p className="mt-4 text-sm text-[var(--color-text-secondary)]">{card.label}</p>
              <p className="mt-1 font-display text-3xl font-semibold text-[var(--color-text-primary)]">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="card p-6">
        <h2 className="font-display text-lg font-semibold text-[var(--color-text-primary)]">Rating Distribution</h2>
       
        { distribution.every((row) => row.count === 0) && (
          <p className="mt-6 text-sm text-[var(--color-text-secondary)]">No ratings yet.</p>
        )}
        <div className="mt-6 space-y-3">
          {distribution.map((row) => (
            <div key={row.stars} className="grid grid-cols-[72px_1fr_40px] items-center gap-3 text-sm">
              <span className="text-[var(--color-text-secondary)]">{row.stars} Star{row.stars === 1 ? '' : 's'}</span>
              <div className="h-3 overflow-hidden rounded-full bg-surface-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${row.percent}%` }}
                />
              </div>
              <span className="text-right tabular-nums text-[var(--color-text-secondary)]">{row.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-display text-lg font-semibold text-[var(--color-text-primary)]">Recent Feedback</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm" aria-label="Recent guest feedback">
            <thead>
              <tr className="border-b border-border text-xs text-[var(--color-text-secondary)]">
                <th scope="col" className="px-5 py-3 font-medium">
                  <SortableHeader label="Guest" column="guest" sort={sort} order={order} onSort={handleSort} />
                </th>
                <th scope="col" className="border-l border-border px-5 py-3 font-medium">
                  <SortableHeader label="Rating" column="rating" sort={sort} order={order} onSort={handleSort} />
                </th>
                <th scope="col" className="border-l border-border px-5 py-3 font-medium">
                  <SortableHeader label="Category" column="category" sort={sort} order={order} onSort={handleSort} />
                </th>
                <th scope="col" className="border-l border-border px-5 py-3 font-medium">
                  <SortableHeader label="Comment" column="comment" sort={sort} order={order} onSort={handleSort} />
                </th>
                <th scope="col" className="border-l border-border px-5 py-3 font-medium">
                  <SortableHeader label="Date" column="date" sort={sort} order={order} onSort={handleSort} />
                </th>
              </tr>
            </thead>
            <tbody>
             
              { reviews.length === 0 && (
                <tr className="border-b border-border">
                  <td colSpan={5} className="px-5 py-12 text-center text-[var(--color-text-secondary)]">No feedback recorded yet.</td>
                </tr>
              )}
              {
                reviews.map((row) => (
                  <tr key={row.id} className="border-b border-border hover:bg-surface-secondary/50">
                    <td className="px-5 py-4 font-medium text-[var(--color-text-primary)]">{row.guest}</td>
                    <td className="border-l border-border px-5 py-4">
                      <StarRating value={row.rating} />
                    </td>
                    <td className="border-l border-border px-5 py-4 text-[var(--color-text-primary)]">{row.category}</td>
                    <td className="max-w-xs border-l border-border px-5 py-4 text-[var(--color-text-secondary)]">{truncateComment(row.comment)}</td>
                    <td className="border-l border-border px-5 py-4 tabular-nums text-[var(--color-text-secondary)]">{row.date}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {pagination && (
          <div className="flex flex-col gap-3 border-t border-border px-6 py-4 text-sm text-[var(--color-text-secondary)] sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {reviews.length} of {pagination.total} {pagination.total === 1 ? 'entry' : 'entries'}
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="disabled:opacity-40 hover:text-[var(--color-text-primary)]"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="disabled:opacity-40 hover:text-[var(--color-text-primary)]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

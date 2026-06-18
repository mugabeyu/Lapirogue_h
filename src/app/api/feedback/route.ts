import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { attachSupabaseCookies, getRouteHandlerSupabaseSession } from '@/lib/supabase-server';

type GuestJoin = { first_name?: string | null; last_name?: string | null };

type FeedbackListRow = {
  id: string;
  rating: number;
  category: string;
  comment: string | null;
  created_at: string;
  guests?: GuestJoin | GuestJoin[] | null;
};

type StatRow = {
  rating: number;
  staff_response: string | null;
  responded_at: string | null;
  created_at: string;
};

const SORT_COLUMNS: Record<string, string> = {
  guest: 'created_at',
  rating: 'rating',
  category: 'category',
  comment: 'comment',
  date: 'created_at',
};

function guestName(row: FeedbackListRow) {
  const guest = Array.isArray(row.guests) ? row.guests[0] : row.guests;
  if (!guest) return 'Unknown guest';
  const name = `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim();
  return name || 'Unknown guest';
}

function formatDate(value: string) {
  return value.slice(0, 10);
}

function isResponded(row: StatRow) {
  return Boolean(row.responded_at || (row.staff_response && row.staff_response.trim()));
}

function averageRating(rows: StatRow[]) {
  if (rows.length === 0) return 0;
  const sum = rows.reduce((acc, row) => acc + row.rating, 0);
  return sum / rows.length;
}

function responseRate(rows: StatRow[]) {
  if (rows.length === 0) return 0;
  const responded = rows.filter(isResponded).length;
  return (responded / rows.length) * 100;
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

function ratingTrend(current: number, previous: number) {
  if (previous === 0) return current > 0 ? current : null;
  return current - previous;
}

function splitByPeriod(rows: StatRow[]) {
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const currentStart = now - thirtyDays;
  const previousStart = now - thirtyDays * 2;

  const current: StatRow[] = [];
  const previous: StatRow[] = [];

  for (const row of rows) {
    const time = new Date(row.created_at).getTime();
    if (time >= currentStart) current.push(row);
    else if (time >= previousStart && time < currentStart) previous.push(row);
  }

  return { current, previous };
}

function buildDistribution(rows: StatRow[]) {
  const counts = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: rows.filter((row) => row.rating === stars).length,
  }));
  const max = Math.max(...counts.map((item) => item.count), 1);
  return counts.map((item) => ({ ...item, percent: (item.count / max) * 100 }));
}

export async function GET(request: NextRequest) {
  const { user, error: userError, response } = await getRouteHandlerSupabaseSession(request);
  if (!user || userError) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), response);
  }

  try {
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
    const limit = Math.min(50, Math.max(1, Number(params.get('limit') ?? '8') || 8));
    const sortKey = params.get('sort') ?? 'date';
    const order = params.get('order') === 'asc' ? 'asc' : 'desc';
    const sortColumn = SORT_COLUMNS[sortKey] ?? 'created_at';

    const admin = getSupabaseAdmin();

    const { data: statRows, error: statError } = await admin
      .from('guest_feedback')
      .select('rating, staff_response, responded_at, created_at');

    if (statError) {
      const missingFeedbackTable =
        (statError as { code?: string; message?: string }).code === 'PGRST205' &&
        String((statError as { message?: string }).message ?? '').includes("'public.guest_feedback'");

      if (missingFeedbackTable) {
        response.headers.set('Cache-Control', 'no-store, max-age=0');
        return attachSupabaseCookies(NextResponse.json({
          success: true,
          data: {
            summary: {
              averageRating: 0,
              averageRatingTrend: null,
              totalReviews: 0,
              totalReviewsTrend: null,
              responseRate: 0,
              responseRateTrend: null,
            },
            distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: 0, percent: 0 })),
            reviews: [],
            pagination: {
              page,
              limit,
              total: 0,
              totalPages: 1,
            },
          },
        }), response);
      }
      throw statError;
    }

    const allStats = (statRows ?? []) as StatRow[];
    const { current: recentStats, previous: priorStats } = splitByPeriod(allStats);

    const avgCurrent = averageRating(recentStats.length ? recentStats : allStats);
    const avgPrevious = averageRating(priorStats);
    const reviewsCurrent = recentStats.length || allStats.length;
    const reviewsPrevious = priorStats.length;
    const rateCurrent = responseRate(recentStats.length ? recentStats : allStats);
    const ratePrevious = responseRate(priorStats);

    const summary = {
      averageRating: allStats.length ? Number(avgCurrent.toFixed(1)) : 0,
      averageRatingTrend: priorStats.length ? ratingTrend(averageRating(recentStats), avgPrevious) : null,
      totalReviews: allStats.length,
      totalReviewsTrend: percentChange(reviewsCurrent, reviewsPrevious),
      responseRate: allStats.length ? Math.round(rateCurrent) : 0,
      responseRateTrend: priorStats.length ? rateCurrent - ratePrevious : null,
    };

    const distribution = buildDistribution(allStats);

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let listQuery = admin
      .from('guest_feedback')
      .select('id, rating, category, comment, created_at, guests(first_name, last_name)', { count: 'exact' })
      .order(sortColumn, { ascending: order === 'asc' });

    if (sortKey === 'guest') {
      listQuery = admin
        .from('guest_feedback')
        .select('id, rating, category, comment, created_at, guests(first_name, last_name)', { count: 'exact' })
        .order('created_at', { ascending: order === 'asc' });
    }

    const { data: listRows, error: listError, count } = await listQuery.range(from, to);

    if (listError) throw listError;

    let reviews = ((listRows ?? []) as FeedbackListRow[]).map((row) => ({
      id: row.id,
      guest: guestName(row),
      rating: row.rating,
      category: row.category,
      comment: row.comment ?? '',
      date: formatDate(row.created_at),
    }));

    if (sortKey === 'guest') {
      reviews = reviews.sort((a, b) => {
        const cmp = a.guest.localeCompare(b.guest);
        return order === 'asc' ? cmp : -cmp;
      });
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return attachSupabaseCookies(NextResponse.json({
      success: true,
      data: {
        summary,
        distribution,
        reviews,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    }), response);
  } catch (error) {
    console.error('GET /api/feedback', error);
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Failed to fetch feedback' }, { status: 500 }), response);
  }
}

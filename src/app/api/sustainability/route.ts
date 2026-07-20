import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { attachSupabaseCookies, getRouteHandlerSupabaseSession } from '@/lib/supabase-server';

type EventRow = {
  guest_id: string;
  activity_id: string;
  points: number;
  carbon_offset_kg?: number | string;
  earned_at?: string;
  created_at?: string;
};

type TierRow = {
  name: string;
  min_points: number;
  sort_order: number;
};

type ActivityRow = {
  id: string;
  name?: string | null;
  color?: string | null;
  carbon_offset_kg?: number | string;
};

type GuestRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  image_path?: string | null;
};

function initials(first?: string | null, last?: string | null) {
  const parts = [first?.[0], last?.[0]].filter(Boolean);
  return parts.join('').toUpperCase() || '?';
}

function resolveTier(totalPoints: number, tiers: TierRow[]) {
  const ordered = [...tiers].sort((a, b) => b.min_points - a.min_points);
  const match = ordered.find((tier) => totalPoints >= tier.min_points);
  return match?.name ?? 'Member';
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

function splitByPeriod(rows: EventRow[]) {
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const currentStart = now - thirtyDays;
  const previousStart = now - thirtyDays * 2;

  const current: EventRow[] = [];
  const previous: EventRow[] = [];

  for (const row of rows) {
    const time = new Date(row.earned_at || row.created_at || 0).getTime();
    if (time >= currentStart) current.push(row);
    else if (time >= previousStart && time < currentStart) previous.push(row);
  }

  return { current, previous };
}

function lastSixMonths() {
  const months: Array<{ key: string; label: string }> = [];
  const now = new Date();
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleString('en-US', { month: 'short' });
    months.push({ key, label });
  }
  return months;
}

function emptySustainabilityPayload() {
  return {
    summary: {
      totalEcoPoints: 0,
      totalEcoPointsTrend: null,
      activeParticipants: 0,
      activeParticipantsTrend: null,
      carbonOffsetKg: 0,
      carbonOffsetTrend: null,
    },
    leaderboard: [],
    activityDistribution: [],
    monthlyTrend: lastSixMonths().map((month) => ({ month: month.label, points: 0 })),
  };
}

async function loadGuestNames(guestIds: string[]): Promise<Map<string, GuestRow>> {
  if (!guestIds.length) return new Map<string, GuestRow>();

  const { data, error } = await getSupabaseAdmin()
    .from('guests')
    .select('id, first_name, last_name, image_path')
    .in('id', guestIds);

  if (error?.code === 'PGRST205') return new Map<string, GuestRow>();
  if (error) throw error;
  return new Map((data ?? []).map((guest) => [guest.id, guest] as const));
}

async function loadActivities(activityIds: string[]): Promise<Map<string, ActivityRow>> {
  if (!activityIds.length) return new Map<string, ActivityRow>();

  const { data, error } = await getSupabaseAdmin()
    .from('sustainability_activities')
    .select('id, name, color, carbon_offset_kg')
    .in('id', activityIds);

  if (error?.code === 'PGRST205') return new Map<string, ActivityRow>();
  if (error) throw error;
  return new Map((data ?? []).map((activity) => [activity.id, activity] as const));
}

export async function GET(request: NextRequest) {
  const { user, error: userError, response } = await getRouteHandlerSupabaseSession(request);
  if (!user || userError) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), response);
  }

  try {
    const admin = getSupabaseAdmin();

    const [eventsResult, tiersResult, activitiesResult] = await Promise.all([
      admin
        .from('guest_eco_point_events')
        .select('guest_id, activity_id, points, carbon_offset_kg, created_at'),
      admin.from('eco_tiers').select('name, min_points, sort_order').order('sort_order', { ascending: true }),
      admin.from('sustainability_activities').select('id, name, color, carbon_offset_kg').eq('is_active', true),
    ]);

    if (eventsResult.error) {
      const missingEventsTable =
        (eventsResult.error as { code?: string; message?: string }).code === 'PGRST205' &&
        String((eventsResult.error as { message?: string }).message ?? '').includes("'public.guest_eco_point_events'");

      if (missingEventsTable) {
        return attachSupabaseCookies(NextResponse.json({
          success: true,
          data: emptySustainabilityPayload(),
        }), response);
      }

      throw eventsResult.error;
    }
    const tiers = tiersResult.error?.code === 'PGRST205' ? [] : tiersResult.error ? (() => { throw tiersResult.error; })() : (tiersResult.data ?? []) as TierRow[];
    const activitiesFromTable = activitiesResult.error?.code === 'PGRST205' ? [] : activitiesResult.error ? (() => { throw activitiesResult.error; })() : (activitiesResult.data ?? []) as ActivityRow[];

    const events = (eventsResult.data ?? []) as EventRow[];

    const guestIds = [...new Set(events.map((row) => row.guest_id))];
    const activityIds = [...new Set(events.map((row) => row.activity_id).filter((id): id is string => Boolean(id)))];
    const [guestsByName, activitiesByName] = await Promise.all([
      loadGuestNames(guestIds),
      loadActivities(activityIds),
    ]);

    const totalPoints = events.reduce((sum, row) => sum + row.points, 0);
    const activeParticipants = new Set(events.map((row) => row.guest_id)).size;

    const { current: recentEvents, previous: priorEvents } = splitByPeriod(events);

    const recentPoints = recentEvents.reduce((sum, row) => sum + row.points, 0);
    const priorPoints = priorEvents.reduce((sum, row) => sum + row.points, 0);
    const recentParticipants = new Set(recentEvents.map((row) => row.guest_id)).size;
    const priorParticipants = new Set(priorEvents.map((row) => row.guest_id)).size;

    const eventCarbon = (row: EventRow) => Number(row.carbon_offset_kg ?? activitiesByName.get(row.activity_id)?.carbon_offset_kg ?? 0);
    const totalCarbon = events.reduce((sum, row) => sum + eventCarbon(row), 0);
    const recentCarbon = recentEvents.reduce((sum, row) => sum + eventCarbon(row), 0);
    const priorCarbon = priorEvents.reduce((sum, row) => sum + eventCarbon(row), 0);

    const summary = {
      totalEcoPoints: totalPoints,
      totalEcoPointsTrend: percentChange(recentPoints, priorPoints),
      activeParticipants,
      activeParticipantsTrend: percentChange(recentParticipants, priorParticipants),
      carbonOffsetKg: Math.round(totalCarbon),
      carbonOffsetTrend: percentChange(recentCarbon, priorCarbon),
    };

    const guestTotals = new Map<string, { points: number; firstName?: string | null; lastName?: string | null; imagePath?: string | null }>();
    for (const row of events) {
      const guest = guestsByName.get(row.guest_id);
      const existing = guestTotals.get(row.guest_id) ?? {
        points: 0,
        firstName: guest?.first_name,
        lastName: guest?.last_name,
        imagePath: guest?.image_path ?? null,
      };
      existing.points += row.points;
      guestTotals.set(row.guest_id, existing);
    }

    const leaderboard = [...guestTotals.entries()]
      .map(([guestId, guest]) => ({
        guestId,
        name: `${guest.firstName ?? ''} ${guest.lastName ?? ''}`.trim() || 'Guest',
        initials: initials(guest.firstName, guest.lastName),
        imagePath: guest.imagePath ?? null,
        tier: resolveTier(guest.points, tiers),
        points: guest.points,
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5)
      .map((entry, index) => ({ rank: index + 1, ...entry }));

    const activityTotals = new Map<string, { name: string; color: string; points: number }>();
    for (const activity of activitiesFromTable) {
      activityTotals.set(activity.id, {
        name: activity.name ?? 'Unknown',
        color: activity.color ?? '#10b981',
        points: 0,
      });
    }

    for (const row of events) {
      const activity = activitiesByName.get(row.activity_id);
      const bucket = activityTotals.get(row.activity_id) ?? {
        name: activity?.name ?? 'Other',
        color: activity?.color ?? '#64748b',
        points: 0,
      };
      bucket.points += row.points;
      activityTotals.set(row.activity_id, bucket);
    }

    const activityDistribution = [...activityTotals.values()]
      .filter((item) => item.points > 0)
      .sort((a, b) => b.points - a.points);

    const monthBuckets = new Map<string, number>();
    for (const row of events) {
      const date = new Date(row.earned_at || row.created_at || 0);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + row.points);
    }

    const monthlyTrend = lastSixMonths().map((month) => ({
      month: month.label,
      points: monthBuckets.get(month.key) ?? 0,
    }));

    return attachSupabaseCookies(NextResponse.json({
      success: true,
      data: {
        summary,
        leaderboard,
        activityDistribution,
        monthlyTrend,
      },
    }), response);
  } catch (error) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    console.error('GET /api/sustainability', error);
    return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Failed to fetch sustainability data' }, { status: 500 }), response);
  }
}

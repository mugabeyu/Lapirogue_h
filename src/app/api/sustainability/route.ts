import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

type EventRow = {
  guest_id: string;
  activity_id: string;
  points: number;
  carbon_offset_kg: number | string;
  earned_at: string;
  sustainability_activities?: { name?: string; color?: string } | { name?: string; color?: string }[] | null;
  guests?: { first_name?: string | null; last_name?: string | null } | { first_name?: string | null; last_name?: string | null }[] | null;
};

type TierRow = {
  name: string;
  min_points: number;
  sort_order: number;
};

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function activityFromEvent(row: EventRow) {
  return pickOne(row.sustainability_activities);
}

function guestFromEvent(row: EventRow) {
  return pickOne(row.guests);
}

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
    const time = new Date(row.earned_at).getTime();
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

export async function GET() {
  try {
    const admin = getSupabaseAdmin();

    const [eventsResult, tiersResult, activitiesResult] = await Promise.all([
      admin
        .from('guest_eco_point_events')
        .select('guest_id, activity_id, points, carbon_offset_kg, earned_at, sustainability_activities(name, color), guests(first_name, last_name)'),
      admin.from('eco_tiers').select('name, min_points, sort_order').order('sort_order', { ascending: true }),
      admin.from('sustainability_activities').select('id, name, color').eq('is_active', true),
    ]);

    if (eventsResult.error) throw eventsResult.error;
    if (tiersResult.error) throw tiersResult.error;
    if (activitiesResult.error) throw activitiesResult.error;

    const events = (eventsResult.data ?? []) as EventRow[];
    const tiers = (tiersResult.data ?? []) as TierRow[];
    const activities = activitiesResult.data ?? [];

    const totalPoints = events.reduce((sum, row) => sum + row.points, 0);
    const totalCarbon = events.reduce((sum, row) => sum + Number(row.carbon_offset_kg), 0);
    const activeParticipants = new Set(events.map((row) => row.guest_id)).size;

    const { current: recentEvents, previous: priorEvents } = splitByPeriod(events);

    const recentPoints = recentEvents.reduce((sum, row) => sum + row.points, 0);
    const priorPoints = priorEvents.reduce((sum, row) => sum + row.points, 0);
    const recentParticipants = new Set(recentEvents.map((row) => row.guest_id)).size;
    const priorParticipants = new Set(priorEvents.map((row) => row.guest_id)).size;
    const recentCarbon = recentEvents.reduce((sum, row) => sum + Number(row.carbon_offset_kg), 0);
    const priorCarbon = priorEvents.reduce((sum, row) => sum + Number(row.carbon_offset_kg), 0);

    const summary = {
      totalEcoPoints: totalPoints,
      totalEcoPointsTrend: percentChange(recentPoints, priorPoints),
      activeParticipants,
      activeParticipantsTrend: percentChange(recentParticipants, priorParticipants),
      carbonOffsetKg: Math.round(totalCarbon),
      carbonOffsetTrend: percentChange(recentCarbon, priorCarbon),
    };

    const guestTotals = new Map<string, { points: number; firstName?: string | null; lastName?: string | null }>();
    for (const row of events) {
      const guest = guestFromEvent(row);
      const existing = guestTotals.get(row.guest_id) ?? {
        points: 0,
        firstName: guest?.first_name,
        lastName: guest?.last_name,
      };
      existing.points += row.points;
      guestTotals.set(row.guest_id, existing);
    }

    const leaderboard = [...guestTotals.entries()]
      .map(([guestId, guest]) => ({
        guestId,
        name: `${guest.firstName ?? ''} ${guest.lastName ?? ''}`.trim() || 'Guest',
        initials: initials(guest.firstName, guest.lastName),
        tier: resolveTier(guest.points, tiers),
        points: guest.points,
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5)
      .map((entry, index) => ({ rank: index + 1, ...entry }));

    const activityTotals = new Map<string, { name: string; color: string; points: number }>();
    for (const activity of activities) {
      activityTotals.set(activity.id, {
        name: activity.name,
        color: activity.color ?? '#10b981',
        points: 0,
      });
    }

    for (const row of events) {
      const activity = activityFromEvent(row);
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
      const date = new Date(row.earned_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + row.points);
    }

    const monthlyTrend = lastSixMonths().map((month) => ({
      month: month.label,
      points: monthBuckets.get(month.key) ?? 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        summary,
        leaderboard,
        activityDistribution,
        monthlyTrend,
      },
    });
  } catch (error) {
    console.error('GET /api/sustainability', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch sustainability data' }, { status: 500 });
  }
}

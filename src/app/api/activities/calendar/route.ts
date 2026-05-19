import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const CATEGORY_COLORS: Record<string, string> = {
  'Water Sports': 'water',
  'Island Tours': 'tours',
  'Wellness & Spa': 'spa',
  Cultural: 'cultural',
  Entertainment: 'cultural',
  Adventure: 'adventure',
  General: 'tours',
};

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateKey(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function buildWeek(anchor: string) {
  const start = startOfWeek(parseDateKey(anchor));
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(toDateKey(addDays(start, i)));
  }
  const end = days[6];
  const label = `${new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric' }).format(start)} - ${new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric', year: 'numeric' }).format(parseDateKey(end))}`;
  return { start: days[0], end, days, label };
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const anchor = params.get('anchor') ?? toDateKey(new Date());
    const category = params.get('category') ?? 'All';
    const week = buildWeek(anchor);
    const today = toDateKey(new Date());

    const supabase = getSupabaseAdmin();

    let activitiesQuery = supabase.from('activities').select('id,name,category,capacity,default_time').eq('status', 'ACTIVE');
    if (category !== 'All') {
      activitiesQuery = activitiesQuery.eq('category', category);
    }

    const { data: activities, error: activitiesError } = await activitiesQuery;
    if (activitiesError) throw activitiesError;

    const { data: bookings, error: bookingsError } = await supabase
      .from('activity_bookings')
      .select('id,activity_id,booking_date,booking_time,participants,status,notes,activities(name,category,capacity),guests(first_name,last_name)')
      .gte('booking_date', week.start)
      .lte('booking_date', week.end)
      .neq('status', 'CANCELLED');

    if (bookingsError) throw bookingsError;

    const sessionsByDay = new Map<string, Array<Record<string, unknown>>>();

    for (const day of week.days) {
      sessionsByDay.set(day, []);
    }

    for (const row of bookings ?? []) {
      const day = row.booking_date as string;
      if (!sessionsByDay.has(day)) continue;

      const activity = row.activities as { name?: string; category?: string; capacity?: number } | null;
      const categoryName = activity?.category ?? 'General';
      const capacity = activity?.capacity ?? 10;
      const participants = (row.participants as number) ?? 0;
      const timeRaw = row.booking_time as string | null;
      const time = timeRaw ? timeRaw.slice(0, 5) : '09:00';

      const guest = row.guests as { first_name?: string; last_name?: string } | null;
      const guestName = guest ? `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim() : 'Guest';

      sessionsByDay.get(day)!.push({
        id: row.id,
        activityId: row.activity_id,
        activityName: activity?.name ?? 'Activity',
        category: categoryName,
        colorKey: CATEGORY_COLORS[categoryName] ?? 'tours',
        time,
        timeLabel: formatTime12(time),
        participants,
        capacity,
        bookedLabel: `${participants}/${capacity} Booked`,
        isFull: participants >= capacity,
        guideName: guestName,
        guests: [{ id: row.id, name: guestName }],
      });
    }

    const filterCategories = ['All', ...Array.from(new Set((activities ?? []).map((a) => a.category as string))).sort()];

    const todaySessions = sessionsByDay.get(today) ?? [];

    return NextResponse.json({
      success: true,
      data: {
        anchor,
        today,
        weekLabel: week.label,
        weekStart: week.start,
        weekEnd: week.end,
        days: week.days.map((date) => ({
          date,
          weekday: new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(parseDateKey(date)),
          day: parseDateKey(date).getDate(),
        })),
        categories: filterCategories,
        sessionsByDay: Object.fromEntries(sessionsByDay),
        todaySessions,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load activity calendar' }, { status: 500 });
  }
}

function formatTime12(time24: string) {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

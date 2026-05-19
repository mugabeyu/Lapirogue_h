import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const activitySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0),
  duration: z.number().int().positive().optional(),
  durationLabel: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  meetingPoint: z.string().optional(),
  requiresAdvanceBooking: z.boolean().optional(),
  weatherDependent: z.boolean().optional(),
  suitableForChildren: z.boolean().optional(),
  defaultTime: z.string().optional(),
  imagePath: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'FULL']).optional(),
});

function parseDurationMinutes(label: string, fallback = 60) {
  const lower = label.toLowerCase();
  if (lower.includes('full day')) return 480;
  const hourMatch = lower.match(/(\d+)\s*h/);
  if (hourMatch) return Number(hourMatch[1]) * 60;
  const minMatch = lower.match(/(\d+)\s*m/);
  if (minMatch) return Number(minMatch[1]);
  return fallback;
}

function parseCapacity(value: string | number, label?: string) {
  if (typeof value === 'number' && value > 0) return value;
  const text = String(label ?? value).toLowerCase();
  if (text.includes('unlimited')) return 99;
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : 10;
}

function formatDuration(minutes: number, label?: string | null) {
  if (label?.trim()) return label.trim();
  if (minutes >= 480) return 'Full Day';
  if (minutes >= 60) return `${Math.round(minutes / 60)} Hours`;
  return `${minutes} min`;
}

function formatCapacity(capacity: number, label?: string | null) {
  if (label?.trim()) return label.trim();
  if (capacity >= 99) return 'Unlimited';
  return `${capacity} max`;
}

type ActivityRow = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number | string;
  duration: number;
  duration_label?: string | null;
  capacity: number;
  meeting_point?: string | null;
  requires_advance_booking?: boolean;
  weather_dependent?: boolean;
  suitable_for_children?: boolean;
  default_time?: string | null;
  status: string;
  image_path?: string | null;
};

function mapActivity(row: ActivityRow, nextSession?: { date: string; time: string | null; label: string } | null) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description ?? undefined,
    price: Number(row.price),
    duration: row.duration,
    durationLabel: formatDuration(row.duration, row.duration_label),
    capacity: row.capacity,
    capacityLabel: formatCapacity(row.capacity),
    meetingPoint: row.meeting_point ?? undefined,
    requiresAdvanceBooking: row.requires_advance_booking ?? false,
    weatherDependent: row.weather_dependent ?? false,
    suitableForChildren: row.suitable_for_children ?? false,
    defaultTime: row.default_time ?? '09:00',
    status: row.status,
    imagePath: row.image_path ?? undefined,
    nextSession: nextSession ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get('search') ?? '';
    const category = request.nextUrl.searchParams.get('category') ?? '';
    const supabase = getSupabaseAdmin();
    let query = supabase.from('activities').select('*').order('name', { ascending: true });

    if (search) {
      query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%`);
    }
    if (category && category !== 'All') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;

    const today = new Date().toISOString().slice(0, 10);
    const { data: upcoming } = await supabase
      .from('activity_bookings')
      .select('activity_id,booking_date,booking_time,status')
      .gte('booking_date', today)
      .neq('status', 'CANCELLED')
      .order('booking_date', { ascending: true });

    const nextByActivity = new Map<string, { date: string; time: string | null; label: string }>();
    for (const booking of upcoming ?? []) {
      const activityId = booking.activity_id as string;
      if (nextByActivity.has(activityId)) continue;
      const date = booking.booking_date as string;
      const time = (booking.booking_time as string | null)?.slice(0, 5) ?? null;
      const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      nextByActivity.set(activityId, {
        date,
        time,
        label: time ? `${dateLabel}, ${formatTime12(time)}` : dateLabel,
      });
    }

    const activities = (data ?? []).map((row) =>
      mapActivity(row as ActivityRow, nextByActivity.get(row.id) ?? null),
    );

    const categories = Array.from(new Set(activities.map((a) => a.category))).sort();

    return NextResponse.json({
      success: true,
      data: activities,
      categories,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch activities' }, { status: 500 });
  }
}

function formatTime12(time24: string) {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function buildInsertPayload(body: z.infer<typeof activitySchema>) {
  const durationLabel = body.durationLabel ?? '';
  const duration = body.duration ?? (durationLabel ? parseDurationMinutes(durationLabel) : 60);
  const capacity = body.capacity ?? 10;

  return {
    name: body.name,
    category: body.category,
    description: body.description,
    price: body.price,
    duration,
    duration_label: durationLabel || formatDuration(duration),
    capacity,
    meeting_point: body.meetingPoint,
    requires_advance_booking: body.requiresAdvanceBooking ?? false,
    weather_dependent: body.weatherDependent ?? false,
    suitable_for_children: body.suitableForChildren ?? false,
    default_time: body.defaultTime ?? '09:00',
    image_path: body.imagePath,
    status: body.status ?? 'ACTIVE',
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = activitySchema.parse(await request.json());
    const { data, error } = await getSupabaseAdmin()
      .from('activities')
      .insert(buildInsertPayload(body))
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data: mapActivity(data as ActivityRow) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to create activity' }, { status: 500 });
  }
}

function buildUpdatePayload(body: z.infer<typeof activitySchema>) {
  const full = buildInsertPayload(body);
  return Object.fromEntries(Object.entries(full).filter(([, value]) => value !== undefined));
}

export async function PUT(request: NextRequest) {
  try {
    const parsed = activitySchema.partial().extend({ id: z.string().uuid() }).parse(await request.json());
    const { id, imagePath, ...rest } = parsed;

    const { data: existing, error: existingError } = await getSupabaseAdmin()
      .from('activities')
      .select('*')
      .eq('id', id)
      .single();
    if (existingError || !existing) {
      return NextResponse.json({ success: false, error: 'Activity not found' }, { status: 404 });
    }

    const merged = {
      name: rest.name ?? existing.name,
      category: rest.category ?? existing.category,
      description: rest.description ?? existing.description ?? undefined,
      price: rest.price ?? Number(existing.price),
      duration: rest.duration ?? existing.duration,
      durationLabel: rest.durationLabel ?? existing.duration_label ?? undefined,
      capacity: rest.capacity ?? existing.capacity,
      meetingPoint: rest.meetingPoint ?? existing.meeting_point ?? undefined,
      requiresAdvanceBooking: rest.requiresAdvanceBooking ?? existing.requires_advance_booking,
      weatherDependent: rest.weatherDependent ?? existing.weather_dependent,
      suitableForChildren: rest.suitableForChildren ?? existing.suitable_for_children,
      defaultTime: rest.defaultTime ?? existing.default_time ?? undefined,
      imagePath: imagePath ?? existing.image_path ?? undefined,
      status: rest.status ?? existing.status,
    };

    const { data, error } = await getSupabaseAdmin()
      .from('activities')
      .update(buildUpdatePayload(merged))
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data: mapActivity(data as ActivityRow) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update activity' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }
    const { error } = await getSupabaseAdmin().from('activities').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Activity deleted' });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete activity' }, { status: 500 });
  }
}

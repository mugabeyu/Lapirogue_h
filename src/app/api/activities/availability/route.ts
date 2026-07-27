import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createApiResponse, validationErrorResponse } from '@/lib/api-response';

/**
 * How many places are left on one activity session (a given activity, on a
 * given date, at a given start time).
 *
 * Capacity is per session rather than per activity: the same tour running on
 * two days has its own allocation each day. Cancelled bookings release their
 * places back.
 */

const querySchema = z.object({
  activityId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date'),
  time: z.string().min(1),
});

/** Accepts `04:30 PM`, `16:30` or `16:30:00` and returns `16:30:00`. */
function toStoredTime(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  if (match[4]) {
    hour = hour % 12;
    if (match[4].toUpperCase() === 'PM') hour += 12;
  }
  return `${String(hour).padStart(2, '0')}:${match[2]}:${match[3] ?? '00'}`;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const parsed = querySchema.parse({
      activityId: params.get('activityId'),
      date: params.get('date'),
      time: params.get('time'),
    });

    const storedTime = toStoredTime(parsed.time);
    if (!storedTime) {
      return createApiResponse(false, 'Unrecognised time slot', { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: activity, error: activityError } = await supabase
      .from('activities')
      .select('id, capacity')
      .eq('id', parsed.activityId)
      .maybeSingle();

    if (activityError) throw activityError;
    if (!activity) {
      return createApiResponse(false, 'Activity not found', { status: 404 });
    }

    const { data: bookings, error: bookingsError } = await supabase
      .from('activity_bookings')
      .select('participants')
      .eq('activity_id', parsed.activityId)
      .eq('booking_date', parsed.date)
      .eq('booking_time', storedTime)
      .neq('status', 'CANCELLED');

    if (bookingsError) throw bookingsError;

    const capacity = Number(activity.capacity ?? 0);
    const booked = (bookings ?? []).reduce(
      (sum, row) => sum + Number(row.participants ?? 0),
      0,
    );

    return createApiResponse(true, {
      capacity,
      booked,
      remaining: Math.max(0, capacity - booked),
    });
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    return createApiResponse(false, 'Failed to check availability');
  }
}

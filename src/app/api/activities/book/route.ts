import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import { awardEcoPoints, removeEcoPointsBySource } from '@/lib/eco-points';

type ActivityBookingRow = {
  id: string;
  booking_date: string | null;
  participants: number | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
  activities?: { name?: string; category?: string; price?: number } | null;
  guests?: { first_name?: string; last_name?: string } | null;
};

const bookingSchema = z.object({
  id: z.string().uuid().optional(),
  activityId: z.string().uuid(),
  guestId: z.string().uuid(),
  date: z.string().min(1),
  timeSlot: z.string().optional(),
  participants: z.number().int().positive(),
  pickupPoint: z.string().optional(),
  status: z.enum(['CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().optional(),
  origin: z.enum(['MOBILE_APP', 'RECEPTION_DESK', 'MANAGER_PORTAL']).optional(),
});

function parseTimeSlot(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (match12?.[4]) {
    let hour = Number(match12[1]) % 12;
    if (match12[4].toUpperCase() === 'PM') hour += 12;
    return `${String(hour).padStart(2, '0')}:${match12[2]}:${match12[3] ?? '00'}`;
  }
  if (/^\d{2}:\d{2}(?::\d{2})?$/.test(trimmed)) {
    const [h, m, s] = trimmed.split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s ?? '00'}`;
  }
  return null;
}

function isWithinRegistrationCutoff(date: string, timeSlot?: string) {
  const parsedTime = parseTimeSlot(timeSlot);
  if (!parsedTime) return false;

  const scheduledAt = new Date(`${date}T${parsedTime}`);
  if (Number.isNaN(scheduledAt.getTime())) return false;

  return scheduledAt.getTime() - Date.now() < 10 * 60 * 1000;
}

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('activity_bookings')
      .select('id,booking_date,participants,status,notes,created_at,activities(name,price),guests(first_name,last_name)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const bookings = (data ?? []) as ActivityBookingRow[];
    return NextResponse.json({
      success: true,
      data: bookings.map((booking) => ({
        id: booking.id,
        activity: booking.activities?.name ?? null,
        guest: booking.guests ? `${booking.guests.first_name ?? ''} ${booking.guests.last_name ?? ''}`.trim() || null : null,
        date: booking.booking_date,
        participants: booking.participants ?? 0,
        status: booking.status,
        notes: booking.notes,
        createdAt: booking.created_at,
      })),
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch bookings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = bookingSchema.parse(await request.json());
    const admin = getSupabaseAdmin();

    if (isWithinRegistrationCutoff(body.date, body.timeSlot)) {
      return NextResponse.json(
        { success: false, error: 'Bookings cannot be registered within 10 minutes of the activity start time' },
        { status: 409 },
      );
    }

    const { data: activeReservation } = await admin
      .from('reservations')
      .select('id, check_in, check_out')
      .eq('guest_id', body.guestId)
      .in('status', ['RESERVED', 'CHECKED_IN'])
      .limit(1)
      .maybeSingle();

    if (!activeReservation) {
      return NextResponse.json({
        success: false,
        error: 'Guest must have an active reservation to book activities.'
      }, { status: 403 });
    }

    // If guest is RESERVED (not checked in), ensure booking date is within reservation dates
    if (activeReservation.status === 'RESERVED') {
      const bookingDate = new Date(body.date);
      const checkIn = new Date(activeReservation.check_in);
      const checkOut = new Date(activeReservation.check_out);
      if (bookingDate < checkIn || bookingDate >= checkOut) {
        return NextResponse.json({
          success: false,
          error: 'Activity booking date must be within your reservation period.'
        }, { status: 403 });
      }
    }

    const { data, error } = await admin
      .from('activity_bookings')
      .insert({
        activity_id: body.activityId,
        guest_id: body.guestId,
        booking_date: body.date,
        booking_time: parseTimeSlot(body.timeSlot),
        participants: body.participants,
        pickup_point: body.pickupPoint,
        status: body.status ?? 'CONFIRMED',
        notes: body.notes,
        origin: body.origin ?? 'RECEPTION_DESK',
      })
      .select('*')
      .single();

    if (error) throw error;

    if ((body.status ?? 'CONFIRMED') === 'COMPLETED') {
      const { data: activity } = await admin
        .from('activities')
        .select('name, category')
        .eq('id', body.activityId)
        .maybeSingle();

      if (activity) {
        await awardEcoPoints({
          sourceType: 'ACTIVITY_BOOKING',
          sourceRecordId: data.id,
          guestId: body.guestId,
          activityName: activity.name,
          activityCategory: activity.category,
          label: activity.name,
          metadata: {
            bookingDate: body.date,
            participants: body.participants,
            pickupPoint: body.pickupPoint ?? null,
          },
        }).catch((awardError) => console.error('Failed to award eco points for booking', awardError));
      }
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to create booking' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = bookingSchema.parse(await request.json());
    const { id, ...updateData } = body as typeof body & { id?: string };
    const admin = getSupabaseAdmin();

    if (isWithinRegistrationCutoff(updateData.date, updateData.timeSlot)) {
      return NextResponse.json(
        { success: false, error: 'Bookings cannot be updated within 10 minutes of the activity start time' },
        { status: 409 },
      );
    }

    const { data: existingBooking } = await admin
      .from('activity_bookings')
      .select('id,status,guest_id,activity_id')
      .eq('id', id)
      .maybeSingle();

    const { data, error } = await admin
      .from('activity_bookings')
      .update({
        activity_id: updateData.activityId,
        guest_id: updateData.guestId,
        booking_date: updateData.date,
        booking_time: parseTimeSlot(updateData.timeSlot),
        participants: updateData.participants,
        pickup_point: updateData.pickupPoint,
        status: updateData.status,
        notes: updateData.notes,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    const resultingStatus = updateData.status ?? existingBooking?.status ?? 'CONFIRMED';
    if (resultingStatus === 'COMPLETED') {
      const { data: activity } = await admin
        .from('activities')
        .select('name, category')
        .eq('id', updateData.activityId)
        .maybeSingle();

      if (activity) {
        await awardEcoPoints({
          sourceType: 'ACTIVITY_BOOKING',
          sourceRecordId: data.id,
          guestId: updateData.guestId,
          activityName: activity.name,
          activityCategory: activity.category,
          label: activity.name,
          metadata: {
            bookingDate: updateData.date,
            participants: updateData.participants,
            pickupPoint: updateData.pickupPoint ?? null,
          },
        }).catch((awardError) => console.error('Failed to award eco points for booking', awardError));
      }
    } else if (existingBooking?.status === 'COMPLETED' && resultingStatus !== 'COMPLETED') {
      await removeEcoPointsBySource('ACTIVITY_BOOKING', data.id).catch((removeError) =>
        console.error('Failed to remove eco points for booking', removeError),
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update booking' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }
    const { error } = await getSupabaseAdmin().from('activity_bookings').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Booking deleted' });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete booking' }, { status: 500 });
  }
}
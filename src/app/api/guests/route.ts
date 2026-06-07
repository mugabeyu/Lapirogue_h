import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuditActor, recordAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { validationErrorResponse, createApiResponse } from '@/lib/api-response';
import { toGuest, type GuestRow } from '@/lib/guests';

const guestSchema = z.object({
  id: z.string().uuid().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  nationality: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().optional(),
  ),
  passport: z.string().optional(),
  dateOfBirth: z.string().optional(),
  vip: z.boolean().optional(),
  status: z.enum(['RESERVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED']).optional(),
  notes: z.string().optional(),
});

async function generateGuestId() {
  const timestamp = Date.now().toString().slice(-6);
  const suffix = Math.floor(Math.random() * 90 + 10);
  return `G-${timestamp}${suffix}`;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || undefined;

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('guests')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,passport.ilike.%${search}%`,
      );
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    const guestRows = (data ?? []) as GuestRow[];
    const guestIds = guestRows.map((row) => row.id);

    const stayByGuest = new Map<string, { checkIn: string; checkOut: string; roomNumber: string | null; roomType: string | null }>();

    if (guestIds.length > 0) {
      const { data: stays } = await supabase
        .from('reservations')
        .select('guest_id,check_in,check_out,status,rooms(room_number,type)')
        .in('guest_id', guestIds)
        .neq('status', 'CANCELLED')
        .order('check_in', { ascending: false });

      for (const stay of stays ?? []) {
        const guestId = stay.guest_id as string;
        if (stayByGuest.has(guestId)) continue;
        const room = stay.rooms as { room_number?: string; type?: string } | null;
        stayByGuest.set(guestId, {
          checkIn: stay.check_in as string,
          checkOut: stay.check_out as string,
          roomNumber: room?.room_number ?? null,
          roomType: room?.type ?? null,
        });
      }
    }

    let guests = guestRows.map((row) => {
      const stay = stayByGuest.get(row.id);
      return {
        ...toGuest(row),
        checkIn: stay?.checkIn,
        checkOut: stay?.checkOut,
        roomNumber: stay?.roomNumber,
        roomType: stay?.roomType,
      };
    });

    if (search) {
      const query = search.toLowerCase();
      guests = guests.filter((guest) => {
        const name = `${guest.firstName} ${guest.lastName}`.toLowerCase();
        const room = guest.roomNumber?.toLowerCase() ?? '';
        const guestCode = guest.guestId.toLowerCase();
        return (
          name.includes(query) ||
          room.includes(query) ||
          guestCode.includes(query) ||
          guest.email?.toLowerCase().includes(query)
        );
      });
    }

    const total = count ?? 0;

    return NextResponse.json({
      success: true,
      data: guests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return createApiResponse(
      false,
      process.env.NODE_ENV === 'production' ? 'Failed to fetch guests' : `Failed to fetch guests: ${message}`,
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  await getAuditActor(request);
  
  try {
    const body = await request.json();
    const validatedData = guestSchema.parse(body);
    const guestId = await generateGuestId();

    const { data, error } = await supabase
      .from('guests')
      .insert({
        guest_id: guestId,
        first_name: validatedData.firstName,
        last_name: validatedData.lastName,
        email: validatedData.email,
        phone: validatedData.phone,
        nationality: validatedData.nationality,
        passport: validatedData.passport,
        date_of_birth: validatedData.dateOfBirth,
        vip: validatedData.vip ?? false,
        status: validatedData.status ?? 'RESERVED',
        notes: validatedData.notes,
      })
      .select('*')
      .single();

    if (error || !data) throw error;
    return createApiResponse(true, toGuest(data as GuestRow), { status: 201 });
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    return createApiResponse(false, 'Failed to create guest', { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = guestSchema.parse(body);
    const supabase = getSupabaseAdmin();
    await getAuditActor(request); // actor not currently used but reserved for future audit

    const { data, error } = await supabase
      .from('guests')
      .update({
        first_name: updateData.firstName,
        last_name: updateData.lastName,
        email: updateData.email,
        phone: updateData.phone,
        nationality: updateData.nationality,
        passport: updateData.passport,
        date_of_birth: updateData.dateOfBirth,
        vip: updateData.vip,
        status: updateData.status,
        notes: updateData.notes,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) throw error;
    return createApiResponse(true, toGuest(data as GuestRow));
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    return createApiResponse(false, 'Failed to update guest', { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return createApiResponse(false, 'ID required', { status: 400 });

  const supabase = getSupabaseAdmin();
  const actor = await getAuditActor(request);
  const actorId = actor?.id ?? null;

  const { data: guest } = await supabase.from('guests').select('*').eq('id', id).maybeSingle();
  if (guest) {
    try {
      await recordAuditLog({ tableName: 'guests', recordId: id, action: 'DELETE', actorId, before: guest as Record<string, unknown> });
    } catch { /* audit skipped */ }
  }

  const [{ count: reservationCount }, { count: activityCount }, { count: paymentCount }, { count: foodOrderCount }, { count: guestOrderCount }, { count: feedbackCount }, { count: messageCount }, { count: scheduleCount }, { count: ecoPointCount }] = await Promise.all([
    supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('guest_id', id).neq('status', 'CANCELLED'),
    supabase.from('activity_bookings').select('id', { count: 'exact', head: true }).eq('guest_id', id).neq('status', 'CANCELLED'),
    supabase.from('payments').select('id', { count: 'exact', head: true }).eq('guest_id', id),
    supabase.from('food_orders').select('id', { count: 'exact', head: true }).eq('guest_id', id),
    supabase.from('guest_orders').select('id', { count: 'exact', head: true }).eq('guest_id', id),
    supabase.from('guest_feedback').select('id', { count: 'exact', head: true }).eq('guest_id', id),
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('guest_id', id),
    supabase.from('guest_schedule_items').select('id', { count: 'exact', head: true }).eq('guest_id', id),
    supabase.from('guest_eco_point_events').select('id', { count: 'exact', head: true }).eq('guest_id', id),
  ]);

  const blockers: string[] = [];
  if (reservationCount && reservationCount > 0) blockers.push(`${reservationCount} reservation(s)`);
  if (activityCount && activityCount > 0) blockers.push(`${activityCount} activity booking(s)`);
  if (paymentCount && paymentCount > 0) blockers.push(`${paymentCount} payment(s)`);
  if (foodOrderCount && foodOrderCount > 0) blockers.push(`${foodOrderCount} food order(s)`);
  if (guestOrderCount && guestOrderCount > 0) blockers.push(`${guestOrderCount} guest order(s)`);
  if (feedbackCount && feedbackCount > 0) blockers.push(`${feedbackCount} feedback review(s)`);
  if (messageCount && messageCount > 0) blockers.push(`${messageCount} message(s)`);
  if (scheduleCount && scheduleCount > 0) blockers.push(`${scheduleCount} schedule item(s)`);
  if (ecoPointCount && ecoPointCount > 0) blockers.push(`${ecoPointCount} eco-point event(s)`);

  if (blockers.length > 0) {
    return createApiResponse(false, `Cannot delete guest: referenced by ${blockers.join(', ')}. Remove or reassign those records first.`, { status: 409 });
  }

  const { error } = await supabase.from('guests').delete().eq('id', id);
  if (error) return createApiResponse(false, 'Failed to delete guest', { status: 500 });
  return createApiResponse(true, { message: 'Guest deleted' });
}

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuditActor, recordAuditLog } from '@/lib/audit';
import { z } from 'zod';

const reservationSchema = z.object({
  id: z.string().uuid().optional(),
  guestId: z.string().uuid(),
  roomId: z.string().uuid(),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  adults: z.number().int().positive(),
  children: z.number().int().min(0),
  totalAmount: z.number().min(0),
  status: z.enum(['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW']).optional(),
});

type ReservationRow = {
  id: string;
  reservation_id?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  adults?: number | null;
  children?: number | null;
  status?: string | null;
  total_amount?: number | string | null;
  guests?: { first_name?: string | null; last_name?: string | null } | null;
  rooms?: { room_number?: string | null; type?: string | null } | null;
};

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get('search') ?? '';
    const guestId = request.nextUrl.searchParams.get('guestId') ?? '';
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('reservations')
      .select('id,reservation_id,guest_id,room_id,check_in,check_out,adults,children,status,total_amount,guests(first_name,last_name),rooms(room_number,type)')
      .order('created_at', { ascending: false });

    if (guestId) {
      query = query.eq('guest_id', guestId);
    }

    if (search) {
      query = query.or(`reservation_id.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as ReservationRow[];
    const mapped = rows.map((reservation) => ({
      id: reservation.id,
      reservationId: reservation.reservation_id ?? null,
      guestId: (reservation as ReservationRow & { guest_id?: string }).guest_id ?? null,
      roomId: (reservation as ReservationRow & { room_id?: string }).room_id ?? null,
      guest: reservation.guests ? `${reservation.guests.first_name ?? ''} ${reservation.guests.last_name ?? ''}`.trim() || null : null,
      room: reservation.rooms?.room_number ?? null,
      roomType: reservation.rooms?.type ?? null,
      checkIn: reservation.check_in ?? null,
      checkOut: reservation.check_out ?? null,
      adults: reservation.adults ?? 0,
      children: reservation.children ?? 0,
      status: reservation.status ?? null,
      totalAmount: reservation.total_amount === undefined || reservation.total_amount === null ? 0 : Number(reservation.total_amount),
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch reservations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = reservationSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();
    const actor = await getAuditActor(request);
    const actorId = actor?.id ?? null;

    const { data: conflicting, error: conflictError } = await supabase
      .from('reservations')
      .select('id')
      .eq('room_id', body.roomId)
      .or(`and(check_in.lte.${body.checkOut},check_out.gte.${body.checkIn})`)
      .neq('status', 'CANCELLED');

    if (conflictError) throw conflictError;

    if (conflicting && conflicting.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Room is not available for the selected dates' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('reservations')
      .insert({
        guest_id: body.guestId,
        room_id: body.roomId,
        check_in: body.checkIn,
        check_out: body.checkOut,
        adults: body.adults,
        children: body.children,
        total_amount: body.totalAmount,
        created_by: actorId,
        updated_by: actorId,
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to create reservation' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = reservationSchema.extend({ id: z.string().uuid() }).parse(body);
    const { id, guestId, roomId, checkIn, checkOut, adults, children, totalAmount, status } = parsed;
    const supabase = getSupabaseAdmin();
    const actor = await getAuditActor(request);
    const actorId = actor?.id ?? null;

    const { data: conflicting, error: conflictError } = await supabase
      .from('reservations')
      .select('id')
      .eq('room_id', roomId)
      .or(`and(check_in.lte.${checkOut},check_out.gte.${checkIn})`)
      .neq('status', 'CANCELLED')
      .neq('id', id);

    if (conflictError) throw conflictError;

    if (conflicting && conflicting.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Room is not available for the selected dates' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('reservations')
      .update({
        guest_id: guestId,
        room_id: roomId,
        check_in: checkIn,
        check_out: checkOut,
        adults,
        children,
        total_amount: totalAmount,
        status,
        updated_by: actorId,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update reservation' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const actor = await getAuditActor(request);
    const actorId = actor?.id ?? null;
    const { data: reservation } = await supabase.from('reservations').select('*').eq('id', id).maybeSingle();

    if (reservation) {
      await recordAuditLog({
        tableName: 'reservations',
        recordId: id,
        action: 'DELETE',
        actorId,
        before: reservation as Record<string, unknown>,
      });
    }

    const { error } = await supabase.from('reservations').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Reservation deleted' });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete reservation' }, { status: 500 });
  }
}

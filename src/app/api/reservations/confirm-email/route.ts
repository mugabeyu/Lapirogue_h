import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { reservationId } = await request.json();
    if (!reservationId) {
      return NextResponse.json({ success: false, error: 'reservationId required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reservationId);
    const { data: reservation, error } = await supabase
      .from('reservations')
      .select('*, guests(*), rooms(*)')
      .eq(isUuid ? 'id' : 'reservation_id', reservationId)
      .maybeSingle();

    if (error || !reservation) {
      return NextResponse.json({ success: false, error: 'Reservation not found' }, { status: 404 });
    }

    const guest = reservation.guests;
    const room = reservation.rooms;

    if (!guest?.email || !room?.room_number) {
      return NextResponse.json({ success: false, error: 'Missing guest email or room number' }, { status: 400 });
    }

    const taxAmount = Math.round(Number(reservation.total_amount) * 0.15);

    const { sendReservationConfirmationEmail } = await import('@/lib/mailer');
    await sendReservationConfirmationEmail({
      to: guest.email,
      guestName: `${guest.first_name || ''} ${guest.last_name || ''}`.trim(),
      roomNumber: room.room_number,
      roomType: room.type,
      checkIn: reservation.check_in,
      checkOut: reservation.check_out,
      totalAmount: Number(reservation.total_amount),
      status: reservation.status,
      reservationId: reservation.reservation_id || reservation.id,
      adults: reservation.adults,
      children: reservation.children,
      taxAmount,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Confirm email error:', error);
    return NextResponse.json({ success: false, error: 'Failed to send confirmation email' }, { status: 500 });
  }
}

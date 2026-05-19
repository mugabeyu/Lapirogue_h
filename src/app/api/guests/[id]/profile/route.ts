import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

type GuestRow = {
  id: string;
  guest_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  passport: string | null;
  date_of_birth: string | null;
  vip: boolean;
  status: string;
  notes: string | null;
  image_path: string | null;
  created_at: string;
  updated_at: string;
};

function toGuest(row: GuestRow) {
  return {
    id: row.id,
    guestId: row.guest_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    nationality: row.nationality ?? undefined,
    passport: row.passport ?? undefined,
    dateOfBirth: row.date_of_birth ?? undefined,
    vip: row.vip,
    status: row.status,
    notes: row.notes ?? undefined,
    imagePath: row.image_path ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (guestError || !guest) {
      return NextResponse.json({ success: false, error: 'Guest not found' }, { status: 404 });
    }

    const { data: reservationsRaw } = await supabase
      .from('reservations')
      .select('id,reservation_id,room_id,check_in,check_out,adults,children,status,total_amount,notes,rooms(room_number,type)')
      .eq('guest_id', id)
      .order('check_in', { ascending: false });

    const reservationIds = (reservationsRaw ?? []).map((r) => r.id);

    const [activityBookingsResult, foodOrdersResult, paymentsByGuest, paymentsByReservation] =
      await Promise.all([
        supabase
          .from('activity_bookings')
          .select('id,booking_date,participants,status,notes,activities(name,price)')
          .eq('guest_id', id)
          .order('booking_date', { ascending: false }),
        supabase
          .from('food_orders')
          .select('id,order_id,total,status,notes,created_at')
          .eq('guest_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('payments')
          .select('id,payment_id,amount,method,status,reference,created_at')
          .eq('guest_id', id)
          .order('created_at', { ascending: false }),
        reservationIds.length > 0
          ? supabase
              .from('payments')
              .select('id,payment_id,amount,method,status,reference,created_at')
              .in('reservation_id', reservationIds)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);

    const reservations = (reservationsRaw ?? []).map((r) => {
      const room = r.rooms as { room_number?: string; type?: string } | null;
      return {
        id: r.id,
        reservationId: r.reservation_id,
        roomId: r.room_id as string,
        checkIn: r.check_in,
        checkOut: r.check_out,
        adults: r.adults,
        children: r.children,
        status: r.status,
        totalAmount: Number(r.total_amount ?? 0),
        notes: r.notes,
        roomNumber: room?.room_number ?? null,
        roomType: room?.type ?? null,
      };
    });

    const activeReservation =
      reservations.find((r) => r.status !== 'CANCELLED' && r.status !== 'CHECKED_OUT') ??
      reservations[0] ??
      null;

    const activityBookings = (activityBookingsResult.data ?? []).map((b) => ({
      id: b.id,
      activity: (b.activities as { name?: string } | null)?.name ?? null,
      date: b.booking_date,
      participants: b.participants,
      status: b.status,
      notes: b.notes,
    }));

    const foodOrders = (foodOrdersResult.data ?? []).map((o) => ({
      id: o.id,
      orderId: o.order_id,
      total: Number(o.total ?? 0),
      status: o.status,
      notes: o.notes,
      createdAt: o.created_at,
    }));

    type PaymentRow = {
      id: string;
      payment_id: string;
      amount: number | string | null;
      method: string;
      status: string;
      reference: string | null;
      created_at: string;
    };
    const paymentMap = new Map<string, PaymentRow>();
    for (const p of (paymentsByGuest.data ?? []) as PaymentRow[]) paymentMap.set(p.id, p);
    for (const p of (paymentsByReservation.data ?? []) as PaymentRow[]) paymentMap.set(p.id, p);

    const payments = Array.from(paymentMap.values()).map((p) => ({
      id: p.id,
      paymentId: p.payment_id,
      amount: Number(p.amount ?? 0),
      method: p.method,
      status: p.status,
      reference: p.reference,
      createdAt: p.created_at,
    }));

    const totalSpent =
      reservations.reduce((sum, r) => sum + r.totalAmount, 0) +
      foodOrders.reduce((sum, o) => sum + o.total, 0);

    return NextResponse.json({
      success: true,
      data: {
        guest: toGuest(guest as GuestRow),
        currentStay: activeReservation,
        reservations,
        activityBookings,
        foodOrders,
        payments,
        stats: {
          totalStays: reservations.length,
          activities: activityBookings.length,
          foodOrders: foodOrders.length,
          totalSpent,
        },
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch guest profile' }, { status: 500 });
  }
}

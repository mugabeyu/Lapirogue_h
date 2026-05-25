import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { buildBillingSummary } from '@/lib/billing';
import { toGuest, type GuestRow } from '@/lib/guests';

export async function GET(_request: NextRequest, context: { params: Promise<unknown> }) {
  try {
    const { id } = (await context.params) as { id: string };
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
            .select('id,order_id,subtotal,service_charge,tax_amount,total,status,notes,created_at')
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

    const { data: extraItemsRaw } = await supabase
      .from('payment_extra_items')
      .select('id,category,label,amount,created_at')
      .eq('guest_id', id)
      .order('created_at', { ascending: false });

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
      amount: Number(((b.activities as { price?: number | string } | null)?.price ?? 0)) * Number(b.participants ?? 0),
      date: b.booking_date,
      participants: b.participants,
      status: b.status,
      notes: b.notes,
    }));

    const foodOrders = (foodOrdersResult.data ?? []).map((o) => ({
      id: o.id,
      orderId: o.order_id,
      subtotal: Number(o.subtotal ?? 0),
      serviceCharge: Number(o.service_charge ?? 0),
      taxAmount: Number(o.tax_amount ?? 0),
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

    const extraCharges = (extraItemsRaw ?? []).map((item) => ({
      category: item.category as 'Transport services' | 'Laundry/services' | 'Additional hotel purchases',
      amount: Number(item.amount ?? 0),
      label: item.label,
      sourceId: item.id,
      createdAt: item.created_at,
    }));

    const billingSummary = buildBillingSummary({
      roomCharges: reservations.map((reservation) => ({
        amount: reservation.totalAmount,
        label: `Reservation ${reservation.reservationId}`,
        sourceId: reservation.id,
        createdAt: reservation.checkIn,
      })),
      activityCharges: activityBookings
        .filter((booking) => Boolean(booking.amount))
        .map((booking) => ({
          amount: booking.amount ?? 0,
          label: booking.activity ?? 'Activity booking',
          sourceId: booking.id,
          createdAt: booking.date,
        })),
      foodOrders: foodOrders.map((order) => ({
        id: order.id,
        orderId: order.orderId,
        subtotal: order.subtotal,
        serviceCharge: order.serviceCharge,
        taxAmount: order.taxAmount,
        total: order.total,
        createdAt: order.createdAt,
      })),
      extraCharges,
      payments: payments.map((payment) => ({
        amount: payment.amount,
        status: payment.status,
      })),
    });

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
          totalSpent: billingSummary.totalCharges,
          balanceDue: billingSummary.balanceDue,
        },
        billingSummary,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch guest profile' }, { status: 500 });
  }
}

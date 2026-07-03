import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { buildBillingSummary } from '@/lib/billing';
import { z } from 'zod';

type PaymentRow = {
  id: string;
  payment_id: string;
  guest_id: string | null;
  reservation_id: string | null;
  amount: number | string | null;
  method: string;
  status: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
  guests?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    nationality?: string | null;
    passport?: string | null;
  } | null;
  reservations?: {
    id?: string | null;
    reservation_id?: string | null;
    check_in?: string | null;
    check_out?: string | null;
    total_amount?: number | string | null;
    rooms?: { room_number?: string | null; type?: string | null } | null;
  } | null;
};

export async function GET(_request: NextRequest, context: { params: Promise<unknown> }) {
  try {
    const { id } = (await context.params) as { id: string };
    const supabase = getSupabaseAdmin();

    const { data: payment, error } = await supabase
      .from('payments')
      .select('id,payment_id,guest_id,reservation_id,amount,method,status,reference,notes,created_at,guests(first_name,last_name,email,phone,nationality,passport),reservations(id,reservation_id,check_in,check_out,total_amount,rooms(room_number,type))')
      .eq('id', id)
      .maybeSingle();

    if (error || !payment) {
      return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });
    }

    const row = payment as PaymentRow;
    const guestId = row.guest_id;
    const reservationId = row.reservation_id;

    const [reservationsResult, foodOrdersResult, activityBookingsResult, paymentsResult] = await Promise.all([
      guestId
        ? supabase
            .from('reservations')
            .select('id,reservation_id,check_in,check_out,total_amount,rooms(room_number,type)')
            .eq('guest_id', guestId)
            .neq('status', 'CANCELLED')
            .neq('status', 'NO_SHOW')
            .order('check_in', { ascending: false })
        : Promise.resolve({ data: [] }),
      guestId
        ? supabase
            .from('food_orders')
            .select('id,order_id,subtotal,service_charge,tax_amount,total,created_at,status,notes')
            .eq('guest_id', guestId)
            .neq('status', 'CANCELLED')
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      guestId
        ? supabase
            .from('activity_bookings')
            .select('id,booking_date,participants,status,notes,activities(name,price)')
            .eq('guest_id', guestId)
            .neq('status', 'CANCELLED')
            .order('booking_date', { ascending: false })
        : Promise.resolve({ data: [] }),
      guestId
        ? supabase
            .from('payments')
            .select('id,payment_id,amount,method,status,reference,created_at')
            .eq('guest_id', guestId)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    const extraItemsResult = guestId
      ? await supabase
          .from('payment_extra_items')
          .select('id,category,label,amount,created_at')
          .eq('guest_id', guestId)
          .order('created_at', { ascending: false })
      : { data: [] as Array<{ id: string; category: string; label: string; amount: number | string | null; created_at: string | null }> };

    const reservations = ((reservationsResult.data ?? []) as Array<{
      id: string;
      reservation_id: string;
      check_in: string;
      check_out: string;
      total_amount: number | string | null;
      rooms?: { room_number?: string | null; type?: string | null } | null;
    }>).map((reservation) => ({
      id: reservation.id,
      reservationId: reservation.reservation_id,
      checkIn: reservation.check_in,
      checkOut: reservation.check_out,
      totalAmount: Number(reservation.total_amount ?? 0),
      roomNumber: reservation.rooms?.room_number ?? null,
      roomType: reservation.rooms?.type ?? null,
    }));

    const foodOrders = ((foodOrdersResult.data ?? []) as Array<{
      id: string;
      order_id: string;
      subtotal?: number | string | null;
      service_charge?: number | string | null;
      tax_amount?: number | string | null;
      total: number | string | null;
      created_at: string;
      status: string;
      notes: string | null;
    }>).map((order) => ({
      id: order.id,
      orderId: order.order_id,
      subtotal: Number(order.subtotal ?? 0),
      serviceCharge: Number(order.service_charge ?? 0),
      taxAmount: Number(order.tax_amount ?? 0),
      total: Number(order.total ?? 0),
      createdAt: order.created_at,
      status: order.status,
      notes: order.notes,
    }));

    const activityBookings = ((activityBookingsResult.data ?? []) as Array<{
      id: string;
      booking_date: string;
      participants: number;
      status: string;
      notes: string | null;
      activities?: { name?: string | null; price?: number | string | null } | null;
    }>).map((booking) => ({
      id: booking.id,
      activity: booking.activities?.name ?? null,
      amount: Number(booking.activities?.price ?? 0) * Number(booking.participants ?? 0),
      date: booking.booking_date,
      participants: booking.participants,
      status: booking.status,
      notes: booking.notes,
    }));

    const payments = ((paymentsResult.data ?? []) as Array<{
      id: string;
      payment_id: string;
      amount: number | string | null;
      method: string;
      status: string;
      reference: string | null;
      created_at: string;
    }>).map((paymentRow) => ({
      id: paymentRow.id,
      paymentId: paymentRow.payment_id,
      amount: Number(paymentRow.amount ?? 0),
      method: paymentRow.method,
      status: paymentRow.status,
      reference: paymentRow.reference,
      createdAt: paymentRow.created_at,
    }));

    const billingSummary = buildBillingSummary({
      roomCharges: reservations.map((reservation) => ({
        amount: reservation.totalAmount,
        label: `Reservation ${reservation.reservationId}`,
        sourceId: reservation.id,
        createdAt: reservation.checkIn,
      })),
      activityCharges: activityBookings
        .filter((booking) => booking.amount > 0)
        .map((booking) => ({
          amount: booking.amount,
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
      extraCharges: (extraItemsResult.data ?? []).map((item) => ({
        category: item.category as 'Transport services' | 'Laundry/services' | 'Additional hotel purchases',
        amount: Number(item.amount ?? 0),
        label: item.label,
        sourceId: item.id,
        createdAt: item.created_at,
      })),
      payments: payments.map((item) => ({ amount: item.amount, status: item.status })),
    });

    return NextResponse.json({
      success: true,
      data: {
        payment: {
          id: row.id,
          paymentId: row.payment_id,
          guestId: row.guest_id,
          reservationId: row.reservation_id,
          amount: Number(row.amount ?? 0),
          method: row.method,
          status: row.status,
          reference: row.reference,
          notes: row.notes,
          createdAt: row.created_at,
        },
        guest: row.guests
          ? {
              firstName: row.guests.first_name ?? '',
              lastName: row.guests.last_name ?? '',
              email: row.guests.email ?? null,
              phone: row.guests.phone ?? null,
              nationality: row.guests.nationality ?? null,
              passport: row.guests.passport ?? null,
            }
          : null,
        reservation: row.reservations
          ? {
              id: row.reservations.id ?? null,
              reservationId: row.reservations.reservation_id ?? null,
              checkIn: row.reservations.check_in ?? null,
              checkOut: row.reservations.check_out ?? null,
              totalAmount: Number(row.reservations.total_amount ?? 0),
              roomNumber: row.reservations.rooms?.room_number ?? null,
              roomType: row.reservations.rooms?.type ?? null,
            }
          : null,
        billingSummary,
        charges: billingSummary.items,
        payments,
        generatedAt: new Date().toISOString(),
        invoiceReference: row.payment_id,
        reservationLookupId: reservationId,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch payment details' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<unknown> }) {
  try {
    const { id } = (await context.params) as { id: string };
    const body = await request.json();

    const paymentSchema = z.object({
      guestId: z.string().uuid(),
      reservationId: z.string().uuid().optional(),
      amount: z.number().min(0.01),
      method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE']),
      status: z.enum(['PENDING', 'PARTIALLY_PAID', 'PAID', 'REFUNDED']).optional(),
      reference: z.string().optional(),
      notes: z.string().optional(),
    });

    const parsed = paymentSchema.parse(body);
    const supabase = getSupabaseAdmin();

    const { data: existingPayment, error: existingError } = await supabase
      .from('payments')
      .select('status')
      .eq('id', id)
      .maybeSingle();

    if (existingError || !existingPayment) {
      return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });
    }

    if (['PAID', 'REFUNDED'].includes(String(existingPayment.status ?? '').toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'Finalized payments are immutable and cannot be updated' },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from('payments')
      .update({
        guest_id: parsed.guestId,
        reservation_id: parsed.reservationId ?? null,
        amount: parsed.amount,
        method: parsed.method,
        status: parsed.status ?? 'PENDING',
        reference: parsed.reference,
        notes: parsed.notes,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update payment' }, { status: 500 });
  }
}
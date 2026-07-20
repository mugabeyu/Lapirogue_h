import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { buildBillingSummary } from '@/lib/billing';
import type { BillingChargeCategory } from '@/lib/billing';
import { sendInvoiceEmail } from '@/lib/mailer';
import { buildInvoicePdfBase64 } from '@/lib/invoice-pdf';

type EmbeddedRelation<T> = T | T[] | null;

type PaymentInvoiceRow = {
  id: string;
  payment_id?: string | null;
  guest_id?: string | null;
  reservation_id?: string | null;
  amount?: number | string | null;
  method?: string | null;
  status?: string | null;
  reference?: string | null;
  notes?: string | null;
  created_at?: string | null;
  guests?: EmbeddedRelation<{
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    nationality?: string | null;
    passport?: string | null;
  }>;
  reservations?: EmbeddedRelation<{
    id?: string | null;
    reservation_id?: string | null;
    check_in?: string | null;
    check_out?: string | null;
    total_amount?: number | string | null;
    rooms?: EmbeddedRelation<{ room_number?: string | null; type?: string | null }>;
  }>;
};

type ReservationChargeRow = {
  id: string;
  reservation_id?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  total_amount?: number | string | null;
  rooms?: EmbeddedRelation<{ room_number?: string | null; type?: string | null }>;
};

type FoodOrderChargeRow = {
  id: string;
  order_id?: string | null;
  subtotal?: number | string | null;
  service_charge?: number | string | null;
  tax_amount?: number | string | null;
  total?: number | string | null;
  created_at?: string | null;
};

type ActivityBookingChargeRow = {
  id: string;
  booking_date?: string | null;
  participants?: number | string | null;
  activities?: EmbeddedRelation<{ name?: string | null; price?: number | string | null }>;
};

type PaymentHistoryRow = {
  id: string;
  payment_id?: string | null;
  amount?: number | string | null;
  method?: string | null;
  status?: string | null;
  reference?: string | null;
  created_at?: string | null;
};

type ExtraChargeRow = {
  id: string;
  category: Exclude<BillingChargeCategory, 'Room charges' | 'Food & Beverage orders' | 'Tours and activities' | 'Taxes and service charges'>;
  label: string;
  amount?: number | string | null;
  created_at?: string | null;
};

function firstRelation<T>(value: EmbeddedRelation<T> | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function POST(_request: NextRequest, context: { params: Promise<unknown> }) {
  try {
    const { id } = (await context.params) as { id: string };
    const supabase = getSupabaseAdmin();

    const { data: paymentRow, error } = await supabase
      .from('payments')
      .select('id,payment_id,guest_id,reservation_id,amount,method,status,reference,notes,created_at,guests(first_name,last_name,email,phone,nationality,passport),reservations(id,reservation_id,check_in,check_out,total_amount,rooms(room_number,type))')
      .eq('id', id)
      .maybeSingle();

    if (error || !paymentRow) return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });

    const typedPaymentRow = paymentRow as PaymentInvoiceRow;
    const guestId = typedPaymentRow.guest_id ?? null;

    const [reservationsResult, foodOrdersResult, activityBookingsResult, paymentsResult] = await Promise.all([
      guestId
        ? supabase.from('reservations').select('id,reservation_id,check_in,check_out,total_amount,rooms(room_number,type)').eq('guest_id', guestId).neq('status', 'CANCELLED').neq('status', 'NO_SHOW').order('check_in', { ascending: false })
        : Promise.resolve({ data: [] }),
      guestId
        ? supabase.from('food_orders').select('id,order_id,subtotal,service_charge,tax_amount,total,created_at,status,notes').eq('guest_id', guestId).neq('status', 'CANCELLED').order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      guestId
        ? supabase.from('activity_bookings').select('id,booking_date,participants,status,notes,activities(name,price)').eq('guest_id', guestId).neq('status', 'CANCELLED').order('booking_date', { ascending: false })
        : Promise.resolve({ data: [] }),
      guestId
        ? supabase.from('payments').select('id,payment_id,amount,method,status,reference,created_at').eq('guest_id', guestId).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    const extraItemsResult = guestId
      ? await supabase.from('payment_extra_items').select('id,category,label,amount,created_at').eq('guest_id', guestId).order('created_at', { ascending: false })
      : { data: [] };

    const reservations = ((reservationsResult.data ?? []) as ReservationChargeRow[]).map((reservation) => {
      const room = firstRelation(reservation.rooms);
      return {
        id: reservation.id,
        reservationId: reservation.reservation_id ?? 'N/A',
        checkIn: reservation.check_in ?? null,
        checkOut: reservation.check_out ?? null,
        totalAmount: Number(reservation.total_amount ?? 0),
        roomNumber: room?.room_number ?? null,
      };
    });

    const foodOrders = ((foodOrdersResult.data ?? []) as FoodOrderChargeRow[]).map((order) => ({
      id: order.id,
      orderId: order.order_id ?? 'N/A',
      subtotal: Number(order.subtotal ?? 0),
      serviceCharge: Number(order.service_charge ?? 0),
      taxAmount: Number(order.tax_amount ?? 0),
      total: Number(order.total ?? 0),
      createdAt: order.created_at ?? null,
    }));

    const activityBookings = ((activityBookingsResult.data ?? []) as ActivityBookingChargeRow[]).map((booking) => {
      const activity = firstRelation(booking.activities);
      return {
        id: booking.id,
        activity: activity?.name ?? null,
        amount: Number(activity?.price ?? 0) * Number(booking.participants ?? 0),
        date: booking.booking_date ?? null,
      };
    });

    const payments = ((paymentsResult.data ?? []) as PaymentHistoryRow[]).map((payment) => ({
      amount: Number(payment.amount ?? 0),
      status: payment.status ?? 'PENDING',
    }));

    const extraCharges = ((extraItemsResult.data ?? []) as ExtraChargeRow[]).map((item) => ({
      id: item.id,
      category: item.category,
      amount: Number(item.amount ?? 0),
      label: item.label,
      createdAt: item.created_at,
    }));

    const billingSummary = buildBillingSummary({
      roomCharges: reservations.map((r) => ({ amount: r.totalAmount, label: `Reservation ${r.reservationId}`, sourceId: r.id, createdAt: r.checkIn })),
      activityCharges: activityBookings.map((b) => ({ amount: b.amount, label: b.activity ?? 'Activity booking', sourceId: b.id, createdAt: b.date })),
      foodOrders: foodOrders.map((o) => ({ id: o.id, orderId: o.orderId, subtotal: o.subtotal, serviceCharge: o.serviceCharge, taxAmount: o.taxAmount, total: o.total, createdAt: o.createdAt })),
      extraCharges: extraCharges.map((charge) => ({
        category: charge.category,
        amount: charge.amount,
        label: charge.label,
        sourceId: charge.id,
        createdAt: charge.createdAt,
      })),
      payments,
    });

    const guestRow = firstRelation(typedPaymentRow.guests);
    const reservationRow = firstRelation(typedPaymentRow.reservations);

    const guest = guestRow
      ? {
          firstName: guestRow.first_name ?? '',
          lastName: guestRow.last_name ?? '',
          email: guestRow.email ?? '',
          phone: guestRow.phone ?? null,
          nationality: guestRow.nationality ?? null,
          passport: guestRow.passport ?? null,
        }
      : null;

    if (!guest || !guest.email) return NextResponse.json({ success: false, error: 'Guest email not available' }, { status: 400 });

    const invoiceReference = String(typedPaymentRow.payment_id ?? 'INV-UNKNOWN');
    const generatedAt = new Date().toISOString();
    const guestName = `${guest.firstName} ${guest.lastName}`.trim() || 'Guest';

    const pdfBase64 = buildInvoicePdfBase64({
      invoiceReference,
      generatedAt,
      invoiceStatus: billingSummary.status,
      guestName,
      guestEmail: guest.email,
      guestPhone: guest.phone,
      guestPassport: guest.passport,
      guestNationality: guest.nationality,
      reservationLabel: reservationRow?.reservation_id ?? 'Walk-in / Guest charge',
      paymentMethod: String(typedPaymentRow.method ?? 'N/A'),
      paymentStatus: String(typedPaymentRow.status ?? 'PENDING'),
      paymentReference: typedPaymentRow.reference ?? null,
      paymentNotes: typedPaymentRow.notes ?? null,
      items: billingSummary.items.map((it) => ({ category: it.category, label: it.label, amount: it.amount, createdAt: it.createdAt })),
      totals: billingSummary.totals,
      totalCharges: billingSummary.totalCharges,
      totalPaid: billingSummary.totalPaid,
      balanceDue: billingSummary.balanceDue,
      payments: ((paymentsResult.data ?? []) as PaymentHistoryRow[]).map((payment) => ({
        paymentId: String(payment.payment_id ?? 'N/A'),
        amount: Number(payment.amount ?? 0),
        method: String(payment.method ?? 'N/A'),
        status: String(payment.status ?? 'PENDING'),
      })),
    });

    await sendInvoiceEmail({
      to: guest.email,
      guestName,
      invoiceReference,
      pdfBase64,
    });

    return NextResponse.json({ success: true, message: 'Invoice sent' });
  } catch (error) {
    console.error('Send invoice failed', error);
    return NextResponse.json({ success: false, error: 'Failed to send invoice' }, { status: 500 });
  }
}

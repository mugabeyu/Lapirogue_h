import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { buildBillingSummary } from '@/lib/billing';
import { sendInvoiceEmail } from '@/lib/mailer';
import { buildInvoicePdfBase64 } from '@/lib/invoice-pdf';

export async function POST(_request: NextRequest, context: { params: Promise<unknown> }) {
  try {
    const { id } = (await context.params) as { id: string };
    const supabase = getSupabaseAdmin();
    const body = await _request.json().catch(() => null);
    const clientPdfBase64 = typeof body?.pdfBase64 === 'string' && body.pdfBase64.length > 0 ? body.pdfBase64 : null;

    const { data: paymentRow, error } = await supabase
      .from('payments')
      .select('id,payment_id,guest_id,reservation_id,amount,method,status,reference,notes,created_at,guests(first_name,last_name,email,phone,nationality,passport),reservations(id,reservation_id,check_in,check_out,total_amount,rooms(room_number,type))')
      .eq('id', id)
      .maybeSingle();

    if (error || !paymentRow) return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });

    const guestId = paymentRow.guest_id as string | null;

    const [reservationsResult, foodOrdersResult, activityBookingsResult, paymentsResult] = await Promise.all([
      guestId
        ? supabase.from('reservations').select('id,reservation_id,check_in,check_out,total_amount,rooms(room_number,type)').eq('guest_id', guestId).order('check_in', { ascending: false })
        : Promise.resolve({ data: [] }),
      guestId
        ? supabase.from('food_orders').select('id,order_id,subtotal,service_charge,tax_amount,total,created_at,status,notes').eq('guest_id', guestId).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      guestId
        ? supabase.from('activity_bookings').select('id,booking_date,participants,status,notes,activities(name,price)').eq('guest_id', guestId).order('booking_date', { ascending: false })
        : Promise.resolve({ data: [] }),
      guestId
        ? supabase.from('payments').select('id,payment_id,amount,method,status,reference,created_at').eq('guest_id', guestId).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    const extraItemsResult = guestId
      ? await supabase.from('payment_extra_items').select('id,category,label,amount,created_at').eq('guest_id', guestId).order('created_at', { ascending: false })
      : { data: [] };

    const reservations = (reservationsResult.data ?? []).map((r: any) => ({ id: r.id, reservationId: r.reservation_id, checkIn: r.check_in, checkOut: r.check_out, totalAmount: Number(r.total_amount ?? 0), roomNumber: r.rooms?.room_number ?? null }));

    const foodOrders = (foodOrdersResult.data ?? []).map((o: any) => ({ id: o.id, orderId: o.order_id, subtotal: Number(o.subtotal ?? 0), serviceCharge: Number(o.service_charge ?? 0), taxAmount: Number(o.tax_amount ?? 0), total: Number(o.total ?? 0), createdAt: o.created_at }));

    const activityBookings = (activityBookingsResult.data ?? []).map((b: any) => ({ id: b.id, activity: b.activities?.name ?? null, amount: Number(b.activities?.price ?? 0) * Number(b.participants ?? 0), date: b.booking_date }));

    const payments = (paymentsResult.data ?? []).map((p: any) => ({ amount: Number(p.amount ?? 0), status: p.status }));

    const extraCharges = (extraItemsResult.data ?? []).map((it: any) => ({
      id: it.id,
      category: it.category,
      amount: Number(it.amount ?? 0),
      label: it.label,
      createdAt: it.created_at,
    }));

    const billingSummary = buildBillingSummary({
      roomCharges: reservations.map((r) => ({ amount: r.totalAmount, label: `Reservation ${r.reservationId}`, sourceId: r.id, createdAt: r.checkIn })),
      activityCharges: activityBookings.map((b) => ({ amount: b.amount, label: b.activity ?? 'Activity booking', sourceId: b.id, createdAt: b.date })),
      foodOrders: foodOrders.map((o) => ({ id: o.id, orderId: o.orderId, subtotal: o.subtotal, serviceCharge: o.serviceCharge, taxAmount: o.taxAmount, total: o.total, createdAt: o.createdAt })),
      extraCharges: extraCharges.map((c) => ({ category: c.category as any, amount: c.amount, label: c.label, sourceId: c.id, createdAt: c.createdAt })),
      payments,
    });

    const guestRow = Array.isArray((paymentRow as any).guests) ? (paymentRow as any).guests[0] : (paymentRow as any).guests;
    const reservationRow = Array.isArray((paymentRow as any).reservations) ? (paymentRow as any).reservations[0] : (paymentRow as any).reservations;

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

    const invoiceReference = String(paymentRow.payment_id ?? 'INV-UNKNOWN');
    const generatedAt = new Date().toISOString();
    const guestName = `${guest.firstName} ${guest.lastName}`.trim() || 'Guest';

    const generatedPdfBase64 = buildInvoicePdfBase64({
      invoiceReference,
      generatedAt,
      invoiceStatus: billingSummary.status,
      guestName,
      guestEmail: guest.email,
      guestPhone: guest.phone,
      guestPassport: guest.passport,
      guestNationality: guest.nationality,
      reservationLabel: reservationRow?.reservation_id ?? 'Walk-in / Guest charge',
      paymentMethod: String((paymentRow as any).method ?? 'N/A'),
      paymentStatus: String((paymentRow as any).status ?? 'PENDING'),
      paymentReference: (paymentRow as any).reference ?? null,
      paymentNotes: (paymentRow as any).notes ?? null,
      items: billingSummary.items.map((it) => ({ category: it.category, label: it.label, amount: it.amount, createdAt: it.createdAt })),
      totals: billingSummary.totals,
      totalCharges: billingSummary.totalCharges,
      totalPaid: billingSummary.totalPaid,
      balanceDue: billingSummary.balanceDue,
      payments: (paymentsResult.data ?? []).map((p: any) => ({
        paymentId: String(p.payment_id ?? 'N/A'),
        amount: Number(p.amount ?? 0),
        method: String(p.method ?? 'N/A'),
        status: String(p.status ?? 'PENDING'),
      })),
    });

    await sendInvoiceEmail({
      to: guest.email,
      guestName,
      invoiceReference,
      pdfBase64: clientPdfBase64 ?? generatedPdfBase64,
    });

    return NextResponse.json({ success: true, message: 'Invoice sent' });
  } catch (error) {
    console.error('Send invoice failed', error);
    return NextResponse.json({ success: false, error: 'Failed to send invoice' }, { status: 500 });
  }
}

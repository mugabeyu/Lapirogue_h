import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuditActor } from '@/lib/audit';
import { attachSupabaseCookies, getRouteHandlerSupabaseSession } from '@/lib/supabase-server';
import { z } from 'zod';

const extraChargeSchema = z.object({
  category: z.enum(['Transport services', 'Laundry/services', 'Additional hotel purchases']),
  label: z.string().min(1).max(120),
  amount: z.number().min(0.01),
});

const paymentSchema = z.object({
  id: z.string().uuid().optional(),
  guestId: z.string().uuid(),
  reservationId: z.string().uuid().optional(),
  amount: z.number().min(0.01),
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE']),
  status: z.enum(['PENDING', 'PARTIALLY_PAID', 'PAID', 'REFUNDED']).optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  extraCharges: z.array(extraChargeSchema).optional().default([]),
});

type PaymentRow = {
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
};

type GuestRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  image_path?: string | null;
};

type ReservationRow = {
  id: string;
  reservation_id?: string | null;
  guest_id?: string | null;
};

async function loadPaymentGuests(guestIds: string[]): Promise<Map<string, GuestRow>> {
  if (!guestIds.length) return new Map<string, GuestRow>();

  const { data, error } = await getSupabaseAdmin()
    .from('guests')
    .select('id, first_name, last_name, image_path')
    .in('id', guestIds);

  if (error) throw error;
  return new Map((data ?? []).map((guest) => [guest.id, guest] as const));
}

async function loadPaymentReservations(reservationIds: string[]): Promise<Map<string, ReservationRow>> {
  if (!reservationIds.length) return new Map<string, ReservationRow>();

  const { data, error } = await getSupabaseAdmin()
    .from('reservations')
    .select('id, reservation_id, guest_id')
    .in('id', reservationIds);

  if (error) throw error;
  return new Map((data ?? []).map((reservation) => [reservation.id, reservation] as const));
}

function guestNameFromRows(guest?: GuestRow | null, reservation?: ReservationRow | null, guestsByName?: Map<string, GuestRow>) {
  if (guest) {
    return `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim() || null;
  }
  const reservationGuest = reservation?.guest_id ? guestsByName?.get(reservation.guest_id) : null;
  return reservationGuest ? `${reservationGuest.first_name ?? ''} ${reservationGuest.last_name ?? ''}`.trim() || null : null;
}

export async function GET(request: NextRequest) {
  const { user, error: userError, response } = await getRouteHandlerSupabaseSession(request);
  if (!user || userError) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), response);
  }

  try {
    const search = request.nextUrl.searchParams.get('search') ?? '';
    const { data, error } = await getSupabaseAdmin()
      .from('payments')
      .select('id,payment_id,guest_id,reservation_id,amount,method,status,reference,notes,created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as PaymentRow[];
    const guestIds = [...new Set(rows.map((payment) => payment.guest_id).filter((id): id is string => Boolean(id)))];
    const reservationIds = [...new Set(rows.map((payment) => payment.reservation_id).filter((id): id is string => Boolean(id)))];

    const [guestsByName, reservationsById] = await Promise.all([
      loadPaymentGuests(guestIds),
      loadPaymentReservations(reservationIds),
    ]);

    const payments = rows.map((payment) => {
      const guest = guestsByName.get(payment.guest_id ?? '');
      const reservation = payment.reservation_id ? reservationsById.get(payment.reservation_id) : null;
      return {
        id: payment.id,
        paymentId: payment.payment_id ?? null,
        guestId: payment.guest_id ?? null,
        reservationId: payment.reservation_id ?? null,
        reservation: reservation?.reservation_id ?? null,
        guest: guestNameFromRows(guest, reservation, guestsByName),
        guestImagePath: guest?.image_path ?? null,
        amount: payment.amount === undefined || payment.amount === null ? 0 : Number(payment.amount),
        method: payment.method ?? null,
        status: payment.status ?? null,
        reference: payment.reference ?? null,
        notes: payment.notes ?? null,
        createdAt: payment.created_at ?? null,
      };
    });

    return attachSupabaseCookies(NextResponse.json({
      success: true,
      data: search
        ? payments.filter((payment) => JSON.stringify(payment).toLowerCase().includes(search.toLowerCase()))
        : payments,
    }), response);
  } catch (error) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return attachSupabaseCookies(NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch payments' }, { status: 500 }), response);
  }
}

export async function POST(request: NextRequest) {
  const { user, error: userError, response } = await getRouteHandlerSupabaseSession(request);
  if (!user || userError) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), response);
  }

  try {
    const body = paymentSchema.parse(await request.json());
    const admin = getSupabaseAdmin();
    await getAuditActor(request);

    const { data, error } = await admin
      .from('payments')
      .insert({
        guest_id: body.guestId,
        reservation_id: body.reservationId ?? null,
        amount: body.amount,
        method: body.method,
        status: body.status ?? 'PENDING',
        reference: body.reference,
        notes: body.notes,
      })
      .select('*')
      .single();

    if (error) throw error;

    if ((body.extraCharges?.length ?? 0) > 0) {
      const { error: extrasError } = await admin.from('payment_extra_items').insert(
        body.extraCharges.map((item) => ({
          payment_id: data.id,
          guest_id: body.guestId,
          reservation_id: body.reservationId ?? null,
          category: item.category,
          label: item.label,
          amount: item.amount,
        })),
      );

      if (extrasError) throw extrasError;
    }

    return attachSupabaseCookies(NextResponse.json({ success: true, data }, { status: 201 }), response);
  } catch (error) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    if (error instanceof z.ZodError) {
      return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 }), response);
    }
    return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Failed to create payment' }, { status: 500 }), response);
  }
}

export async function PUT(request: NextRequest) {
  const { user, error: userError, response } = await getRouteHandlerSupabaseSession(request);
  if (!user || userError) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), response);
  }

  try {
    const body = paymentSchema.extend({ id: z.string().uuid() }).parse(await request.json());
    const { id, guestId, reservationId, amount, method, status, reference, notes, extraCharges } = body;
    const admin = getSupabaseAdmin();
    await getAuditActor(request);

    const { data: existingPayment, error: existingError } = await admin
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

    const { data, error } = await admin
      .from('payments')
      .update({
        guest_id: guestId,
        reservation_id: reservationId ?? null,
        amount,
        method,
        status,
        reference,
        notes,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    const { error: deleteExtrasError } = await admin.from('payment_extra_items').delete().eq('payment_id', id);
    if (deleteExtrasError) throw deleteExtrasError;

    if ((extraCharges?.length ?? 0) > 0) {
      const { error: extrasError } = await admin.from('payment_extra_items').insert(
        extraCharges.map((item) => ({
          payment_id: id,
          guest_id: guestId,
          reservation_id: reservationId ?? null,
          category: item.category,
          label: item.label,
          amount: item.amount,
        })),
      );
      if (extrasError) throw extrasError;
    }

    return attachSupabaseCookies(NextResponse.json({ success: true, data }), response);
  } catch (error) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    if (error instanceof z.ZodError) {
      return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 }), response);
    }
    return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Failed to update payment' }, { status: 500 }), response);
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error: userError, response } = await getRouteHandlerSupabaseSession(request);
  if (!user || userError) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), response);
  }

  return attachSupabaseCookies(
    NextResponse.json(
      { success: false, error: 'Payments are immutable and cannot be deleted' },
      { status: 405 },
    ),
    response,
  );
}

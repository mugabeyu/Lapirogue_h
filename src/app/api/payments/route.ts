import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const paymentSchema = z.object({
  id: z.string().uuid().optional(),
  guestId: z.string().uuid(),
  reservationId: z.string().uuid().optional(),
  amount: z.number().min(0.01),
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE']),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']).optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
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
  guests?: { first_name?: string | null; last_name?: string | null } | null;
  reservations?: {
    reservation_id?: string | null;
    guests?: { first_name?: string | null; last_name?: string | null } | null;
  } | null;
};

function guestName(row: PaymentRow) {
  if (row.guests) {
    return `${row.guests.first_name ?? ''} ${row.guests.last_name ?? ''}`.trim() || null;
  }
  if (row.reservations?.guests) {
    return `${row.reservations.guests.first_name ?? ''} ${row.reservations.guests.last_name ?? ''}`.trim() || null;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get('search') ?? '';
    const { data, error } = await getSupabaseAdmin()
      .from('payments')
      .select(
        'id,payment_id,guest_id,reservation_id,amount,method,status,reference,notes,created_at,guests(first_name,last_name),reservations(reservation_id,guests(first_name,last_name))',
      )
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as PaymentRow[];
    const payments = rows.map((payment) => ({
      id: payment.id,
      paymentId: payment.payment_id ?? null,
      guestId: payment.guest_id ?? null,
      reservationId: payment.reservation_id ?? null,
      reservation: payment.reservations?.reservation_id ?? null,
      guest: guestName(payment),
      amount: payment.amount === undefined || payment.amount === null ? 0 : Number(payment.amount),
      method: payment.method ?? null,
      status: payment.status ?? null,
      reference: payment.reference ?? null,
      notes: payment.notes ?? null,
      createdAt: payment.created_at ?? null,
    }));

    return NextResponse.json({
      success: true,
      data: search
        ? payments.filter((payment) => JSON.stringify(payment).toLowerCase().includes(search.toLowerCase()))
        : payments,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = paymentSchema.parse(await request.json());
    const { data, error } = await getSupabaseAdmin()
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
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to create payment' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = paymentSchema.extend({ id: z.string().uuid() }).parse(await request.json());
    const { id, guestId, reservationId, amount, method, status, reference, notes } = body;
    const { data, error } = await getSupabaseAdmin()
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
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update payment' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }
    const { error } = await getSupabaseAdmin().from('payments').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Payment deleted' });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete payment' }, { status: 500 });
  }
}

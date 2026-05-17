import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const paymentSchema = z.object({
  id: z.string().uuid().optional(),
  reservationId: z.string().uuid(),
  amount: z.number().min(0),
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE']),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']).optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentRow = {
  id: string;
  payment_id?: string | null;
  amount?: number | string | null;
  method?: string | null;
  status?: string | null;
  reference?: string | null;
  created_at?: string | null;
  reservations?: {
    reservation_id?: string | null;
    guests?: { first_name?: string | null; last_name?: string | null } | null;
  } | null;
};

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get('search') ?? '';
    const { data, error } = await getSupabaseAdmin()
      .from('payments')
      .select('id,payment_id,amount,method,status,reference,created_at,reservations(reservation_id,guests(first_name,last_name))')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as PaymentRow[];
    const payments = rows.map((payment) => ({
      id: payment.id,
      paymentId: payment.payment_id ?? null,
      reservation: payment.reservations?.reservation_id ?? null,
      guest: payment.reservations?.guests ? `${payment.reservations.guests.first_name ?? ''} ${payment.reservations.guests.last_name ?? ''}`.trim() || null : null,
      amount: payment.amount === undefined || payment.amount === null ? 0 : Number(payment.amount),
      method: payment.method ?? null,
      status: payment.status ?? null,
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
        reservation_id: body.reservationId,
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
    const body = paymentSchema.parse(await request.json());
    const { id, ...updateData } = body;
    const { data, error } = await getSupabaseAdmin()
      .from('payments')
      .update({
        reservation_id: updateData.reservationId,
        amount: updateData.amount,
        method: updateData.method,
        status: updateData.status,
        reference: updateData.reference,
        notes: updateData.notes,
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

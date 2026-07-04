import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [guests, rooms, reservations, payments, orders] = await Promise.all([
      supabase.from('guests').select('id', { count: 'exact', head: true }),
      supabase.from('rooms').select('id', { count: 'exact', head: true }),
      supabase.from('reservations').select('id', { count: 'exact', head: true }),
      supabase.from('payments').select('amount,status'),
      supabase.from('food_orders').select('total,status'),
    ]);

    const revenue = (payments.data ?? []).reduce((sum, payment) => {
      const s = String(payment.status ?? '').toUpperCase();
      if (s === 'REFUNDED') return sum - Number(payment.amount);
      if (s === 'PAID' || s === 'COMPLETED' || s === 'PARTIALLY_PAID') return sum + Number(payment.amount);
      return sum;
    }, 0);
    const foodRevenue = (orders.data ?? []).reduce((sum, order) => {
      if (order.status === 'CANCELLED') return sum;
      return sum + Number(order.total);
    }, 0);

    return NextResponse.json({
      success: true,
      data: [
        { id: 'guests', metric: 'Guests', value: guests.count ?? 0 },
        { id: 'rooms', metric: 'Rooms', value: rooms.count ?? 0 },
        { id: 'reservations', metric: 'Reservations', value: reservations.count ?? 0 },
        { id: 'payments', metric: 'Completed Payment Revenue', value: revenue },
        { id: 'food', metric: 'Food Order Revenue', value: foodRevenue },
      ],
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch reports' }, { status: 500 });
  }
}

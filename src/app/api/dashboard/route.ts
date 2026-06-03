import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const supabase = getSupabaseAdmin();

    const [
      totalGuestsResult,
      activeReservationsResult,
      availableRoomsResult,
      totalRoomsResult,
      paymentsResult,
      todaysArrivalsResult,
      totalActivitiesResult,
      pendingFoodOrdersResult,
    ] = await Promise.all([
      supabase.from('guests').select('id', { count: 'exact', head: true }),
      supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'CHECKED_IN'),
      supabase
        .from('rooms')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'OCCUPIED'),
      supabase.from('rooms').select('id', { count: 'exact', head: true }),
      supabase
        .from('payments')
        .select('amount,status,created_at'),
      supabase
        .from('reservations')
        .select('*, guests(first_name,last_name), rooms(room_number,type)')
        .lte('check_in', today.toISOString())
        .gte('check_out', today.toISOString())
        .eq('status', 'CONFIRMED')
        .limit(5),
      supabase.from('activities').select('id', { count: 'exact', head: true }),
      supabase
        .from('food_orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING'),
    ]);

    const paymentRows = paymentsResult.data ?? [];
    const recordedStatuses = new Set(['PENDING', 'PARTIALLY_PAID', 'PAID']);

    const recordedPayments = paymentRows.filter((payment) => recordedStatuses.has(String(payment.status ?? '').toUpperCase()));
    const pendingPayments = paymentRows.filter((payment) => String(payment.status ?? '').toUpperCase() === 'PENDING');
    const todaysRecordedPayments = recordedPayments.filter((payment) => {
      if (!payment.created_at) return false;
      return new Date(payment.created_at) >= today;
    });

    const totalRevenue = recordedPayments.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0,
    );
    const todayRevenue = todaysRecordedPayments.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0,
    );
    const availableRooms = availableRoomsResult.count ?? 0;
    const totalRooms = totalRoomsResult.count ?? 0;

    const dashboardData = {
      stats: {
        totalGuests: totalGuestsResult.count ?? 0,
        activeReservations: activeReservationsResult.count ?? 0,
        roomOccupancy: {
          available: availableRooms,
          total: totalRooms,
          percentage: totalRooms ? Math.round((availableRooms / totalRooms) * 100) : 0,
        },
        totalRevenue,
        todayRevenue,
        todaysArrivals: todaysArrivalsResult.data?.length ?? 0,
        totalActivities: totalActivitiesResult.count ?? 0,
        pendingFoodOrders: pendingFoodOrdersResult.count ?? 0,
        pendingPayments: pendingPayments.length,
      },
      todaysArrivals: todaysArrivalsResult.data ?? [],
    };

    return NextResponse.json({
      success: true,
      data: dashboardData,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

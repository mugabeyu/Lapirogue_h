import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { toDateKey, addDays } from '@/lib/date-utils';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const today = toDateKey(new Date());
    const tomorrow = toDateKey(addDays(new Date(), 1));

    const [
      totalRoomsResult,
      occupiedRoomsResult,
      availableRoomsResult,
      cleaningRoomsResult,
      maintenanceRoomsResult,
      totalGuestsResult,
      activeReservationsResult,
      checkinsTodayResult,
      checkoutsTodayResult,
      revenueResult,
      pendingPaymentsResult,
      checkinsListResult,
      checkoutsListResult,
    ] = await Promise.all([
      supabase.from('rooms').select('id', { count: 'exact', head: true }),
      supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('status', 'OCCUPIED'),
      supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('status', 'AVAILABLE'),
      supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('status', 'CLEANING'),
      supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('status', 'MAINTENANCE'),
      supabase.from('guests').select('id', { count: 'exact', head: true }),
      supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .in('status', ['CONFIRMED', 'CHECKED_IN']),
      supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .in('status', ['CONFIRMED', 'CHECKED_IN'])
        .gte('check_in', today)
        .lt('check_in', tomorrow),
      supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .in('status', ['CONFIRMED', 'CHECKED_IN'])
        .gte('check_out', today)
        .lt('check_out', tomorrow),
      supabase
        .from('payments')
        .select('amount,status'),
      supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING'),
      supabase
        .from('reservations')
        .select('id, check_in, check_out, guests(first_name, last_name), rooms(room_number, type)')
        .in('status', ['CONFIRMED', 'CHECKED_IN'])
        .gte('check_in', today)
        .lt('check_in', tomorrow)
        .order('check_in', { ascending: true })
        .limit(10),
      supabase
        .from('reservations')
        .select('id, check_in, check_out, guests(first_name, last_name), rooms(room_number, type)')
        .in('status', ['CONFIRMED', 'CHECKED_IN'])
        .gte('check_out', today)
        .lt('check_out', tomorrow)
        .order('check_out', { ascending: true })
        .limit(10),
    ]);

    const errors = [
      { name: 'totalRooms', error: totalRoomsResult.error },
      { name: 'occupiedRooms', error: occupiedRoomsResult.error },
      { name: 'availableRooms', error: availableRoomsResult.error },
      { name: 'cleaningRooms', error: cleaningRoomsResult.error },
      { name: 'maintenanceRooms', error: maintenanceRoomsResult.error },
      { name: 'totalGuests', error: totalGuestsResult.error },
      { name: 'activeReservations', error: activeReservationsResult.error },
      { name: 'checkinsToday', error: checkinsTodayResult.error },
      { name: 'checkoutsToday', error: checkoutsTodayResult.error },
      { name: 'revenue', error: revenueResult.error },
      { name: 'pendingPayments', error: pendingPaymentsResult.error },
      { name: 'checkinsList', error: checkinsListResult.error },
      { name: 'checkoutsList', error: checkoutsListResult.error },
    ];

    const failedQuery = errors.find((e) => e.error);
    if (failedQuery) {
      throw new Error(`Failed to fetch ${failedQuery.name}: ${failedQuery.error?.message || 'Unknown error'}`);
    }

    const totalRooms = totalRoomsResult.count ?? 0;
    const occupiedRooms = occupiedRoomsResult.count ?? 0;
    const availableRooms = availableRoomsResult.count ?? 0;
    const completedPayments = (revenueResult.data ?? []).filter(
      (payment) => String(payment.status ?? '').toUpperCase() !== 'PENDING',
    );
    const totalRevenue = completedPayments.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0,
    );
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalRooms,
          occupiedRooms,
          availableRooms,
          occupancyRate,
          totalGuests: totalGuestsResult.count ?? 0,
          activeReservations: activeReservationsResult.count ?? 0,
          checkinsToday: checkinsTodayResult.count ?? 0,
          checkoutsToday: checkoutsTodayResult.count ?? 0,
          totalRevenue,
          pendingPayments: pendingPaymentsResult.count ?? 0,
          roomStatusBreakdown: {
            available: availableRoomsResult.count ?? 0,
            occupied: occupiedRoomsResult.count ?? 0,
            cleaning: cleaningRoomsResult.count ?? 0,
            maintenance: maintenanceRoomsResult.count ?? 0,
          },
        },
        todaysCheckins: checkinsListResult.data ?? [],
        todaysCheckouts: checkoutsListResult.data ?? [],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch dashboard data';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
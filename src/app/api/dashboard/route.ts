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
      paymentsResult,
      reservationsResult,
      activityBookingsResult,
      foodOrdersResult,
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
      supabase.from('payments').select('guest_id,amount,status'),
      supabase
        .from('reservations')
        .select('guest_id,total_amount')
        .in('status', ['CONFIRMED', 'CHECKED_IN']),
      supabase
        .from('activity_bookings')
        .select('guest_id,participants,activities(price)')
        .eq('status', 'CONFIRMED'),
      supabase
        .from('food_orders')
        .select('guest_id,total')
        .in('status', ['PENDING', 'PREPARING', 'SERVED']),
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
      { name: 'payments', error: paymentsResult.error },
      { name: 'reservations', error: reservationsResult.error },
      { name: 'activityBookings', error: activityBookingsResult.error },
      { name: 'foodOrders', error: foodOrdersResult.error },
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

    const completedPayments = (paymentsResult.data ?? []).filter(
      (payment) => String(payment.status ?? '').toUpperCase() !== 'PENDING',
    );
    const totalRevenue = completedPayments.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0,
    );

    const guestBalances: Record<string, { charges: number; paid: number }> = {};

    (reservationsResult.data ?? []).forEach((r) => {
      const guestId = r.guest_id;
      if (!guestId) return;
      if (!guestBalances[guestId]) guestBalances[guestId] = { charges: 0, paid: 0 };
      guestBalances[guestId].charges += Number(r.total_amount ?? 0);
    });

    (paymentsResult.data ?? []).forEach((p) => {
      const guestId = p.guest_id;
      if (!guestId) return;
      if (!guestBalances[guestId]) guestBalances[guestId] = { charges: 0, paid: 0 };
      const status = String(p.status ?? '').toUpperCase();
      if (status === 'REFUNDED') {
        guestBalances[guestId].paid -= Number(p.amount ?? 0);
      } else if (status !== 'PENDING') {
        guestBalances[guestId].paid += Number(p.amount ?? 0);
      }
    });

    (activityBookingsResult.data ?? []).forEach((ab) => {
      const guestId = ab.guest_id;
      if (!guestId) return;
      if (!guestBalances[guestId]) guestBalances[guestId] = { charges: 0, paid: 0 };
      const price = (ab.activities as { price?: number | null } | null)?.price ?? 0;
      guestBalances[guestId].charges += price * (ab.participants ?? 1);
    });

    (foodOrdersResult.data ?? []).forEach((fo) => {
      const guestId = fo.guest_id;
      if (!guestId) return;
      if (!guestBalances[guestId]) guestBalances[guestId] = { charges: 0, paid: 0 };
      guestBalances[guestId].charges += Number(fo.total ?? 0);
    });

    let pendingPayments = 0;
    Object.values(guestBalances).forEach(({ charges, paid }) => {
      const balanceDue = Math.max(charges - paid, 0);
      pendingPayments += balanceDue;
    });

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
          pendingPayments,
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
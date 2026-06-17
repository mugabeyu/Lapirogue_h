import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { toDateKey, addDays } from '@/lib/date-utils';

const dashboardCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 30000;

function getCachedResponse<T>(key: string): T | null {
  const cached = dashboardCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data as T;
  }
  return null;
}

function setCachedResponse<T>(key: string, data: T): void {
  if (dashboardCache.size > 10) {
    const oldestKey = dashboardCache.keys().next().value;
    if (oldestKey) dashboardCache.delete(oldestKey);
  }
  dashboardCache.set(key, { data, timestamp: Date.now() });
}

export async function GET() {
  try {
    const today = toDateKey(new Date());
    const cacheKey = `dashboard-${today}`;
    const cached = getCachedResponse<{
      stats: unknown;
      todaysCheckins: unknown[];
      todaysCheckouts: unknown[];
    }>(cacheKey);

    if (cached) {
      return NextResponse.json({ success: true, data: cached }, {
        headers: { 'Cache-Control': 'private, max-age=30' },
      });
    }

    const supabase = getSupabaseAdmin();
    const tomorrow = toDateKey(addDays(new Date(), 1));

    const [
      roomsResult,
      totalGuestsResult,
      reservationsResult,
      todayReservationsResult,
      paymentsResult,
      activityBookingsResult,
      foodOrdersResult,
    ] = await Promise.all([
      supabase.from('rooms').select('status'),
      supabase.from('guests').select('id', { count: 'exact', head: true }),
      supabase
        .from('reservations')
        .select('guest_id,total_amount,status,check_in,check_out')
        .in('status', ['CONFIRMED', 'CHECKED_IN']),
      supabase
        .from('reservations')
        .select('id, check_in, check_out, guests(first_name, last_name), rooms(room_number, type)')
        .in('status', ['CONFIRMED', 'CHECKED_IN'])
        .or(`check_in.gte.${today},check_in.lt.${tomorrow},check_out.gte.${today},check_out.lt.${tomorrow}`)
        .order('check_in', { ascending: true })
        .limit(20),
      supabase.from('payments').select('guest_id,amount,status'),
      supabase
        .from('activity_bookings')
        .select('guest_id,participants,activities(price)')
        .eq('status', 'CONFIRMED'),
      supabase
        .from('food_orders')
        .select('guest_id,total')
        .in('status', ['PENDING', 'PREPARING', 'SERVED']),
    ]);

    if (roomsResult.error) {
      throw new Error(`Failed to fetch rooms: ${roomsResult.error.message}`);
    }
    if (totalGuestsResult.error) {
      throw new Error(`Failed to fetch guests: ${totalGuestsResult.error.message}`);
    }
    if (reservationsResult.error) {
      throw new Error(`Failed to fetch reservations: ${reservationsResult.error.message}`);
    }
    if (todayReservationsResult.error) {
      throw new Error(`Failed to fetch today's reservations: ${todayReservationsResult.error.message}`);
    }
    if (paymentsResult.error) {
      throw new Error(`Failed to fetch payments: ${paymentsResult.error.message}`);
    }
    if (activityBookingsResult.error) {
      throw new Error(`Failed to fetch activity bookings: ${activityBookingsResult.error.message}`);
    }
    if (foodOrdersResult.error) {
      throw new Error(`Failed to fetch food orders: ${foodOrdersResult.error.message}`);
    }

    const roomsData = roomsResult.data ?? [];
    const totalRooms = roomsData.length;
    const occupiedRooms = roomsData.filter((r) => r.status === 'OCCUPIED').length;
    const availableRooms = roomsData.filter((r) => r.status === 'AVAILABLE').length;
    const cleaningRooms = roomsData.filter((r) => r.status === 'CLEANING').length;
    const maintenanceRooms = roomsData.filter((r) => r.status === 'MAINTENANCE').length;

    const reservationsData = reservationsResult.data ?? [];
    const todayReservations = todayReservationsResult.data ?? [];

    const checkinsToday = todayReservations.filter((r) => {
      const checkInDate = r.check_in?.split('T')[0];
      return checkInDate === today;
    });

    const checkoutsToday = todayReservations.filter((r) => {
      const checkOutDate = r.check_out?.split('T')[0];
      return checkOutDate === today;
    });

    const completedPayments = (paymentsResult.data ?? []).filter(
      (payment) => String(payment.status ?? '').toUpperCase() !== 'PENDING',
    );
    const totalRevenue = completedPayments.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0,
    );

    const guestBalances: Record<string, { charges: number; paid: number }> = {};

    reservationsData.forEach((r) => {
      const guestId = r.guest_id;
      if (!guestId) return;
      if (!guestBalances[guestId]) guestBalances[guestId] = { charges: 0, paid: 0 };
      guestBalances[guestId].charges += Number(r.total_amount ?? 0);
    });

    paymentsResult.data?.forEach((p) => {
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

    activityBookingsResult.data?.forEach((ab) => {
      const guestId = ab.guest_id;
      if (!guestId) return;
      if (!guestBalances[guestId]) guestBalances[guestId] = { charges: 0, paid: 0 };
      const price = (ab.activities as { price?: number | null } | null)?.price ?? 0;
      guestBalances[guestId].charges += price * (ab.participants ?? 1);
    });

    foodOrdersResult.data?.forEach((fo) => {
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

    const responseData = {
      stats: {
        totalRooms,
        occupiedRooms,
        availableRooms,
        occupancyRate,
        totalGuests: totalGuestsResult.count ?? 0,
        activeReservations: reservationsData.length,
        checkinsToday: checkinsToday.length,
        checkoutsToday: checkoutsToday.length,
        totalRevenue,
        pendingPayments,
        roomStatusBreakdown: {
          available: availableRooms,
          occupied: occupiedRooms,
          cleaning: cleaningRooms,
          maintenance: maintenanceRooms,
        },
      },
      todaysCheckins: checkinsToday,
      todaysCheckouts: checkoutsToday,
    };

    setCachedResponse(cacheKey, responseData);

    return NextResponse.json({ success: true, data: responseData }, {
      headers: { 'Cache-Control': 'private, max-age=30' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch dashboard data';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { toDateKey, addDays } from '@/lib/date-utils';
import { attachSupabaseCookies, getRouteHandlerSupabaseSession } from '@/lib/supabase-server';

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

export async function GET(request: NextRequest) {
  const { user, error: userError, response } = await getRouteHandlerSupabaseSession(request);
  if (!user || userError) {
    return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), response);
  }

  try {
    const today = toDateKey(new Date());
    const cacheKey = `dashboard-${today}-${user.role}`;
    const cached = getCachedResponse<{
      stats: unknown;
      todaysCheckins: unknown[];
      todaysCheckouts: unknown[];
    }>(cacheKey);

    if (cached) {
      response.headers.set('Cache-Control', 'private, max-age=30');
      return attachSupabaseCookies(NextResponse.json({ success: true, data: cached }), response);
    }

    const supabase = getSupabaseAdmin();
    const tomorrow = toDateKey(addDays(new Date(), 1));

    // ── Admin Dashboard: System Health & Audits ──────────────
    if (user.role === 'ADMIN') {
      const [managerCount, departmentCount, auditCount] = await Promise.all([
        supabase.from('managers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('departments').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', today),
      ]);

      const stats = {
        totalManagers: managerCount.count ?? 0,
        activeDepartments: departmentCount.count ?? 0,
        todayAuditEvents: auditCount.count ?? 0,
      };

      setCachedResponse(cacheKey, { stats, todaysCheckins: [], todaysCheckouts: [] });
      response.headers.set('Cache-Control', 'private, max-age=30');
      return attachSupabaseCookies(NextResponse.json({ success: true, data: { stats, todaysCheckins: [], todaysCheckouts: [] } }), response);
    }

    // ── Receptionist Dashboard: Arrivals, Departures, Cleanliness ──
    if (user.role === 'RECEPTIONIST') {
      const [roomsResult, todayReservationsResult] = await Promise.all([
        supabase.from('rooms').select('status'),
        supabase
          .from('reservations')
          .select('id, check_in, check_out, guests(first_name, last_name, image_path), rooms(room_number, type)')
          .in('status', ['CONFIRMED', 'CHECKED_IN'])
          .or(`check_in.gte.${today},check_in.lt.${tomorrow},check_out.gte.${today},check_out.lt.${tomorrow}`)
          .order('check_in', { ascending: true })
          .limit(20),
      ]);

      const roomStatusBreakdown = {
        available: 0, occupied: 0, cleaning: 0, maintenance: 0,
      };
      for (const room of (roomsResult.data ?? []) as { status: string }[]) {
        const key = room.status.toLowerCase() as keyof typeof roomStatusBreakdown;
        if (key in roomStatusBreakdown) roomStatusBreakdown[key]++;
      }

      const todaysCheckins: unknown[] = [];
      const todaysCheckouts: unknown[] = [];
      for (const row of (todayReservationsResult.data ?? []) as Array<{
        id: string; check_in: string; check_out: string;
        guests?: { first_name?: string | null; last_name?: string | null; image_path?: string | null } | null;
        rooms?: { room_number?: string | null; type?: string | null } | null;
      }>) {
        if (row.check_in >= today && row.check_in < tomorrow) todaysCheckins.push(row);
        if (row.check_out >= today && row.check_out < tomorrow) todaysCheckouts.push(row);
      }

      const stats = {
        totalRooms: roomStatusBreakdown.available + roomStatusBreakdown.occupied + roomStatusBreakdown.cleaning + roomStatusBreakdown.maintenance,
        availableRooms: roomStatusBreakdown.available,
        occupiedRooms: roomStatusBreakdown.occupied,
        cleaningRooms: roomStatusBreakdown.cleaning,
        maintenanceRooms: roomStatusBreakdown.maintenance,
        checkinsToday: todaysCheckins.length,
        checkoutsToday: todaysCheckouts.length,
        roomStatusBreakdown,
      };

      setCachedResponse(cacheKey, { stats, todaysCheckins, todaysCheckouts });
      response.headers.set('Cache-Control', 'private, max-age=30');
      return attachSupabaseCookies(NextResponse.json({ success: true, data: { stats, todaysCheckins, todaysCheckouts } }), response);
    }

    // ── Manager Dashboard: Revenue, Staff Metrics, Performance ──
    const [
      roomsResult,
      totalGuestsResult,
      reservationsResult,
      todayReservationsResult,
      paymentsResult,
      activityBookingsResult,
      foodOrdersResult,
      receptionistCount,
      feedbackResult,
    ] = await Promise.all([
      supabase.from('rooms').select('status'),
      supabase.from('guests').select('id', { count: 'exact', head: true }),
      supabase
        .from('reservations')
        .select('guest_id,total_amount,status,check_in,check_out')
        .in('status', ['CONFIRMED', 'CHECKED_IN']),
      supabase
        .from('reservations')
        .select('id, check_in, check_out, guests(first_name, last_name, image_path), rooms(room_number, type)')
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
      supabase.from('receptionists').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('guest_feedback').select('rating'),
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

    const isPaymentCompleted = (status: string): boolean => {
      const s = status.toUpperCase();
      return s === 'PAID' || s === 'COMPLETED' || s === 'PARTIALLY_PAID';
    };

    const totalRevenue = (paymentsResult.data ?? []).reduce((sum, payment) => {
      const status = String(payment.status ?? '').toUpperCase();
      if (status === 'REFUNDED') return sum - Number(payment.amount ?? 0);
      if (isPaymentCompleted(status)) return sum + Number(payment.amount ?? 0);
      return sum;
    }, 0);

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
      } else if (isPaymentCompleted(status)) {
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

    // Manager-specific metrics
    const activeReceptionists = receptionistCount.count ?? 0;
    const feedbackRatings = (feedbackResult.data ?? []) as { rating: number }[];
    const avgFeedback = feedbackRatings.length > 0
      ? Math.round((feedbackRatings.reduce((s, f) => s + f.rating, 0) / feedbackRatings.length) * 10) / 10
      : 0;

    const responseData = {
      stats: {
        totalRooms,
        occupiedRooms,
        availableRooms,
        cleaningRooms,
        maintenanceRooms,
        occupancyRate,
        totalGuests: totalGuestsResult.count ?? 0,
        activeReservations: reservationsData.length,
        checkinsToday: checkinsToday.length,
        checkoutsToday: checkoutsToday.length,
        totalRevenue,
        pendingPayments,
        activeReceptionists,
        averageFeedback: avgFeedback,
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

    response.headers.set('Cache-Control', 'private, max-age=30');
    return attachSupabaseCookies(NextResponse.json({ success: true, data: responseData }), response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch dashboard data';
    return attachSupabaseCookies(
      NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      ),
      response
    );
  }
}

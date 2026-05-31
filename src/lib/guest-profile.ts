import { getSupabaseAdmin } from '@/lib/supabase';
import { toGuest, type GuestRow } from '@/lib/guests';
import type { Guest, GuestStatus, GuestStay } from '@/types';
import type { GuestProfileData } from '@/types';

export type GuestProfile = {
  guest: Guest;
  currentStay: GuestStay | null;
};

async function loadGuestProfile(guestId: string): Promise<GuestProfile | null> {
  const supabase = getSupabaseAdmin();

  const { data: guest, error: guestError } = await supabase
    .from('guests')
    .select('*')
    .eq('id', guestId)
    .maybeSingle();

  if (guestError || !guest) return null;

  const { data: reservations } = await supabase
    .from('reservations')
    .select('id,room_id,check_in,check_out,status,total_amount,rooms(room_number,type),reservation_id')
    .eq('guest_id', guestId)
    .order('check_in', { ascending: false });

  const stays: GuestStay[] = (reservations ?? []).map((r) => ({
    id: r.id,
    reservationId: r.reservation_id ?? '',
    roomId: r.room_id as string,
    checkIn: r.check_in,
    checkOut: r.check_out,
    adults: 1,
    children: 0,
    status: r.status,
    totalAmount: Number(r.total_amount ?? 0),
    roomNumber: (r.rooms as { room_number?: string | null } | null)?.room_number ?? null,
    roomType: (r.rooms as { type?: string | null } | null)?.type ?? null,
  }));

  const activeStay = stays.find((s) => s.status !== 'CANCELLED' && s.status !== 'CHECKED_OUT') ?? stays[0] ?? null;

  return {
    guest: { ...toGuest(guest as GuestRow), status: guest.status as GuestStatus },
    currentStay: activeStay,
  };
}

export async function loadGuestProfileData(guestId: string): Promise<GuestProfileData | null> {
  const supabase = getSupabaseAdmin();

  // Fetch guest
  const { data: guest, error: guestError } = await supabase
    .from('guests')
    .select('*')
    .eq('id', guestId)
    .maybeSingle();

  if (guestError || !guest) return null;

  // Fetch reservations
  const { data: reservationsData } = await supabase
    .from('reservations')
    .select('id,room_id,check_in,check_out,status,total_amount,rooms(room_number,type),reservation_id,created_at,updated_at')
    .eq('guest_id', guestId)
    .order('check_in', { ascending: false });

  const reservations: GuestStay[] = (reservationsData ?? []).map((r) => ({
    id: r.id,
    reservationId: r.reservation_id ?? '',
    roomId: r.room_id as string,
    checkIn: r.check_in,
    checkOut: r.check_out,
    adults: 1, // TODO: fetch actual adults and children from reservations table? Currently not stored.
    children: 0,
    status: r.status,
    totalAmount: Number(r.total_amount ?? 0),
    roomNumber: (r.rooms as { room_number?: string | null } | null)?.room_number ?? null,
    roomType: (r.rooms as { type?: string | null } | null)?.type ?? null,
  }));

  // Determine current stay (active or most recent)
  const activeStay = reservations.find((s) => s.status !== 'CANCELLED' && s.status !== 'CHECKED_OUT') ?? reservations[0] ?? null;

  // Fetch activity bookings
  const { data: activityBookingsData } = await supabase
    .from('activity_bookings')
    .select('id,activity,amount,date,participants,status,notes,created_at,updated_at')
    .eq('guest_id', guestId);

  const activityBookings = (activityBookingsData ?? []).map((ab) => ({
    id: ab.id,
    activity: ab.activity ?? null,
    amount: ab.amount ?? undefined,
    date: ab.date,
    participants: ab.participants,
    status: ab.status,
    notes: ab.notes ?? null,
  }));

  // Fetch food orders
  const { data: foodOrdersData } = await supabase
    .from('food_orders')
    .select('id,order_id,subtotal,service_charge,tax_amount,total,status,notes,created_at,updated_at')
    .eq('guest_id', guestId);

  const foodOrders = (foodOrdersData ?? []).map((fo) => ({
    id: fo.id,
    orderId: fo.order_id,
    subtotal: fo.subtotal ?? undefined,
    serviceCharge: fo.service_charge ?? undefined,
    taxAmount: fo.tax_amount ?? undefined,
    total: fo.total,
    status: fo.status,
    notes: fo.notes ?? null,
    createdAt: fo.created_at,
  }));

  // Fetch payments
  const { data: paymentsData } = await supabase
    .from('payments')
    .select('id,payment_id,amount,method,status,reference,created_at,updated_at')
    .eq('guest_id', guestId);

  const payments = (paymentsData ?? []).map((p) => ({
    id: p.id,
    paymentId: p.payment_id,
    amount: p.amount,
    method: p.method,
    status: p.status,
    reference: p.reference ?? null,
    createdAt: p.created_at,
  }));

  // Compute stats
  const totalStays = reservations.length;
  const activities = activityBookings.length;
  const foodOrdersCount = foodOrders.length;
  // Total spent: sum of reservation totals, food order totals, and activity booking amounts (if present)
  const totalSpent = reservations.reduce((sum, r) => sum + r.totalAmount, 0)
    + foodOrders.reduce((sum, fo) => sum + fo.total, 0)
    + activityBookings.reduce((sum, ab) => sum + (ab.amount ?? 0), 0);
  // Balance due: we can compute as total charges minus total paid? For now, we'll set to 0 or compute from payments?
  // We don't have a direct field for charges due. We'll leave it as 0 for now, but note that the type expects a number.
  const balanceDue = 0; // TODO: compute properly if needed

  const stats = {
    totalStays,
    activities,
    foodOrders: foodOrdersCount,
    totalSpent,
    balanceDue,
  };

  // Build the guest object
  const guestObj = { ...toGuest(guest as GuestRow), status: guest.status as GuestStatus };

  return {
    guest: guestObj,
    currentStay: activeStay ?? null,
    reservations,
    activityBookings,
    foodOrders,
    payments,
    stats,
    // billingSummary is optional, we can leave it out
  };
}

export { loadGuestProfile, loadGuestProfileData };
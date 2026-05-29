import { getSupabaseAdmin } from '@/lib/supabase';
import { toGuest, type GuestRow } from '@/lib/guests';
import type { Guest, GuestStatus, GuestStay } from '@/types';

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

export { loadGuestProfile };
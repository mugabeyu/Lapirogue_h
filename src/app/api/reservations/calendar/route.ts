import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { addDays, endOfMonth, parseDateKey, startOfMonth, startOfWeek, toDateKey } from '@/lib/date-utils';

type RoomRow = {
  id: string;
  room_number: string;
  type: string;
  description: string | null;
};

type ReservationRow = {
  id: string;
  room_id: string;
  check_in: string;
  check_out: string;
  status: string;
  guests: { first_name: string | null; last_name: string | null } | null;
  rooms: { room_number: string | null; type: string | null } | null;
};

function buildRange(anchor: string, view: 'week' | 'month') {
  const anchorDate = parseDateKey(anchor);
  let start: Date;
  let end: Date;

  if (view === 'week') {
    start = startOfWeek(anchorDate);
    end = addDays(start, 6);
  } else {
    start = startOfMonth(anchorDate);
    end = endOfMonth(anchorDate);
  }

  const days: string[] = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    days.push(toDateKey(cursor));
    cursor = addDays(cursor, 1);
  }

  const label =
    view === 'week'
      ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(start) +
        ' – ' +
        new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(end)
      : new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(start);

  return { start: toDateKey(start), end: toDateKey(end), days, label };
}

function displayStatus(
  status: string,
  checkIn: string,
  checkOut: string,
  today: string,
): 'confirmed' | 'checked-in' | 'pending' | 'departing' | 'cancelled' {
  if (status === 'CANCELLED') return 'cancelled';
  if (status === 'CHECKED_IN' && checkOut === today) return 'departing';
  if (status === 'CHECKED_IN') return 'checked-in';
  if (status === 'CONFIRMED' && checkIn > today) return 'pending';
  if (status === 'CONFIRMED') return 'confirmed';
  if (status === 'CHECKED_OUT') return 'cancelled';
  return 'confirmed';
}

const TYPE_LABELS: Record<string, string> = {
  VILLA: 'VILLAS',
  SUITE: 'SUITES',
  DELUXE: 'DELUXE',
  STANDARD: 'STANDARD',
};

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const anchor = params.get('anchor') ?? toDateKey(new Date());
    const view = params.get('view') === 'week' ? 'week' : 'month';
    const range = buildRange(anchor, view);
    const today = toDateKey(new Date());

    const supabase = getSupabaseAdmin();

    const [{ data: rooms, error: roomsError }, { data: reservations, error: reservationsError }] =
      await Promise.all([
        supabase.from('rooms').select('id,room_number,type,description').order('type').order('room_number'),
        supabase
          .from('reservations')
          .select('id,room_id,check_in,check_out,status,guests(first_name,last_name),rooms(room_number,type)')
          .lte('check_in', range.end)
          .gte('check_out', range.start)
          .neq('status', 'CANCELLED'),
      ]);

    if (roomsError) throw roomsError;
    if (reservationsError) throw reservationsError;

    const roomRows = (rooms ?? []) as RoomRow[];
    const grouped = new Map<string, RoomRow[]>();

    for (const room of roomRows) {
      const key = room.type;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(room);
    }

    const roomGroups = Array.from(grouped.entries()).map(([type, items]) => ({
      type,
      label: TYPE_LABELS[type] ?? type,
      rooms: items.map((room) => ({
        id: room.id,
        roomNumber: room.room_number,
        type: room.type,
        subtitle: room.description ?? undefined,
      })),
    }));

    const bookingRows = (reservations ?? []) as unknown as ReservationRow[];
    const bookings = bookingRows.map((row) => {
      const guest = row.guests as { first_name?: string | null; last_name?: string | null } | null;
      const guestName = guest
        ? `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim()
        : 'Guest';
      return {
        id: row.id,
        roomId: row.room_id,
        guestName,
        checkIn: row.check_in,
        checkOut: row.check_out,
        status: row.status,
        displayStatus: displayStatus(row.status, row.check_in, row.check_out, today),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        anchor,
        view,
        today,
        start: range.start,
        end: range.end,
        label: range.label,
        days: range.days,
        roomGroups,
        bookings,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load calendar' }, { status: 500 });
  }
}

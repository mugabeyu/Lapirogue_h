import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { addDays, parseDateKey, startOfWeek, toDateKey } from '@/lib/date-utils';

type GuestRow = {
  id: string;
  guest_id: string;
  first_name: string;
  last_name: string;
  status: string;
  vip: boolean;
  image_path?: string | null;
};

type ScheduleRow = {
  id: string;
  guest_id: string;
  title: string;
  item_type: 'RESERVATION' | 'ACTIVITY' | 'BOOKING' | 'ORDER' | 'SERVICE' | 'CUSTOM';
  source_module?: string | null;
  source_record_id?: string | null;
  start_at: string;
  end_at: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  notes?: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
  guests?: { first_name?: string | null; last_name?: string | null } | null;
};

function parseDate(value: string | null, fallback: Date) {
  if (!value) return new Date(fallback);
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date(fallback) : parsed;
}

function formatWeekLabel(start: Date) {
  const end = addDays(start, 6);
  const formatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function dateKey(value: string) {
  return value.slice(0, 10);
}

function overlapsWeek(startAt: string, endAt: string, weekStart: Date) {
  const itemStart = dateKey(startAt);
  const itemEnd = dateKey(endAt);
  const weekStartKey = toDateKey(weekStart);
  const weekEndKey = toDateKey(addDays(weekStart, 6));
  return itemStart <= weekEndKey && itemEnd >= weekStartKey;
}

function colorForType(type: ScheduleRow['item_type']) {
  switch (type) {
    case 'RESERVATION':
      return '#C9A56A';
    case 'ACTIVITY':
      return '#97B7F5';
    case 'BOOKING':
      return '#E9A8F6';
    case 'ORDER':
      return '#FFCA8B';
    case 'SERVICE':
      return '#9DEFD9';
    default:
      return '#E7D7F0';
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const weekStartParam = searchParams.get('weekStart');
    const selectedGuestId = searchParams.get('guestId') || '';

    const requestedWeekStart = startOfWeek(parseDate(weekStartParam, new Date()));

    const supabase = getSupabaseAdmin();

    const [guestsResult, reservationsResult] = await Promise.all([
      supabase
        .from('guests')
        .select('id, guest_id, first_name, last_name, status, vip, image_path')
        .order('first_name', { ascending: true }),
      supabase
        .from('reservations')
        .select('id, guest_id, check_in, check_out, status, rooms(room_number)')
        .neq('status', 'CANCELLED')
        .lte('check_in', toDateKey(addDays(requestedWeekStart, 6)))
        .gte('check_out', toDateKey(requestedWeekStart)),
    ]);

    if (guestsResult.error) throw guestsResult.error;
    if (reservationsResult.error) throw reservationsResult.error;

    const guests = (guestsResult.data ?? []) as GuestRow[];
    const roomMap = new Map<string, string>();
    const stayMap = new Map<string, { checkIn: string | null; checkOut: string | null }>();

    (reservationsResult.data ?? []).forEach((reservation) => {
      const guestId = reservation.guest_id as string;
      const roomNumber = (reservation.rooms as { room_number?: string | null } | null)?.room_number ?? '';
      if (guestId && roomNumber && !roomMap.has(guestId)) {
        roomMap.set(guestId, roomNumber);
      }
      if (guestId && !stayMap.has(guestId)) {
        stayMap.set(guestId, {
          checkIn: reservation.check_in ?? null,
          checkOut: reservation.check_out ?? null,
        });
      }
    });

    const selectedGuest = guests.find((guest) => guest.id === selectedGuestId) ?? null;

    const mappedGuests = guests.map((guest) => ({
      id: guest.id,
      guestId: guest.guest_id,
      firstName: guest.first_name,
      lastName: guest.last_name,
      status: guest.status,
      vip: guest.vip,
      imagePath: guest.image_path ?? null,
      roomNumber: roomMap.get(guest.id) ?? null,
    }));

    const scheduledItems: ScheduleRow[] = [];

    if (selectedGuestId) {
      const allGuestReservations = await supabase
        .from('reservations')
        .select('id, guest_id, check_in, check_out, status, rooms(room_number)')
        .eq('guest_id', selectedGuestId)
        .neq('status', 'CANCELLED');

      if (allGuestReservations.error) throw allGuestReservations.error;

      (allGuestReservations.data ?? []).forEach((reservation) => {
        const checkIn = reservation.check_in as string | null;
        const checkOut = reservation.check_out as string | null;
        if (!checkIn || !checkOut) return;

        const startAt = `${checkIn}T00:00:00`;
        const endAt = `${checkOut}T23:59:59`;
        const roomNumber = (reservation.rooms as { room_number?: string | null } | null)?.room_number ?? 'Room';

        scheduledItems.push({
          id: `reservation-${reservation.id}`,
          guest_id: selectedGuestId,
          title: `${roomNumber} reservation`,
          item_type: 'RESERVATION',
          source_module: 'reservations',
          source_record_id: reservation.id,
          start_at: startAt,
          end_at: endAt,
          status: (reservation.status as ScheduleRow['status']) ?? 'CONFIRMED',
          notes: null,
          color: colorForType('RESERVATION'),
          created_at: startAt,
          updated_at: startAt,
        });
      });

      const [customItemsResult, activityBookingsResult, foodOrdersResult, guestOrdersResult, itineraryEventsResult] = await Promise.all([
        supabase
          .from('guest_schedule_items')
          .select('id,guest_id,title,item_type,start_at,end_at,status,color,created_at,updated_at,source_module,source_record_id,notes')
          .eq('guest_id', selectedGuestId),
        supabase
          .from('activity_bookings')
          .select('id,guest_id,booking_date,booking_time,participants,status,notes,activities(name,price),guests(first_name,last_name)')
          .eq('guest_id', selectedGuestId),
        supabase
          .from('food_orders')
          .select('id,guest_id,order_id,created_at,status,notes,items,guests(first_name,last_name)')
          .eq('guest_id', selectedGuestId),
        supabase
          .from('guest_orders')
          .select('id,guest_id,order_id,order_time,status,notes,order_type,guests(first_name,last_name)')
          .eq('guest_id', selectedGuestId),
        supabase
          .from('itinerary_events')
          .select('id,guest_id,title,category,description,start_at,end_at,location,status,guests(first_name,last_name)')
          .eq('guest_id', selectedGuestId),
      ]);

      if (customItemsResult.error) throw customItemsResult.error;
      if (activityBookingsResult.error) throw activityBookingsResult.error;
      if (foodOrdersResult.error) throw foodOrdersResult.error;
      if (guestOrdersResult.error) throw guestOrdersResult.error;
      if (itineraryEventsResult.error) throw itineraryEventsResult.error;

      const customItems = (customItemsResult.data ?? []) as ScheduleRow[];
      customItems.forEach((item) => scheduledItems.push({
        ...item,
        color: item.color ?? colorForType(item.item_type),
      }));

      (activityBookingsResult.data ?? []).forEach((booking) => {
        const bookingDate = booking.booking_date as string;
        const parsedTime = parseTimeSlot((booking.booking_time as string | null) ?? '09:00');
        const [hours, minutes] = (parsedTime ?? '09:00:00').split(':');
        const startHourInt = parseInt(hours, 10);
        const endHourInt = (startHourInt + 1) % 24;
        const startAt = `${bookingDate}T${hours}:${minutes}:00`;
        const endDate = endHourInt < startHourInt ? toDateKey(addDays(parseDateKey(bookingDate), 1)) : bookingDate;
        const endAt = `${endDate}T${String(endHourInt).padStart(2, '0')}:${minutes}:00`;
        scheduledItems.push({
          id: booking.id,
          guest_id: selectedGuestId,
          title: `${(booking.activities as { name?: string | null } | null)?.name ?? 'Activity'} booking`,
          item_type: 'ACTIVITY',
          source_module: 'activity_bookings',
          source_record_id: booking.id,
          start_at: startAt,
          end_at: endAt,
          status: (booking.status as ScheduleRow['status']) ?? 'CONFIRMED',
          notes: booking.notes ?? null,
          color: colorForType('ACTIVITY'),
          created_at: bookingDate,
          updated_at: bookingDate,
        });
      });

      (foodOrdersResult.data ?? []).forEach((order) => {
        let createdAt = order.created_at;
        const parsedAt = createdAt ? new Date(createdAt) : null;
        const scheduledMatch = typeof order.notes === 'string' ? order.notes.match(/Scheduled for (\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/) : null;
        if (scheduledMatch) {
          createdAt = scheduledMatch[1] + ':00';
        } else if (!createdAt || !parsedAt || Number.isNaN(parsedAt.getTime())) {
          createdAt = `${requestedWeekStart.toISOString().slice(0, 10)}T09:00:00`;
        } else {
          const datePart = createdAt.slice(0, 10);
          const timePart = createdAt.slice(11, 19);
          createdAt = `${datePart}T${timePart}`;
        }
        const endAt = new Date(createdAt);
        endAt.setMinutes(endAt.getMinutes() + 45);
        const items = order.items as { name?: string }[] | null;
        const title = items?.[0]?.name ?? 'Food order';
        scheduledItems.push({
          id: order.id,
          guest_id: selectedGuestId,
          title,
          item_type: 'ORDER',
          source_module: 'food_orders',
          source_record_id: order.id,
          start_at: createdAt,
          end_at: endAt.toISOString(),
          status: (order.status as ScheduleRow['status']) ?? 'SCHEDULED',
          notes: order.notes ?? null,
          color: colorForType('ORDER'),
          created_at: createdAt,
          updated_at: createdAt,
        });
      });

      (guestOrdersResult.data ?? []).forEach((order) => {
        const createdAt = order.order_time ?? requestedWeekStart.toISOString();
        const endAt = new Date(createdAt);
        endAt.setMinutes(endAt.getMinutes() + 60);
        scheduledItems.push({
          id: order.id,
          guest_id: selectedGuestId,
          title: 'Guest order',
          item_type: 'ORDER',
          source_module: 'guest_orders',
          source_record_id: order.id,
          start_at: createdAt,
          end_at: endAt.toISOString(),
          status: (order.status as ScheduleRow['status']) ?? 'SCHEDULED',
          notes: order.notes ?? null,
          color: colorForType('ORDER'),
          created_at: createdAt,
          updated_at: createdAt,
        });
      });

      (itineraryEventsResult.data ?? []).forEach((event) => {
        const startAt = event.start_at ?? requestedWeekStart.toISOString();
        const endAt = event.end_at ?? new Date(new Date(startAt).getTime() + 60 * 60 * 1000).toISOString();
        scheduledItems.push({
          id: event.id,
          guest_id: selectedGuestId,
          title: event.title,
          item_type: 'SERVICE',
          source_module: 'itinerary_events',
          source_record_id: event.id,
          start_at: startAt,
          end_at: endAt,
          status: (event.status as ScheduleRow['status']) ?? 'CONFIRMED',
          notes: event.description ?? null,
          color: colorForType('SERVICE'),
          created_at: startAt,
          updated_at: startAt,
        });
      });

      scheduledItems.sort((left, right) => {
        const startDiff = new Date(left.start_at).getTime() - new Date(right.start_at).getTime();
        if (startDiff !== 0) return startDiff;
        return new Date(left.end_at).getTime() - new Date(right.end_at).getTime();
      });
    }

    const payloadItems = scheduledItems.filter((item) => {
      if (item.item_type === 'ORDER' && item.source_module === 'food_orders') {
        return true;
      }
      return overlapsWeek(item.start_at, item.end_at, requestedWeekStart);
    });

    return NextResponse.json({
      success: true,
      data: {
        guests: mappedGuests,
        selectedGuest: selectedGuest ? {
          id: selectedGuest.id,
          guestId: selectedGuest.guest_id,
          firstName: selectedGuest.first_name,
          lastName: selectedGuest.last_name,
          status: selectedGuest.status,
          vip: selectedGuest.vip,
          roomNumber: roomMap.get(selectedGuest.id) ?? null,
          stay: stayMap.get(selectedGuest.id) ?? null,
        } : null,
        weekStart: toDateKey(requestedWeekStart),
        weekEnd: toDateKey(addDays(requestedWeekStart, 6)),
        weekLabel: formatWeekLabel(requestedWeekStart),
        items: payloadItems.map((item) => ({
          id: item.id,
          guestId: item.guest_id,
          title: item.title,
          itemType: item.item_type,
          sourceModule: item.source_module ?? undefined,
          sourceRecordId: item.source_record_id ?? undefined,
          startAt: item.start_at,
          endAt: item.end_at,
          status: item.status,
          notes: item.notes ?? undefined,
          color: item.color ?? colorForType(item.item_type),
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })),
        totalActivities: payloadItems.length,
      },
    });
  } catch (error) {
    console.error('Schedule API Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch schedule data' }, { status: 500 });
  }
}

function parseTimeSlot(value?: string) {
  if (!value) return null;
  const trimmed = String(value).trim();
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (match12?.[4]) {
    let hour = Number(match12[1]) % 12;
    if (match12[4].toUpperCase() === 'PM') hour += 12;
    return `${String(hour).padStart(2, '0')}:${match12[2]}:${match12[3] ?? '00'}`;
  }
  if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(trimmed)) {
    const [h, m, s] = trimmed.split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s ?? '00'}`;
  }
  return null;
}

function isWithinRegistrationCutoff(startAt: string) {
  const scheduledAt = new Date(startAt);
  if (Number.isNaN(scheduledAt.getTime())) return false;
  return scheduledAt.getTime() - Date.now() < 10 * 60 * 1000;
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as string;

    if (action === 'auto-complete') {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('guest_schedule_items')
        .update({ status: 'COMPLETED' })
        .lt('end_at', new Date().toISOString())
        .eq('status', 'SCHEDULED')
        .select();
      if (error) throw error;
      return NextResponse.json({ success: true, data: data ?? [] });
    }

    if (action === 'mark-completed') {
      const itemId = body.itemId as string;
      if (!itemId) {
        return NextResponse.json({ success: false, error: 'itemId required' }, { status: 400 });
      }
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('guest_schedule_items')
        .update({ status: 'COMPLETED' })
        .eq('id', itemId)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Schedule PATCH Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update schedule' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const guestId = String(body.guestId ?? '').trim();
    const title = String(body.title ?? '').trim();
    const itemType = String(body.itemType ?? 'CUSTOM') as ScheduleRow['item_type'];
    const sourceId = String(body.sourceId ?? '').trim();
    const startAt = String(body.startAt ?? '').trim();
    const endAt = String(body.endAt ?? '').trim();
    const notes = body.notes ? String(body.notes) : null;
    const supabase = getSupabaseAdmin();

    if (!guestId || !startAt || !endAt) {
      return NextResponse.json({ success: false, error: 'Guest, start time, and end time are required' }, { status: 400 });
    }

    if ((itemType === 'ACTIVITY' || itemType === 'BOOKING' || itemType === 'ORDER') && !sourceId) {
      return NextResponse.json({ success: false, error: 'Please select an item from the list' }, { status: 400 });
    }

    if ((itemType === 'CUSTOM' || itemType === 'SERVICE' || itemType === 'RESERVATION') && !title) {
      return NextResponse.json({ success: false, error: 'Title is required for custom entries' }, { status: 400 });
    }

    const bookingDate = startAt.slice(0, 10);
    const timeSlot = startAt.slice(11, 16);

    if (isWithinRegistrationCutoff(startAt)) {
      return NextResponse.json(
        { success: false, error: 'Registration is closed within 10 minutes of the scheduled start time' },
        { status: 409 },
      );
    }

    const startTimeMinutes = Number(startAt.slice(11, 13)) * 60 + Number(startAt.slice(14, 16));
    const endTimeMinutes = Number(endAt.slice(11, 13)) * 60 + Number(endAt.slice(14, 16));
    if (startTimeMinutes < 7 * 60 || startTimeMinutes > 21 * 60) {
      return NextResponse.json({ success: false, error: 'Start time must be between 07:00 and 21:00' }, { status: 400 });
    }
    if (endTimeMinutes < 7 * 60 || endTimeMinutes > 22 * 60) {
      return NextResponse.json({ success: false, error: 'End time must be between 07:00 and 22:00' }, { status: 400 });
    }
    if (endTimeMinutes <= startTimeMinutes) {
      return NextResponse.json({ success: false, error: 'End time must be after start time' }, { status: 400 });
    }

    if (itemType === 'ACTIVITY' || itemType === 'BOOKING') {
      const { data: activity, error: activityError } = await supabase
        .from('activities')
        .select('id,name,duration')
        .eq('id', sourceId)
        .single();

      if (activityError || !activity) {
        return NextResponse.json({ success: false, error: 'Activity not found' }, { status: 404 });
      }

      const participants = Math.max(1, Number(body.participants) || 1);

      const { data: booking, error: bookingError } = await supabase
        .from('activity_bookings')
        .insert({
          activity_id: sourceId,
          guest_id: guestId,
          booking_date: bookingDate,
          booking_time: parseTimeSlot(timeSlot),
          participants,
          status: (body.status as ScheduleRow['status']) ?? 'CONFIRMED',
          notes,
        })
        .select('id')
        .single();

      if (bookingError) throw bookingError;

      return NextResponse.json({
        success: true,
        data: {
          id: booking.id,
          sourceModule: 'activity_bookings',
          title: activity.name,
          itemType,
        },
      }, { status: 201 });
    }

    if (itemType === 'ORDER') {
      const { data: menuItem, error: menuError } = await supabase
        .from('menu_items')
        .select('id,name,price,category')
        .eq('id', sourceId)
        .single();

if (menuError || !menuItem) {
        return NextResponse.json({ success: false, error: 'Menu item not found' }, { status: 404 });
      }

      const price = Number(menuItem.price);
      const { data: reservation } = await supabase
        .from('reservations')
        .select('room_id')
        .eq('guest_id', guestId)
        .neq('status', 'CANCELLED')
        .order('check_in', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: order, error: orderError } = await supabase
        .from('food_orders')
        .insert({
          guest_id: guestId,
          room_id: reservation?.room_id ?? null,
          items: [
            {
              id: menuItem.id,
              name: menuItem.name,
              quantity: 1,
              price,
            },
          ],
          total: price,
          status: 'PENDING',
          notes: notes ?? `Scheduled for ${startAt}`,
          created_at: startAt,
        })
        .select('id,created_at')
        .single();

      if (orderError) throw orderError;

      return NextResponse.json({
        success: true,
        data: {
          id: order.id,
          sourceModule: 'food_orders',
          title: menuItem.name,
          itemType,
        },
      }, { status: 201 });
    }

    const { data, error } = await supabase
      .from('guest_schedule_items')
      .insert({
        guest_id: guestId,
        title,
        item_type: itemType,
        source_module: body.sourceModule ?? 'manual',
        source_record_id: body.sourceRecordId ?? null,
        start_at: startAt,
        end_at: endAt,
        status: body.status ?? 'SCHEDULED',
        notes,
        color: body.color ?? colorForType(itemType),
      })
      .select('id,guest_id,title,item_type,source_module,source_record_id,start_at,end_at,status,notes,color,created_at,updated_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create schedule item' }, { status: 500 });
  }
}

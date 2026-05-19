import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const foodOrderSchema = z.object({
  id: z.string().uuid().optional(),
  guestId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().min(0),
  })),
  total: z.number().min(0),
  status: z.enum(['PENDING', 'PREPARING', 'SERVED', 'CANCELLED']).optional(),
  notes: z.string().optional(),
});

type FoodOrderRow = {
  id: string;
  order_id?: string | null;
  guest_id?: string | null;
  items?: Array<{ name?: string; quantity?: number }> | null;
  total?: number | string | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  guests?: { first_name?: string | null; last_name?: string | null } | null;
  rooms?: { room_number?: string | null } | null;
};

function itemsSummary(items: FoodOrderRow['items']) {
  const rows = items ?? [];
  if (rows.length === 0) return 'No items';
  const first = rows[0]?.name ?? 'Item';
  if (rows.length === 1) return first;
  return `${first} + ${rows.length - 1} more`;
}

function formatOrderTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get('search') ?? '';
    const statusFilter = request.nextUrl.searchParams.get('status') ?? '';

    let query = getSupabaseAdmin()
      .from('food_orders')
      .select('id,order_id,guest_id,items,total,status,notes,created_at,guests(first_name,last_name),rooms(room_number)')
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) throw error;

    const orders = (data ?? []) as FoodOrderRow[];
    const mapped = orders.map((order) => ({
      id: order.id,
      orderId: order.order_id ?? null,
      guest: order.guests ? `${order.guests.first_name ?? ''} ${order.guests.last_name ?? ''}`.trim() || null : null,
      room: order.rooms?.room_number ?? null,
      itemsSummary: itemsSummary(order.items),
      total: order.total === undefined || order.total === null ? 0 : Number(order.total),
      status: order.status ?? null,
      time: formatOrderTime(order.created_at),
      createdAt: order.created_at ?? null,
    }));

    const stats = {
      newOrders: mapped.filter((o) => o.status === 'PENDING').length,
      preparing: mapped.filter((o) => o.status === 'PREPARING').length,
      delivered: mapped.filter((o) => o.status === 'SERVED').length,
      completedToday: mapped.filter((o) => {
        if (!o.createdAt) return false;
        const created = new Date(o.createdAt);
        const today = new Date();
        return (
          o.status === 'SERVED' &&
          created.getDate() === today.getDate() &&
          created.getMonth() === today.getMonth() &&
          created.getFullYear() === today.getFullYear()
        );
      }).length,
    };

    const filtered = search
      ? mapped.filter((order) => JSON.stringify(order).toLowerCase().includes(search.toLowerCase()))
      : mapped;

    return NextResponse.json({
      success: true,
      data: filtered,
      stats,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch food orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = foodOrderSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();

    let roomId = body.roomId ?? null;
    if (body.guestId && !roomId) {
      const { data: reservation } = await supabase
        .from('reservations')
        .select('room_id')
        .eq('guest_id', body.guestId)
        .neq('status', 'CANCELLED')
        .order('check_in', { ascending: false })
        .limit(1)
        .maybeSingle();
      roomId = reservation?.room_id ?? null;
    }

    const { data, error } = await supabase
      .from('food_orders')
      .insert({
        guest_id: body.guestId ?? null,
        room_id: roomId,
        items: body.items,
        total: body.total,
        status: body.status ?? 'PENDING',
        notes: body.notes,
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to create food order' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = foodOrderSchema.partial().extend({ id: z.string().uuid() }).parse(await request.json());
    const { id, guestId, roomId, items, total, status, notes } = body;

    const updatePayload: Record<string, unknown> = {};
    if (items !== undefined) updatePayload.items = items;
    if (total !== undefined) updatePayload.total = total;
    if (status !== undefined) updatePayload.status = status;
    if (notes !== undefined) updatePayload.notes = notes;
    if (guestId !== undefined) updatePayload.guest_id = guestId;
    if (roomId !== undefined) updatePayload.room_id = roomId;

    const { data, error } = await getSupabaseAdmin()
      .from('food_orders')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update food order' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }
    const { error } = await getSupabaseAdmin().from('food_orders').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Food order deleted' });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete food order' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const foodOrderSchema = z.object({
  id: z.string().uuid().optional(),
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
  total?: number | string | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  guests?: { first_name?: string | null; last_name?: string | null } | null;
  rooms?: { room_number?: string | null } | null;
};

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get('search') ?? '';
    const { data, error } = await getSupabaseAdmin()
      .from('food_orders')
      .select('id,order_id,total,status,notes,created_at,guests(first_name,last_name),rooms(room_number)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const orders = (data ?? []) as FoodOrderRow[];
    const mapped = orders.map((order) => ({
      id: order.id,
      orderId: order.order_id ?? null,
      guest: order.guests ? `${order.guests.first_name ?? ''} ${order.guests.last_name ?? ''}`.trim() || null : null,
      room: order.rooms?.room_number ?? null,
      total: order.total === undefined || order.total === null ? 0 : Number(order.total),
      status: order.status ?? null,
      createdAt: order.created_at ?? null,
    }));

    return NextResponse.json({
      success: true,
      data: search
        ? mapped.filter((order) => JSON.stringify(order).toLowerCase().includes(search.toLowerCase()))
        : mapped,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch food orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = foodOrderSchema.parse(await request.json());
    const { data, error } = await getSupabaseAdmin()
      .from('food_orders')
      .insert({
        items: body.items,
        total: body.total,
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
    const body = foodOrderSchema.parse(await request.json());
    const { id, ...updateData } = body as typeof body & { id?: string };
    const { data, error } = await getSupabaseAdmin()
      .from('food_orders')
      .update({
        items: updateData.items,
        total: updateData.total,
        status: updateData.status,
        notes: updateData.notes,
      })
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
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const menuItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0),
  isAvailable: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get('search') ?? '';
    const supabase = getSupabaseAdmin();
    let query = supabase.from('menu_items').select('*').order('name', { ascending: true });

    if (search) {
      query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: (data ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        price: Number(item.price),
        status: item.is_available ? 'AVAILABLE' : 'UNAVAILABLE',
      })),
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch menu items' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = menuItemSchema.parse(await request.json());
    const { data, error } = await getSupabaseAdmin()
      .from('menu_items')
      .insert({
        name: body.name,
        category: body.category,
        description: body.description,
        price: body.price,
        is_available: body.isAvailable ?? true,
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to create menu item' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = menuItemSchema.parse(await request.json());
    const { id, ...updateData } = body as typeof body & { id?: string };
    const { data, error } = await getSupabaseAdmin()
      .from('menu_items')
      .update({
        name: updateData.name,
        category: updateData.category,
        description: updateData.description,
        price: updateData.price,
        is_available: updateData.isAvailable,
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
    return NextResponse.json({ success: false, error: 'Failed to update menu item' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }
    const { error } = await getSupabaseAdmin().from('menu_items').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Menu item deleted' });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete menu item' }, { status: 500 });
  }
}

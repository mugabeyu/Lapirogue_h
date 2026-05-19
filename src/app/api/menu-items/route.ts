import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const menuItemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  price: z.number().min(0).optional(),
  preparationMinutes: z.number().int().min(0).optional().nullable(),
  isAvailable: z.boolean().optional(),
  imagePath: z.string().optional().nullable(),
});

const createMenuItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional().nullable(),
  price: z.number().min(0),
  preparationMinutes: z.number().int().min(0).optional().nullable(),
  isAvailable: z.boolean().optional(),
  imagePath: z.string().optional().nullable(),
});

type MenuRow = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number | string;
  preparation_minutes: number | null;
  is_available: boolean;
  image_path: string | null;
  created_at: string;
  updated_at: string;
};

function mapMenuItem(row: MenuRow) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description ?? undefined,
    price: Number(row.price),
    preparationMinutes: row.preparation_minutes ?? null,
    isAvailable: row.is_available,
    imagePath: row.image_path ?? undefined,
    status: row.is_available ? 'AVAILABLE' : 'UNAVAILABLE',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildInsertPayload(body: z.infer<typeof menuItemSchema>) {
  return {
    name: body.name!,
    category: body.category!,
    description: body.description ?? null,
    price: body.price ?? 0,
    preparation_minutes: body.preparationMinutes ?? null,
    is_available: body.isAvailable ?? true,
    image_path: body.imagePath ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get('search') ?? '';
    const category = request.nextUrl.searchParams.get('category') ?? '';
    const supabase = getSupabaseAdmin();
    let query = supabase.from('menu_items').select('*').order('name', { ascending: true });

    if (search) {
      query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (category && category !== 'All') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;

    const items = (data ?? []).map((row) => mapMenuItem(row as MenuRow));
    const categories = Array.from(new Set(items.map((item) => item.category))).sort();

    return NextResponse.json({ success: true, data: items, categories });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch menu items' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = createMenuItemSchema.parse(await request.json());

    const { data, error } = await getSupabaseAdmin()
      .from('menu_items')
      .insert(buildInsertPayload(body))
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data: mapMenuItem(data as MenuRow) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to create menu item' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = menuItemSchema.extend({ id: z.string().uuid() }).parse(await request.json());
    const { id, ...rest } = body;

    const { data: existing, error: existingError } = await getSupabaseAdmin()
      .from('menu_items')
      .select('*')
      .eq('id', id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ success: false, error: 'Menu item not found' }, { status: 404 });
    }

    const row = existing as MenuRow;
    const merged = {
      name: rest.name ?? row.name,
      category: rest.category ?? row.category,
      description: rest.description !== undefined ? rest.description : row.description,
      price: rest.price ?? Number(row.price),
      preparation_minutes:
        rest.preparationMinutes !== undefined ? rest.preparationMinutes : row.preparation_minutes,
      is_available: rest.isAvailable !== undefined ? rest.isAvailable : row.is_available,
      image_path: rest.imagePath !== undefined ? rest.imagePath : row.image_path,
    };

    const { data, error } = await getSupabaseAdmin()
      .from('menu_items')
      .update(merged)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data: mapMenuItem(data as MenuRow) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update menu item' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
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

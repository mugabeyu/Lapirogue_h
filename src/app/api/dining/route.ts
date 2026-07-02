import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const category = request.nextUrl.searchParams.get('category') ?? '';

    let query = supabase
      .from('menu_items')
      .select('*')
      .eq('is_available', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;

    const items = (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      category: row.category as string,
      description: (row.description as string) ?? null,
      price: Number(row.price),
      preparationMinutes: (row.preparation_minutes as number) ?? null,
      isAvailable: row.is_available as boolean,
      imagePath: (row.image_path as string) ?? null,
    }));

    const categories = Array.from(new Set(items.map((item) => item.category))).sort();

    const grouped: Record<string, typeof items> = {};
    for (const cat of categories) {
      grouped[cat] = items.filter((item) => item.category === cat);
    }

    return NextResponse.json({
      success: true,
      data: items,
      grouped,
      categories,
      total: items.length,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch menu' }, { status: 500 });
  }
}

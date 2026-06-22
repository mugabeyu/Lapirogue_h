import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const TOUR_CATEGORIES = ['Island Tours', 'Water Sports', 'Adventure', 'Cultural', 'Entertainment'];

function formatDurationLabel(minutes: number) {
  if (minutes >= 480) return 'Full Day';
  if (minutes >= 60) return `${Math.round(minutes / 60)} Hours`;
  return `${minutes} min`;
}

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get('type') ?? '';
    const supabase = getSupabaseAdmin();

    if (type === 'ACTIVITY' || type === 'BOOKING') {
      let query = supabase
        .from('activities')
        .select('id,name,category,price,duration,default_time,status')
        .eq('status', 'ACTIVE')
        .order('name', { ascending: true });

      if (type === 'BOOKING') {
        query = query.in('category', TOUR_CATEGORIES);
      }

      const { data, error } = await query;
      if (error) throw error;

      return NextResponse.json({
        success: true,
        data: (data ?? []).map((row) => ({
          id: row.id,
          label: row.name,
          subtitle: row.category,
          meta: formatDurationLabel(row.duration),
          price: Number(row.price),
          defaultTime: row.default_time ?? '09:00',
        })),
      });
    }

    if (type === 'ORDER') {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id,name,category,price,is_available')
        .eq('is_available', true)
        .order('name', { ascending: true });

      if (error) throw error;

      return NextResponse.json({
        success: true,
        data: (data ?? []).map((row) => ({
          id: row.id,
          label: row.name,
          subtitle: row.category,
          price: Number(row.price),
        })),
      });
    }

    return NextResponse.json({ success: true, data: [] });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load options' }, { status: 500 });
  }
}

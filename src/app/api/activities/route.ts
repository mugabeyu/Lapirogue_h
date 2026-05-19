import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const activitySchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0),
  duration: z.number().int().positive(),
  capacity: z.number().int().positive(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'FULL']).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get('search') ?? '';
    const supabase = getSupabaseAdmin();
    let query = supabase.from('activities').select('*').order('created_at', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: (data ?? []).map((activity) => ({
        id: activity.id,
        name: activity.name,
        category: activity.category,
        description: activity.description,
        price: Number(activity.price),
        duration: activity.duration,
        capacity: activity.capacity,
        status: activity.status,
        imagePath: activity.image_path,
      })),
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch activities' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = activitySchema.parse(await request.json());
    const { data, error } = await getSupabaseAdmin()
      .from('activities')
      .insert(body)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to create activity' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = activitySchema.extend({ id: z.string().uuid() }).parse(await request.json());
    const { id, ...updateData } = body;
    const { data, error } = await getSupabaseAdmin()
      .from('activities')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update activity' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }
    const { error } = await getSupabaseAdmin().from('activities').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Activity deleted' });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete activity' }, { status: 500 });
  }
}

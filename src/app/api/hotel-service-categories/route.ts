import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuditActor, recordAuditLog } from '@/lib/audit';
import { z } from 'zod';

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().optional().default(''),
  iconName: z.string().optional().default('room_service'),
  colorHex: z.string().optional().default('#9B59B6'),
  bgColorHex: z.string().optional().nullable(),
  displayOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get('search') ?? '';
    let query = getSupabaseAdmin().from('hotel_service_categories').select('*').order('display_order', { ascending: true });
    if (search) query = query.ilike('name', `%${search}%`);
    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        iconName: row.icon_name,
        colorHex: row.color_hex,
        bgColorHex: row.bg_color_hex,
        displayOrder: row.display_order,
        isActive: row.is_active,
      })),
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch hotel service categories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    const actor = await getAuditActor(request);
    const actorId = actor?.id ?? null;
    const { data, error } = await getSupabaseAdmin().from('hotel_service_categories').insert({
      name: body.name,
      description: body.description,
      icon_name: body.iconName,
      color_hex: body.colorHex,
      bg_color_hex: body.bgColorHex,
      display_order: body.displayOrder,
      is_active: body.isActive,
      created_by: actorId,
      updated_by: actorId,
    }).select('*').single();
    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to create category' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    const { id, ...updateData } = body;
    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    const actor = await getAuditActor(request);
    const actorId = actor?.id ?? null;
    const { data, error } = await getSupabaseAdmin().from('hotel_service_categories').update({
      name: updateData.name,
      description: updateData.description,
      icon_name: updateData.iconName,
      color_hex: updateData.colorHex,
      bg_color_hex: updateData.bgColorHex,
      display_order: updateData.displayOrder,
      is_active: updateData.isActive,
      updated_by: actorId,
    }).eq('id', id).select('*').single();
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update category' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const actor = await getAuditActor(request);
  const actorId = actor?.id ?? null;
  const { data: category } = await supabase.from('hotel_service_categories').select('*').eq('id', id).maybeSingle();

  if (category) {
    await recordAuditLog({
      tableName: 'hotel_service_categories',
      recordId: id,
      action: 'DELETE',
      actorId,
      before: category as Record<string, unknown>,
    });
  }

  const { error } = await supabase.from('hotel_service_categories').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: 'Failed to delete category' }, { status: 500 });
  return NextResponse.json({ success: true });
}

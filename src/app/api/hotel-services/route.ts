import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuditActor, recordAuditLog } from '@/lib/audit';
import { z } from 'zod';

const schema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional().nullable(),
  name: z.string().min(1),
  description: z.string().optional().default(''),
  subtitle: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  hoursText: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
  isAvailable: z.boolean().optional().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get('search') ?? '';
    let query = getSupabaseAdmin().from('hotel_services').select('*').order('sort_order', { ascending: true });
    if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: (data ?? []).map((row) => ({
        id: row.id,
        categoryId: row.category_id,
        name: row.name,
        description: row.description,
        subtitle: row.subtitle,
        phoneNumber: row.phone_number,
        email: row.email,
        hoursText: row.hours_text,
        location: row.location,
        imageUrl: row.image_url,
        sortOrder: row.sort_order,
        isAvailable: row.is_available,
      })),
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch hotel services' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    const actor = await getAuditActor(request);
    const actorId = actor?.id ?? null;
    const { data, error } = await getSupabaseAdmin().from('hotel_services').insert({
      category_id: body.categoryId,
      name: body.name,
      description: body.description,
      subtitle: body.subtitle,
      phone_number: body.phoneNumber,
      email: body.email,
      hours_text: body.hoursText,
      location: body.location,
      image_url: body.imageUrl,
      sort_order: body.sortOrder,
      is_available: body.isAvailable,
      created_by: actorId,
      updated_by: actorId,
    }).select('*').single();
    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to create service' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    const { id, ...updateData } = body;
    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    const actor = await getAuditActor(request);
    const actorId = actor?.id ?? null;
    const { data, error } = await getSupabaseAdmin().from('hotel_services').update({
      category_id: updateData.categoryId,
      name: updateData.name,
      description: updateData.description,
      subtitle: updateData.subtitle,
      phone_number: updateData.phoneNumber,
      email: updateData.email,
      hours_text: updateData.hoursText,
      location: updateData.location,
      image_url: updateData.imageUrl,
      sort_order: updateData.sortOrder,
      is_available: updateData.isAvailable,
      updated_by: actorId,
    }).eq('id', id).select('*').single();
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update service' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const actor = await getAuditActor(request);
  const actorId = actor?.id ?? null;
  const { data: service } = await supabase.from('hotel_services').select('*').eq('id', id).maybeSingle();

  if (service) {
    await recordAuditLog({
      tableName: 'hotel_services',
      recordId: id,
      action: 'DELETE',
      actorId,
      before: service as Record<string, unknown>,
    });
  }

  const { error } = await supabase.from('hotel_services').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: 'Failed to delete service' }, { status: 500 });
  return NextResponse.json({ success: true });
}

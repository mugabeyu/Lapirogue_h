import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  phoneNumber: z.string().min(1),
  iconName: z.string().optional().nullable(),
  colorHex: z.string().optional().nullable(),
  bgColorHex: z.string().optional().nullable(),
  is24h: z.boolean().optional().default(true),
  displayOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get('search') ?? '';
    let query = getSupabaseAdmin().from('emergency_contacts').select('*').order('display_order', { ascending: true });
    if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        phoneNumber: row.phone_number,
        iconName: row.icon_name,
        colorHex: row.color_hex,
        bgColorHex: row.bg_color_hex,
        is24h: row.is_24h,
        displayOrder: row.display_order,
        isActive: row.is_active,
      })),
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch emergency contacts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    const { data, error } = await getSupabaseAdmin().from('emergency_contacts').insert({
      name: body.name,
      description: body.description,
      phone_number: body.phoneNumber,
      icon_name: body.iconName,
      color_hex: body.colorHex,
      bg_color_hex: body.bgColorHex,
      is_24h: body.is24h,
      display_order: body.displayOrder,
      is_active: body.isActive,
    }).select('*').single();
    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to create emergency contact' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    const { id, ...updateData } = body;
    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    const { data, error } = await getSupabaseAdmin().from('emergency_contacts').update({
      name: updateData.name,
      description: updateData.description,
      phone_number: updateData.phoneNumber,
      icon_name: updateData.iconName,
      color_hex: updateData.colorHex,
      bg_color_hex: updateData.bgColorHex,
      is_24h: updateData.is24h,
      display_order: updateData.displayOrder,
      is_active: updateData.isActive,
    }).eq('id', id).select('*').single();
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update emergency contact' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
  const { error } = await getSupabaseAdmin().from('emergency_contacts').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: 'Failed to delete emergency contact' }, { status: 500 });
  return NextResponse.json({ success: true });
}

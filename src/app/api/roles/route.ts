import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const allowedRoleNames = ['MAIN_RECEPTIONIST', 'RECEPTIONIST'] as const;

const roleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.enum(allowedRoleNames),
  description: z.string().optional(),
  permissions: z.record(z.unknown()).optional(),
});

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('roles')
      .select('*')
      .in('name', allowedRoleNames)
      .order('name', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch roles',
      details: process.env.NODE_ENV === 'production'
        ? undefined
        : error instanceof Error
          ? error.message
          : String(error),
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = roleSchema.parse(await request.json());
    if (!allowedRoleNames.includes(body.name)) {
      return NextResponse.json({ success: false, error: 'Unsupported role name' }, { status: 400 });
    }
    const { data, error } = await getSupabaseAdmin()
      .from('roles')
      .insert({
        name: body.name,
        description: body.description,
        permissions: body.permissions ?? {},
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({
      success: false,
      error: 'Failed to create role',
      details: process.env.NODE_ENV === 'production'
        ? undefined
        : error instanceof Error
          ? error.message
          : String(error),
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = roleSchema.parse(await request.json());
    if (!allowedRoleNames.includes(body.name)) {
      return NextResponse.json({ success: false, error: 'Unsupported role name' }, { status: 400 });
    }
    const { id, ...updateData } = body;
    const { data, error } = await getSupabaseAdmin()
      .from('roles')
      .update({
        name: updateData.name,
        description: updateData.description,
        permissions: updateData.permissions,
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
    return NextResponse.json({
      success: false,
      error: 'Failed to update role',
      details: process.env.NODE_ENV === 'production'
        ? undefined
        : error instanceof Error
          ? error.message
          : String(error),
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }
    const { error } = await getSupabaseAdmin().from('roles').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Role deleted' });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to delete role',
      details: process.env.NODE_ENV === 'production'
        ? undefined
        : error instanceof Error
          ? error.message
          : String(error),
    }, { status: 500 });
  }
}

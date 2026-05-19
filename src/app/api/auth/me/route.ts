import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';

function normalizeRole(role?: string | null) {
  return 'RECEPTIONIST';
}

const profileSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const authClient = getRouteHandlerSupabaseClient(request);
  const { data: { user }, error: userError } = await authClient.auth.getUser();
  if (!user || userError) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const { data: profileRow } = await authClient
    .from('profiles')
    .select('auth_id, email, full_name, role, created_at, updated_at')
    .eq('auth_id', user.id)
    .maybeSingle();

  const email = profileRow?.email || user.email || '';
  const name = profileRow?.full_name || user.user_metadata?.full_name || '';
  const role = normalizeRole(profileRow?.role || (user.user_metadata?.role as string | undefined));

  return NextResponse.json({
    success: true,
    data: {
      id: profileRow?.auth_id || user.id,
      email,
      name,
      role,
      phone: null,
      isActive: true,
      createdAt: profileRow?.created_at || user.created_at || '',
      updatedAt: profileRow?.updated_at || user.updated_at || '',
    },
  });
}

export async function PUT(request: NextRequest) {
  const authClient = getRouteHandlerSupabaseClient(request);
  const { data: { user }, error: userError } = await authClient.auth.getUser();
  if (!user || userError) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validatedData = profileSchema.parse(body);

    const { data, error } = await authClient
      .from('profiles')
      .upsert({
        auth_id: user.id,
        full_name: validatedData.fullName,
        email: validatedData.email,
        role: 'RECEPTIONIST',
      }, {
        onConflict: 'auth_id',
      })
      .select('auth_id, email, full_name, role, created_at, updated_at')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        id: data.auth_id,
        email: data.email,
        name: data.full_name,
        role: data.role,
        phone: null,
        isActive: true,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
  }
}
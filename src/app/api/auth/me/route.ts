import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { INTERNATIONAL_PHONE_DISPLAY_PATTERN } from '@/lib/phone';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeRole(role?: string | null) {
  if (role === 'MAIN_RECEPTIONIST') return 'MAIN_RECEPTIONIST' as const;
  return 'RECEPTIONIST' as const;
}

const profileSchema = z.object({
  fullName: z.string().min(1).optional().nullable(),
  email: z.string().email(),
  avatarUrl: z.string().url().optional().nullable(),
  phone: z.string().regex(INTERNATIONAL_PHONE_DISPLAY_PATTERN, 'Use Mauritian format like (+230) 1234 5678').optional().nullable(),
});

function normalizeVal(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

export async function GET(request: NextRequest) {
  const authClient = getRouteHandlerSupabaseClient(request);
  const adminClient = getSupabaseAdmin();
  const { data: { user }, error: userError } = await authClient.auth.getUser();
  if (!user || userError) {
    const response = NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  }

  // Reject guest users - staff portal only
  const { data: guestRow } = await adminClient
    .from('guests')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle();

  if (guestRow) {
    return NextResponse.json({ success: false, error: 'Guests must access via the mobile app' }, { status: 403 });
  }

  const [profileResult, staffResult] = await Promise.all([
    adminClient
      .from('profiles')
      .select('auth_id, email, full_name, phone, avatar_url, role, is_main, is_active, created_at, updated_at')
      .eq('auth_id', user.id)
      .maybeSingle(),
    adminClient
      .from('staff')
      .select('auth_user_id, full_name, image_path, status')
      .eq('auth_user_id', user.id)
      .maybeSingle(),
  ]);

  const profileRow = profileResult.data
    ? {
        ...profileResult.data,
        email: normalizeVal(profileResult.data.email),
        full_name: normalizeVal(profileResult.data.full_name),
        phone: normalizeVal(profileResult.data.phone),
        avatar_url: normalizeVal(profileResult.data.avatar_url),
        role: normalizeVal(profileResult.data.role),
      }
    : null;
  const staffRow = staffResult.data;

  if (profileRow?.is_active === false) {
    return NextResponse.json({ success: false, error: 'This staff account is blocked' }, { status: 403 });
  }

  const email = profileRow?.email || user.email || '';

  let name = profileRow?.full_name || staffRow?.full_name || (user.user_metadata?.full_name as string | undefined) || null;

  if (!name && email) {
    const local = email.split('@')[0] ?? '';
    const derived = local
      .replace(/[._\-]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((p: string) => p[0]?.toUpperCase() + p.slice(1).toLowerCase())
      .join(' ');
    name = derived || email;
    try {
      await adminClient.from('profiles').upsert({ auth_id: user.id, full_name: name }, { onConflict: 'auth_id' });
    } catch {
      // ignore
    }
  }
  const role = profileRow?.is_main
    ? ('MAIN_RECEPTIONIST' as const)
    : normalizeRole(profileRow?.role || (user.user_metadata?.role as string | undefined));

  let avatarUrl: string | null = null;
  const tryToMakePublic = async (maybePathOrUrl: string | null | undefined) => {
    if (!maybePathOrUrl) return null;
    if (/^https?:\/\//i.test(maybePathOrUrl)) return maybePathOrUrl;
    try {
      let path = maybePathOrUrl;
      const marker = '/storage/v1/object/public/staff-avatars/';
      const idx = path.indexOf(marker);
      if (idx !== -1) {
        path = decodeURIComponent(path.slice(idx + marker.length));
      }
      if (path.startsWith('staff-avatars/')) {
        path = path.replace(/^staff-avatars\//, '');
      }

      const { data: publicData } = await adminClient.storage.from('staff-avatars').getPublicUrl(path);
      return publicData?.publicUrl ?? maybePathOrUrl;
    } catch {
      return maybePathOrUrl;
    }
  };

  avatarUrl = await tryToMakePublic(profileRow?.avatar_url ?? null) || (await tryToMakePublic(staffRow?.image_path ?? null));

  const response = NextResponse.json({
    success: true,
    data: {
      id: profileRow?.auth_id || user.id,
      email,
      name,
      role,
      phone: profileRow?.phone ?? null,
      avatarUrl,
      isActive: profileRow?.is_active !== false,
      createdAt: profileRow?.created_at || user.created_at || '',
      updatedAt: profileRow?.updated_at || user.updated_at || '',
    },
  });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export async function PUT(request: NextRequest) {
  const authClient = getRouteHandlerSupabaseClient(request);
  const { data: { user }, error: userError } = await authClient.auth.getUser();
  if (!user || userError) {
    const response = NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  }

  try {
    const body = await request.json();
    const validatedData = profileSchema.parse(body);

    const { data, error } = await authClient
      .from('profiles')
      .upsert(
        {
          auth_id: user.id,
          full_name: validatedData.fullName,
          email: validatedData.email,
          phone: validatedData.phone ?? null,
          avatar_url: validatedData.avatarUrl ?? null,
        },
        { onConflict: 'auth_id' },
      )
      .select('auth_id, email, full_name, phone, avatar_url, role, is_main, is_active, created_at, updated_at')
      .single();

    if (error) throw error;

    const response = NextResponse.json({
      success: true,
      data: {
        id: data.auth_id,
        email: data.email,
        name: data.full_name,
        role: data.is_main ? 'MAIN_RECEPTIONIST' : data.role,
        phone: data.phone,
        avatarUrl: data.avatar_url,
        isActive: data.is_active !== false,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const response = NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
      response.headers.set('Cache-Control', 'no-store, max-age=0');
      return response;
    }
    const response = NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  }
}
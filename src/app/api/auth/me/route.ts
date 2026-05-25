import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeRole(role?: string | null) {
  if (role === 'MAIN_RECEPTIONIST') return 'MAIN_RECEPTIONIST' as const;
  return 'RECEPTIONIST' as const;
}

const profileSchema = z.object({
  // Allow fullName to be optional/null during quick avatar uploads
  fullName: z.string().min(1).optional().nullable(),
  email: z.string().email(),
  avatarUrl: z.string().url().optional().nullable(),
  phone: z.string().optional().nullable(),
});

type ProfileRow = {
  auth_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string | null;
  is_main: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

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

  // Try to read the profiles row using the request-scoped client first
  // This improves read-after-write consistency for requests that just upserted the profile
  const { data: profileRowFromAuth } = await authClient
    .from('profiles')
    .select('auth_id, email, full_name, phone, avatar_url, role, is_main, is_active, created_at, updated_at')
    .eq('auth_id', user.id)
    .maybeSingle();

  // Still fetch staff via admin client (readonly); use admin for staff to avoid RLS surprises
  const { data: staffRow } = await adminClient
    .from('staff')
    .select('auth_user_id, full_name, image_path, status')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  // Also read profiles via admin client so we can merge any fields that may be unavailable
  // to the request-scoped client (helps when RLS or replication cause partial reads)
  const { data: profileRowAdmin } = await adminClient
    .from('profiles')
    .select('auth_id, email, full_name, phone, avatar_url, role, is_main, is_active, created_at, updated_at')
    .eq('auth_id', user.id)
    .maybeSingle();

  // Merge, preferring the request-scoped row when it has useful values, otherwise use admin row
  const profileRow = (() => {
    if (!profileRowFromAuth && !profileRowAdmin) return null;
    if (!profileRowFromAuth) return profileRowAdmin;
    if (!profileRowAdmin) return profileRowFromAuth;
    return {
      auth_id: profileRowFromAuth.auth_id ?? profileRowAdmin.auth_id,
      email: normalizeVal(profileRowFromAuth.email) ?? profileRowAdmin.email,
      full_name: normalizeVal(profileRowFromAuth.full_name) ?? profileRowAdmin.full_name,
      phone: normalizeVal(profileRowFromAuth.phone) ?? profileRowAdmin.phone,
      avatar_url: normalizeVal(profileRowFromAuth.avatar_url) ?? profileRowAdmin.avatar_url,
      role: normalizeVal(profileRowFromAuth.role) ?? profileRowAdmin.role,
      is_main: profileRowFromAuth.is_main ?? profileRowAdmin.is_main,
      is_active: profileRowFromAuth.is_active ?? profileRowAdmin.is_active,
      created_at: profileRowFromAuth.created_at ?? profileRowAdmin.created_at,
      updated_at: profileRowFromAuth.updated_at ?? profileRowAdmin.updated_at,
    } satisfies ProfileRow;
  })();

  if (profileRow?.is_active === false) {
    return NextResponse.json({ success: false, error: 'This staff account is blocked' }, { status: 403 });
  }

  const email = profileRow?.email || user.email || '';

  // Prefer explicit profile/staff full_name, then auth metadata.
  let name = profileRow?.full_name || staffRow?.full_name || (user.user_metadata?.full_name as string | undefined) || null;

  // If we still have no usable full name, derive a friendly name from the
  // email local-part (e.g. "uncle.yunusu@gmail.com" -> "Uncle Yunusu") and
  // persist it to `profiles` so subsequent reads return the DB value.
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
      // Persist via admin client so server reads see the stable value immediately.
      await adminClient.from('profiles').upsert({ auth_id: user.id, full_name: name }, { onConflict: 'auth_id' });
    } catch {
      // ignore persistence errors — we still return the derived name
    }
  }
  const role = profileRow?.is_main
    ? ('MAIN_RECEPTIONIST' as const)
    : normalizeRole(profileRow?.role || (user.user_metadata?.role as string | undefined));

  // Normalize avatar URL: profiles.avatar_url may already be a public URL, or it
  // might be stored as a storage path (e.g. "profile/..../file.png") or as
  // staff.image_path. When a storage path is stored we must convert it to a
  // public URL using the storage API so clients can render it directly.
  let avatarUrl: string | null = null;
  const tryToMakePublic = async (maybePathOrUrl: string | null | undefined) => {
    if (!maybePathOrUrl) return null;
    if (/^https?:\/\//i.test(maybePathOrUrl)) return maybePathOrUrl;
    try {
      // Normalize common stored forms into a storage path inside the bucket.
      let path = maybePathOrUrl;
      // If the value contains an embedded storage URL, extract the path segment.
      const marker = '/storage/v1/object/public/staff-avatars/';
      const idx = path.indexOf(marker);
      if (idx !== -1) {
        path = decodeURIComponent(path.slice(idx + marker.length));
      }
      // If the stored path accidentally includes the bucket prefix, strip it.
      if (path.startsWith('staff-avatars/')) {
        path = path.replace(/^staff-avatars\//, '');
      }

      const { data: publicData } = await adminClient.storage.from('staff-avatars').getPublicUrl(path);
      return publicData?.publicUrl ?? maybePathOrUrl;
    } catch {
      return maybePathOrUrl;
    }
  };

  // Prefer explicit profile.avatar_url, then staff.image_path
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
          // Persist avatar URL if provided by the client upload flow
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

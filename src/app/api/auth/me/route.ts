import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { attachSupabaseCookies, getRouteHandlerSupabaseSession } from '@/lib/supabase-server';
import { INTERNATIONAL_PHONE_DISPLAY_PATTERN } from '@/lib/phone';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const userCache = new Map<string, { data: unknown; timestamp: number }>();
const USER_CACHE_TTL_MS = 60000;

type ProfileRow = {
  auth_id?: string;
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

type StaffRow = {
  auth_user_id: string;
  email: string | null;
  full_name: string | null;
  image_path: string | null;
  status: string | null;
};

type SessionData = {
  id: string;
  email: string;
  name: string;
  role: 'MAIN_RECEPTIONIST' | 'RECEPTIONIST';
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function normalizeRole(role?: string | null): SessionData['role'] {
  if (role === 'MAIN_RECEPTIONIST') return 'MAIN_RECEPTIONIST';
  return 'RECEPTIONIST';
}

function normalizeVal(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

function normalizeStorageUrl(admin: ReturnType<typeof getSupabaseAdmin>, value: string | null | undefined) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;

  let path = value;
  const marker = '/storage/v1/object/public/staff-avatars/';
  const markerIndex = path.indexOf(marker);
  if (markerIndex !== -1) {
    path = decodeURIComponent(path.slice(markerIndex + marker.length));
  }
  if (path.startsWith('staff-avatars/')) {
    path = path.replace(/^staff-avatars\//, '');
  }

  return admin.storage.from('staff-avatars').getPublicUrl(path).data.publicUrl ?? value;
}

function deriveNameFromEmail(email: string) {
  const local = email.split('@')[0] ?? '';
  return (
    local
      .replace(/[._\-]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1).toLowerCase()}`)
      .join(' ') || email
  );
}

function buildSessionData(params: {
  userId: string;
  userCreatedAt?: string;
  userUpdatedAt?: string;
  userMetadata?: Record<string, unknown>;
  profile: ProfileRow | null;
  staff: StaffRow | null;
  admin: ReturnType<typeof getSupabaseAdmin>;
}): SessionData {
  const { userId, userCreatedAt, userUpdatedAt, userMetadata, profile, staff, admin } = params;
  const email = profile?.email || staff?.email || '';
  const name =
    profile?.full_name ||
    staff?.full_name ||
    (typeof userMetadata?.full_name === 'string' ? userMetadata.full_name : null) ||
    (email ? deriveNameFromEmail(email) : '');

  return {
    id: profile?.auth_id || staff?.auth_user_id || userId,
    email,
    name,
    role: profile?.is_main ? 'MAIN_RECEPTIONIST' : normalizeRole(profile?.role ?? (userMetadata?.role as string | undefined)),
    phone: profile?.phone ?? null,
    avatarUrl: normalizeStorageUrl(admin, profile?.avatar_url) || normalizeStorageUrl(admin, staff?.image_path),
    isActive: profile?.is_active !== false,
    createdAt: profile?.created_at || userCreatedAt || '',
    updatedAt: profile?.updated_at || userUpdatedAt || '',
  };
}

const profileSchema = z.object({
  fullName: z.string().min(1).optional().nullable(),
  email: z.string().email(),
  avatarUrl: z.string().url().optional().nullable(),
  phone: z.string().regex(INTERNATIONAL_PHONE_DISPLAY_PATTERN, 'Use Mauritian format like (+230) 1234 5678').optional().nullable(),
});

export async function GET(request: NextRequest) {
  const { user, error: userError, response } = await getRouteHandlerSupabaseSession(request);
  if (!user || userError) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), response);
  }

  const cacheKey = `user-${user.id}`;
  const cached = userCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < USER_CACHE_TTL_MS) {
    response.headers.set('Cache-Control', 'private, max-age=60');
    return attachSupabaseCookies(NextResponse.json({ success: true, data: cached.data }, { status: 200 }), response);
  }

  const admin = getSupabaseAdmin();

  const [profileResult, staffResult, guestResult] = await Promise.all([
    admin
      .from('profiles')
      .select('auth_id, email, full_name, phone, avatar_url, role, is_main, is_active, created_at, updated_at')
      .eq('auth_id', user.id)
      .maybeSingle(),
    admin
      .from('staff')
      .select('auth_user_id, email, full_name, image_path, status')
      .eq('auth_user_id', user.id)
      .maybeSingle(),
    admin
      .from('guests')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle(),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (staffResult.error) throw staffResult.error;
  if (guestResult.error) throw guestResult.error;

  if (guestResult.data) {
    return attachSupabaseCookies(
      NextResponse.json({ success: false, error: 'Guests must access via the mobile app' }, { status: 403 }),
      response,
    );
  }

  const profileRow = profileResult.data as ProfileRow | null;
  const staffRow = staffResult.data as StaffRow | null;

  if (profileRow?.is_active === false || (staffRow?.status && staffRow.status.toUpperCase() !== 'ACTIVE')) {
    return attachSupabaseCookies(
      NextResponse.json({ success: false, error: 'This staff account is blocked' }, { status: 403 }),
      response,
    );
  }

  const normalizedProfileRow: ProfileRow | null = profileRow
    ? {
        auth_id: profileRow.auth_id,
        email: normalizeVal(profileRow.email),
        full_name: normalizeVal(profileRow.full_name),
        phone: normalizeVal(profileRow.phone),
        avatar_url: normalizeVal(profileRow.avatar_url),
        role: normalizeVal(profileRow.role),
        is_main: profileRow.is_main,
        is_active: profileRow.is_active,
        created_at: profileRow.created_at,
        updated_at: profileRow.updated_at,
      }
    : null;

  let responseData = buildSessionData({
    userId: user.id,
    userCreatedAt: user.created_at,
    userUpdatedAt: user.updated_at,
    userMetadata: user.user_metadata ?? {},
    profile: normalizedProfileRow,
    staff: staffRow,
    admin,
  });

  if (!responseData.name && responseData.email) {
    responseData = { ...responseData, name: deriveNameFromEmail(responseData.email) };
    try {
      await admin.from('profiles').upsert({ auth_id: user.id, full_name: responseData.name }, { onConflict: 'auth_id' });
    } catch {
      // Ignore profile backfill failures so session lookup still works.
    }
  }

  userCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
  response.headers.set('Cache-Control', 'private, max-age=60');
  return attachSupabaseCookies(NextResponse.json({ success: true, data: responseData }), response);
}

export async function PUT(request: NextRequest) {
  const { user, error: userError, response, supabase } = await getRouteHandlerSupabaseSession(request);
  if (!user || userError) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), response);
  }

  userCache.delete(`user-${user.id}`);

  try {
    const body = await request.json();
    const validatedData = profileSchema.parse(body);
    const admin = getSupabaseAdmin();

    const { data: existingProfile } = await admin
      .from('profiles')
      .select('email, full_name, phone, avatar_url, role, is_main, is_active, created_at, updated_at')
      .eq('auth_id', user.id)
      .maybeSingle();

    const resolvedEmail = validatedData.email || existingProfile?.email || user.email || '';
    const resolvedFullName =
      validatedData.fullName ?? existingProfile?.full_name ?? (user.user_metadata?.full_name as string | null) ?? null;
    const resolvedPhone = validatedData.phone ?? existingProfile?.phone ?? null;
    const resolvedAvatarUrl = validatedData.avatarUrl !== undefined ? validatedData.avatarUrl : existingProfile?.avatar_url ?? null;

    const { data, error } = await admin
      .from('profiles')
      .upsert(
        {
          auth_id: user.id,
          email: resolvedEmail,
          full_name: resolvedFullName,
          phone: resolvedPhone,
          avatar_url: resolvedAvatarUrl,
          is_active: existingProfile?.is_active ?? true,
        },
        { onConflict: 'auth_id' },
      )
      .select('auth_id, email, full_name, phone, avatar_url, role, is_main, is_active, created_at, updated_at')
      .single();

    if (error) throw error;

    const metadata: Record<string, string> = {};
    if (resolvedFullName) metadata.full_name = resolvedFullName;
    if (resolvedPhone) metadata.phone = resolvedPhone;
    if (resolvedAvatarUrl) metadata.avatar_url = resolvedAvatarUrl;

    if (Object.keys(metadata).length > 0) {
      await supabase.auth.updateUser({ data: metadata });
    }

    const responseData = buildSessionData({
      userId: user.id,
      userCreatedAt: user.created_at,
      userUpdatedAt: user.updated_at,
      userMetadata: { ...(user.user_metadata ?? {}), ...metadata },
      profile: data as ProfileRow,
      staff: null,
      admin,
    });

    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return attachSupabaseCookies(NextResponse.json({ success: true, data: responseData }), response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      response.headers.set('Cache-Control', 'no-store, max-age=0');
      return attachSupabaseCookies(
        NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 }),
        response,
      );
    }
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return attachSupabaseCookies(
      NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to update profile' }, { status: 500 }),
      response,
    );
  }
}

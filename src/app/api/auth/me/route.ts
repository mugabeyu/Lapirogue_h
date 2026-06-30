import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { attachSupabaseCookies, getRouteHandlerSupabaseSession } from '@/lib/supabase-server';

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
  is_active: boolean | null;
  home_address: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ManagerRow = {
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  image_path: string | null;
  home_address: string | null;
  department_id: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  departments?: { name: string | null } | null;
};

type ReceptionistRow = {
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  image_path: string | null;
  home_address: string | null;
  department_id: string | null;
  manager_id: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  departments?: { name: string | null } | null;
};

type SessionData = {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'RECEPTIONIST';
  phone: string | null;
  avatarUrl: string | null;
  homeAddress: string | null;
  departmentId: string | null;
  departmentName: string | null;
  managerId: string | null;
  managerName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function normalizeRole(role?: string | null): SessionData['role'] {
  if (role === 'ADMIN') return 'ADMIN';
  if (role === 'MANAGER') return 'MANAGER';
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

async function buildSessionData(params: {
  userId: string;
  userCreatedAt?: string;
  userUpdatedAt?: string;
  userMetadata?: Record<string, unknown>;
  profile: ProfileRow | null;
  admin: ReturnType<typeof getSupabaseAdmin>;
}): Promise<SessionData> {
  const { userId, userCreatedAt, userUpdatedAt, userMetadata, profile, admin } = params;

  if (!profile?.role) {
    return {
      id: userId,
      email: profile?.email || '',
      name: profile?.full_name || deriveNameFromEmail(profile?.email || ''),
      role: 'RECEPTIONIST',
      phone: null,
      avatarUrl: null,
      homeAddress: null,
      departmentId: null,
      departmentName: null,
      managerId: null,
      managerName: null,
      isActive: profile?.is_active !== false,
      createdAt: profile?.created_at || userCreatedAt || '',
      updatedAt: profile?.updated_at || userUpdatedAt || '',
    };
  }

  const role = normalizeRole(profile.role);
  const email = profile.email || '';
  const name = profile.full_name || deriveNameFromEmail(email);
  const avatarUrl = normalizeStorageUrl(admin, profile.avatar_url);

  let departmentName: string | null = null;
  let managerName: string | null = null;
  let managerId: string | null = null;
  let detailPhone: string | null = null;
  let detailHomeAddress = profile.home_address;

  if (role === 'MANAGER') {
    const { data } = await admin
      .from('managers')
      .select('phone, home_address, department_id, departments(name)')
      .eq('auth_id', userId)
      .maybeSingle();
    const mgr = data as { phone?: string | null; home_address?: string | null; department_id?: string | null; departments?: { name?: string | null } | null } | null;
    if (mgr) {
      detailPhone = normalizeVal(mgr.phone);
      detailHomeAddress = detailHomeAddress || normalizeVal(mgr.home_address);
      departmentName = mgr.departments?.name ?? null;
    }
  } else if (role === 'RECEPTIONIST') {
    const { data } = await admin
      .from('receptionists')
      .select('phone, home_address, department_id, manager_id, departments(name)')
      .eq('auth_id', userId)
      .maybeSingle();
    const rec = data as { phone?: string | null; home_address?: string | null; department_id?: string | null; manager_id?: string | null; departments?: { name?: string | null } | null } | null;
    if (rec) {
      detailPhone = normalizeVal(rec.phone);
      detailHomeAddress = detailHomeAddress || normalizeVal(rec.home_address);
      departmentName = rec.departments?.name ?? null;
      managerId = rec.manager_id ?? null;

      if (managerId) {
        const { data: mgrData } = await admin
          .from('managers')
          .select('first_name, last_name')
          .eq('id', managerId)
          .maybeSingle();
        if (mgrData) {
          managerName = `${(mgrData as { first_name?: string }).first_name ?? ''} ${(mgrData as { last_name?: string }).last_name ?? ''}`.trim();
        }
      }
    }
  }

  return {
    id: profile.auth_id || userId,
    email,
    name,
    role,
    phone: normalizeVal(profile.phone) || detailPhone,
    avatarUrl,
    homeAddress: detailHomeAddress,
    departmentId: null,
    departmentName,
    managerId,
    managerName,
    isActive: profile.is_active !== false,
    createdAt: profile.created_at || userCreatedAt || '',
    updatedAt: profile.updated_at || userUpdatedAt || '',
  };
}

const profileSchema = z.object({
  fullName: z.string().min(1).optional().nullable(),
  email: z.string().email(),
  avatarUrl: z.string().url().optional().nullable(),
  phone: z.string().optional().nullable(),
  homeAddress: z.string().optional().nullable(),
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

  const [profileResult, guestResult] = await Promise.all([
    admin
      .from('profiles')
      .select('auth_id, email, full_name, phone, avatar_url, role, is_active, home_address, created_at, updated_at')
      .eq('auth_id', user.id)
      .maybeSingle(),
    admin
      .from('guests')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle(),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (guestResult.error) throw guestResult.error;

  if (guestResult.data) {
    return attachSupabaseCookies(
      NextResponse.json({ success: false, error: 'Guests must access via the mobile app' }, { status: 403 }),
      response,
    );
  }

  const profileRow = profileResult.data as ProfileRow | null;

  if (profileRow?.is_active === false) {
    return attachSupabaseCookies(
      NextResponse.json({ success: false, error: 'This account is blocked' }, { status: 403 }),
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
        is_active: profileRow.is_active,
        home_address: normalizeVal(profileRow.home_address),
        created_at: profileRow.created_at,
        updated_at: profileRow.updated_at,
      }
    : null;

  let responseData = await buildSessionData({
    userId: user.id,
    userCreatedAt: user.created_at,
    userUpdatedAt: user.updated_at,
    userMetadata: user.user_metadata ?? {},
    profile: normalizedProfileRow,
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
      .select('email, full_name, phone, avatar_url, role, is_active, home_address, created_at, updated_at')
      .eq('auth_id', user.id)
      .maybeSingle();

    const resolvedEmail = validatedData.email || existingProfile?.email || user.email || '';
    const resolvedFullName =
      validatedData.fullName ?? existingProfile?.full_name ?? (user.user_metadata?.full_name as string | null) ?? null;
    const resolvedPhone = validatedData.phone ?? existingProfile?.phone ?? null;
    const resolvedAvatarUrl = validatedData.avatarUrl !== undefined ? validatedData.avatarUrl : existingProfile?.avatar_url ?? null;
    const resolvedHomeAddress = validatedData.homeAddress !== undefined ? validatedData.homeAddress : existingProfile?.home_address ?? null;

    const { data, error } = await admin
      .from('profiles')
      .upsert(
        {
          auth_id: user.id,
          email: resolvedEmail,
          full_name: resolvedFullName,
          phone: resolvedPhone,
          avatar_url: resolvedAvatarUrl,
          home_address: resolvedHomeAddress,
          is_active: existingProfile?.is_active ?? true,
        },
        { onConflict: 'auth_id' },
      )
      .select('auth_id, email, full_name, phone, avatar_url, role, is_active, home_address, created_at, updated_at')
      .single();

    if (error) throw error;

    const metadata: Record<string, string> = {};
    if (resolvedFullName) metadata.full_name = resolvedFullName;
    if (resolvedPhone) metadata.phone = resolvedPhone;
    if (resolvedAvatarUrl) metadata.avatar_url = resolvedAvatarUrl;

    if (Object.keys(metadata).length > 0) {
      await supabase.auth.updateUser({ data: metadata });
    }

    const responseData = await buildSessionData({
      userId: user.id,
      userCreatedAt: user.created_at,
      userUpdatedAt: user.updated_at,
      userMetadata: { ...(user.user_metadata ?? {}), ...metadata },
      profile: data as ProfileRow,
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

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { attachSupabaseCookies, getRouteHandlerSupabaseSession } from '@/lib/supabase-server';
import { INTERNATIONAL_PHONE_DISPLAY_PATTERN } from '@/lib/phone';

function emptyToUndefined(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

const profileSchema = z.object({
  fullName: z.preprocess(emptyToUndefined, z.string().min(1).optional().nullable()),
  email: z.preprocess(emptyToUndefined, z.string().email().optional().nullable()),
  phone: z.preprocess(
    emptyToUndefined,
    z.string().regex(INTERNATIONAL_PHONE_DISPLAY_PATTERN, 'Use Mauritian format like (+230) 1234 5678').optional().nullable(),
  ),
  avatarUrl: z.preprocess(emptyToUndefined, z.string().url().optional().nullable()),
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

function normalizeRole(role?: string | null) {
  if (role === 'MAIN_RECEPTIONIST') return 'MAIN_RECEPTIONIST' as const;
  return 'RECEPTIONIST' as const;
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

export async function PUT(request: NextRequest) {
  const { user, error: userError, response, supabase } = await getRouteHandlerSupabaseSession(request);
  if (!user || userError) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), response);
  }

  try {
    const body = await request.json();
    const validatedData = profileSchema.parse(body);
    const admin = getSupabaseAdmin();

    const { data: existingProfile } = await admin
      .from('profiles')
      .select('email, full_name, phone, avatar_url, role, is_main, is_active, created_at, updated_at')
      .eq('auth_id', user.id)
      .maybeSingle();

    const resolvedEmail = validatedData.email ?? existingProfile?.email ?? user.email ?? '';
    const resolvedFullName =
      validatedData.fullName ?? existingProfile?.full_name ?? (user.user_metadata?.full_name as string | null) ?? null;
    const resolvedPhone = validatedData.phone ?? existingProfile?.phone ?? null;
    const resolvedAvatarUrl =
      validatedData.avatarUrl !== undefined ? validatedData.avatarUrl : existingProfile?.avatar_url ?? null;

    const { data, error } = await admin
      .from('profiles')
      .upsert(
        {
          auth_id: user.id,
          full_name: resolvedFullName,
          email: resolvedEmail,
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

    const profile = data as ProfileRow;
    const responseData = {
      id: profile.auth_id,
      email: profile.email,
      name: profile.full_name,
      role: profile.is_main ? 'MAIN_RECEPTIONIST' : normalizeRole(profile.role),
      phone: profile.phone,
      avatarUrl: normalizeStorageUrl(admin, profile.avatar_url),
      isActive: profile.is_active !== false,
      createdAt: profile.created_at ?? '',
      updatedAt: profile.updated_at ?? '',
    };

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

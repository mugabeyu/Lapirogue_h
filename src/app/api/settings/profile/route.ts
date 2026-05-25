import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';

function emptyToUndefined(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

const profileSchema = z.object({
  fullName: z.preprocess(emptyToUndefined, z.string().min(1).optional().nullable()),
  email: z.preprocess(emptyToUndefined, z.string().email().optional().nullable()),
  phone: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  avatarUrl: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
});

export async function PUT(request: NextRequest) {
  const authClient = getRouteHandlerSupabaseClient(request);
  const { data: { user }, error: userError } = await authClient.auth.getUser();
  if (!user || userError) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validatedData = profileSchema.parse(body);

    const { data: existingProfile } = await authClient
      .from('profiles')
      .select('email, full_name, phone, avatar_url')
      .eq('auth_id', user.id)
      .maybeSingle();

    const resolvedEmail = validatedData.email ?? existingProfile?.email ?? user.email ?? '';
    // Do not default full name to the email. If no full name is provided by
    // the client or existing profile or auth metadata, leave it null so the
    // database does not store the email into `full_name`.
    const resolvedFullName =
      validatedData.fullName ?? existingProfile?.full_name ?? user.user_metadata?.full_name ?? null;
    const resolvedPhone = validatedData.phone ?? existingProfile?.phone ?? null;
    const resolvedAvatarUrl =
      validatedData.avatarUrl !== undefined ? validatedData.avatarUrl : existingProfile?.avatar_url ?? null;

    const profileUpdate: Record<string, string | null> = {
      auth_id: user.id,
      full_name: resolvedFullName,
      email: resolvedEmail,
      phone: resolvedPhone,
    };

    profileUpdate.avatar_url = resolvedAvatarUrl;

    const { data, error } = await authClient
      .from('profiles')
      .upsert(
        profileUpdate,
        { onConflict: 'auth_id' },
      )
      .select('auth_id, email, full_name, phone, avatar_url, role, is_main, created_at, updated_at')
      .single();

    if (error) throw error;

    if (resolvedEmail && resolvedEmail !== user.email) {
      await authClient.auth.updateUser({ email: resolvedEmail });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: data.auth_id,
        email: data.email,
        name: data.full_name,
        role: data.is_main ? 'MAIN_RECEPTIONIST' : data.role,
        phone: data.phone,
        avatarUrl: data.avatar_url,
        isActive: true,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('Profile update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update profile',
      },
      { status: 500 },
    );
  }
}

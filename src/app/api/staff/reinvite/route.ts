import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';

const reinviteSchema = z.object({
  staffId: z.string().uuid(),
});

function generateSecurePassword(length = 20) {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+[]{}';
  const bytes = randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i += 1) {
    password += charset[bytes[i] % charset.length];
  }
  return password;
}

async function requireMainReceptionist(request: NextRequest) {
  const authClient = getRouteHandlerSupabaseClient(request);
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return { ok: false as const, status: 401, error: 'Not authenticated' };
  }

  const admin = getSupabaseAdmin();
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role,is_main')
    .eq('auth_id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false as const, status: 403, error: 'Not authorized' };
  }

  if (profile.is_main !== true) {
    return { ok: false as const, status: 403, error: 'Only the main receptionist can resend credentials' };
  }

  return { ok: true as const, userId: user.id };
}

export async function POST(request: NextRequest) {
  const auth = await requireMainReceptionist(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = reinviteSchema.parse(await request.json());
    const admin = getSupabaseAdmin();
    const temporaryPassword = generateSecurePassword();
    const loginUrl = new URL('/login', request.url).toString();

    const { data: staff, error: staffError } = await admin
      .from('staff')
      .select('id,auth_user_id,email,full_name,employee_code,status')
      .eq('id', body.staffId)
      .maybeSingle();

    if (staffError) throw staffError;
    if (!staff) {
      return NextResponse.json({ success: false, error: 'Staff member not found' }, { status: 404 });
    }

    if (!staff.auth_user_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'This staff member is not linked to an authentication user',
        },
        { status: 409 },
      );
    }

    if (staff.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          error: 'Blocked staff cannot receive a new invitation until they are unblocked.',
        },
        { status: 403 },
      );
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('is_main')
      .eq('auth_id', staff.auth_user_id)
      .maybeSingle();
    const authRole = profile?.is_main ? 'MAIN_RECEPTIONIST' : 'RECEPTIONIST';

    const { error: updateUserError } = await admin.auth.admin.updateUserById(staff.auth_user_id, {
      email: staff.email,
      password: temporaryPassword,
      user_metadata: {
        full_name: staff.full_name,
        role: authRole,
        employee_code: staff.employee_code,
        temporary_password: temporaryPassword,
        credential_instructions: 'Use the temporary password from this email, then reset it after first login.',
        login_url: loginUrl,
      },
    });

    if (updateUserError) {
      throw updateUserError;
    }

    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(staff.email, {
      redirectTo: loginUrl,
      data: {
        full_name: staff.full_name,
        role: authRole,
        employee_code: staff.employee_code,
        temporary_password: temporaryPassword,
        credential_instructions: 'Use the temporary password from this email, then reset it after first login.',
        login_url: loginUrl,
      },
    });

    if (inviteError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Credentials were regenerated but invitation email could not be sent. Please retry.',
          details: inviteError.message,
        },
        { status: 502 },
      );
    }

    await admin
      .from('profiles')
      .update({
        email: staff.email,
        full_name: staff.full_name,
        role: 'RECEPTIONIST',
      })
      .eq('auth_id', staff.auth_user_id);

    return NextResponse.json({
      success: true,
      message: 'Invitation email sent with refreshed login credentials.',
      data: {
        staffId: staff.id,
        email: staff.email,
        status: staff.status,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ success: false, error: 'Failed to resend staff invitation' }, { status: 500 });
  }
}

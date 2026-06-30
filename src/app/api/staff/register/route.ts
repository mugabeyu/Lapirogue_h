import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createApiResponse } from '@/lib/api-response';
import { jwtVerify, SignJWT } from 'jose';

const invitationSecret = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.ONBOARDING_SECRET || 'staff-invite-secret'
);

async function verifyInvitationToken(token: string) {
  const { payload } = await jwtVerify(token, invitationSecret, { algorithms: ['HS256'] });
  if (!payload.staffId || typeof payload.staffId !== 'string') throw new Error('Invalid token payload');
  return payload.staffId as string;
}

async function findAuthUserByEmail(supabase: ReturnType<typeof getSupabaseAdmin>, email: string) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return (data.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || typeof token !== 'string') {
      return createApiResponse(false, 'Invitation token is required', { status: 400 });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return createApiResponse(false, 'Password must be at least 8 characters', { status: 400 });
    }

    const staffId = await verifyInvitationToken(token);
    const supabase = getSupabaseAdmin();

    // Look up the staff member in both tables
    const { data: manager } = await supabase
      .from('managers')
      .select('id, first_name, last_name, email, auth_id')
      .eq('id', staffId)
      .maybeSingle();

    const { data: receptionist } = await supabase
      .from('receptionists')
      .select('id, first_name, last_name, email, auth_id')
      .eq('id', staffId)
      .maybeSingle();

    const staff = manager ?? receptionist;
    if (!staff) {
      return createApiResponse(false, 'Staff member not found', { status: 404 });
    }

    const role = manager ? 'MANAGER' : 'RECEPTIONIST';

    if (staff.auth_id) {
      return createApiResponse(false, 'This staff invitation has already been used. Contact an admin if you need to reset your account.', { status: 400 });
    }

    // Check if email already has an auth user
    const existingUser = await findAuthUserByEmail(supabase, staff.email);

    let authId: string;

    if (existingUser) {
      authId = existingUser.id;
    } else {
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: staff.email,
        password,
        email_confirm: true,
        user_metadata: { role },
      });

      if (createError) {
        return createApiResponse(false, createError.message, { status: 400 });
      }
      if (!newUser?.user) {
        return createApiResponse(false, 'Failed to create account', { status: 500 });
      }
      authId = newUser.user.id;
    }

    // Update the staff table with the auth_id
    const table = manager ? 'managers' : 'receptionists';
    await supabase
      .from(table)
      .update({ auth_id: authId })
      .eq('id', staffId);

    // Create or update profile
    await supabase.from('profiles').upsert({
      auth_id: authId,
      email: staff.email,
      full_name: `${staff.first_name} ${staff.last_name}`,
      role,
      is_active: true,
    }, { onConflict: 'auth_id' });

    return createApiResponse(true, { role, email: staff.email });
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid token payload') {
      return createApiResponse(false, 'Invalid invitation token', { status: 400 });
    }
    if (error instanceof Error && (error.message.includes('jwt') || error.message.includes('JWT'))) {
      return createApiResponse(false, 'This invitation link is invalid or has expired.', { status: 400 });
    }
    console.error('Staff registration error:', error);
    return createApiResponse(false, 'Registration failed', { status: 500 });
  }
}

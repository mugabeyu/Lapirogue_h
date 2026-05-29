import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import { jwtVerify } from 'jose';

const invitationSecret = new TextEncoder().encode(process.env.JWT_SECRET || process.env.ONBOARDING_SECRET || 'staff-invite-secret');

const registerSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
});

type StaffOnboarding = {
  id: string;
  email: string;
  full_name: string;
  employee_code: string;
  department: string;
  position: string;
};

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ success: false, error: 'Token required' }, { status: 400 });
  }

  try {
    const { payload } = await jwtVerify(token, invitationSecret);
    const staffId = payload.staffId as string;

    if (!staffId) {
      return NextResponse.json({ success: false, error: 'Invalid token payload' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: onboarding, error: onboardingError } = await supabase
      .from('staff_onboarding')
      .select('id, staff_id, expires_at')
      .eq('invite_token', token)
      .maybeSingle();

    if (onboardingError || !onboarding) {
      return NextResponse.json({ success: false, error: 'Invalid or expired invitation' }, { status: 400 });
    }

    if (onboarding.expires_at && new Date(onboarding.expires_at) < new Date()) {
      return NextResponse.json({ success: false, error: 'Invitation has expired' }, { status: 400 });
    }

    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id,email,full_name,employee_code,department,position')
      .eq('id', staffId)
      .maybeSingle();

    if (staffError || !staff) {
      return NextResponse.json({ success: false, error: 'Staff not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: staff.id,
        email: staff.email,
        full_name: staff.full_name,
        employee_code: staff.employee_code,
        department: staff.department,
        position: staff.position,
      } as StaffOnboarding,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid or expired invitation' }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = registerSchema.parse(await request.json());

    const { payload } = await jwtVerify(body.token, invitationSecret);
    const staffId = payload.staffId as string;

    if (!staffId) {
      return NextResponse.json({ success: false, error: 'Invalid token payload' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: onboarding, error: onboardingError } = await supabase
      .from('staff_onboarding')
      .select('id, staff_id, expires_at')
      .eq('invite_token', body.token)
      .maybeSingle();

    if (onboardingError || !onboarding) {
      return NextResponse.json({ success: false, error: 'Invalid or expired invitation' }, { status: 400 });
    }

    if (onboarding.expires_at && new Date(onboarding.expires_at) < new Date()) {
      return NextResponse.json({ success: false, error: 'Invitation has expired' }, { status: 400 });
    }

    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id,email,full_name,employee_code,status')
      .eq('id', staffId)
      .maybeSingle();

    if (staffError || !staff) {
      return NextResponse.json({ success: false, error: 'Staff not found' }, { status: 404 });
    }

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('auth_id')
      .eq('email', staff.email)
      .maybeSingle();

    if (existingProfile?.auth_id) {
      return NextResponse.json({ success: false, error: 'This staff member already has an account' }, { status: 409 });
    }

    const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
      email: staff.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: staff.full_name,
        employee_code: staff.employee_code,
      },
    });

    if (createError) {
      return NextResponse.json({ success: false, error: createError.message || 'Failed to create account' }, { status: 500 });
    }

    const authId = createdUser?.user?.id;
    if (!authId) {
      return NextResponse.json({ success: false, error: 'Failed to create account' }, { status: 500 });
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        auth_id: authId,
        email: staff.email,
        full_name: staff.full_name,
        role: 'RECEPTIONIST',
        is_active: staff.status === 'ACTIVE',
      });

    if (profileError) {
      await supabase.auth.admin.deleteUser(authId);
      throw profileError;
    }

    await supabase
      .from('staff_onboarding')
      .delete()
      .eq('staff_id', staffId);

    await supabase
      .from('staff')
      .update({ auth_user_id: authId })
      .eq('id', staffId);

    return NextResponse.json({ success: true, message: 'Account created successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Registration failed' }, { status: 500 });
  }
}
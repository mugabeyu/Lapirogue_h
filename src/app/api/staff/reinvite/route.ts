import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import { SignJWT } from 'jose';
import { sendStaffInvitationEmail } from '@/lib/mailer';

const invitationSecret = new TextEncoder().encode(process.env.JWT_SECRET || process.env.ONBOARDING_SECRET || 'staff-invite-secret');

const reinviteSchema = z.object({
  staffId: z.string().uuid(),
});

async function generateInvitationToken(staffId: string): Promise<string> {
  return new SignJWT({ staffId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('48h')
    .sign(invitationSecret);
}

async function requireMainReceptionist(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.replace('Bearer ', '');

  if (!accessToken) {
    return { ok: false as const, status: 401, error: 'Not authenticated' };
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

  if (!user || userError) {
    return { ok: false as const, status: 401, error: 'Not authenticated' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, is_main')
    .eq('auth_id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false as const, status: 403, error: 'Not authorized' };
  }

  if (profile.is_main !== true) {
    return { ok: false as const, status: 403, error: 'Only the main receptionist can resend invitations' };
  }

  return { ok: true as const };
}

export async function POST(request: NextRequest) {
  const auth = await requireMainReceptionist(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = reinviteSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();

    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id,email,full_name,employee_code,status')
      .eq('id', body.staffId)
      .maybeSingle();

    if (staffError) throw staffError;
    if (!staff) {
      return NextResponse.json({ success: false, error: 'Staff member not found' }, { status: 404 });
    }

    if (staff.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Inactive staff cannot receive a new invitation until activated.' },
        { status: 403 }
      );
    }

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('auth_id')
      .eq('email', staff.email)
      .maybeSingle();

    if (existingProfile?.auth_id) {
      return NextResponse.json({ success: false, error: 'This staff member already has an account' }, { status: 409 });
    }

    const { data: onboarding } = await supabase
      .from('staff_onboarding')
      .select('id')
      .eq('staff_id', staff.id)
      .maybeSingle();

    if (onboarding) {
      await supabase.from('staff_onboarding').delete().eq('id', onboarding.id);
    }

    const isMain = await supabase
      .from('profiles')
      .select('is_main')
      .eq('email', staff.email)
      .maybeSingle()
      .then(({ data }) => Boolean(data?.is_main));

    const invitationToken = await generateInvitationToken(staff.id);
    const registerUrl = new URL(`/register?token=${invitationToken}`, request.url).toString();

    const { error: insertError } = await supabase
      .from('staff_onboarding')
      .insert({
        staff_id: staff.id,
        invite_token: invitationToken,
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      });

    if (insertError) throw insertError;

    await sendStaffInvitationEmail({
      to: staff.email,
      staffName: staff.full_name,
      employeeCode: staff.employee_code,
      role: isMain ? 'Main Receptionist' : 'Receptionist',
      registerUrl,
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation refreshed and sent through Resend.',
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
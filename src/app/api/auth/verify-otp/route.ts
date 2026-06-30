import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createApiResponse } from '@/lib/api-response';
import { z } from 'zod';

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

export async function POST(request: NextRequest) {
  try {
    const body = verifyOtpSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();

    // Find valid OTP
    const { data: otpRecord, error: otpError } = await supabase
      .from('registration_otps')
      .select('*')
      .eq('email', body.email)
      .eq('otp_code', body.otp)
      .eq('is_verified', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) throw otpError;
    if (!otpRecord) {
      return createApiResponse(false, 'Invalid or expired OTP', { status: 400 });
    }

    // Mark OTP as verified
    await supabase
      .from('registration_otps')
      .update({ is_verified: true })
      .eq('id', otpRecord.id);

    // Get guest data from temp storage
    const guestData = otpRecord.temp_guest_data as {
      guestId: string;
      firstName: string;
      lastName: string;
      password: string;
    };

    // Create auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: guestData.password,
      email_confirm: true,
      user_metadata: {
        firstName: guestData.firstName,
        lastName: guestData.lastName,
        guestId: guestData.guestId,
        role: 'GUEST',
      },
    });

    if (authError) {
      if (authError.message?.includes('already been registered')) {
        // User already exists, try to find them
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(
          (u) => u.email?.toLowerCase() === body.email.toLowerCase()
        );
        if (existingUser) {
          // Link existing auth to guest
          await supabase
            .from('guests')
            .update({
              auth_id: existingUser.id,
              account_status: 'ACTIVE',
            })
            .eq('id', guestData.guestId);

          return createApiResponse(true, {
            message: 'Account verified. Please log in.',
            alreadyExists: true,
          });
        }
      }
      throw authError;
    }

    // Link auth user to guest and activate
    const { error: linkError } = await supabase
      .from('guests')
      .update({
        auth_id: authUser.user.id,
        account_status: 'ACTIVE',
      })
      .eq('id', guestData.guestId);

    if (linkError) throw linkError;

    // Create profile entry for consistency
    await supabase.from('profiles').upsert({
      auth_id: authUser.user.id,
      email: body.email,
      full_name: `${guestData.firstName} ${guestData.lastName}`,
      role: 'GUEST',
      is_active: true,
    }, { onConflict: 'auth_id' });

    // Clean up old OTP records
    await supabase
      .from('registration_otps')
      .delete()
      .eq('email', body.email);

    return createApiResponse(true, {
      message: 'Account created successfully. You can now log in.',
      guestId: guestData.guestId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, error.errors[0]?.message || 'Validation error', { status: 400 });
    }
    return createApiResponse(false, 'Failed to verify OTP', { status: 500 });
  }
}

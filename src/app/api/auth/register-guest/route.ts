import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createApiResponse } from '@/lib/api-response';
import { z } from 'zod';
import crypto from 'crypto';

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional().nullable(),
  homeAddress: z.string().optional().nullable(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function POST(request: NextRequest) {
  try {
    const body = registerSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();

    // Check if email already registered
    const { data: existingGuest } = await supabase
      .from('guests')
      .select('id, auth_id, account_status')
      .eq('email', body.email)
      .maybeSingle();

    if (existingGuest?.auth_id) {
      return createApiResponse(false, 'This email is already registered. Please log in.', { status: 409 });
    }

    // Check if email already used by staff
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('auth_id')
      .eq('email', body.email)
      .maybeSingle();

    if (existingProfile) {
      return createApiResponse(false, 'This email is already registered as staff. Use a different email.', { status: 409 });
    }

    // Create or update guest record
    let guestId: string;
    if (existingGuest) {
      guestId = existingGuest.id;
      await supabase
        .from('guests')
        .update({
          first_name: body.firstName,
          last_name: body.lastName,
          phone: body.phone || null,
          home_address: body.homeAddress || null,
          account_status: 'PENDING',
        })
        .eq('id', guestId);
    } else {
      const { data: newGuest, error: createError } = await supabase
        .from('guests')
        .insert({
          first_name: body.firstName,
          last_name: body.lastName,
          email: body.email,
          phone: body.phone || null,
          home_address: body.homeAddress || null,
          account_status: 'PENDING',
        })
        .select('id')
        .single();

      if (createError) throw createError;
      guestId = newGuest.id;
    }

    // Generate and store OTP
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabase
      .from('registration_otps')
      .insert({
        email: body.email,
        otp_code: otpCode,
        temp_guest_data: {
          guestId,
          firstName: body.firstName,
          lastName: body.lastName,
          password: body.password,
        },
        expires_at: expiresAt,
      });

    // Send OTP via email
    try {
      const { sendOtpEmail } = await import('@/lib/mailer');
      await sendOtpEmail(body.email, otpCode, body.firstName);
    } catch {
      // Log email failure but don't block registration
      console.error('Failed to send OTP email to', body.email);
    }

    return createApiResponse(true, {
      message: 'OTP sent to your email',
      email: body.email,
      expiresIn: 600,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, error.errors[0]?.message || 'Validation error', { status: 400 });
    }
    return createApiResponse(false, 'Failed to initiate registration', { status: 500 });
  }
}

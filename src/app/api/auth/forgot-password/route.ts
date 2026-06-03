import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendPasswordResetEmail } from '@/lib/mailer';
import { z } from 'zod';

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = forgotPasswordSchema.parse(body);
    const redirectUrl = new URL('/reset-password', request.url).toString();

    const { data, error: resetError } = await getSupabaseAdmin().auth.admin.generateLink({
      type: 'recovery',
      email: validatedData.email,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (resetError) {
      if (/not found|does not exist|unable to validate/i.test(resetError.message)) {
        return NextResponse.json({ success: true, message: 'If the email exists, a reset link has been sent' });
      }

      console.error('Forgot password reset link failed', resetError.message, resetError);
      throw resetError;
    }

    const resetUrl = data.properties?.action_link;
    if (!resetUrl) {
      throw new Error('Supabase did not return a password recovery link');
    }

    await sendPasswordResetEmail({
      to: validatedData.email,
      resetUrl,
    });

    return NextResponse.json({ success: true, message: 'If the email exists, a reset link has been sent' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }

    console.error('Forgot password route error', error);
    return NextResponse.json({ success: false, error: 'Failed to process request' }, { status: 500 });
  }
}

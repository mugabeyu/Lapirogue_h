import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = forgotPasswordSchema.parse(body);
    const redirectUrl = new URL('/reset-password', request.url).toString();

    const { error: resetError } = await getSupabaseAdmin().auth.resetPasswordForEmail(validatedData.email, {
      redirectTo: redirectUrl,
    });

    if (resetError) {
      console.error('Forgot password reset failed', resetError.message, resetError);
      throw resetError;
    }

    return NextResponse.json({ success: true, message: 'If the email exists, a reset link has been sent' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }

    console.error('Forgot password route error', error);
    return NextResponse.json({ success: false, error: 'Failed to process request' }, { status: 500 });
  }
}
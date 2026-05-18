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

    // Find user by email
    const { data: user, error } = await getSupabaseAdmin()
      .from('users')
      .select('id, email, full_name')
      .eq('email', validatedData.email)
      .single();

    if (error || !user) {
      // Don't reveal if email exists or not for security
      return NextResponse.json({ success: true, message: 'If the email exists, a reset link has been sent' });
    }

    const { error: resetError } = await getSupabaseAdmin().auth.resetPasswordForEmail(validatedData.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://lapirogue-website.vercel.app'}/reset-password`,
    });

    if (resetError) throw resetError;

    return NextResponse.json({ success: true, message: 'If the email exists, a reset link has been sent' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to process request' }, { status: 500 });
  }
}
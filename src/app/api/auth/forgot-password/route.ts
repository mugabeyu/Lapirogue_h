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

    const supabase = getSupabaseAdmin();

   
    const redirectUrl = new URL('/reset-password', request.url).toString();

    let data;
    let resetError;

    try {
      ({ data, error: resetError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: validatedData.email,
        options: {
          redirectTo: redirectUrl,
        },
      }));
    } catch (connectionError) {
      console.error('Forgot password reset link failed', connectionError);
      return NextResponse.json(
        { success: false, error: 'Unable to reach authentication service. Please try again later.' },
        { status: 503 }
      );
    }

    if (resetError) {
      if (/not found|does not exist|unable to validate/i.test(resetError.message)) {
        return NextResponse.json({ success: true, message: 'If the email exists, a reset link has been sent' });
      }

      console.error('Forgot password reset link failed', resetError.message, resetError);
      return NextResponse.json({ success: false, error: 'Unable to send reset link' }, { status: 502 });
    }

    if (!(data as { properties?: { action_link?: string } } | null)?.properties?.action_link) {
      return NextResponse.json({ success: false, error: 'Supabase did not return a password recovery link' }, { status: 502 });
    }

    const resetUrl = (data as { properties: { action_link: string } }).properties.action_link;

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('name')
      .eq('email', validatedData.email)
      .maybeSingle();
    const userName = profileRow?.name ?? validatedData.email.split('@')[0];

    await sendPasswordResetEmail({
      to: validatedData.email,
      name: userName,
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

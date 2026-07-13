import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendSecurityAlertEmail } from '@/lib/mailer';

const bodySchema = z.object({
  email: z.string().email(),
  lockedUntil: z.string(),
});

// Shared endpoint used by BOTH the staff web app and the guest mobile app to
// send the "3 failed login attempts" lockout email, since only this app has
// mailer infrastructure configured. Not staff/session-gated by design: it is
// invoked from the login screen itself, before any session exists.
export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json());
    const admin = getSupabaseAdmin();

    const [{ data: profile }, { data: guest }] = await Promise.all([
      admin.from('profiles').select('full_name').ilike('email', body.email).maybeSingle(),
      admin.from('guests').select('first_name, last_name').ilike('email', body.email).maybeSingle(),
    ]);

    const name = profile?.full_name || (guest ? `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim() : undefined);

    await sendSecurityAlertEmail({ to: body.email, name, lockedUntil: body.lockedUntil });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error' }, { status: 400 });
    }
    console.error('Security alert email failed', error);
    // Never fail the caller's lockout flow just because the email failed to send.
    return NextResponse.json({ success: false, error: 'Failed to send alert email' }, { status: 200 });
  }
}

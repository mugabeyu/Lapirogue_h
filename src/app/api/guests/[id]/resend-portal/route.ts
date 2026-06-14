import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { loadGuestProfile } from '@/lib/guest-profile';
import { sendGuestPortalInvitationEmail } from '@/lib/mailer';

const resendPortalSchema = z.object({
  guestId: z.string().uuid(),
});

async function requireMainReceptionist(request: NextRequest) {
  const authClient = getRouteHandlerSupabaseClient(request);
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return { ok: false as const, status: 401, error: 'Not authenticated' };
  }

  const admin = getSupabaseAdmin();
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role,is_main')
    .eq('auth_id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false as const, status: 403, error: 'Not authorized' };
  }

  if (profile.is_main !== true) {
    return { ok: false as const, status: 403, error: 'Only the main receptionist can send guest room emails' };
  }

  return { ok: true as const };
}

export async function POST(request: NextRequest, context: { params: Promise<unknown> }) {
  const auth = await requireMainReceptionist(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = (await context.params) as { id: string };
    const body = resendPortalSchema.parse({ guestId: id });
    const profile = await loadGuestProfile(body.guestId);

    if (!profile) {
      return NextResponse.json({ success: false, error: 'Guest not found' }, { status: 404 });
    }

    if (!profile.guest.email) {
      return NextResponse.json({ success: false, error: 'Guest email address is missing' }, { status: 400 });
    }

    const stay = profile.currentStay;
    if (!stay?.roomNumber) {
      return NextResponse.json({ success: false, error: 'Guest does not have an assigned room yet' }, { status: 409 });
    }

    const registerUrl = new URL('/register', request.url);
    registerUrl.searchParams.set('guestId', body.guestId);

    await sendGuestPortalInvitationEmail({
      to: profile.guest.email,
      guestName: `${profile.guest.firstName} ${profile.guest.lastName}`.trim(),
      guestId: profile.guest.guestId,
      guestEmail: profile.guest.email,
      roomNumber: stay.roomNumber,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      registerUrl: registerUrl.toString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Guest portal invitation email sent successfully.',
      data: {
        guestId: body.guestId,
        email: profile.guest.email,
        roomNumber: stay.roomNumber,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }

    console.error('Guest portal invitation email error:', error);
    return NextResponse.json({ success: false, error: 'Failed to send guest portal invitation email' }, { status: 500 });
  }
}

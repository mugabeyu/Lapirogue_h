import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuditActor } from '@/lib/audit';
import { createApiResponse } from '@/lib/api-response';
import { sendGuestWelcomeEmailWithCredentials } from '@/lib/mailer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const guestId = (body as { guestId?: string }).guestId;

    if (!guestId || typeof guestId !== 'string') {
      return createApiResponse(false, 'guestId is required', { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    await getAuditActor(request);

    const [{ data: guestRow }, { data: reservationRow }] = await Promise.all([
      supabase.from('guests').select('id,first_name,last_name,email,status,auth_id').eq('id', guestId).maybeSingle(),
      supabase.from('reservations').select('room_id,rooms(room_number)').eq('guest_id', guestId).eq('status', 'CHECKED_IN').maybeSingle(),
    ]);

    if (!guestRow) {
      return createApiResponse(false, 'Guest not found', { status: 404 });
    }

    if (guestRow.auth_id) {
      return createApiResponse(false, 'Guest already has an auth account', { status: 409 });
    }

    const firstName = guestRow.first_name ?? '';
    const lastName = guestRow.last_name ?? '';
    const email = guestRow.email;

    if (!email) {
      return createApiResponse(false, 'Guest email is required for account creation', { status: 400 });
    }

    const roomNumber = (reservationRow as { rooms?: { room_number?: string } } | null)?.rooms?.room_number ?? '';
    const tempPassword = `${firstName}${roomNumber}@lapirogue`.toLowerCase();

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        firstName,
        lastName,
        guestId: guestRow.id,
      },
    });

    if (authError || !authUser || !authUser.user) {
      return createApiResponse(false, authError?.message ?? 'Failed to create auth account', { status: 500 });
    }

    const { error: updateError } = await supabase
      .from('guests')
      .update({
        auth_id: authUser.user.id,
        temporary_password: tempPassword,
        is_temp_password_changed: false,
      })
      .eq('id', guestRow.id);

    if (updateError) {
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return createApiResponse(false, 'Failed to link auth account to guest', { status: 500 });
    }

    if (email) {
      sendGuestWelcomeEmailWithCredentials({
        to: email,
        guestName: `${firstName} ${lastName}`.trim(),
        email,
        temporaryPassword: tempPassword,
        roomNumber,
      }).catch(() => {});
    }

    return createApiResponse(true, {
      guestId: guestRow.id,
      authId: authUser.user.id,
      email,
      temporaryPassword: tempPassword,
    });
  } catch (error) {
    return createApiResponse(false, 'Failed to register guest account');
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuditActor } from '@/lib/audit';
import { createApiResponse } from '@/lib/api-response';
import { z } from 'zod';

const guestRegisterSchema = z.object({
  guestId: z.string().uuid(),
  password: z.string().min(8),
});

export async function GET(request: NextRequest) {
  try {
    const guestId = request.nextUrl.searchParams.get('guestId');

    if (!guestId) {
      return createApiResponse(false, 'guestId is required', { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const [{ data: guestRow }, { data: reservationRow }] = await Promise.all([
      supabase
        .from('guests')
        .select('id,guest_id,first_name,last_name,email,auth_id')
        .eq('id', guestId)
        .maybeSingle(),
      supabase
        .from('reservations')
        .select('check_in,check_out,status,rooms(room_number)')
        .eq('guest_id', guestId)
        .neq('status', 'CANCELLED')
        .order('check_in', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (!guestRow) {
      return createApiResponse(false, 'Guest not found', { status: 404 });
    }

    return createApiResponse(true, {
      id: guestRow.id,
      guestId: guestRow.guest_id,
      fullName: `${guestRow.first_name ?? ''} ${guestRow.last_name ?? ''}`.trim(),
      email: guestRow.email ?? '',
      alreadyRegistered: Boolean(guestRow.auth_id),
      roomNumber:
        (reservationRow as { rooms?: { room_number?: string | null } } | null)?.rooms
          ?.room_number ?? null,
      checkIn: (reservationRow as { check_in?: string | null } | null)?.check_in ?? null,
      checkOut: (reservationRow as { check_out?: string | null } | null)?.check_out ?? null,
    });
  } catch {
    return createApiResponse(false, 'Failed to load guest invitation', {
      status: 500,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = guestRegisterSchema.parse(await request.json());
    const guestId = body.guestId;

    const supabase = getSupabaseAdmin();
    await getAuditActor(request);

    const [{ data: guestRow }, { data: reservationRow }] = await Promise.all([
      supabase.from('guests').select('id,guest_id,first_name,last_name,email,status,auth_id').eq('id', guestId).maybeSingle(),
      supabase.from('reservations').select('room_id,check_in,check_out,rooms(room_number)').eq('guest_id', guestId).eq('status', 'CHECKED_IN').maybeSingle(),
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

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        firstName,
        lastName,
        guestId: guestRow.id,
        guestCode: guestRow.guest_id,
      },
    });

    if (authError || !authUser || !authUser.user) {
      return createApiResponse(false, authError?.message ?? 'Failed to create auth account', { status: 500 });
    }

    const { error: updateError } = await supabase
      .from('guests')
      .update({
        auth_id: authUser.user.id,
        temporary_password: null,
        is_temp_password_changed: true,
      })
      .eq('id', guestRow.id);

    if (updateError) {
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return createApiResponse(false, 'Failed to link auth account to guest', { status: 500 });
    }

    return createApiResponse(true, {
      guestId: guestRow.id,
      guestCode: guestRow.guest_id,
      authId: authUser.user.id,
      email,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, 'Validation error', { status: 400 });
    }
    return createApiResponse(false, 'Failed to register guest account');
  }
}

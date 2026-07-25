import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuditActor, recordAuditLog } from '@/lib/audit';
import { createApiResponse } from '@/lib/api-response';
import { notifyGuest } from '@/lib/guest-notifications';
import { z } from 'zod';

const statusSchema = z.object({
  accountStatus: z.enum(['ACTIVE', 'FROZEN', 'BANNED'], {
    errorMap: () => ({ message: 'Status must be one of: ACTIVE, FROZEN, BANNED' }),
  }),
});

export async function PUT(request: NextRequest, context: { params: Promise<unknown> }) {
  try {
    const { id } = (await context.params) as { id: string };
    const body = statusSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();
    const actor = await getAuditActor(request);

    const { data: existing } = await supabase
      .from('guests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      return createApiResponse(false, 'Guest not found', { status: 404 });
    }

    // If banning, auto-cancel all active reservations
    if (body.accountStatus === 'BANNED') {
      const { data: activeReservations } = await supabase
        .from('reservations')
        .select('id')
        .eq('guest_id', id)
        .in('status', ['RESERVED', 'CONFIRMED']);

      if (activeReservations && activeReservations.length > 0) {
        const reservationIds = activeReservations.map((r: { id: string }) => r.id);
        await supabase
          .from('reservations')
          .update({ status: 'CANCELLED' })
          .in('id', reservationIds);
      }
    }

    const { data, error } = await supabase
      .from('guests')
      .update({
        account_status: body.accountStatus,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    await recordAuditLog({
      tableName: 'guests',
      recordId: id,
      action: 'UPDATE',
      actorId: actor?.id ?? null,
      before: existing as Record<string, unknown>,
      after: data as Record<string, unknown>,
    });

    if (existing.account_status !== body.accountStatus) {
      const guestMessage = {
        ACTIVE: 'Your account has been reactivated. You can book and use hotel services again.',
        FROZEN: 'Your account has been put on hold. Please contact reception to resume bookings.',
        BANNED: 'Your account has been closed and any upcoming bookings were cancelled. Please contact reception.',
      }[body.accountStatus];

      await notifyGuest({
        guestId: id,
        title: 'Account status updated',
        message: guestMessage,
        category: 'Account',
      });
    }

    return createApiResponse(true, {
      id: data.id,
      accountStatus: data.account_status,
      message: body.accountStatus === 'BANNED'
        ? 'Guest has been banned. All active reservations have been cancelled.'
        : body.accountStatus === 'FROZEN'
          ? 'Guest account has been frozen.'
          : 'Guest account has been reactivated.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, error.errors[0]?.message || 'Validation error', { status: 400 });
    }
    return createApiResponse(false, 'Failed to update guest status', { status: 500 });
  }
}

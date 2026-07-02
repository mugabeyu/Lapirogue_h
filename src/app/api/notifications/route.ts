import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuditActor, recordAuditLog } from '@/lib/audit';
import { z } from 'zod';

const notificationSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  message: z.string().min(1),
  category: z.string().optional(),
});

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({
      success: true,
      data: (data ?? []).map((notification) => ({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        category: notification.category,
        status: notification.is_read ? 'READ' : 'UNREAD',
        createdAt: notification.created_at,
      })),
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = notificationSchema.parse(await request.json());
    const { data, error } = await getSupabaseAdmin()
      .from('notifications')
      .insert({
        title: body.title,
        message: body.message,
        category: body.category ?? 'General',
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to create notification' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    const all = searchParams.get('all') === 'true';

    if (all) {
      const { error } = await getSupabaseAdmin()
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false);
      if (error) throw error;
    } else if (id) {
      const { error } = await getSupabaseAdmin()
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update notifications' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const actor = await getAuditActor(request);
    const actorId = actor?.id ?? null;
    const { data: notification } = await supabase.from('notifications').select('*').eq('id', id).maybeSingle();

    if (notification) {
      await recordAuditLog({
        tableName: 'notifications',
        recordId: id,
        action: 'DELETE',
        actorId,
        before: notification as Record<string, unknown>,
      });
    }

    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Notification deleted' });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete notification' }, { status: 500 });
  }
}

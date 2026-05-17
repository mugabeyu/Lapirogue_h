import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import { verifyToken } from '@/services/auth';

type MessageRow = {
  id: string;
  guest_id?: string | null;
  message_type?: string | null;
  subject?: string | null;
  content?: string | null;
  is_read?: boolean | null;
  attachment_url?: string | null;
  created_at?: string | null;
  guests?: { first_name?: string | null; last_name?: string | null } | null;
};

const messageSchema = z.object({
  guestId: z.string().uuid(),
  messageType: z.enum(['guest', 'admin']).default('admin'),
  subject: z.string().optional().nullable(),
  content: z.string().min(1),
  attachmentUrl: z.string().optional().nullable(),
});

function requireAuth(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: NextRequest) {
  const decoded = requireAuth(request);
  if (!decoded) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const guestId = request.nextUrl.searchParams.get('guestId');
    let query = getSupabaseAdmin()
      .from('messages')
      .select('id, guest_id, message_type, subject, content, is_read, attachment_url, created_at, guests(first_name,last_name)')
      .order('created_at', { ascending: false });

    if (guestId) {
      query = query.eq('guest_id', guestId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: ((data ?? []) as MessageRow[]).map((message) => ({
        id: message.id,
        guestId: message.guest_id ?? null,
        guestName: message.guests ? `${message.guests.first_name ?? ''} ${message.guests.last_name ?? ''}`.trim() : null,
        messageType: message.message_type ?? null,
        subject: message.subject ?? null,
        content: message.content ?? null,
        attachmentUrl: message.attachment_url ?? null,
        isRead: !!message.is_read,
        createdAt: message.created_at ?? null,
      })),
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const decoded = requireAuth(request);
  if (!decoded) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = messageSchema.parse(await request.json());
    const { data, error } = await getSupabaseAdmin()
      .from('messages')
      .insert({
        guest_id: body.guestId,
        message_type: body.messageType,
        subject: body.subject ?? null,
        content: body.content,
        attachment_url: body.attachmentUrl ?? null,
        is_read: false,
      })
      .select('id, guest_id, message_type, subject, content, is_read, attachment_url, created_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to create message' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const decoded = requireAuth(request);
  if (!decoded) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    const all = searchParams.get('all') === 'true';

    if (all) {
      const { error } = await getSupabaseAdmin().from('messages').update({ is_read: true }).eq('is_read', false);
      if (error) throw error;
    } else if (id) {
      const { error } = await getSupabaseAdmin().from('messages').update({ is_read: true }).eq('id', id);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update messages' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const decoded = requireAuth(request);
  if (!decoded) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin().from('messages').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Message deleted' });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete message' }, { status: 500 });
  }
}
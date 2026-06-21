import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import { getAuditActor, recordAuditLog } from '@/lib/audit';
import { attachSupabaseCookies, getRouteHandlerSupabaseSession } from '@/lib/supabase-server';
import { validationErrorResponse } from '@/lib/api-response';

type MessageRow = {
  id: string;
  guest_id?: string | null;
  sender_type?: string | null;
  content?: string | null;
  is_read?: boolean | null;
  created_at?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
};

const messageSchema = z.object({
  guestId: z.string().uuid(),
  senderType: z.enum(['guest', 'staff', 'admin', 'receptionist']).default('admin'),
  content: z.string().min(1),
  fileUrl: z.string().url().optional().nullable(),
  fileName: z.string().optional().nullable(),
  fileType: z.string().optional().nullable(),
  fileSize: z.number().int().optional().nullable(),
});

async function loadGuestNames(guestIds: string[]) {
  if (!guestIds.length) return new Map<string, { name: string | null; imagePath: string | null }>();

  const { data, error } = await getSupabaseAdmin()
    .from('guests')
    .select('id, first_name, last_name, image_path')
    .in('id', guestIds);

  if (error) throw error;

  return new Map(
    (data ?? []).map((guest) => [
      guest.id,
      {
        name: `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim() || null,
        imagePath: guest.image_path ?? null,
      },
    ]),
  );
}

async function mapMessages(messages: MessageRow[]) {
  const guestIds = [...new Set(messages.map((message) => message.guest_id).filter((id): id is string => Boolean(id)))];
  const guestNames = await loadGuestNames(guestIds);

  return messages.map((message) => {
    const guest = message.guest_id ? guestNames.get(message.guest_id) : null;
    return {
      id: message.id,
      guestId: message.guest_id ?? null,
      guestName: guest?.name ?? null,
      guestImagePath: guest?.imagePath ?? null,
      senderType: message.sender_type ?? null,
      content: message.content ?? null,
      isRead: !!message.is_read,
      createdAt: message.created_at ?? null,
      fileUrl: message.file_url ?? null,
      fileName: message.file_name ?? null,
      fileType: message.file_type ?? null,
      fileSize: message.file_size ?? null,
    };
  });
}

export async function GET(request: NextRequest) {
  const { user, error: userError, response } = await getRouteHandlerSupabaseSession(request);
  if (!user || userError) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), response);
  }

  try {
    const guestId = request.nextUrl.searchParams.get('guestId');
    let query = getSupabaseAdmin()
      .from('messages')
      .select('id, guest_id, sender_type, content, is_read, created_at, file_url, file_name, file_type, file_size')
      .order('created_at', { ascending: false });

    if (guestId) {
      query = query.eq('guest_id', guestId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return attachSupabaseCookies(
      NextResponse.json({
        success: true,
        data: await mapMessages((data ?? []) as MessageRow[]),
      }),
      response,
    );
  } catch (error) {
    return attachSupabaseCookies(
      NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch messages' }, { status: 500 }),
      response,
    );
  }
}

export async function POST(request: NextRequest) {
  const { user, error: userError, response } = await getRouteHandlerSupabaseSession(request);
  if (!user || userError) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), response);
  }

  try {
    const body = messageSchema.parse(await request.json());
    const { data, error } = await getSupabaseAdmin()
      .from('messages')
      .insert({
        guest_id: body.guestId,
        sender_type: body.senderType,
        content: body.content.trim(),
        is_read: body.senderType !== 'guest',
        file_url: body.fileUrl ?? null,
        file_name: body.fileName ?? null,
        file_type: body.fileType ?? null,
        file_size: body.fileSize ?? null,
      })
      .select('id, guest_id, sender_type, content, is_read, created_at, file_url, file_name, file_type, file_size')
      .single();

    if (error) throw error;
    const mapped = await mapMessages((data ? [data] : []) as MessageRow[]);
    return attachSupabaseCookies(NextResponse.json({ success: true, data: mapped[0] ?? null }, { status: 201 }), response);
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return attachSupabaseCookies(validationResponse, response);
    return attachSupabaseCookies(
      NextResponse.json(
        {
          success: false,
          error: 'Failed to create message',
          details: process.env.NODE_ENV === 'production' ? undefined : error instanceof Error ? error.message : JSON.stringify(error),
        },
        { status: 500 },
      ),
      response,
    );
  }
}

export async function PATCH(request: NextRequest) {
  const { user, error: userError, response } = await getRouteHandlerSupabaseSession(request);
  if (!user || userError) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), response);
  }

  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    const guestId = searchParams.get('guestId');
    const all = searchParams.get('all') === 'true';

    if (all) {
      const { error } = await getSupabaseAdmin()
        .from('messages')
        .update({ is_read: true })
        .eq('is_read', false)
        .eq('sender_type', 'guest');
      if (error) throw error;
    } else if (guestId) {
      const { error } = await getSupabaseAdmin()
        .from('messages')
        .update({ is_read: true })
        .eq('guest_id', guestId)
        .eq('is_read', false)
        .eq('sender_type', 'guest');
      if (error) throw error;
    } else if (id) {
      const { error } = await getSupabaseAdmin().from('messages').update({ is_read: true }).eq('id', id);
      if (error) throw error;
    }

    return attachSupabaseCookies(NextResponse.json({ success: true }), response);
  } catch (error) {
    return attachSupabaseCookies(
      NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to update messages' }, { status: 500 }),
      response,
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error: userError, response } = await getRouteHandlerSupabaseSession(request);
  if (!user || userError) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), response);
  }

  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    if (!id) {
      return attachSupabaseCookies(NextResponse.json({ success: false, error: 'ID required' }, { status: 400 }), response);
    }
    const supabase = getSupabaseAdmin();
    const actor = await getAuditActor(request);
    const { data: message } = await supabase.from('messages').select('*').eq('id', id).maybeSingle();

    if (message) {
      await recordAuditLog({
        tableName: 'messages',
        recordId: id,
        action: 'DELETE',
        actorId: actor?.id ?? null,
        before: message as Record<string, unknown>,
      });
    }

    const { error } = await supabase.from('messages').delete().eq('id', id);
    if (error) throw error;
    return attachSupabaseCookies(NextResponse.json({ success: true, message: 'Message deleted' }), response);
  } catch (error) {
    return attachSupabaseCookies(
      NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to delete message' }, { status: 500 }),
      response,
    );
  }
}

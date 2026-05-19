import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';

const ALLOWED_BUCKETS = [
  'room-images',
  'activity-images',
  'menu-images',
  'staff-avatars',
  'content-images',
  'chat_uploads',
  'guest-documents',
] as const;

type AllowedBucket = (typeof ALLOWED_BUCKETS)[number];

export async function POST(request: NextRequest) {
  try {
    const authClient = getRouteHandlerSupabaseClient(request);
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const bucket = formData.get('bucket') as string;
    const id = formData.get('id') as string;
    const target = (formData.get('target') as string | null) ?? bucket;

    if (!file || !bucket || !id) {
      return NextResponse.json({ success: false, error: 'Missing file, bucket, or id' }, { status: 400 });
    }

    if (!ALLOWED_BUCKETS.includes(bucket as AllowedBucket)) {
      return NextResponse.json({ success: false, error: 'Invalid storage bucket' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const fileName = `${id}/${Date.now()}-${safeName}`;

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.storage.from(bucket).upload(fileName, buffer, {
      contentType: file.type,
      upsert: true,
    });

    if (error) throw error;

    const { data: publicUrl } = admin.storage.from(bucket).getPublicUrl(fileName);
    const url = publicUrl.publicUrl;

    if (target === 'profile' || (bucket === 'staff-avatars' && target === 'staff-avatars')) {
      await admin.from('profiles').update({ avatar_url: url }).eq('auth_id', id);
    } else if (bucket === 'room-images') {
      await admin.from('rooms').update({ image_path: url }).eq('id', id);
    } else if (bucket === 'activity-images') {
      await admin.from('activities').update({ image_path: url }).eq('id', id);
    } else if (bucket === 'menu-images') {
      await admin.from('menu_items').update({ image_path: url }).eq('id', id);
    } else if (bucket === 'staff-avatars') {
      await admin.from('staff').update({ image_path: url }).eq('id', id);
    } else if (bucket === 'content-images') {
      await admin.from('site_content_pages').update({ image_path: url }).eq('slug', id);
    } else if (bucket === 'chat_uploads') {
      await admin.from('messages').update({ attachment_url: url }).eq('id', id);
    } else if (bucket === 'guest-documents') {
      await admin.from('guests').update({ image_path: url }).eq('id', id);
    }

    return NextResponse.json({
      success: true,
      data: {
        path: data.path,
        publicUrl: url,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ success: false, error: 'Failed to upload file' }, { status: 500 });
  }
}

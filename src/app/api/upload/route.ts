import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const bucket = formData.get('bucket') as string;
    const id = formData.get('id') as string;

    if (!file || !bucket || !id) {
      return NextResponse.json(
        { success: false, error: 'Missing file, bucket, or id' },
        { status: 400 }
      );
    }

    const allowedBuckets = ['room-images', 'activity-images', 'menu-images', 'staff-avatars', 'content-images', 'chat_uploads'];
    if (!allowedBuckets.includes(bucket)) {
      return NextResponse.json(
        { success: false, error: 'Invalid bucket. Admin can only upload images for rooms, activities, menu items, and staff.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = `${id}/${file.name}`;

    const { data, error } = await getSupabaseAdmin().storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (error) throw error;

    const { data: publicUrl } = getSupabaseAdmin().storage
      .from(bucket)
      .getPublicUrl(fileName);

    if (bucket === 'room-images') {
      await getSupabaseAdmin()
        .from('rooms')
        .update({ image_path: publicUrl.publicUrl })
        .eq('id', id)
        .select()
        .single();
    } else if (bucket === 'activity-images') {
      await getSupabaseAdmin()
        .from('activities')
        .update({ image_path: publicUrl.publicUrl })
        .eq('id', id)
        .select()
        .single();
    } else if (bucket === 'menu-images') {
      await getSupabaseAdmin()
        .from('menu_items')
        .update({ image_path: publicUrl.publicUrl })
        .eq('id', id)
        .select()
        .single();
    } else if (bucket === 'staff-avatars') {
      await getSupabaseAdmin()
        .from('staff')
        .update({ image_path: publicUrl.publicUrl })
        .eq('id', id)
        .select()
        .single();
    } else if (bucket === 'content-images') {
      await getSupabaseAdmin()
        .from('site_content_pages')
        .update({ image_path: publicUrl.publicUrl })
        .eq('slug', id)
        .select()
        .single();
    } else if (bucket === 'chat_uploads') {
      await getSupabaseAdmin()
        .from('messages')
        .update({ attachment_url: publicUrl.publicUrl })
        .eq('id', id)
        .select()
        .single();
    }

    return NextResponse.json({
      success: true,
      data: {
        path: data.path,
        publicUrl: publicUrl.publicUrl,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
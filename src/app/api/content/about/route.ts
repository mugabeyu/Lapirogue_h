import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import { validationErrorResponse } from '@/lib/api-response';

const contentSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  body: z.string().min(1),
  highlights: z.array(z.string()).default([]),
  metrics: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).default([]),
  imagePath: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const { data, error } = await supabase.from('site_content_pages').select('*').eq('slug', 'about').maybeSingle();
  if (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch about content' }, { status: 500 });
  }
  return NextResponse.json({ success: true, data });
}

export async function PUT(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = contentSchema.parse(await request.json());
    const { data, error } = await supabase
      .from('site_content_pages')
      .upsert({
        slug: 'about',
        title: body.title,
        subtitle: body.subtitle,
        body: body.body,
        highlights: body.highlights,
        metrics: body.metrics,
        image_path: body.imagePath ?? null,
        updated_by: user.id,
        is_active: true,
      }, { onConflict: 'slug' })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    return NextResponse.json({ success: false, error: 'Failed to update about content' }, { status: 500 });
  }
}
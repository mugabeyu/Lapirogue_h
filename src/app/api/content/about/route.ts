import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';

const contentSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  body: z.string().min(1),
  highlights: z.array(z.string()).default([]),
  metrics: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).default([]),
  imagePath: z.string().optional().nullable(),
});

async function requireAuth(request: NextRequest) {
  const authClient = getRouteHandlerSupabaseClient(request);
  const { data: { user } } = await authClient.auth.getUser();
  return user ?? null;
}

export async function GET(request: NextRequest) {
  const decoded = await requireAuth(request);
  if (!decoded) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('site_content_pages')
    .select('*')
    .eq('slug', 'about')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch about content' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

export async function PUT(request: NextRequest) {
  const decoded = await requireAuth(request);
  if (!decoded) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = contentSchema.parse(await request.json());

    const { data, error } = await getSupabaseAdmin()
      .from('site_content_pages')
      .upsert({
        slug: 'about',
        title: body.title,
        subtitle: body.subtitle,
        body: body.body,
        highlights: body.highlights,
        metrics: body.metrics,
        image_path: body.imagePath ?? null,
        updated_by: decoded.id,
        is_active: true,
      }, { onConflict: 'slug' })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ success: false, error: 'Failed to update about content' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { z } from 'zod';
import { handleError, validationErrorResponse } from '@/lib/api-response';

const contentSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  body: z.string().min(1),
  highlights: z.array(z.string()).default([]),
  metrics: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).default([]),
  imagePath: z.string().optional().nullable(),
});

type SiteContentRow = {
  id?: string;
  slug: string;
  title: string | null;
  subtitle?: string | null;
  body?: string | null;
  highlights?: unknown;
  metrics?: unknown;
  image_path?: string | null;
  updated_by?: string | null;
  is_active?: boolean | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

function parseStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function parseMetricArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is { label?: unknown; value?: unknown } => typeof item === 'object' && item !== null)
        .map((item) => ({
          label: typeof item.label === 'string' ? item.label : '',
          value: typeof item.value === 'string' ? item.value : '',
        }))
        .filter((item) => item.label && item.value)
    : [];
}

function normalizeContentRow(row: SiteContentRow | null) {
  if (!row) return null;

  const metadata = row.metadata ?? {};
  const metadataSubtitle = typeof metadata.subtitle === 'string' ? metadata.subtitle : '';
  const metadataImagePath =
    typeof metadata.image_path === 'string'
      ? metadata.image_path
      : typeof metadata.imagePath === 'string'
        ? metadata.imagePath
        : null;
  const metadataIsActive = typeof metadata.is_active === 'boolean'
    ? metadata.is_active
    : typeof metadata.isActive === 'boolean'
      ? metadata.isActive
      : true;

  return {
    ...row,
    title: row.title ?? '',
    subtitle: row.subtitle ?? metadataSubtitle,
    body: row.body ?? '',
    highlights: parseStringArray(row.highlights ?? metadata.highlights),
    metrics: parseMetricArray(row.metrics ?? metadata.metrics),
    image_path: row.image_path ?? metadataImagePath,
    is_active: row.is_active ?? metadataIsActive,
  };
}

function isMissingColumnError(error: { code?: string; message?: string; details?: string } | null) {
  if (!error) return false;
  const joined = [error.code, error.message, error.details].filter(Boolean).join(' ').toLowerCase();
  return joined.includes('column') && joined.includes('site_content_pages');
}

export async function GET(request: NextRequest) {
  try {
    const authClient = getRouteHandlerSupabaseClient(request);
    const adminClient = getSupabaseAdmin();
    const { data: { user }, error: userError } = await authClient.auth.getUser();

    if (!user || userError) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const { data, error } = await adminClient.from('site_content_pages').select('*').eq('slug', 'about').maybeSingle();
    if (error) throw error;

    return NextResponse.json({ success: true, data: normalizeContentRow((data ?? null) as SiteContentRow | null) });
  } catch (error) {
    return handleError(error, 'Failed to fetch about content');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authClient = getRouteHandlerSupabaseClient(request);
    const adminClient = getSupabaseAdmin();
    const { data: { user }, error: userError } = await authClient.auth.getUser();

    if (!user || userError) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = contentSchema.parse(await request.json());
    const metadata = {
      subtitle: body.subtitle,
      highlights: body.highlights,
      metrics: body.metrics,
      image_path: body.imagePath ?? null,
      updated_by: user.id,
      is_active: true,
    };

    const modernPayload = {
      slug: 'about',
      title: body.title,
      subtitle: body.subtitle,
      body: body.body,
      highlights: body.highlights,
      metrics: body.metrics,
      image_path: body.imagePath ?? null,
      updated_by: user.id,
      is_active: true,
      metadata,
    };

    let data: SiteContentRow | null = null;
    let error: { code?: string; message?: string; details?: string } | null = null;

    const modernResult = await adminClient
      .from('site_content_pages')
      .upsert(modernPayload, { onConflict: 'slug' })
      .select('*')
      .single();

    data = modernResult.data as SiteContentRow | null;
    error = modernResult.error;

    if (error && isMissingColumnError(error)) {
      const legacyResult = await adminClient
        .from('site_content_pages')
        .upsert(
          {
            slug: 'about',
            title: body.title,
            body: body.body,
            metadata,
          },
          { onConflict: 'slug' },
        )
        .select('*')
        .single();

      data = legacyResult.data as SiteContentRow | null;
      error = legacyResult.error;
    }

    if (error) throw error;

    return NextResponse.json({ success: true, data: normalizeContentRow(data) });
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    return handleError(error, 'Failed to update about content');
  }
}

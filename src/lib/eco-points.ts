import { getSupabaseAdmin } from '@/lib/supabase';

export type EcoAwardSourceType = 'ACTIVITY_BOOKING' | 'SERVICE_REQUEST' | 'MANUAL';

export type EcoAwardInput = {
  sourceType: EcoAwardSourceType;
  sourceRecordId: string;
  guestId: string;
  activityName?: string | null;
  activityCategory?: string | null;
  label?: string | null;
  points?: number | null;
  carbonOffsetKg?: number | null;
  metadata?: Record<string, unknown>;
};

type SustainabilityActivityRow = {
  id: string;
  name: string;
  category?: string | null;
  default_points: number;
  carbon_offset_kg: number | string;
  is_active?: boolean | null;
};

function normalize(value?: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

export async function findEcoActivity(activityName?: string | null, activityCategory?: string | null) {
  const admin = getSupabaseAdmin();
  const candidates = [normalize(activityName), normalize(activityCategory)].filter(Boolean);

  if (candidates.length === 0) return null;

  const { data, error } = await admin
    .from('sustainability_activities')
    .select('id, name, category, default_points, carbon_offset_kg, is_active')
    .eq('is_active', true)
    .or(
      candidates
        .map((candidate) => `name.ilike.${candidate},category.ilike.${candidate}`)
        .join(','),
    )
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as SustainabilityActivityRow | null) ?? null;
}

export async function awardEcoPoints(input: EcoAwardInput) {
  const admin = getSupabaseAdmin();
  const ecoActivity = await findEcoActivity(input.activityName, input.activityCategory);
  if (!ecoActivity) {
    return { awarded: false as const, reason: 'No matching eco activity' };
  }

  const points = Number(input.points ?? ecoActivity.default_points);
  if (!Number.isFinite(points) || points <= 0) {
    return { awarded: false as const, reason: 'No points configured' };
  }

  const carbonOffsetKg = Number(input.carbonOffsetKg ?? ecoActivity.carbon_offset_kg ?? 0);
  const payload = {
    guest_id: input.guestId,
    activity_id: ecoActivity.id,
    source_type: input.sourceType,
    source_record_id: input.sourceRecordId,
    source_label: input.label ?? ecoActivity.name,
    points,
    carbon_offset_kg: Number.isFinite(carbonOffsetKg) ? carbonOffsetKg : 0,
    metadata: input.metadata ?? {},
    earned_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from('guest_eco_point_events')
    .upsert(payload, { onConflict: 'source_type,source_record_id' });

  if (error) throw error;
  return { awarded: true as const, points };
}

export async function removeEcoPointsBySource(sourceType: EcoAwardSourceType, sourceRecordId: string) {
  const { error } = await getSupabaseAdmin()
    .from('guest_eco_point_events')
    .delete()
    .eq('source_type', sourceType)
    .eq('source_record_id', sourceRecordId);

  if (error) throw error;
}

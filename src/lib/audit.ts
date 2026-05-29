import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createRouteHandlerSupabaseContext } from '@/lib/supabase-server';

export type AuditActor = {
  id: string;
  email: string | null;
  name: string | null;
  role: 'MAIN_RECEPTIONIST' | 'RECEPTIONIST' | null;
};

export async function getAuditActor(request: NextRequest): Promise<AuditActor | null> {
  const { supabase } = createRouteHandlerSupabaseContext(request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await getSupabaseAdmin()
    .from('profiles')
    .select('full_name, is_main')
    .eq('auth_id', user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    name: profile?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? null,
    role: profile?.is_main ? 'MAIN_RECEPTIONIST' : 'RECEPTIONIST',
  };
}

export function withCreatedBy<T extends Record<string, unknown>>(values: T, actorId: string | null) {
  return {
    ...values,
    created_by: actorId,
    updated_by: actorId,
  };
}

export function withUpdatedBy<T extends Record<string, unknown>>(values: T, actorId: string | null) {
  return {
    ...values,
    updated_by: actorId,
  };
}

export function withDeletedBy<T extends Record<string, unknown>>(values: T, actorId: string | null) {
  return {
    ...values,
    deleted_by: actorId,
    deleted_at: new Date().toISOString(),
  };
}

export function withBlockedBy<T extends Record<string, unknown>>(values: T, actorId: string | null) {
  return {
    ...values,
    blocked_by: actorId,
    blocked_at: new Date().toISOString(),
  };
}

export async function recordAuditLog(entry: {
  tableName: string;
  recordId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'BLOCK' | 'UNBLOCK';
  actorId: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('audit_logs').insert({
    table_name: entry.tableName,
    record_id: entry.recordId,
    action: entry.action,
    actor_id: entry.actorId,
    previous_data: entry.before ?? null,
    new_data: entry.after ?? null,
  });

  if (error) {
    console.warn('Audit log skipped', error);
  }
}

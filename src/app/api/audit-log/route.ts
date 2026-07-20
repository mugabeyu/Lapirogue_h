import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

type AuditRow = {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  actor_id: string | null;
  previous_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

type ActorRow = { auth_id: string; full_name: string | null; email: string | null; role: string | null };

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? '15')));
    const tableFilter = searchParams.get('table') || undefined;
    const actionFilter = searchParams.get('action') || undefined;

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (tableFilter) query = query.eq('table_name', tableFilter);
    if (actionFilter) query = query.eq('action', actionFilter);

    const from = (page - 1) * limit;
    const { data, error, count } = await query.range(from, from + limit - 1);
    if (error) throw error;

    const rows = (data ?? []) as AuditRow[];
    const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean))) as string[];

    let actors: Record<string, ActorRow> = {};
    if (actorIds.length > 0) {
      const { data: actorRows } = await supabase
        .from('profiles')
        .select('auth_id, full_name, email, role')
        .in('auth_id', actorIds);
      actors = Object.fromEntries((actorRows ?? []).map((a) => [a.auth_id, a as ActorRow]));
    }

    const entries = rows.map((r) => ({
      id: r.id,
      tableName: r.table_name,
      recordId: r.record_id,
      action: r.action,
      actor: r.actor_id
        ? {
            id: r.actor_id,
            name: actors[r.actor_id]?.full_name ?? null,
            email: actors[r.actor_id]?.email ?? null,
            role: actors[r.actor_id]?.role ?? null,
          }
        : null,
      previousData: r.previous_data,
      newData: r.new_data,
      createdAt: r.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: {
        entries,
        pagination: { page, limit, total: count ?? 0, totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)) },
      },
    });
  } catch (error) {
    console.error('Audit log fetch error', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch audit log' }, { status: 500 });
  }
}

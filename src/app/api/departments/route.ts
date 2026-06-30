import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuditActor, recordAuditLog } from '@/lib/audit';
import { createApiResponse } from '@/lib/api-response';
import { z } from 'zod';

const departmentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Department name is required'),
  description: z.string().optional().nullable(),
});

type DepartmentRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function toDepartment(row: DepartmentRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return createApiResponse(true, (data ?? []).map(toDepartment));
  } catch {
    return createApiResponse(false, 'Failed to fetch departments');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = departmentSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();
    const actor = await getAuditActor(request);

    const { data, error } = await supabase
      .from('departments')
      .insert({
        name: body.name,
        description: body.description || null,
        created_by: actor?.id || null,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return createApiResponse(false, 'A department with this name already exists', { status: 409 });
      }
      throw error;
    }

    await recordAuditLog({
      tableName: 'departments',
      recordId: data.id,
      action: 'INSERT',
      actorId: actor?.id ?? null,
      after: data as Record<string, unknown>,
    });

    return createApiResponse(true, toDepartment(data as DepartmentRow));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, 'Validation error', { status: 400 });
    }
    return createApiResponse(false, 'Failed to create department', { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = departmentSchema.parse(await request.json());
    if (!body.id) {
      return createApiResponse(false, 'Department ID is required', { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const actor = await getAuditActor(request);

    const { data: existing } = await supabase
      .from('departments')
      .select('*')
      .eq('id', body.id)
      .single();

    const { data, error } = await supabase
      .from('departments')
      .update({
        name: body.name,
        description: body.description || null,
      })
      .eq('id', body.id)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return createApiResponse(false, 'A department with this name already exists', { status: 409 });
      }
      throw error;
    }

    await recordAuditLog({
      tableName: 'departments',
      recordId: body.id,
      action: 'UPDATE',
      actorId: actor?.id ?? null,
      before: existing as Record<string, unknown>,
      after: data as Record<string, unknown>,
    });

    return createApiResponse(true, toDepartment(data as DepartmentRow));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, 'Validation error', { status: 400 });
    }
    return createApiResponse(false, 'Failed to update department', { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return createApiResponse(false, 'Department ID is required', { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const actor = await getAuditActor(request);

    const { data: existing } = await supabase
      .from('departments')
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return createApiResponse(false, 'Department not found', { status: 404 });
    }

    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === '23503') {
        return createApiResponse(false, 'Cannot delete department: it has managers or receptionists assigned', { status: 409 });
      }
      throw error;
    }

    await recordAuditLog({
      tableName: 'departments',
      recordId: id,
      action: 'DELETE',
      actorId: actor?.id ?? null,
      before: existing as Record<string, unknown>,
    });

    return createApiResponse(true, { message: 'Department deleted' });
  } catch {
    return createApiResponse(false, 'Failed to delete department', { status: 500 });
  }
}

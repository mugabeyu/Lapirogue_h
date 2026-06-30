import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuditActor, recordAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { createApiResponse } from '@/lib/api-response';
import { SignJWT } from 'jose';

const receptionistSchema = z.object({
  id: z.string().uuid().optional(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional().nullable(),
  homeAddress: z.string().optional().nullable(),
  departmentId: z.string().uuid('Valid department is required'),
  managerId: z.string().uuid('Reporting manager is required'),
  isActive: z.boolean().optional(),
});

const invitationSecret = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.ONBOARDING_SECRET || 'staff-invite-secret'
);

async function generateInvitationToken(receptionistId: string): Promise<string> {
  return new SignJWT({ staffId: receptionistId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('48h')
    .sign(invitationSecret);
}

type ReceptionistRow = {
  id: string;
  employee_code: string;
  auth_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  home_address: string | null;
  department_id: string;
  manager_id: string;
  date_of_joining: string;
  is_active: boolean;
  image_path: string | null;
  created_at: string;
  updated_at: string;
  departments?: { name: string | null } | null;
};

function toReceptionist(row: ReceptionistRow) {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    authId: row.auth_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    homeAddress: row.home_address,
    departmentId: row.department_id,
    departmentName: row.departments?.name ?? null,
    managerId: row.manager_id,
    dateOfJoining: row.date_of_joining,
    isActive: row.is_active,
    imagePath: row.image_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findAuthUserByEmail(supabase: ReturnType<typeof getSupabaseAdmin>, email: string) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return (data.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('receptionists')
      .select('*, departments(name)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return createApiResponse(true, (data ?? []).map(toReceptionist));
  } catch {
    return createApiResponse(false, 'Failed to fetch receptionists');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = receptionistSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();
    const actor = await getAuditActor(request);

    const existingUser = await findAuthUserByEmail(supabase, body.email);

    const { data, error } = await supabase
      .from('receptionists')
      .insert({
        first_name: body.firstName,
        last_name: body.lastName,
        email: body.email,
        phone: body.phone || null,
        home_address: body.homeAddress || null,
        department_id: body.departmentId,
        manager_id: body.managerId,
        created_by: actor?.id || null,
      })
      .select('*, departments(name)')
      .single();

    if (error) {
      if (error.code === '23505') {
        return createApiResponse(false, 'A receptionist with this email already exists', { status: 409 });
      }
      throw error;
    }

    if (!existingUser) {
      const token = await generateInvitationToken(data.id);
      const registerUrl = new URL('/register', request.url);
      registerUrl.searchParams.set('token', token);
      registerUrl.searchParams.set('role', 'RECEPTIONIST');

      try {
        const { sendStaffInvitationEmail } = await import('@/lib/mailer');
        await sendStaffInvitationEmail({
          to: body.email,
          staffName: body.firstName,
          employeeCode: data.employee_code,
          role: 'RECEPTIONIST',
          registerUrl: registerUrl.toString(),
        });
      } catch {
        // Email failure is non-fatal
      }
    } else {
      await supabase
        .from('receptionists')
        .update({ auth_id: existingUser.id })
        .eq('id', data.id);

      await supabase.from('profiles').upsert({
        auth_id: existingUser.id,
        email: body.email,
        full_name: `${body.firstName} ${body.lastName}`,
        role: 'RECEPTIONIST',
        is_active: true,
      }, { onConflict: 'auth_id' });
    }

    await recordAuditLog({
      tableName: 'receptionists',
      recordId: data.id,
      action: 'INSERT',
      actorId: actor?.id ?? null,
      after: data as Record<string, unknown>,
    });

    return createApiResponse(true, toReceptionist(data as ReceptionistRow));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, 'Validation error', { status: 400 });
    }
    return createApiResponse(false, 'Failed to create receptionist', { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = receptionistSchema.extend({ id: z.string().uuid() }).parse(await request.json());
    const supabase = getSupabaseAdmin();
    const actor = await getAuditActor(request);

    const { data: existing } = await supabase
      .from('receptionists')
      .select('*')
      .eq('id', body.id)
      .single();

    if (!existing) {
      return createApiResponse(false, 'Receptionist not found', { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      first_name: body.firstName,
      last_name: body.lastName,
      email: body.email,
      phone: body.phone || null,
      home_address: body.homeAddress || null,
      // department_id and manager_id are locked after creation — Manager-only via dedicated endpoint
    };
    if (body.isActive !== undefined) {
      updateData.is_active = body.isActive;
    }

    const { data, error } = await supabase
      .from('receptionists')
      .update(updateData)
      .eq('id', body.id)
      .select('*, departments(name)')
      .single();

    if (error) throw error;

    if (existing.auth_id) {
      const profileUpdate: Record<string, unknown> = {
        email: body.email,
        full_name: `${body.firstName} ${body.lastName}`,
        phone: body.phone || null,
        home_address: body.homeAddress || null,
      };
      if (body.isActive !== undefined) {
        profileUpdate.is_active = body.isActive;
      }
      await supabase.from('profiles').upsert(profileUpdate, { onConflict: 'auth_id' });
    }

    await recordAuditLog({
      tableName: 'receptionists',
      recordId: body.id,
      action: 'UPDATE',
      actorId: actor?.id ?? null,
      before: existing as Record<string, unknown>,
      after: data as Record<string, unknown>,
    });

    return createApiResponse(true, toReceptionist(data as ReceptionistRow));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, 'Validation error', { status: 400 });
    }
    return createApiResponse(false, 'Failed to update receptionist', { status: 500 });
  }
}

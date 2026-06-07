import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuditActor, recordAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { createApiResponse } from '@/lib/api-response';
import { buildRegisterRedirect } from '@/lib/supabase-email';
import { sendStaffInvitationEmail } from '@/lib/mailer';
import { SignJWT } from 'jose';

function emptyToUndefined(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : value;
}

const staffSchema = z.object({
  id: z.string().uuid().optional(),
  employeeCode: z.string().min(1),
  name: z.string().min(1),
  department: z.string().min(1),
  position: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  isMain: z.boolean().optional(),
});

function generateEmployeeCode() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `EMP-${timestamp}${random}`;
}

type StaffRow = {
  id: string;
  employee_code: string;
  full_name: string;
  department: string;
  position: string;
  email: string;
  phone: string | null;
  status: string;
  image_path: string | null;
};

const invitationSecret = new TextEncoder().encode(process.env.JWT_SECRET || process.env.ONBOARDING_SECRET || 'staff-invite-secret');

async function generateInvitationToken(staffId: string): Promise<string> {
  return new SignJWT({ staffId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('48h')
    .sign(invitationSecret);
}

async function clearMainReceptionistFlag(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { error } = await supabase.from('profiles').update({ is_main: false }).eq('is_main', true);
  if (error) throw error;
}

function resolveMainReceptionist(isMain?: boolean) {
  return isMain === true;
}

function formatStaffRoleLabel(isMain: boolean) {
  return isMain ? 'Main receptionist' : 'Receptionist';
}

async function findAuthUserByEmail(supabase: ReturnType<typeof getSupabaseAdmin>, email: string) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return (data.users ?? []).find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get('search') ?? '';
    const supabase = getSupabaseAdmin();
    let query = supabase.from('staff').select('*').order('full_name', { ascending: true });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,department.ilike.%${search}%,position.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const staffEmails = (data ?? [])
      .map((member: StaffRow) => member.email)
      .filter((email): email is string => Boolean(email));

    const mainReceptionists = staffEmails.length
      ? await supabase.from('profiles').select('email, is_main').in('email', staffEmails)
      : { data: [], error: null };

    if (mainReceptionists.error) throw mainReceptionists.error;

    const mainReceptionistSet = new Set(
      (mainReceptionists.data ?? []).filter((profile) => profile.is_main).map((profile) => String(profile.email ?? '').toLowerCase()),
    );

    return NextResponse.json({
      success: true,
      data: (data ?? []).map((member: StaffRow) => {
        const isMain = Boolean(member.email && mainReceptionistSet.has(member.email.toLowerCase()));
        return {
          id: member.id,
          employeeCode: member.employee_code,
          name: member.full_name,
          department: member.department,
          position: member.position,
          email: member.email,
          phone: member.phone,
          status: member.status,
          role: isMain ? 'MAIN_RECEPTIONIST' : 'RECEPTIONIST',
          roleLabel: formatStaffRoleLabel(isMain),
          isMain,
          imagePath: member.image_path,
        };
      }),
    });
  } catch {
    return createApiResponse(false, 'Failed to fetch staff');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = staffSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();
    const actor = await getAuditActor(request);
    const actorId = actor?.id ?? null;
    const isMainReceptionist = resolveMainReceptionist(body.isMain);
    const employeeCode = body.employeeCode || generateEmployeeCode();

    const { data: existingStaff } = await supabase
      .from('staff')
      .select('id')
      .eq('email', body.email)
      .maybeSingle();

    if (existingStaff) {
      return NextResponse.json({ success: false, error: 'Email already registered' }, { status: 409 });
    }

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('auth_id')
      .eq('email', body.email)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json({ success: false, error: 'Email already registered' }, { status: 409 });
    }

    if (isMainReceptionist) {
      await clearMainReceptionistFlag(supabase);
    }

    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .insert({
        employee_code: employeeCode,
        full_name: body.name,
        department: body.department,
        position: body.position,
        email: body.email,
        phone: body.phone,
        status: body.status ?? 'ACTIVE',
      })
      .select('*')
      .single();

    if (staffError) throw staffError;

    const invitationToken = await generateInvitationToken(staff.id);
    const registerUrl = buildRegisterRedirect(request, invitationToken);

    const { error: onboardingError } = await supabase
      .from('staff_onboarding')
      .insert({
        staff_id: staff.id,
        invite_token: invitationToken,
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        created_by: actorId,
      });

    if (onboardingError) {
      await supabase.from('staff').delete().eq('id', staff.id);
      throw onboardingError;
    }

    try {
      await sendStaffInvitationEmail({
        to: body.email,
        staffName: body.name,
        employeeCode,
        role: isMainReceptionist ? 'Main Receptionist' : 'Receptionist',
        registerUrl,
      });
    } catch (emailError) {
      await supabase.from('staff').delete().eq('id', staff.id);
      await supabase.from('staff_onboarding').delete().eq('staff_id', staff.id);
      console.error('Failed to send invitation email:', emailError);
      return NextResponse.json({ success: false, error: 'Failed to send invitation email' }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...staff,
        invited: true,
      },
      message: 'Staff created successfully. Invitation email sent via Resend.',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = error as z.ZodError;
      return NextResponse.json({ success: false, error: 'Validation error', details: validationError.errors }, { status: 400 });
    }
    return NextResponse.json(
      {
        success: false,
        error: process.env.NODE_ENV === 'production'
          ? 'Failed to create staff'
          : error instanceof Error
            ? error.message
            : 'Failed to create staff',
        details:
          process.env.NODE_ENV === 'production'
            ? undefined
            : error instanceof Error
              ? error.stack ?? error.message
              : (() => {
                  try {
                    return JSON.stringify(error);
                  } catch {
                    return String(error);
                  }
                })(),
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = staffSchema.parse(await request.json());
    const { id, ...updateData } = body;
    const supabase = getSupabaseAdmin();
    const actor = await getAuditActor(request);
    const actorRole = actor?.role ?? null;

    const { data: existingStaff, error: existingStaffError } = await supabase
      .from('staff')
      .select('id, email')
      .eq('id', id)
      .maybeSingle();

    if (existingStaffError || !existingStaff) {
      return NextResponse.json({ success: false, error: 'Staff not found' }, { status: 404 });
    }

    if (updateData.email !== existingStaff.email && actorRole !== 'MAIN_RECEPTIONIST') {
      return NextResponse.json({ success: false, error: 'Only admin users can update staff email addresses' }, { status: 403 });
    }

    const isMainReceptionist = resolveMainReceptionist(updateData.isMain);
    const authRole = isMainReceptionist ? 'MAIN_RECEPTIONIST' : 'RECEPTIONIST';
    const databaseRole = 'RECEPTIONIST';

    if (updateData.email !== existingStaff.email) {
      const { data: duplicateStaff } = await supabase
        .from('staff')
        .select('id')
        .eq('email', updateData.email)
        .neq('id', id)
        .maybeSingle();

      if (duplicateStaff) {
        return NextResponse.json({ success: false, error: 'Email already registered' }, { status: 409 });
      }

      const { data: duplicateProfile } = await supabase
        .from('profiles')
        .select('auth_id')
        .eq('email', updateData.email)
        .maybeSingle();

      if (duplicateProfile) {
        return NextResponse.json({ success: false, error: 'Email already registered' }, { status: 409 });
      }
    }

    if (isMainReceptionist) {
      await clearMainReceptionistFlag(supabase);
    }

    const actorId = actor?.id ?? null;

    const existingAuthUser = await findAuthUserByEmail(supabase, existingStaff.email);

    if (existingAuthUser) {
      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(existingAuthUser.id, {
        email: updateData.email,
        user_metadata: {
          full_name: updateData.name,
          role: authRole,
          employee_code: updateData.employeeCode,
        },
      });

      if (authUpdateError) {
        throw authUpdateError;
      }

      await supabase
        .from('profiles')
        .update({
          email: updateData.email,
          full_name: updateData.name,
          role: databaseRole,
          is_main: isMainReceptionist,
          is_active: updateData.status !== 'INACTIVE',
        })
        .eq('email', existingStaff.email);
    }

    const { data, error } = await supabase
      .from('staff')
      .update({
        employee_code: updateData.employeeCode,
        full_name: updateData.name,
        department: updateData.department,
        position: updateData.position,
        email: updateData.email,
        phone: updateData.phone,
        status: updateData.status,
        blocked_by: updateData.status === 'INACTIVE' ? actorId : null,
        blocked_at: updateData.status === 'INACTIVE' ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = error as z.ZodError;
      return NextResponse.json({ success: false, error: 'Validation error', details: validationError.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update staff' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const actor = await getAuditActor(request);
    const actorId = actor?.id ?? null;

    const { data: existingStaff } = await supabase
      .from('staff')
      .select('id, email')
      .eq('id', id)
      .maybeSingle();

    if (!existingStaff) {
      return createApiResponse(false, 'Staff not found', { status: 404 });
    }

    const { count: reservationCount } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', id);

    if (reservationCount && reservationCount > 0) {
      return createApiResponse(false, `Cannot delete staff member: referenced by ${reservationCount} reservation(s).`, { status: 409 });
    }

    const { data: staffToDelete } = await supabase
      .from('staff')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (staffToDelete) {
      await recordAuditLog({
        tableName: 'staff',
        recordId: id,
        action: 'DELETE',
        actorId,
        before: staffToDelete as Record<string, unknown>,
      });
    }

    const { error } = await supabase.from('staff').delete().eq('id', id);
    if (error) throw error;

    if (existingStaff.email) {
      const existingAuthUser = await findAuthUserByEmail(supabase, existingStaff.email);
      if (existingAuthUser) {
        await supabase.from('profiles').delete().eq('auth_id', existingAuthUser.id);
        await supabase.auth.admin.deleteUser(existingAuthUser.id);
      } else {
        await supabase.from('profiles').delete().eq('email', existingStaff.email);
      }
    }

    return createApiResponse(true, { message: 'Staff deleted' });
  } catch {
    return createApiResponse(false, 'Failed to delete staff');
  }
}

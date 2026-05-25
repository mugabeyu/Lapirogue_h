import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuditActor, recordAuditLog } from '@/lib/audit';
import { z } from 'zod';

const staffSchema = z.object({
  id: z.string().uuid().optional(),
  employeeCode: z.string().min(1),
  name: z.string().min(1),
  department: z.string().min(1),
  position: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  isMain: z.boolean().optional(),
});

function generateEmployeeCode() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `EMP-${timestamp}${random}`;
}

function generateSecurePassword(length = 20) {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+[]{}';
  const bytes = randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i += 1) {
    password += charset[bytes[i] % charset.length];
  }
  return password;
}

type StaffRow = {
  id: string;
  auth_user_id: string | null;
  employee_code: string;
  full_name: string;
  department: string;
  position: string;
  email: string;
  phone: string | null;
  status: string;
  image_path: string | null;
};

async function clearMainReceptionistFlag(supabase: ReturnType<typeof getSupabaseAdmin>, exceptAuthId?: string) {
  let query = supabase.from('profiles').update({ is_main: false }).eq('is_main', true);
  if (exceptAuthId) {
    query = query.neq('auth_id', exceptAuthId);
  }
  const { error } = await query;
  if (error) throw error;
}

function resolveMainReceptionist(isMain?: boolean) {
  return isMain === true;
}

function formatStaffRoleLabel(isMain: boolean) {
  return isMain ? 'Main receptionist' : 'Receptionist';
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

    const authIds = (data ?? [])
      .map((member: StaffRow) => member.auth_user_id)
      .filter((authId): authId is string => Boolean(authId));

    const mainReceptionists = authIds.length
      ? await supabase.from('profiles').select('auth_id, is_main').in('auth_id', authIds)
      : { data: [], error: null };

    if (mainReceptionists.error) throw mainReceptionists.error;

    const mainReceptionistSet = new Set(
      (mainReceptionists.data ?? []).filter((profile) => profile.is_main).map((profile) => profile.auth_id),
    );

    return NextResponse.json({
      success: true,
      data: (data ?? []).map((member: StaffRow) => {
        const isMain = Boolean(member.auth_user_id && mainReceptionistSet.has(member.auth_user_id));
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
    return NextResponse.json({ success: false, error: 'Failed to fetch staff' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = staffSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();
    const actor = await getAuditActor(request);
    const actorId = actor?.id ?? null;
    const loginUrl = new URL('/login', request.url).toString();
    const temporaryPassword = generateSecurePassword();
    const isMainReceptionist = resolveMainReceptionist(body.isMain);
    const authRole = isMainReceptionist ? 'MAIN_RECEPTIONIST' : 'RECEPTIONIST';
    const databaseRole = 'RECEPTIONIST';
    const isActive = body.status !== 'INACTIVE';
    
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

    const employeeCode = body.employeeCode || generateEmployeeCode();

    // Create staff record
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
        created_by: actorId,
        updated_by: actorId,
      })
      .select('*')
      .single();

    if (staffError) throw staffError;

    // Invite user by email immediately through Supabase Auth.
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(body.email, {
      redirectTo: loginUrl,
      data: {
        full_name: body.name,
        role: authRole,
        employee_code: employeeCode,
        temporary_password: temporaryPassword,
        credential_instructions: 'Use the temporary password from this email, then reset it after first login.',
        login_url: loginUrl,
      },
    });

    const invitedUserId = inviteData?.user?.id;
    if (inviteError || !invitedUserId) {
      await supabase.from('staff').delete().eq('id', staff.id);
      throw inviteError ?? new Error('Supabase invite did not return a user id');
    }

    // Ensure generated credentials are attached to the invited auth user.
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(invitedUserId, {
      password: temporaryPassword,
      email: body.email,
      user_metadata: {
        full_name: body.name,
        role: authRole,
        employee_code: employeeCode,
        temporary_password: temporaryPassword,
        credential_instructions: 'Use the temporary password from this email, then reset it after first login.',
        login_url: loginUrl,
      },
    });

    if (updateAuthError) {
      await supabase.from('staff').delete().eq('id', staff.id);
      await supabase.auth.admin.deleteUser(invitedUserId);
      throw updateAuthError;
    }

    const { data: user, error: userError } = await supabase
      .from('profiles')
      .insert({
        auth_id: invitedUserId,
        email: body.email,
        full_name: body.name,
        role: databaseRole,
        is_main: isMainReceptionist,
        is_active: isActive,
      })
      .select('auth_id, email, full_name, role, is_main')
      .single();

    if (userError) {
      await supabase.from('staff').delete().eq('id', staff.id);
      await supabase.auth.admin.deleteUser(invitedUserId);
      throw userError;
    }

    const { data: updatedStaff, error: staffLinkError } = await supabase
      .from('staff')
      .update({ auth_user_id: invitedUserId })
      .eq('id', staff.id)
      .select('*')
      .single();

    if (staffLinkError) {
      await supabase.from('profiles').delete().eq('auth_id', invitedUserId);
      await supabase.auth.admin.deleteUser(invitedUserId);
      await supabase.from('staff').delete().eq('id', staff.id);
      throw staffLinkError;
    }

    return NextResponse.json({ 
      success: true, 
      data: {
        ...updatedStaff,
        user: {
          ...user,
          role: user.is_main ? 'MAIN_RECEPTIONIST' : user.role,
        },
      },
      message: 'Staff created successfully. Login invitation sent via Supabase email.'
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = error as z.ZodError;
      return NextResponse.json({ success: false, error: 'Validation error', details: validationError.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to create staff' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = staffSchema.parse(await request.json());
    const { id, ...updateData } = body;
    const supabase = getSupabaseAdmin();

    const { data: existingStaff, error: existingStaffError } = await supabase
      .from('staff')
      .select('id, auth_user_id, email')
      .eq('id', id)
      .maybeSingle();

    if (existingStaffError || !existingStaff) {
      return NextResponse.json({ success: false, error: 'Staff not found' }, { status: 404 });
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

      if (duplicateProfile && duplicateProfile.auth_id !== existingStaff.auth_user_id) {
        return NextResponse.json({ success: false, error: 'Email already registered' }, { status: 409 });
      }
    }

    if (isMainReceptionist) {
      await clearMainReceptionistFlag(supabase, existingStaff.auth_user_id ?? undefined);
    }

    const actor = await getAuditActor(request);
    const actorId = actor?.id ?? null;

    if (existingStaff.auth_user_id) {
      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(existingStaff.auth_user_id, {
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
          updated_by: actorId,
        })
        .eq('auth_id', existingStaff.auth_user_id);
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
        updated_by: actorId,
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
    const { data: existingStaff } = await supabase
      .from('staff')
      .select('id, auth_user_id')
      .eq('id', id)
      .maybeSingle();

    const actor = await getAuditActor(request);
    const actorId = actor?.id ?? null;

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

    if (existingStaff?.auth_user_id) {
      await supabase.from('profiles').delete().eq('auth_id', existingStaff.auth_user_id);
      await supabase.auth.admin.deleteUser(existingStaff.auth_user_id);
    }

    return NextResponse.json({ success: true, message: 'Staff deleted' });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete staff' }, { status: 500 });
  }
}

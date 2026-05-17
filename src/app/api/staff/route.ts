import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import { hashPassword } from '@/services/auth';
import { randomBytes } from 'node:crypto';

const staffSchema = z.object({
  id: z.string().uuid().optional(),
  employeeCode: z.string().min(1),
  name: z.string().min(1),
  department: z.string().min(1),
  position: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

function generateSecurePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  const bytes = randomBytes(12);
  for (let i = 0; i < 12; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

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

    return NextResponse.json({
      success: true,
      data: (data ?? []).map((member: StaffRow) => ({
        id: member.id,
        employeeCode: member.employee_code,
        name: member.full_name,
        department: member.department,
        position: member.position,
        email: member.email,
        phone: member.phone,
        status: member.status,
        imagePath: member.image_path,
      })),
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch staff' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = staffSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();
    
    // Check if email already exists in users
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', body.email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ success: false, error: 'Email already registered' }, { status: 409 });
    }

    // Generate secure password
    const autoPassword = generateSecurePassword();
    const passwordHash = await hashPassword(autoPassword);
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
      })
      .select('*')
      .single();

    if (staffError) throw staffError;

    // Create user account for staff
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(body.email, {
      data: {
        full_name: body.name,
        role: 'STAFF',
        temp_password: autoPassword,
        login_url: new URL('/login', request.url).toString(),
      },
    });

    if (inviteError) {
      await supabase.from('staff').delete().eq('id', staff.id);
      throw inviteError;
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        email: body.email,
        password_hash: passwordHash,
        full_name: body.name,
        role: 'STAFF',
      })
      .select('id, email, full_name, role')
      .single();

    if (userError) {
      await supabase.from('staff').delete().eq('id', staff.id);
      if (inviteData?.user?.id) {
        await supabase.auth.admin.deleteUser(inviteData.user.id);
      }
      throw userError;
    }

    return NextResponse.json({ 
      success: true, 
      data: {
        ...staff,
        user: user,
      },
      message: 'Staff created successfully. Login credentials sent via Supabase email.'
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
    const { data, error } = await getSupabaseAdmin()
      .from('staff')
      .update({
        employee_code: updateData.employeeCode,
        full_name: updateData.name,
        department: updateData.department,
        position: updateData.position,
        email: updateData.email,
        phone: updateData.phone,
        status: updateData.status,
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
    const { error } = await getSupabaseAdmin().from('staff').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Staff deleted' });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete staff' }, { status: 500 });
  }
}

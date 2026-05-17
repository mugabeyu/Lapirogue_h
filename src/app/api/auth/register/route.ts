import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hashPassword, generateToken } from '@/services/auth';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'MANAGER', 'RECEPTION', 'RESTAURANT', 'TOUR_MANAGER', 'STAFF']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = registerSchema.parse(body);
    const supabase = getSupabaseAdmin();

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', validatedData.email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email already registered' },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(validatedData.password);

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email: validatedData.email,
        password_hash: hashedPassword,
        full_name: validatedData.name,
        role: validatedData.role || 'STAFF',
      })
      .select('id,email,full_name,role,is_active,created_at,updated_at')
      .single();

    if (error || !user) {
      return NextResponse.json(
        { success: false, error: 'Failed to create user' },
        { status: 500 },
      );
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.full_name,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    });

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.full_name,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

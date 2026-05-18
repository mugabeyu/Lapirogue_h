import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hashPassword } from '@/services/auth';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
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

    // Create the user in Supabase Auth (so Supabase issues the session/token)
    const res = NextResponse.next();
    const authClient = getRouteHandlerSupabaseClient(request, res);

    const { data: signUpData, error: signUpError } = await authClient.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
    }, {
      data: { full_name: validatedData.name, role: validatedData.role || 'STAFF' },
    });

    if (signUpError) {
      return NextResponse.json(
        { success: false, error: signUpError.message },
        { status: 500 }
      );
    }

    // Keep a mirrored record in the application `users` table for legacy flows
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

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.full_name,
          role: user.role,
        },
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

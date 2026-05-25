import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { attachSupabaseCookies, createRouteHandlerSupabaseContext } from '@/lib/supabase-server';
import { getAuditActor } from '@/lib/audit';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = registerSchema.parse(body);
    const adminClient = getSupabaseAdmin();
    const actor = await getAuditActor(request);
    const actorId = actor?.id ?? null;

    // Create the auth user first.
    const { supabase: authClient, response } = createRouteHandlerSupabaseContext(request);

    const { data: signUpData, error: signUpError } = await authClient.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        data: { full_name: validatedData.name, role: 'RECEPTIONIST' },
      },
    });

    if (signUpError) {
      return NextResponse.json(
        { success: false, error: signUpError.message },
        { status: 500 }
      );
    }

    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('auth_id')
      .eq('email', validatedData.email)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { success: false, error: 'Email already registered' },
        { status: 409 }
      );
    }

    const { data: user, error } = await adminClient
      .from('profiles')
      .insert({
        auth_id: signUpData.user?.id ?? '',
        email: validatedData.email,
        full_name: validatedData.name,
        role: 'RECEPTIONIST',
        is_main: false,
        is_active: true,
        created_by: actorId,
        updated_by: actorId,
      })
      .select('auth_id,email,full_name,role,is_main,created_at,updated_at')
      .single();

    if (error || !user) {
      return NextResponse.json(
        { success: false, error: 'Failed to create user' },
        { status: 500 },
      );
    }

    return attachSupabaseCookies(NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.auth_id,
          email: user.email,
          name: user.full_name,
          role: user.role,
        },
      },
    }), response);
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

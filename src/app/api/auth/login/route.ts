import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { comparePassword } from '@/services/auth';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = loginSchema.parse(body);
    // Use Supabase Auth to sign in and let Supabase manage the session cookie.
    const res = NextResponse.next();
    const authClient = getRouteHandlerSupabaseClient(request, res);

    const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
      email: validatedData.email,
      password: validatedData.password,
    });

    if (signInError) {
      return NextResponse.json({ success: false, error: signInError.message }, { status: 401 });
    }

    // Optionally update last_login in the app users table (best-effort)
    const supabase = getSupabaseAdmin();
    void supabase.from('users').update({ last_login: new Date().toISOString() }).eq('email', validatedData.email);

    return NextResponse.json({ success: true, data: { user: signInData.user ?? null } });
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

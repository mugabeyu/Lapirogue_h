import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { attachSupabaseCookies, createRouteHandlerSupabaseContext } from '@/lib/supabase-server';
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
    // Sign in through Supabase Auth.
    const { supabase: authClient, response } = createRouteHandlerSupabaseContext(request);

    // Log the environment variables to debug the URL issue
    console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL);

    const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
      email: validatedData.email,
      password: validatedData.password,
    });

    if (signInError) {
      console.error('Sign in error:', signInError);
      return NextResponse.json({ success: false, error: signInError.message }, { status: 401 });
    }

    console.log('Signed in user:', signInData.user);

    const adminClient = getSupabaseAdmin();
    const metadata = signInData.user?.user_metadata ?? {};
    void adminClient
      .from('profiles')
      .upsert({
        auth_id: signInData.user?.id ?? '',
        email: signInData.user?.email ?? '',
        full_name: metadata.full_name ?? metadata.name ?? signInData.user?.email ?? '',
        role: 'RECEPTIONIST',
      }, { onConflict: 'auth_id' });

    const result = attachSupabaseCookies(NextResponse.json({ success: true, data: { user: signInData.user ?? null } }), response);
    console.log('Set cookies and returning response');
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Internal server error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

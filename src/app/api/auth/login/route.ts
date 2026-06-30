import { NextRequest, NextResponse } from 'next/server';
import { attachSupabaseCookies, createRouteHandlerSupabaseContext } from '@/lib/supabase-server';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function isNetworkLikeSupabaseError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const cause = error.cause;

  return (
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('enotfound') ||
    message.includes('econnrefused') ||
    message.includes('supabase url') ||
    message.includes('placeholder') ||
    (cause instanceof Error && /enotfound|econnrefused|fetch failed/i.test(cause.message))
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = loginSchema.parse(body);
    // Sign in through Supabase Auth.
    const { supabase: authClient, response } = createRouteHandlerSupabaseContext(request);

    let signInData: Awaited<ReturnType<typeof authClient.auth.signInWithPassword>>['data'];
    let signInError: Awaited<ReturnType<typeof authClient.auth.signInWithPassword>>['error'];

    try {
      const signInResult = await authClient.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });
      signInData = signInResult.data;
      signInError = signInResult.error;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication service is unreachable. Verify Supabase URL/key configuration.',
        },
        { status: 503 },
      );
    }

    if (isNetworkLikeSupabaseError(signInError)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Supabase authentication is not reachable. Check the project URL and public key in your environment.',
        },
        { status: 503 },
      );
    }

    if (signInError) {
      return NextResponse.json({ success: false, error: signInError.message }, { status: 401 });
    }

    const userId = signInData.user?.id ?? '';
    const metadata = signInData.user?.user_metadata ?? {};

    const [{ data: profileRow }, { data: guestRow }] = await Promise.all([
      authClient
        .from('profiles')
        .select('auth_id, role, is_active')
        .eq('auth_id', userId)
        .maybeSingle(),
      authClient
        .from('guests')
        .select('id')
        .eq('auth_id', userId)
        .maybeSingle(),
    ]);

    if (guestRow) {
      await authClient.auth.signOut();
      return NextResponse.json({ success: false, error: 'Guests must access via the mobile app' }, { status: 403 });
    }

    if (!profileRow || !['ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(profileRow.role)) {
      await authClient.auth.signOut();
      return NextResponse.json({ success: false, error: 'Access denied. Staff account not found.' }, { status: 403 });
    }

    if (profileRow.is_active === false) {
      await authClient.auth.signOut();
      return NextResponse.json({ success: false, error: 'This staff account is blocked' }, { status: 403 });
    }

    // Staff login successful - upsert profile
    void authClient
      .from('profiles')
      .upsert({
        auth_id: userId,
        email: signInData.user?.email ?? '',
        full_name: metadata.full_name ?? metadata.name ?? undefined,
        is_active: true,
      }, { onConflict: 'auth_id' });

    const result = attachSupabaseCookies(
      NextResponse.json({ success: true, data: { user: signInData.user ?? null, userType: 'staff' } }),
      response,
    );
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error && /Supabase URL|configuration|placeholder/i.test(error.message)) {
      return NextResponse.json({ success: false, error: error.message }, { status: 503 });
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

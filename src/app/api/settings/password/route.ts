import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { attachSupabaseCookies, getRouteHandlerSupabaseSession } from '@/lib/supabase-server';

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function PUT(request: NextRequest) {
  const { user, error: userError, response, supabase } = await getRouteHandlerSupabaseSession(request);
  if (!user || userError) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), response);
  }

  try {
    const body = await request.json();
    const validatedData = passwordSchema.parse(body);

    if (!user.email) {
      response.headers.set('Cache-Control', 'no-store, max-age=0');
      return attachSupabaseCookies(NextResponse.json({ success: false, error: 'User email missing' }, { status: 400 }), response);
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: validatedData.currentPassword,
    });

    if (signInError) {
      response.headers.set('Cache-Control', 'no-store, max-age=0');
      return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 401 }), response);
    }

    const { error } = await supabase.auth.updateUser({ password: validatedData.newPassword });

    if (error) throw error;

    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return attachSupabaseCookies(NextResponse.json({ success: true, message: 'Password updated successfully' }), response);
  } catch (error) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    if (error instanceof z.ZodError) {
      return attachSupabaseCookies(
        NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 }),
        response,
      );
    }
    return attachSupabaseCookies(NextResponse.json({ success: false, error: 'Failed to update password' }, { status: 500 }), response);
  }
}

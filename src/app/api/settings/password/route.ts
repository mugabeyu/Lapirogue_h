import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function PUT(request: NextRequest) {
  const authClient = getRouteHandlerSupabaseClient(request);
  const { data: { user }, error: userError } = await authClient.auth.getUser();
  if (!user || userError) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validatedData = passwordSchema.parse(body);

    if (!user.email) {
      return NextResponse.json({ success: false, error: 'User email missing' }, { status: 400 });
    }

    const { error: signInError } = await authClient.auth.signInWithPassword({
      email: user.email,
      password: validatedData.currentPassword,
    });

    if (signInError) {
      return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 401 });
    }

    const { error } = await authClient.auth.updateUser({ password: validatedData.newPassword });

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update password' }, { status: 500 });
  }
}
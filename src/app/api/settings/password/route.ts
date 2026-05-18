import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import { comparePassword, hashPassword } from '@/services/auth';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function PUT(request: NextRequest) {
  const res = NextResponse.next();
  const authClient = getRouteHandlerSupabaseClient(request, res);
  const { data: { user }, error: userError } = await authClient.auth.getUser();
  if (!user || userError) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validatedData = passwordSchema.parse(body);

    // Get current user with password hash
    const { data: userRow, error: fetchError } = await getSupabaseAdmin()
      .from('users')
      .select('id, password_hash')
      .eq('id', user.id)
      .single();

    if (fetchError || !user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Verify current password
    const isValid = await comparePassword(validatedData.currentPassword, userRow.password_hash);
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 401 });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(validatedData.newPassword);

    // Update password
    const { error } = await getSupabaseAdmin()
      .from('users')
      .update({ password_hash: newPasswordHash })
      .eq('id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update password' }, { status: 500 });
  }
}
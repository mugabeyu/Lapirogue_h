import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const syncPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

export async function POST(request: NextRequest) {
  try {
    const { supabase: authClient } = await import('@/lib/supabase-server').then(m => m.createRouteHandlerSupabaseContext(request));
    const { data: { user }, error: userError } = await authClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    
    const body = await request.json();
    const validatedData = syncPasswordSchema.parse(body);

    const adminClient = getSupabaseAdmin();

    // Update password via Supabase Auth
    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      password: validatedData.newPassword,
    });

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 400 });
    }

    // Update profile timestamp
    void adminClient.from('profiles').update({ updated_at: new Date().toISOString() }).eq('auth_id', user.id);

    return NextResponse.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ success: false, error: 'Failed to update password' }, { status: 500 });
  }
}
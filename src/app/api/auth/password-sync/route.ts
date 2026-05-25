import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const syncPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    void syncPasswordSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user?.email) {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ updated_at: new Date().toISOString() })
      .eq('auth_id', userData.user.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Password synchronized' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ success: false, error: 'Failed to synchronize password' }, { status: 500 });
  }
}
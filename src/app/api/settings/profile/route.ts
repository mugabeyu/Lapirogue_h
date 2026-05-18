import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';

const profileSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
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
    const validatedData = profileSchema.parse(body);

    const { data, error } = await getSupabaseAdmin()
      .from('users')
      .update({
        full_name: validatedData.fullName,
        email: validatedData.email,
        phone: validatedData.phone,
      })
      .eq('id', user.id)
      .select('id, email, full_name, role, phone, is_active, created_at, updated_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { attachSupabaseCookies, createRouteHandlerSupabaseContext } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  const { supabase, response } = createRouteHandlerSupabaseContext(request);
  await supabase.auth.signOut();

  return attachSupabaseCookies(NextResponse.json({ success: true, message: 'Logged out successfully' }), response);
}

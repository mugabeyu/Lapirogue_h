import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  const res = NextResponse.next();
  const authClient = getRouteHandlerSupabaseClient(request, res);
  await authClient.auth.signOut();

  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  return response;
}

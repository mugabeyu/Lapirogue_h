import { NextRequest } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';

export async function requireAuth(request: NextRequest) {
  const authClient = getRouteHandlerSupabaseClient(request);
  const { data: { user } } = await authClient.auth.getUser();
  return user ?? null;
}
import { createServerComponentClient, createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

export function getServerComponentSupabaseClient() {
  return createServerComponentClient({ cookies });
}

export function getRouteHandlerSupabaseClient(req: NextRequest, res: any) {
  // For route handlers we need to create a response object to pass to the helper.
  // Callers should pass a NextResponse instance when available.
  return createRouteHandlerClient({ req, res });
}

export async function getServerUser() {
  const supabase = getServerComponentSupabaseClient();
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

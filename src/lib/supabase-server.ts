import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

const resolvedSupabaseUrl = 'https://afilatpihmbicqadwslm.supabase.co';
const resolvedSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmaWxhdHBpaG1iaWNxYWR3c2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjkyOTMsImV4cCI6MjA5NDcwNTI5M30.YRojYa3ewoh4L81haeBHbeGrU9t6nXSplxYzFO-RfkQ';

export function createRouteHandlerSupabaseContext(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(resolvedSupabaseUrl, resolvedSupabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: any }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  return { supabase, response };
}

export function getRouteHandlerSupabaseClient(request: NextRequest) {
  return createRouteHandlerSupabaseContext(request).supabase;
}

export function attachSupabaseCookies(response: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });

  return response;
}

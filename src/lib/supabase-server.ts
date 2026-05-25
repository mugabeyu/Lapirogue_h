import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseConfig } from './supabase-config';

type ResponseCookieOptions = NonNullable<Parameters<NextResponse['cookies']['set']>[2]>;

export function createRouteHandlerSupabaseContext(request: NextRequest) {
  const { url, anonKey } = getSupabaseConfig();

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: ResponseCookieOptions }>) {
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

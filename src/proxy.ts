import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const supabaseUrl = 'https://afilatpihmbicqadwslm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmaWxhdHBpaG1iaWNxYWR3c2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjkyOTMsImV4cCI6MjA5NDcwNTI5M30.YRojYa3ewoh4L81haeBHbeGrU9t6nXSplxYzFO-RfkQ';

async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Try to get the user and refresh the session
  // This will also sync any cookies that were set by the Supabase client
  try {
    const { data } = await supabase.auth.getUser();
    
    // If no user but we're on a protected route, just continue
    // The layout component will handle the redirect
  } catch (error) {
    // Silently handle any auth errors during middleware
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

export default proxy;

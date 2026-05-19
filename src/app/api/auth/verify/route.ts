import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://afilatpihmbicqadwslm.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmaWxhdHBpaG1iaWNxYWR3c2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjkyOTMsImV4cCI6MjA5NDcwNTI5M30.YRojYa3ewoh4L81haeBHbeGrU9t6nXSplxYzFO-RfkQ';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    });

    // Get the user - this should refresh and set cookies if needed
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      return NextResponse.json({ authenticated: true, user: { id: user.id, email: user.email } });
    } else {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ authenticated: false, error: 'Auth check failed' }, { status: 500 });
  }
}

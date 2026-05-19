import { createClient } from '@supabase/supabase-js';

export function getSupabaseBrowserClient() {
  // Use hardcoded values for lapirogue project
  // Env vars were not being picked up by Turbopack at compile time
  const supabaseUrl = 'https://afilatpihmbicqadwslm.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmaWxhdHBpaG1iaWNxYWR3c2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjkyOTMsImV4cCI6MjA5NDcwNTI5M30.YRojYa3ewoh4L81haeBHbeGrU9t6nXSplxYzFO-RfkQ';

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  // Debug: surface whether the public URL was inlined into the client bundle
  // Avoid logging the full anon key to keep secrets out of console logs.
  try {
    // eslint-disable-next-line no-console
    console.debug('Supabase client config:', {
      url: supabaseUrl,
      anonKeyPresent: !!supabaseAnonKey,
    });
  } catch (_) {}
  
    // Reuse a single client instance in the browser to avoid multiple GoTrue
    // instances warning and undefined behaviour during HMR or concurrent use.
    const globalKey = '__supabase_browser_client';
    const anyGlobal: any = globalThis as any;
  
    if (!anyGlobal[globalKey]) {
      // Debug: surface whether the public URL was inlined into the client bundle
      try {
        // eslint-disable-next-line no-console
        console.debug('Supabase client config:', {
          url: supabaseUrl,
          anonKeyPresent: !!supabaseAnonKey,
        });
      } catch (_) {}
  
      anyGlobal[globalKey] = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
        },
      });
    }
  
    return anyGlobal[globalKey];
}
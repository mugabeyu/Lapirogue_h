import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export function getSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return null so callers can handle missing client configuration in dev/test
    // Avoid printing secret values.
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
    return null;
  }

  try {
    new URL(supabaseUrl);
  } catch {
    console.error('NEXT_PUBLIC_SUPABASE_URL is invalid');
    return null;
  }

  const globalKey = '__supabase_browser_client';
  const browserGlobal = globalThis as typeof globalThis & {
    __supabase_browser_client?: SupabaseClient;
  };

  if (!browserGlobal[globalKey]) {
    browserGlobal[globalKey] = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  return browserGlobal[globalKey];
}

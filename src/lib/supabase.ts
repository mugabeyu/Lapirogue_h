import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Use the public anon key even on server-side to rely on RLS and policies.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.');
}

export function getSupabaseAdmin() {
  // Note: we intentionally do not use a service role key here.
  // All authorization should be enforced via RLS and policies in the database.
  // Because this client is created with the anon key, Row-Level Security (RLS)
  // is enforced by Postgres. Use `supabase.auth.getUser()` on the server to
  // identify the current user and rely on DB policies for access control.
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const resolvedSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const resolvedSupabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cachedAdminClient: SupabaseClient | null = null;

function createFetchWithTimeout(timeoutMs: number) {
  return async (input: URL | RequestInfo, init?: RequestInit) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

function validateConfig() {
  if (!resolvedSupabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  }

  try {
    new URL(resolvedSupabaseUrl);
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is invalid. Expected full https URL to your Supabase project.');
  }

  if (!resolvedSupabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }
}

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  validateConfig();

  cachedAdminClient = createClient(resolvedSupabaseUrl!, resolvedSupabaseServiceKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: createFetchWithTimeout(60000),
    },
  });

  return cachedAdminClient;
}

export function resetSupabaseAdminCache(): void {
  cachedAdminClient = null;
}

function isPlaceholderSupabaseUrl(url: string) {
  return /your-project\.supabase\.co/i.test(url) || /<project-ref>|example\.supabase\.co/i.test(url);
}

function isPlaceholderSupabaseKey(key: string) {
  return /your-public-anon-key|your-publishable-key|example/i.test(key);
}

export function getSupabaseConfig(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing Supabase configuration: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local');
  }

  if (isPlaceholderSupabaseUrl(url)) {
    throw new Error('Supabase URL is still set to a placeholder value. Replace it with your real project URL in .env.local.');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid Supabase URL format. Use full https URL, e.g. https://<project-ref>.supabase.co');
  }

  if (!/^https:$/i.test(parsed.protocol)) {
    throw new Error('Supabase URL must use https.');
  }

  if (!parsed.hostname.endsWith('.supabase.co')) {
    throw new Error('Supabase URL must point to a Supabase project host.');
  }

  if (isPlaceholderSupabaseKey(anonKey)) {
    throw new Error('Supabase anonymous key is still set to a placeholder value. Replace it with the real public key in .env.local.');
  }

  return { url, anonKey };
}

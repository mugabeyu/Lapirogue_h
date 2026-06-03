import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { User } from '@/types';
import { getSupabaseConfig } from './supabase-config';

function normalizeRole(role?: string | null): User['role'] {
  if (role === 'MAIN_RECEPTIONIST') return 'MAIN_RECEPTIONIST';
  return 'RECEPTIONIST';
}

export async function getServerSession(): Promise<User | null> {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseConfig();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Read-only server session lookup.
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return null;
  }

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('email, full_name, phone, avatar_url, role, is_main, is_active, created_at, updated_at')
    .eq('auth_id', user.id)
    .maybeSingle();

  if (profileRow?.is_active === false) {
    return null;
  }

  const sessionUser = {
    id: user.id,
    email: profileRow?.email ?? user.email ?? '',
    name: profileRow?.full_name ?? user.user_metadata?.full_name ?? '',
    role: profileRow?.is_main
      ? ('MAIN_RECEPTIONIST' as const)
      : normalizeRole(profileRow?.role ?? (user.user_metadata?.role as string | null | undefined)),
    phone: profileRow?.phone ?? null,
    avatarUrl: profileRow?.avatar_url ?? null,
    isActive: profileRow?.is_active !== false,
    createdAt: profileRow?.created_at ?? '',
    updatedAt: profileRow?.updated_at ?? '',
  };

  return sessionUser;
}

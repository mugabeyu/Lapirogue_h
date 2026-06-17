import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { User } from '@/types';
import { getSupabaseAdmin } from './supabase';
import { getSupabaseConfig } from './supabase-config';

type ProfileRow = {
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string | null;
  is_main: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type StaffRow = {
  email: string | null;
  full_name: string | null;
  phone: string | null;
  image_path: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function normalizeRole(role?: string | null): User['role'] {
  if (role === 'MAIN_RECEPTIONIST') return 'MAIN_RECEPTIONIST';
  return 'RECEPTIONIST';
}

function normalizeStorageUrl(admin: ReturnType<typeof getSupabaseAdmin>, value: string | null | undefined) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;

  let path = value;
  const marker = '/storage/v1/object/public/staff-avatars/';
  const markerIndex = path.indexOf(marker);
  if (markerIndex !== -1) {
    path = decodeURIComponent(path.slice(markerIndex + marker.length));
  }
  if (path.startsWith('staff-avatars/')) {
    path = path.replace(/^staff-avatars\//, '');
  }

  return admin.storage.from('staff-avatars').getPublicUrl(path).data.publicUrl ?? value;
}

export async function getServerSession(): Promise<User | null> {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseConfig();
  const admin = getSupabaseAdmin();

  const authClient = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Server components cannot mutate cookies directly.
      },
    },
  });

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser();
  if (error || !user) {
    return null;
  }

  const [profileResult, staffResult] = await Promise.all([
    admin
      .from('profiles')
      .select('email, full_name, phone, avatar_url, role, is_main, is_active, created_at, updated_at')
      .eq('auth_id', user.id)
      .maybeSingle(),
    admin
      .from('staff')
      .select('email, full_name, phone, image_path, status, created_at, updated_at')
      .eq('auth_user_id', user.id)
      .maybeSingle(),
  ]);

  if (profileResult.error) return null;
  if (staffResult.error) return null;

  const profileRow = profileResult.data as ProfileRow | null;
  const staffRow = staffResult.data as StaffRow | null;

  if (profileRow?.is_active === false) return null;
  if (staffRow?.status && staffRow.status.toUpperCase() !== 'ACTIVE') return null;

  const email = profileRow?.email || staffRow?.email || user.email || '';
  const name = profileRow?.full_name || staffRow?.full_name || (user.user_metadata?.full_name as string | undefined) || '';
  const avatarUrl = normalizeStorageUrl(admin, profileRow?.avatar_url) || normalizeStorageUrl(admin, staffRow?.image_path);

  return {
    id: user.id,
    email,
    name,
    role: profileRow?.is_main
      ? 'MAIN_RECEPTIONIST'
      : normalizeRole(profileRow?.role ?? (user.user_metadata?.role as string | null | undefined)),
    phone: profileRow?.phone ?? staffRow?.phone ?? null,
    avatarUrl,
    isActive: profileRow?.is_active == null ? true : Boolean(profileRow.is_active),
    createdAt: profileRow?.created_at || staffRow?.created_at || user.created_at || '',
    updatedAt: profileRow?.updated_at || staffRow?.updated_at || user.updated_at || '',
  };
}

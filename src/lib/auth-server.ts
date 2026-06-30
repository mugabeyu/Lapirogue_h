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
  is_active: boolean | null;
  home_address: string | null;
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

type ManagerRow = {
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  image_path: string | null;
  home_address: string | null;
  department_id: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  departments?: { name: string | null } | null;
};

type ReceptionistRow = {
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  image_path: string | null;
  home_address: string | null;
  department_id: string | null;
  manager_id: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  departments?: { name: string | null } | null;
};

function normalizeRole(role?: string | null): User['role'] {
  if (role === 'ADMIN') return 'ADMIN';
  if (role === 'MANAGER') return 'MANAGER';
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

  const [profileResult, guestResult] = await Promise.all([
    admin
      .from('profiles')
      .select('email, full_name, phone, avatar_url, role, is_active, home_address, created_at, updated_at')
      .eq('auth_id', user.id)
      .maybeSingle(),
    admin
      .from('guests')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle(),
  ]);

  if (profileResult.error) return null;
  if (guestResult.error) return null;

  const profileRow = profileResult.data as ProfileRow | null;

  if (guestResult.data) return null;
  if (profileRow?.is_active === false) return null;

  const role = normalizeRole(profileRow?.role ?? (user.user_metadata?.role as string | null | undefined));

  // Fetch role-specific data
  let managerRow: ManagerRow | null = null;
  let receptionistRow: ReceptionistRow | null = null;
  let departmentName: string | null = null;
  let managerName: string | null = null;
  let managerId: string | null = null;
  let homeAddress = profileRow?.home_address ?? null;

  if (role === 'MANAGER') {
    const { data } = await admin
      .from('managers')
      .select('email, first_name, last_name, phone, image_path, home_address, department_id, is_active, created_at, updated_at, departments(name)')
      .eq('auth_id', user.id)
      .maybeSingle();
    managerRow = data as ManagerRow | null;
    departmentName = managerRow?.departments?.name ?? null;
    homeAddress = homeAddress ?? managerRow?.home_address ?? null;
  } else if (role === 'RECEPTIONIST') {
    const { data } = await admin
      .from('receptionists')
      .select('email, first_name, last_name, phone, image_path, home_address, department_id, manager_id, is_active, created_at, updated_at, departments(name)')
      .eq('auth_id', user.id)
      .maybeSingle();
    receptionistRow = data as ReceptionistRow | null;
    departmentName = receptionistRow?.departments?.name ?? null;
    homeAddress = homeAddress ?? receptionistRow?.home_address ?? null;
    managerId = receptionistRow?.manager_id ?? null;
  }

  const staffRow = managerRow || receptionistRow;
  const email = profileRow?.email || staffRow?.email || user.email || '';

  let name = profileRow?.full_name || '';
  if (!name && staffRow) {
    name = `${staffRow.first_name ?? ''} ${staffRow.last_name ?? ''}`.trim();
  }
  if (!name) {
    name = (user.user_metadata?.full_name as string | undefined) || '';
  }

  const avatarUrl = normalizeStorageUrl(admin, profileRow?.avatar_url) || normalizeStorageUrl(admin, staffRow?.image_path);

  // Fetch manager name for receptionist if needed
  if (managerId) {
    const { data: mgrData } = await admin
      .from('managers')
      .select('first_name, last_name')
      .eq('id', managerId)
      .maybeSingle();
    if (mgrData) {
      managerName = `${mgrData.first_name ?? ''} ${mgrData.last_name ?? ''}`.trim();
    }
  }

  return {
    id: user.id,
    email,
    name,
    role,
    phone: profileRow?.phone ?? staffRow?.phone ?? null,
    avatarUrl,
    homeAddress,
    departmentId: managerRow?.department_id ?? receptionistRow?.department_id ?? null,
    departmentName,
    managerId,
    managerName,
    isActive: profileRow?.is_active == null ? true : Boolean(profileRow.is_active),
    createdAt: profileRow?.created_at || staffRow?.created_at || user.created_at || '',
    updatedAt: profileRow?.updated_at || staffRow?.updated_at || user.updated_at || '',
  };
}

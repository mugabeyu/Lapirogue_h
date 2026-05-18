import { getServerUser } from './supabase-server';
import { User } from '@/types';

export async function getServerSession(): Promise<User | null> {
  if (typeof window !== 'undefined') return null;

  const user = await getServerUser();
  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? '',
    name: user.user_metadata?.full_name ?? '',
    role: (user.user_metadata?.role as User['role']) ?? 'RECEPTION',
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };
}

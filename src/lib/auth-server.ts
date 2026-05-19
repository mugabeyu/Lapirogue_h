import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { User } from '@/types';
import { writeFileSync, appendFileSync } from 'fs';

const resolvedSupabaseUrl = 'https://afilatpihmbicqadwslm.supabase.co';
const resolvedSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmaWxhdHBpaG1iaWNxYWR3c2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjkyOTMsImV4cCI6MjA5NDcwNTI5M30.YRojYa3ewoh4L81haeBHbeGrU9t6nXSplxYzFO-RfkQ';

function normalizeRole(role?: string | null): User['role'] {
  return 'RECEPTIONIST';
}

export async function getServerSession(): Promise<User | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(resolvedSupabaseUrl, resolvedSupabaseAnonKey, {
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
  if (error) {
    console.error('Error fetching user:', error);
    // Write error to debug log
    try {
      appendFileSync('debug.log', `Error fetching user: ${JSON.stringify(error)}\n`);
    } catch (e) {
      console.error('Failed to write to debug.log:', e);
    }
    return null;
  }
  if (!user) {
    // Write to debug log when user is null
    try {
      appendFileSync('debug.log', 'User is null\n');
    } catch (e) {
      console.error('Failed to write to debug.log:', e);
    }
    return null;
  }

  const sessionUser = {
    id: user.id,
    email: user.email ?? '',
    name: user.user_metadata?.full_name ?? '',
    role: normalizeRole(user.user_metadata?.role as string | null | undefined),
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };

  // Write user to debug log
  try {
    appendFileSync('debug.log', `User from supabase: ${JSON.stringify(sessionUser)}\n`);
  } catch (e) {
    console.error('Failed to write to debug.log:', e);
  }

  return sessionUser;
}
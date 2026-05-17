import { verifyToken } from '@/services/auth';
import { User } from '@/types';

// Use a runtime/dynamic import for `next/headers` so this module can be
// imported from both server-only and other build contexts without causing
// Next.js static analysis to treat it as a pages-only server component.
export async function getServerSession(): Promise<User | null> {
  if (typeof window !== 'undefined') {
    // Client-side: no server session available
    return null;
  }

  // Dynamically import server-only helpers at runtime on the server.
  // This avoids static analysis errors during the build when some codepaths
  // may be included in contexts that don't support `next/headers`.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const headersMod = await import('next/headers');
  const cookieStore = await headersMod.cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    return null;
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return null;
  }

  return {
    id: decoded.userId,
    email: decoded.email,
    name: '',
    role: decoded.role as User['role'],
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };
}

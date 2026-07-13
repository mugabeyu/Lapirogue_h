import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const AUTH_ROUTES = ['/login', '/forgot-password', '/reset-password'];
const PUBLIC_ROUTES = ['/register', '/dining'];

const PUBLIC_API_PREFIXES = [
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/verify',
  '/api/auth/password-sync',
  '/api/auth/me',
  '/api/staff/register',
  '/api/reservations',
  '/api/rooms',
  '/api/activities',
  '/api/dining',
  '/api/spa',
  '/api/menu-items',
  '/api/health',
];

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

function corsResponse(status = 204) {
  return new NextResponse(null, { status, headers: CORS_HEADERS });
}

function nextResponse(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
  if (request.nextUrl.pathname.startsWith('/api/')) {
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }
  return response;
}

function createSupabase(request: NextRequest, response: NextResponse, supabaseUrl: string, supabaseAnonKey: string) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}

async function isGuestUser(supabase: ReturnType<typeof createServerClient>, userId: string): Promise<boolean> {
  const { data: guest } = await supabase
    .from('guests')
    .select('id')
    .eq('auth_id', userId)
    .maybeSingle();
  return !!guest;
}

async function getStaffRole(supabase: ReturnType<typeof createServerClient>, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_id', userId)
    .maybeSingle();
  return data?.role ?? null;
}

// Route-level role restrictions. Each entry lists the ONLY roles permitted to access
// a path (and everything under it). Paths not listed here are accessible to any
// authenticated staff member (Admin/Manager/Receptionist), matching pre-existing
// behaviour. This exists because the Sidebar only hides nav links client-side —
// it does not by itself prevent a user from navigating directly to a hidden route.
const ROLE_RESTRICTED_PATHS: { prefixes: string[]; roles: string[] }[] = [
  { prefixes: ['/departments', '/managers', '/audit-log', '/api/departments', '/api/managers', '/api/audit-log'], roles: ['ADMIN'] },
  {
    prefixes: [
      '/receptionists', '/payments', '/sustainability', '/feedback', '/hotel-information', '/reports',
      '/api/receptionists', '/api/payments', '/api/sustainability', '/api/feedback', '/api/content', '/api/reports',
    ],
    roles: ['MANAGER'],
  },
  { prefixes: ['/schedule', '/messages', '/api/schedule', '/api/messages'], roles: ['RECEPTIONIST'] },
];

function matchRestriction(pathname: string) {
  return ROLE_RESTRICTED_PATHS.find((entry) =>
    entry.prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CORS preflight — respond immediately for all API routes
  if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    return corsResponse(204);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variables');
  }

  if (pathname.startsWith('/api/')) {
    if (isPublicApi(pathname)) {
      return nextResponse(request);
    }

    const response = nextResponse(request);
    const supabase = createSupabase(request, response, supabaseUrl, supabaseAnonKey);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    if (await isGuestUser(supabase, user.id)) {
      return NextResponse.json({ success: false, error: 'Guests must access via the mobile app' }, { status: 403 });
    }

    const restriction = matchRestriction(pathname);
    if (restriction) {
      const role = await getStaffRole(supabase, user.id);
      if (!role || !restriction.roles.includes(role)) {
        return NextResponse.json({ success: false, error: 'Forbidden: insufficient role permissions' }, { status: 403 });
      }
    }

    return response;
  }

  if (isAuthRoute(pathname)) {
    const response = nextResponse(request);
    const supabase = createSupabase(request, response, supabaseUrl, supabaseAnonKey);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      if (await isGuestUser(supabase, user.id)) {
        const loginUrl = new URL('/login', request.url);
        await supabase.auth.signOut();
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.redirect(new URL('/', request.url));
    }

    return response;
  }

  if (isPublicRoute(pathname)) {
    return nextResponse(request);
  }

  const response = nextResponse(request);
  const supabase = createSupabase(request, response, supabaseUrl, supabaseAnonKey);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (await isGuestUser(supabase, user.id)) {
    const loginUrl = new URL('/login', request.url);
    await supabase.auth.signOut();
    return NextResponse.redirect(loginUrl);
  }

  const restriction = matchRestriction(pathname);
  if (restriction) {
    const role = await getStaffRole(supabase, user.id);
    if (!role || !restriction.roles.includes(role)) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/',
    '/(login|forgot-password|reset-password|register)(/.*)?',
    '/api/:path*',
    '/((?!dining|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

export default middleware;
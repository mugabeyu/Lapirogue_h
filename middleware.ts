import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const AUTH_ROUTES = ['/login', '/forgot-password', '/reset-password'];
const PUBLIC_ROUTES = ['/register'];

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

function nextResponse(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');
  }
  return response;
}

export async function OPTIONS(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
      },
    });
  }
  return NextResponse.next();
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

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variables');
  }

  const { pathname } = request.nextUrl;

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

  return response;
}

export const config = {
  matcher: [
    '/',
    '/(login|forgot-password|reset-password|register)(/.*)?',
    '/((?!api/(?:auth/(?:login|forgot-password|verify|password-sync|me|staff/register)|reservations|rooms|activities|dining|spa)|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

export default middleware;
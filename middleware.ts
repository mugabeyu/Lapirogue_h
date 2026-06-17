import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const AUTH_ROUTES = ['/login', '/forgot-password', '/reset-password'];
const PUBLIC_ROUTES = ['/register'];

const PUBLIC_API_PREFIXES = [
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/verify',
  '/api/auth/password-sync',
  '/api/staff/onboarding',
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
  return NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
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
    const {
      data: { user },
    } = await createSupabase(request, response, supabaseUrl, supabaseAnonKey).auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    return response;
  }

  if (isAuthRoute(pathname)) {
    const response = nextResponse(request);
    const {
      data: { user },
    } = await createSupabase(request, response, supabaseUrl, supabaseAnonKey).auth.getUser();

    if (user) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return response;
  }

  if (isPublicRoute(pathname)) {
    return nextResponse(request);
  }

  const response = nextResponse(request);
  const {
    data: { user },
  } = await createSupabase(request, response, supabaseUrl, supabaseAnonKey).auth.getUser();

  if (!user) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/auth/(?:login|forgot-password|verify|password-sync|me)|staff/onboarding|login|forgot-password|reset-password|register|$).*)',
  ],
};

export default middleware;
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  function getRedirectPath() {
    if (typeof window === 'undefined') return '/';
    const next = new URLSearchParams(window.location.search).get('next');
    if (next && next.startsWith('/') && !next.startsWith('/login')) {
      return next;
    }
    return '/';
  }

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (!cancelled && result?.success) {
          router.replace(getRedirectPath());
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        setErrorMessage(result?.error || 'Login failed');
        return;
      }

      router.push(getRedirectPath());
      router.refresh();
    } catch (err) {
      console.error(err);
      setErrorMessage('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-surface text-[var(--color-text-primary)] lg:flex">
        <section
          className="relative hidden min-h-screen overflow-hidden bg-surface-secondary text-white lg:flex lg:w-1/2 auth-login-bg"
        >
          <div className="absolute inset-0 auth-dark-overlay" />

          <div className="relative z-10 flex w-full items-center px-14 xl:px-20">
            <div className="max-w-xl">
              <div className="mb-8 flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-secondary/10 ring-2 ring-surface/30">
                  <img src="/lapiroguelogo.jpg" alt="La Pirogue Resort" className="h-full w-full object-cover" />
                </div>
                <div>
                  <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
                    Lapirogue Operations
                  </h2>
                  <p className="mt-3 text-base uppercase tracking-[0.24em] text-white/85">
                    Guest management control room
                  </p>
                </div>
              </div>

              <p className="max-w-lg text-2xl leading-10 text-white/90 xl:text-[30px] xl:leading-[1.45]">
                A calm command center for guest stays, rooms, reservations, billing, service requests, and staff workflows.
              </p>
            </div>
          </div>
        </section>

        <section className="flex w-full items-center justify-center px-6 py-8 sm:px-10 lg:w-1/2 lg:px-14 xl:px-16">
          <div className="w-full max-w-[420px]">
            <h1 className="mb-5 text-center font-display text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text-primary)] sm:text-[32px]">
              Sign in to your account
            </h1>

            {errorMessage ? (
              <p className="mb-5 text-sm text-red-500" role="alert">{errorMessage}</p>
            ) : null}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-[15px] font-semibold text-[var(--color-text-primary)]" htmlFor="email">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="h-12 w-full rounded-2xl border border-border bg-surface px-4 text-[16px] text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus:border-border focus:ring-4 focus:ring-surface/70 disabled:cursor-not-allowed disabled:bg-surface-secondary"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <label className="block text-[15px] font-semibold text-[var(--color-text-primary)]" htmlFor="password">
                    Password
                  </label>
                </div>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className="h-12 w-full rounded-xl border border-border bg-surface px-4 pr-12 text-[16px] text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus:border-border focus:ring-4 focus:ring-surface-secondary disabled:cursor-not-allowed disabled:bg-surface-secondary [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 pt-1">
                <Link href="/forgot-password" className="text-[15px] font-medium text-[var(--color-link)] transition hover:text-[var(--color-text-secondary)]">
                  Forgot Password?
                </Link>
              </div>

              <button
                type="submit"
                className="btn-primary flex h-12 w-full items-center justify-center px-6 text-[16px] font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}

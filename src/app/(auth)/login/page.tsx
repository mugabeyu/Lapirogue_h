'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

const REMEMBER_EMAIL_KEY = 'login.rememberedEmail';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const rememberedEmail = window.localStorage.getItem(REMEMBER_EMAIL_KEY);

    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

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
          rememberMe,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        setErrorMessage(result?.error || 'Login failed');
        return;
      }

      if (rememberMe) {
        window.localStorage.setItem(REMEMBER_EMAIL_KEY, email);
      } else {
        window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }

      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      setErrorMessage('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-white text-slate-900 lg:flex">
        <section
          className="relative hidden min-h-screen overflow-hidden bg-slate-900 text-white lg:flex lg:w-1/2"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(15, 23, 42, 0.35) 0%, rgba(15, 118, 110, 0.18) 18%, rgba(15, 118, 110, 0.32) 48%, rgba(15, 118, 110, 0.18) 82%, rgba(15, 23, 42, 0.35) 100%), url('/images/homeimage.jpeg')",
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        >
          <div className="absolute inset-0 bg-slate-950/35" />

          <div className="relative z-10 flex w-full items-center px-14 xl:px-20">
            <div className="max-w-xl">
              <div className="mb-8 flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 ring-2 ring-white/30">
                  <img src="/lapiroguelogo.jpg" alt="La Pirogue Resort" className="h-full w-full object-cover" />
                </div>
                <div>
                  <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-white xl:text-4xl">
                    Lapirogue Operations
                  </h2>
                  <p className="mt-2 text-sm uppercase tracking-[0.32em] text-emerald-300/90">
                    Guest management control room
                  </p>
                </div>
              </div>

              <p className="max-w-lg text-lg leading-8 text-white/78 xl:text-xl">
                A calm command center for guest stays, rooms, reservations, billing, service requests, and staff workflows.
              </p>
            </div>
          </div>
        </section>

        <section className="flex w-full items-center justify-center px-6 py-8 sm:px-10 lg:w-1/2 lg:px-14 xl:px-16">
          <div className="w-full max-w-[420px]">
            <h1 className="mb-5 text-center font-display text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-[32px]">
              Sign in to your account
            </h1>

            {errorMessage ? (
              <div
                className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-600 shadow-sm"
                role="alert"
                aria-live="polite"
              >
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-red-500 text-[12px] font-bold">
                  !
                </span>
                <p>{errorMessage}</p>
              </div>
            ) : null}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-[15px] font-semibold text-slate-900" htmlFor="email">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[16px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70 disabled:cursor-not-allowed disabled:bg-slate-50"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <label className="block text-[15px] font-semibold text-slate-900" htmlFor="password">
                    Password
                  </label>
                </div>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-[#FFF7B8] px-4 pr-12 text-[16px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70 disabled:cursor-not-allowed disabled:bg-slate-100 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-600 transition hover:text-slate-900"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 pt-1">
                <label className="flex cursor-pointer items-center gap-3 text-[15px] font-medium text-slate-900">
                  <span className="relative flex h-6 w-6 items-center justify-center">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="peer sr-only"
                      disabled={isLoading}
                    />
                    <span className="absolute inset-0 rounded-md border border-slate-300 bg-white transition peer-checked:border-emerald-600 peer-checked:bg-emerald-600" />
                    <svg
                      viewBox="0 0 24 24"
                      className="relative z-10 hidden h-4 w-4 text-white peer-checked:block"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  Remember me
                </label>

                <Link href="/forgot-password" className="text-[15px] font-medium text-slate-900 transition hover:text-slate-700">
                  Forgot Password?
                </Link>
              </div>

              <button
                type="submit"
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-emerald-950 px-6 text-[16px] font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-70"
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

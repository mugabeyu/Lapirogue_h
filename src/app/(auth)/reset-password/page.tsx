'use client';

import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

function getRecoveryTokensFromHash() {
  if (typeof window === 'undefined') {
    return null;
  }

  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const type = params.get('type');

  if (!accessToken || !refreshToken || type !== 'recovery') {
    return null;
  }

  return { accessToken, refreshToken };
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasSupabaseConfig, setHasSupabaseConfig] = useState(true);
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    let isMounted = true;
    const supabaseClient = getSupabaseBrowserClient();

    if (!supabaseClient) {
      if (isMounted) {
        setHasSupabaseConfig(false);
        setIsReady(false);
      }
      return () => {
        isMounted = false;
      };
    }

    const client = supabaseClient;

    async function initializeAuth() {
      const recoveryTokens = getRecoveryTokensFromHash();

      if (recoveryTokens) {
        const { error } = await client.auth.setSession({
          access_token: recoveryTokens.accessToken,
          refresh_token: recoveryTokens.refreshToken,
        });

        if (error) {
          toast.error(error.message || 'Unable to initialize password recovery session');
          if (isMounted) {
            setIsReady(false);
          }
          return;
        }

        window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
      }

      const { data } = await client.auth.getSession();

      if (isMounted) {
        setIsReady(Boolean(data.session));
      }
    }

    void initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      toast.error('Reset password is unavailable until Supabase public env vars are configured.');
      setIsSubmitting(false);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Passwords do not match');
      setIsSubmitting(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      toast.error('Password recovery session not found. Open the reset link from your email again.');
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });

    if (error) {
      setIsSubmitting(false);
      toast.error(error.message || 'Unable to reset password');
      return;
    }

    await supabase.auth.signOut();

    setIsSubmitting(false);
    toast.success('Password reset successfully');
    setPasswordData({ newPassword: '', confirmPassword: '' });
    router.replace('/login?passwordReset=success');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sand-100">
      <div className="card p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Reset Password</h1>
        {!hasSupabaseConfig ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 mb-4">
            Missing Supabase public configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to use password reset.
          </div>
        ) : !isReady ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 mb-4">
            Open the password reset link from your email first. This page needs the Supabase recovery session from that link.
          </div>
        ) : null}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">New Password</label>
            <input
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              className="input-field w-full"
              minLength={8}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirm Password</label>
            <input
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              className="input-field w-full"
              minLength={8}
              required
            />
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full disabled:opacity-50">
            {isSubmitting ? 'Resetting...' : 'Reset Password'}
          </button>
          <Link href="/login" className="block text-center text-sm text-ink-600 hover:text-ink-900">
            Back to Login
          </Link>
        </form>
      </div>
    </div>
  );
}
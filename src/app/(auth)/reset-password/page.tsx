'use client';

import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase-browser';

export default function ResetPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      await supabaseBrowser.auth.initialize();
      const { data } = await supabaseBrowser.auth.getSession();

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

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Passwords do not match');
      setIsSubmitting(false);
      return;
    }

    const { data: sessionData } = await supabaseBrowser.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      toast.error('Password recovery session not found. Open the reset link from your email again.');
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabaseBrowser.auth.updateUser({ password: passwordData.newPassword });

    if (error) {
      setIsSubmitting(false);
      toast.error(error.message || 'Unable to reset password');
      return;
    }

    const response = await fetch('/api/auth/password-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        newPassword: passwordData.newPassword,
      }),
    });

    setIsSubmitting(false);
    toast[response.ok ? 'success' : 'error'](
      response.ok ? 'Password reset successfully' : 'Unable to reset password'
    );
    
    if (response.ok) {
      setPasswordData({ newPassword: '', confirmPassword: '' });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sand-100">
      <div className="card p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Reset Password</h1>
        {!isReady ? (
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
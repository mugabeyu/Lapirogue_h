'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type StaffOnboarding = {
  id: string;
  email: string;
  full_name: string;
  employee_code: string;
  department: string;
  position: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [staff, setStaff] = useState<StaffOnboarding | null>(null);
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setIsReady(false);
      setStaff(null);
      return;
    }

    let cancelled = false;
    fetch(`/api/staff/onboarding?token=${encodeURIComponent(token)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (!cancelled && result?.success) {
          setStaff(result.data);
          setIsReady(true);
        } else if (!cancelled) {
          setIsReady(false);
          setStaff(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsReady(false);
          setStaff(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = new URLSearchParams(window.location.search).get('token');
    if (!token || !staff) return;

    if (passwordData.password !== passwordData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/staff/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: passwordData.password }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        toast.error(result?.error || 'Registration failed');
        return;
      }

      toast.success('Account setup complete. Please sign in.');
      router.replace('/login?registered=1');
    } catch {
      toast.error('Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isReady && !staff) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-secondary px-4">
        <div className="card w-full max-w-md p-8 text-center">
          <h1 className="mb-4 text-2xl font-bold text-[var(--color-text-primary)]">Invalid Invitation</h1>
          <p className="text-[var(--color-text-secondary)] mb-6">
            This invitation link is invalid or has expired. Please contact your administrator.
          </p>
          <Link href="/login" className="btn-primary">Back to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat px-4 auth-page-bg">
      <div className="absolute inset-0 auth-dark-overlay backdrop-blur-[1px]" />
      <div className="card relative z-10 w-full max-w-md border border-border bg-surface p-8 shadow-2xl backdrop-blur-md">
        <h1 className="mb-2 text-center text-2xl font-bold text-[var(--color-text-primary)]">Complete Staff Registration</h1>
        <p className="mb-6 text-center text-sm text-[var(--color-text-secondary)]">Your invitation details are pre-filled below.</p>

        {staff && (
            <div className="mb-6 rounded-lg bg-slate-50 p-4 text-sm">
            <p><strong>Email:</strong> <span className="text-[var(--color-text-secondary)]">{staff.email}</span></p>
            <p><strong>Name:</strong> <span className="text-[var(--color-text-secondary)]">{staff.full_name}</span></p>
            <p><strong>Employee Code:</strong> <span className="text-[var(--color-text-secondary)]">{staff.employee_code}</span></p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Create Password</label>
            <input
              type="password"
              value={passwordData.password}
              onChange={(event) => setPasswordData({ ...passwordData, password: event.target.value })}
              className="input-field w-full"
              minLength={8}
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Confirm Password</label>
            <input
              type="password"
              value={passwordData.confirmPassword}
              onChange={(event) => setPasswordData({ ...passwordData, confirmPassword: event.target.value })}
              className="input-field w-full"
              minLength={8}
              required
              disabled={isSubmitting}
            />
          </div>

          <button type="submit" className="btn-primary w-full disabled:opacity-50" disabled={isSubmitting}>
            {isSubmitting ? 'Setting up...' : 'Create Password'}
          </button>

          <Link href="/login" className="block text-center text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Back to Login</Link>
        </form>
      </div>
    </div>
  );
}
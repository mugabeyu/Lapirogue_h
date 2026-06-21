'use client';

import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';

const DEFAULT_RESET_MESSAGE = 'If the email exists in the database, a reset link will be sent.';
const DEFAULT_ERROR_MESSAGE = 'Unable to process request. Please try again.';

type StatusType = 'success' | 'error' | '';

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat px-4 auth-page-bg">
      <div className="absolute inset-0 auth-dark-overlay" />
      <div className="card relative z-10 w-full max-w-md p-8">
        {children}
      </div>
    </div>
  );
}

function StatusAlert({ message, type }: { message: string; type: StatusType }) {
  if (!message) {
    return null;
  }

  const colorClass = type === 'error' ? 'text-red-500' : 'text-green-500';

  return (
    <p className={`text-sm ${colorClass}`}>{message}</p>
  );
}

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<StatusType>('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatusMessage('');
    setStatusType('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const message = data.error || 'Unable to process request';
        setStatusMessage(message);
        setStatusType('error');
        toast.error(message);
        return;
      }

      const message = data.message || DEFAULT_RESET_MESSAGE;
      setStatusMessage(message);
      setStatusType('success');
      toast.success(message);
      setSubmitted(true);
    } catch {
      const message = DEFAULT_ERROR_MESSAGE;
      setStatusMessage(message);
      setStatusType('error');
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <PageShell>
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4 text-[var(--color-text-primary)]">Check Your Email</h1>
          <p className="text-[var(--color-text-secondary)] mb-6">
            If an account with that email exists, we've sent a password reset link.
          </p>
          <Link href="/login" className="btn-primary">
            Back to Login
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div>
        <h1 className="text-2xl font-semibold text-center mb-6 text-[var(--color-text-primary)]">Forgot Password</h1>
        <p className="text-[var(--color-text-secondary)] text-center mb-4">
          Enter your email address and we'll send you a reset link.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field w-full"
              placeholder="you@example.com"
              required
            />
          </div>
          <StatusAlert message={statusMessage} type={statusType} />
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full disabled:opacity-50">
            {isSubmitting ? 'Sending...' : 'Send Reset Link'}
          </button>
          <Link href="/login" className="block text-center text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            Back to Login
          </Link>
        </form>
      </div>
    </PageShell>
  );
}


"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type GuestInvitation = {
  id: string;
  guestId: string;
  email: string;
  fullName: string;
  roomNumber?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  alreadyRegistered: boolean;
};

type InvitationMode = 'guest' | 'staff' | null;

export default function RegisterPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingInvite, setIsLoadingInvite] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [guest, setGuest] = useState<GuestInvitation | null>(null);
  const [staffData, setStaffData] = useState<{ email?: string; role?: string } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [completedMessage, setCompletedMessage] = useState("");
  const [mode, setMode] = useState<InvitationMode>(null);
  const [passwordData, setPasswordData] = useState({
    password: "",
    confirmPassword: "",
  });

  function closePage() {
    if (typeof window === "undefined") return;
    window.close();
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const guestId = params.get("guestId");
    const token = params.get("token");
    const role = params.get("role");

    if (!guestId && !token) {
      setIsLoadingInvite(false);
      setIsReady(false);
      setLoadError("This registration link is invalid.");
      return;
    }

    let cancelled = false;

    const loadInvite = async () => {
      try {
        if (guestId) {
          setMode('guest');
          // Guest invitation flow
          const url = `/api/guests/register-account?guestId=${encodeURIComponent(guestId)}`;
          const response = await fetch(url);
          const result = await response.json().catch(() => null);

          if (cancelled) return;

          if (!response.ok || !result?.success) {
            setIsReady(false);
            setGuest(null);
            setLoadError(result?.error || "This registration link is invalid.");
            return;
          }

          setGuest(result.data);
          setLoadError("");
          setIsReady(true);
        } else if (token) {
          setMode('staff');
          // Staff invitation flow — just verify token by calling POST with empty check
          // We store the role from URL for display
          setStaffData({ role: role ?? undefined });
          setIsReady(true);
        }
      } catch {
        if (cancelled) return;
        setIsReady(false);
        setGuest(null);
        setLoadError("Failed to load the registration link.");
      } finally {
        if (!cancelled) {
          setIsLoadingInvite(false);
        }
      }
    };

    void loadInvite();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleGuestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const guestId = new URLSearchParams(window.location.search).get("guestId");
    if (!guestId) return;

    if (passwordData.password !== passwordData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/guests/register-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId, password: passwordData.password }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        toast.error(result?.error || "Registration failed");
        return;
      }

      setCompletedMessage(
        "Guest portal account created successfully. You can now close this page.",
      );
      toast.success("Guest account created successfully.");
    } catch {
      toast.error("Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStaffSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) return;

    if (passwordData.password !== passwordData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/staff/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: passwordData.password }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        toast.error(result?.error || "Registration failed");
        return;
      }

      setCompletedMessage(
        "Staff account created successfully. You can now close this page and sign in.",
      );
      toast.success("Staff account created successfully.");
    } catch {
      toast.error("Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingInvite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-secondary px-4">
        <div className="card w-full max-w-md p-8 text-center">
          <h1 className="mb-4 text-2xl font-semibold text-[var(--color-text-primary)]">Loading...</h1>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-secondary px-4">
        <div className="card w-full max-w-md p-8 text-center">
          <h1 className="mb-4 text-2xl font-semibold text-[var(--color-text-primary)]">
            Invalid Invitation
          </h1>
          <p className="text-[var(--color-text-secondary)] mb-6">
            {loadError || "This invitation link is invalid or has expired."}
          </p>
          <button type="button" onClick={closePage} className="btn-primary">
            Close Page
          </button>
        </div>
      </div>
    );
  }

  if (completedMessage || (guest?.alreadyRegistered)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat px-4 auth-page-bg">
        <div className="absolute inset-0 auth-dark-overlay" />
        <div className="card relative z-10 w-full max-w-md border border-border bg-surface p-8 text-center">
          <h1 className="mb-2 text-2xl font-semibold text-[var(--color-text-primary)]">
            {guest?.alreadyRegistered ? "Guest Already Registered" : "Registration Complete"}
          </h1>
          <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
            {guest?.alreadyRegistered
              ? "This guest invitation has already been used. You can close this page."
              : completedMessage}
          </p>
          <button type="button" onClick={closePage} className="btn-primary w-full">
            Close Page
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'staff') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat px-4 auth-page-bg">
        <div className="absolute inset-0 auth-dark-overlay" />
        <div className="card relative z-10 w-full max-w-md border border-border bg-surface p-8">
          <h1 className="mb-2 text-center text-2xl font-semibold text-[var(--color-text-primary)]">
            Complete Staff Registration
          </h1>
          <p className="mb-6 text-center text-sm text-[var(--color-text-secondary)]">
            {staffData?.role
              ? `You have been invited as a ${staffData.role.charAt(0) + staffData.role.slice(1).toLowerCase()}.`
              : "Set up your staff account."}
          </p>

          <form onSubmit={handleStaffSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Create Password</label>
              <input
                type="password"
                value={passwordData.password}
                onChange={(event) =>
                  setPasswordData({ ...passwordData, password: event.target.value })
                }
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
                onChange={(event) =>
                  setPasswordData({ ...passwordData, confirmPassword: event.target.value })
                }
                className="input-field w-full"
                minLength={8}
                required
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Setting up..." : "Create Password"}
            </button>

            <button
              type="button"
              onClick={closePage}
              className="block w-full text-center text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              Close Page
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Guest registration form
  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat px-4 auth-page-bg">
      <div className="absolute inset-0 auth-dark-overlay" />
      <div className="card relative z-10 w-full max-w-md border border-border bg-surface p-8">
        <h1 className="mb-2 text-center text-2xl font-semibold text-[var(--color-text-primary)]">
          Complete Guest Registration
        </h1>
        <p className="mb-6 text-center text-sm text-[var(--color-text-secondary)]">
          Your invitation details are pre-filled below.
        </p>

        {guest && (
          <div className="mb-6 rounded-xl border border-border bg-surface-secondary p-4 text-sm">
            <p>
              <strong>Email:</strong>{" "}
              <span className="text-[var(--color-text-secondary)]">{guest.email}</span>
            </p>
            <p>
              <strong>Name:</strong>{" "}
              <span className="text-[var(--color-text-secondary)]">{guest.fullName}</span>
            </p>
            <p>
              <strong>Guest ID:</strong>{" "}
              <span className="text-[var(--color-text-secondary)]">{guest.guestId}</span>
            </p>
            {guest.roomNumber ? (
              <p>
                <strong>Room Number:</strong>{" "}
                <span className="text-[var(--color-text-secondary)]">{guest.roomNumber}</span>
              </p>
            ) : null}
          </div>
        )}

        <form onSubmit={handleGuestSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Create Password</label>
            <input
              type="password"
              value={passwordData.password}
              onChange={(event) =>
                setPasswordData({ ...passwordData, password: event.target.value })
              }
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
              onChange={(event) =>
                setPasswordData({ ...passwordData, confirmPassword: event.target.value })
              }
              className="input-field w-full"
              minLength={8}
              required
              disabled={isSubmitting}
            />
          </div>

          <button
            type="submit"
            className="btn-primary w-full disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Setting up..." : "Create Password"}
          </button>

          <button
            type="button"
            onClick={closePage}
            className="block w-full text-center text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            Close Page
          </button>
        </form>
      </div>
    </div>
  );
}

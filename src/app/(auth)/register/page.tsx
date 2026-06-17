"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type StaffOnboarding = {
  id: string;
  email: string;
  full_name: string;
  employee_code: string;
  department: string;
  position: string;
};

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

export default function RegisterPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingInvite, setIsLoadingInvite] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [staff, setStaff] = useState<StaffOnboarding | null>(null);
  const [guest, setGuest] = useState<GuestInvitation | null>(null);
  const [inviteType, setInviteType] = useState<"staff" | "guest" | null>(null);
  const [loadError, setLoadError] = useState("");
  const [completedMessage, setCompletedMessage] = useState("");
  const [passwordData, setPasswordData] = useState({
    password: "",
    confirmPassword: "",
  });

  function closePage() {
    if (typeof window === "undefined") return;
    window.close();
  }

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    const guestId = new URLSearchParams(window.location.search).get("guestId");
    setInviteType(token ? "staff" : guestId ? "guest" : null);

    if (!token && !guestId) {
      setIsLoadingInvite(false);
      setIsReady(false);
      setStaff(null);
      setGuest(null);
      setLoadError("This registration link is invalid.");
      return;
    }

    let cancelled = false;

    const loadInvite = async () => {
      try {
        const url = token
          ? `/api/staff/onboarding?token=${encodeURIComponent(token)}`
          : `/api/guests/register-account?guestId=${encodeURIComponent(guestId ?? "")}`;

        const response = await fetch(url);
        const result = await response.json().catch(() => null);

        if (cancelled) return;

        if (!response.ok || !result?.success) {
          setIsReady(false);
          setStaff(null);
          setGuest(null);
          setLoadError(
            result?.error ||
              (token
                ? "This invitation link is invalid or has expired."
                : "This guest registration link is invalid."),
          );
          return;
        }

        if (token) {
          setStaff(result.data);
          setGuest(null);
        } else {
          setGuest(result.data);
          setStaff(null);
        }

        setLoadError("");
        setIsReady(true);
      } catch {
        if (cancelled) return;
        setIsReady(false);
        setStaff(null);
        setGuest(null);
        setLoadError(
          token
            ? "This invitation link is invalid or has expired."
            : "Failed to load the guest registration link.",
        );
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = new URLSearchParams(window.location.search).get("token");
    const guestId = new URLSearchParams(window.location.search).get("guestId");
    if (!token && !guestId) return;

    if (passwordData.password !== passwordData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        token ? "/api/staff/onboarding" : "/api/guests/register-account",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            token
              ? { token, password: passwordData.password }
              : { guestId, password: passwordData.password },
          ),
        },
      );

      const result = await response.json();

      if (!response.ok || !result?.success) {
        toast.error(result?.error || "Registration failed");
        return;
      }

      if (token) {
        toast.success("Account setup complete. Please sign in.");
        router.replace("/login?registered=1");
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

  if (!isReady || (!staff && !guest)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-secondary px-4">
        <div className="card w-full max-w-md p-8 text-center">
          <h1 className="mb-4 text-2xl font-semibold text-[var(--color-text-primary)]">
            Invalid Invitation
          </h1>
          <p className="text-[var(--color-text-secondary)] mb-6">
            {loadError || "This invitation link is invalid or has expired."}
          </p>
          {inviteType === "guest" ? (
            <button type="button" onClick={closePage} className="btn-primary">
              Close Page
            </button>
          ) : (
            <Link href="/login" className="btn-primary">
              Back to Login
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (
    inviteType === "guest" &&
    (guest?.alreadyRegistered || completedMessage)
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat px-4 auth-page-bg">
        <div className="absolute inset-0 auth-dark-overlay" />
        <div className="card relative z-10 w-full max-w-md border border-border bg-surface p-8 text-center">
          <h1 className="mb-2 text-2xl font-semibold text-[var(--color-text-primary)]">
            {guest?.alreadyRegistered
              ? "Guest Already Registered"
              : "Registration Complete"}
          </h1>
          <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
            {guest?.alreadyRegistered
              ? "This guest invitation has already been used. You can close this page."
              : completedMessage}
          </p>
          <button
            type="button"
            onClick={closePage}
            className="btn-primary w-full"
          >
            Close Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat px-4 auth-page-bg">
      <div className="absolute inset-0 auth-dark-overlay" />
      <div className="card relative z-10 w-full max-w-md border border-border bg-surface p-8">
        <h1 className="mb-2 text-center text-2xl font-semibold text-[var(--color-text-primary)]">
          {inviteType === "guest"
            ? "Complete Guest Registration"
            : "Complete Staff Registration"}
        </h1>
        <p className="mb-6 text-center text-sm text-[var(--color-text-secondary)]">
          Your invitation details are pre-filled below.
        </p>

        {staff && (
          <div className="mb-6 rounded-xl border border-border bg-surface-secondary p-4 text-sm">
            <p>
              <strong>Email:</strong>{" "}
              <span className="text-[var(--color-text-secondary)]">
                {staff.email}
              </span>
            </p>
            <p>
              <strong>Name:</strong>{" "}
              <span className="text-[var(--color-text-secondary)]">
                {staff.full_name}
              </span>
            </p>
            <p>
              <strong>Employee Code:</strong>{" "}
              <span className="text-[var(--color-text-secondary)]">
                {staff.employee_code}
              </span>
            </p>
          </div>
        )}

        {guest && (
          <div className="mb-6 rounded-xl border border-border bg-surface-secondary p-4 text-sm">
            <p>
              <strong>Email:</strong>{" "}
              <span className="text-[var(--color-text-secondary)]">
                {guest.email}
              </span>
            </p>
            <p>
              <strong>Name:</strong>{" "}
              <span className="text-[var(--color-text-secondary)]">
                {guest.fullName}
              </span>
            </p>
            <p>
              <strong>Guest ID:</strong>{" "}
              <span className="text-[var(--color-text-secondary)]">
                {guest.guestId}
              </span>
            </p>
            {guest.roomNumber ? (
              <p>
                <strong>Room Number:</strong>{" "}
                <span className="text-[var(--color-text-secondary)]">
                  {guest.roomNumber}
                </span>
              </p>
            ) : null}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Create Password
            </label>
            <input
              type="password"
              value={passwordData.password}
              onChange={(event) =>
                setPasswordData({
                  ...passwordData,
                  password: event.target.value,
                })
              }
              className="input-field w-full"
              minLength={8}
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Confirm Password
            </label>
            <input
              type="password"
              value={passwordData.confirmPassword}
              onChange={(event) =>
                setPasswordData({
                  ...passwordData,
                  confirmPassword: event.target.value,
                })
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

          {inviteType === "guest" ? (
            <button
              type="button"
              onClick={closePage}
              className="block w-full text-center text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              Close Page
            </button>
          ) : (
            <Link
              href="/login"
              className="block text-center text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              Back to Login
            </Link>
          )}
        </form>
      </div>
    </div>
  );
}

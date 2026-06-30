'use client';

import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useApi } from '@/hooks/useApi';
import { formatInternationalPhoneDisplay } from '@/lib/phone';
import { ImageUploadField } from '@/components/ui/ImageUploadField';
import { deleteStoredImage, uploadProfileAvatar } from '@/lib/upload-image';
import { User } from '@/types';

type SettingsTab = 'profile' | 'security';

type AuthMeResponse = {
  success: boolean;
  data: User;
};

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
];

export default function SettingsPageContent() {
  const { data: user, mutate } = useApi<User>('/api/auth/me');
  const isManager = user?.role === 'MANAGER';
  const isStaff = user?.role === 'MANAGER' || user?.role === 'RECEPTIONIST';
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    homeAddress: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (!user) return;
    setAvatarUrl(user.avatarUrl ?? null);
    setProfileForm({
      fullName: user.name || '',
      email: user.email || '',
      phone: formatInternationalPhoneDisplay(user.phone || ''),
      homeAddress: user.homeAddress || '',
    });
  }, [user]);

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    const response = await fetch('/api/settings/profile', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: profileForm.fullName,
        email: profileForm.email,
        phone: profileForm.phone || null,
        homeAddress: profileForm.homeAddress || null,
        avatarUrl,
      }),
    });

    setIsSaving(false);
    if (response.ok) {
      toast.success('Profile saved');
      const payload = await response.json().catch(() => null);
      if (payload?.success && payload.data) {
        try {
          await mutate({ success: true, data: payload.data } satisfies AuthMeResponse, false);
        } catch {
          await mutate();
        }
      } else {
        await mutate();
      }
    } else {
      const payload = await response.json().catch(() => null);
      console.error('Profile save failed. Request body:', JSON.stringify({ fullName: profileForm.fullName, email: profileForm.email, phone: profileForm.phone, homeAddress: profileForm.homeAddress, avatarUrl }));
      if (payload?.details) {
        console.error('Profile save validation errors:', JSON.stringify(payload.details, null, 2));
      }
      toast.error(payload?.error || 'Unable to update profile');
    }
  }

  async function handlePasswordSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsSaving(true);
    const response = await fetch('/api/settings/password', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      }),
    });

    setIsSaving(false);
    toast[response.ok ? 'success' : 'error'](response.ok ? 'Password updated' : 'Unable to update password');
    if (response.ok) {
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    }
  }

  async function handleAvatarUpload(file: File) {
    if (!user?.id) return;
    const previousAvatarUrl = avatarUrl ?? user.avatarUrl ?? null;
    const url = await uploadProfileAvatar({
      file,
      userId: user.id,
    });
    setAvatarUrl(url);

    const body = {
      fullName: profileForm.fullName || null,
      email: profileForm.email || user.email,
      phone: profileForm.phone || null,
      homeAddress: profileForm.homeAddress || null,
      avatarUrl: url,
    };

    const response = await fetch('/api/settings/profile', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      setAvatarUrl(previousAvatarUrl);
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error ?? 'Unable to save avatar');
    }

    const payload = await response.json().catch(() => null);
    if (payload?.success && payload.data) {
      try {
        await mutate({ success: true, data: payload.data } satisfies AuthMeResponse, false);
      } catch {
        // ignore mutate errors
      }
    }

    if (previousAvatarUrl && previousAvatarUrl !== url) {
      try {
        await deleteStoredImage({ bucket: 'staff-avatars', publicUrl: previousAvatarUrl });
      } catch {
        toast.warning('Profile picture updated, but the previous image could not be removed');
      }
    }

    toast.success('Profile picture updated');
    await mutate();
    await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' });
  }

  const tabTitle = activeTab === 'profile' ? 'Profile Settings' : 'Security Settings';

  return (
    <div className="animate-in fade-in duration-500">
      <h1 className="font-display text-4xl text-[var(--color-text-primary)]">Settings</h1>

      <div className="mt-10 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="space-y-1 text-sm">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`block w-full rounded-lg px-1 py-2 text-left transition-colors ${
                activeTab === tab.id ? 'font-semibold text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <section className="rounded-[28px] border border-border bg-surface px-6 py-10 shadow-sm sm:px-10">
          <h2 className="text-center font-display text-3xl text-[var(--color-text-primary)]">{tabTitle}</h2>

          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSave} className="mx-auto mt-8 max-w-lg space-y-6">
              <div className="flex justify-center">
                <ImageUploadField
                  label="Profile picture"
                  shape="circle"
                  previewUrl={avatarUrl}
                  onFileSelect={handleAvatarUpload}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Full name</label>
                <input
                  type="text"
                  value={profileForm.fullName}
                  onChange={(event) => setProfileForm({ ...profileForm, fullName: event.target.value })}
                  className="input-field w-full"
                  required
                  readOnly={isStaff}
                  tabIndex={isStaff ? -1 : undefined}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Email</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(event) => setProfileForm({ ...profileForm, email: event.target.value })}
                  className="input-field w-full"
                  required
                  readOnly={isStaff}
                  tabIndex={isStaff ? -1 : undefined}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Phone</label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(event) => setProfileForm({ ...profileForm, phone: formatInternationalPhoneDisplay(event.target.value) })}
                  className="input-field w-full"
                  placeholder="(+230) 1234 5678"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Home Address</label>
                <input
                  type="text"
                  value={profileForm.homeAddress}
                  onChange={(event) => setProfileForm({ ...profileForm, homeAddress: event.target.value })}
                  className="input-field w-full"
                  placeholder="Enter your home address"
                />
              </div>
              <div className="flex justify-center pt-2">
                <button type="submit" disabled={isSaving} className="btn-primary min-w-40 disabled:opacity-50">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handlePasswordSave} className="mx-auto mt-8 max-w-lg space-y-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Current password</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(event) => setPasswordData({ ...passwordData, currentPassword: event.target.value })}
                  className="input-field w-full"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">New password</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(event) => setPasswordData({ ...passwordData, newPassword: event.target.value })}
                  className="input-field w-full"
                  minLength={8}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Confirm new password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(event) => setPasswordData({ ...passwordData, confirmPassword: event.target.value })}
                  className="input-field w-full"
                  minLength={8}
                  required
                />
              </div>
              <div className="flex justify-center pt-2">
                <button type="submit" disabled={isSaving} className="btn-primary min-w-40 disabled:opacity-50">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

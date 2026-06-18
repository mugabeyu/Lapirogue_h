'use client';

import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useApi } from '@/hooks/useApi';
import { formatInternationalPhoneDisplay } from '@/lib/phone';
import { ImageUploadField } from '@/components/ui/ImageUploadField';
import { deleteStoredImage, uploadImage, uploadProfileAvatar } from '@/lib/upload-image';
import { User } from '@/types';

type SettingsTab = 'profile' | 'security' | 'hotel';

type AboutContentForm = {
  title: string;
  subtitle: string;
  body: string;
  highlightsText: string;
  metricsText: string;
  imagePath: string;
};

type AuthMeResponse = {
  success: boolean;
  data: User;
};

type AboutMetric = {
  label?: string;
  value?: string;
};

async function readErrorMessage(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  if (payload?.error && typeof payload.error === 'string') return payload.error;
  return fallback;
}

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
  { id: 'hotel', label: 'Hotel Info' },
];

export default function SettingsPageContent() {
  const { data: user, mutate } = useApi<User>('/api/auth/me');
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    email: '',
    phone: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [aboutData, setAboutData] = useState<AboutContentForm>({
    title: '',
    subtitle: '',
    body: '',
    highlightsText: '',
    metricsText: '',
    imagePath: '',
  });

useEffect(() => {
    async function loadAboutContent() {
      try {
        const response = await fetch('/api/content/about', { credentials: 'include' });
        if (!response.ok) {
          const message = await readErrorMessage(response, 'Unable to load hotel info');
          toast.error(message);
          return;
        }

        const payload = await response.json();
        const data = payload.data;
        if (!data) return;

        setAboutData({
          title: data.title ?? '',
          subtitle: data.subtitle ?? '',
          body: data.body ?? '',
          highlightsText: Array.isArray(data.highlights) ? data.highlights.join('\n') : '',
          metricsText: Array.isArray(data.metrics)
            ? data.metrics
                .map((metric: AboutMetric) => `${metric.label ?? ''}|${metric.value ?? ''}`)
                .join('\n')
            : '',
          imagePath: data.image_path ?? '',
        });
      } catch {
        toast.error('Unable to load hotel info');
      }
    }

    loadAboutContent();
  }, []);

  useEffect(() => {
    if (!user) return;
    setAvatarUrl(user.avatarUrl ?? null);
    setProfileForm({
      fullName: user.name || '',
      email: user.email || '',
      phone: formatInternationalPhoneDisplay(user.phone || ''),
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
        avatarUrl,
      }),
    });

    setIsSaving(false);
    toast[response.ok ? 'success' : 'error'](response.ok ? 'Profile saved' : 'Unable to update profile');
    if (response.ok) {
      const payload = await response.json().catch(() => null);
      if (payload?.success && payload.data) {
        try {
          // Update the /api/auth/me cache immediately so Topbar reflects changes
          await mutate({ success: true, data: payload.data } satisfies AuthMeResponse, false);
        } catch {
          // fallback to revalidation
          await mutate();
        }
      } else {
        await mutate();
      }
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

    // Prefer the explicit fullName entered in the form. Do not send the
    // email as the `fullName` value — let the server keep it null if no name
    // is available so it doesn't get stored as the display name.
    const body = {
      fullName: profileForm.fullName || null,
      email: profileForm.email || user.email,
      phone: profileForm.phone || null,
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

    // Update SWR cache immediately with the returned profile so UI updates without waiting
    const payload = await response.json().catch(() => null);
    if (payload?.success && payload.data) {
      // mutate the /api/auth/me cache with the new data (no revalidation)
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
    // Ensure client session is refreshed immediately after updating avatar
    await mutate();
    // Also refetch auth/me explicitly to ensure other components update
    await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' });
  }

  async function handleAboutImageUpload(file: File) {
    const url = await uploadImage({
      file,
      bucket: 'content-images',
      id: 'about',
      target: 'about',
    });
    if (!url) throw new Error('Upload failed');
    setAboutData((current) => ({ ...current, imagePath: url }));
    toast.success('Hotel image uploaded');
  }

async function handleHotelSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    const highlights = aboutData.highlightsText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    const metrics = aboutData.metricsText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [label, value] = item.split('|').map((part) => part.trim());
        return { label, value };
      })
      .filter((item) => item.label && item.value);

    const response = await fetch('/api/content/about', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: aboutData.title,
        subtitle: aboutData.subtitle,
        body: aboutData.body,
        highlights,
        metrics,
        imagePath: aboutData.imagePath || null,
      }),
    });

    setIsSaving(false);
    if (response.ok) {
      toast.success('Hotel info saved');
      return;
    }

    toast.error(await readErrorMessage(response, 'Unable to save hotel info'));
  }

  const tabTitle =
    activeTab === 'profile' ? 'Profile Settings' : activeTab === 'security' ? 'Security Settings' : 'Hotel Info';

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

          {activeTab === 'hotel' && (
            <form onSubmit={handleHotelSave} className="mx-auto mt-8 max-w-2xl space-y-6">
              <ImageUploadField
                label="Hotel hero image"
                previewUrl={aboutData.imagePath}
                onFileSelect={handleAboutImageUpload}
                hint="Shown on the public about page"
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Title</label>
                <input
                  type="text"
                  value={aboutData.title}
                  onChange={(event) => setAboutData({ ...aboutData, title: event.target.value })}
                  className="input-field w-full"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Subtitle</label>
                <input
                  type="text"
                  value={aboutData.subtitle}
                  onChange={(event) => setAboutData({ ...aboutData, subtitle: event.target.value })}
                  className="input-field w-full"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">About text</label>
                <textarea
                  value={aboutData.body}
                  onChange={(event) => setAboutData({ ...aboutData, body: event.target.value })}
                  className="input-field min-h-36 w-full"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Highlights</label>
                <textarea
                  value={aboutData.highlightsText}
                  onChange={(event) => setAboutData({ ...aboutData, highlightsText: event.target.value })}
                  className="input-field min-h-28 w-full"
                  placeholder="One highlight per line"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Metrics</label>
                <textarea
                  value={aboutData.metricsText}
                  onChange={(event) => setAboutData({ ...aboutData, metricsText: event.target.value })}
                  className="input-field min-h-28 w-full"
                  placeholder="Label|Value per line"
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

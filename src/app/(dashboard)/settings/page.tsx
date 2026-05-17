'use client';

import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useApi } from '@/hooks/useApi';
import { User } from '@/types';

type AboutContentForm = {
  title: string;
  subtitle: string;
  body: string;
  highlightsText: string;
  metricsText: string;
  imagePath: string;
};

export default function SettingsPage() {
  const { data: user, mutate } = useApi<User>('/api/auth/me');
  const [isSaving, setIsSaving] = useState(false);
  const [isContentSaving, setIsContentSaving] = useState(false);
  const [formData, setFormData] = useState({
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
      const response = await fetch('/api/content/about');
      if (!response.ok) return;

      const payload = await response.json();
      const data = payload.data;
      if (!data) return;

      setAboutData({
        title: data.title ?? '',
        subtitle: data.subtitle ?? '',
        body: data.body ?? '',
        highlightsText: Array.isArray(data.highlights) ? data.highlights.join('\n') : '',
        metricsText: Array.isArray(data.metrics)
          ? data.metrics.map((metric: { label?: string; value?: string }) => `${metric.label ?? ''}|${metric.value ?? ''}`).join('\n')
          : '',
        imagePath: data.image_path ?? '',
      });
    }

    loadAboutContent();
  }, []);

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.name || '',
        email: user.email || '',
        phone: '',
      });
    }
  }, [user]);

  async function handleProfileUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    const response = await fetch('/api/settings/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    setIsSaving(false);
    toast[response.ok ? 'success' : 'error'](response.ok ? 'Profile updated' : 'Unable to update profile');
    if (response.ok) mutate();
  }

  async function handlePasswordUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsSaving(true);
    const response = await fetch('/api/settings/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      }),
    });

    setIsSaving(false);
    toast[response.ok ? 'success' : 'error'](response.ok ? 'Password updated' : 'Unable to update password');
    if (response.ok) {
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', 'content-images');
    formData.append('id', 'about');

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      toast.success('Profile picture updated');
      const payload = await response.json();
      setAboutData((current) => ({ ...current, imagePath: payload.data?.publicUrl ?? current.imagePath }));
    } else {
      toast.error('Unable to upload profile picture');
    }
  }

  async function handleAboutSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsContentSaving(true);

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: aboutData.title,
        subtitle: aboutData.subtitle,
        body: aboutData.body,
        highlights,
        metrics,
        imagePath: aboutData.imagePath,
      }),
    });

    setIsContentSaving(false);
    toast[response.ok ? 'success' : 'error'](response.ok ? 'About content updated' : 'Unable to update about content');
  }

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-500">
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">Update Profile</h2>
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full Name</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="input-field w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input-field w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone Number</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input-field w-full"
            />
          </div>
          <button type="submit" disabled={isSaving} className="btn-primary disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">Update Password</h2>
        <form onSubmit={handlePasswordUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Current Password</label>
            <input
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              className="input-field w-full"
              required
            />
          </div>
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
            <label className="block text-sm font-medium mb-1">Confirm New Password</label>
            <input
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              className="input-field w-full"
              minLength={8}
              required
            />
          </div>
          <button type="submit" disabled={isSaving} className="btn-primary disabled:opacity-50">
            {isSaving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">Profile Picture</h2>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-sand-200">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <label className="btn-secondary cursor-pointer">
            Change Picture
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">About Page Content</h2>
        <form onSubmit={handleAboutSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={aboutData.title}
              onChange={(e) => setAboutData({ ...aboutData, title: e.target.value })}
              className="input-field w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Subtitle</label>
            <input
              type="text"
              value={aboutData.subtitle}
              onChange={(e) => setAboutData({ ...aboutData, subtitle: e.target.value })}
              className="input-field w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Body</label>
            <textarea
              value={aboutData.body}
              onChange={(e) => setAboutData({ ...aboutData, body: e.target.value })}
              className="input-field w-full min-h-40"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Highlights</label>
            <textarea
              value={aboutData.highlightsText}
              onChange={(e) => setAboutData({ ...aboutData, highlightsText: e.target.value })}
              className="input-field w-full min-h-32"
              placeholder="One highlight per line"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Metrics</label>
            <textarea
              value={aboutData.metricsText}
              onChange={(e) => setAboutData({ ...aboutData, metricsText: e.target.value })}
              className="input-field w-full min-h-32"
              placeholder="Label|Value per line"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="btn-secondary inline-flex w-fit cursor-pointer">
              Upload About Image
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
            {aboutData.imagePath ? <span className="break-all text-sm text-ink-600">{aboutData.imagePath}</span> : null}
          </div>
          <button type="submit" disabled={isContentSaving} className="btn-primary disabled:opacity-50">
            {isContentSaving ? 'Saving...' : 'Save About Content'}
          </button>
        </form>
      </div>
    </div>
  );
}

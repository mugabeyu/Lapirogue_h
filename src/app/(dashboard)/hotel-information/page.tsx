'use client';

import { FormEvent, useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import { useApi } from '@/hooks/useApi';
import { ImageUploadField } from '@/components/ui/ImageUploadField';
import { uploadImage } from '@/lib/upload-image';
import { toast } from 'sonner';
import type { User } from '@/types';

type AboutContentForm = {
  title: string;
  subtitle: string;
  body: string;
  imagePath: string;
};

async function readErrorMessage(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  if (payload?.error && typeof payload.error === 'string') return payload.error;
  return fallback;
}

export default function HotelInformationPage() {
  const { data: currentUser } = useApi<User>('/api/auth/me');
  const [isSaving, setIsSaving] = useState(false);
  const [aboutData, setAboutData] = useState<AboutContentForm>({
    title: '',
    subtitle: '',
    body: '',
    imagePath: '',
  });

  const isManager = currentUser?.role === 'MANAGER';

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
          imagePath: data.image_path ?? '',
        });
      } catch {
        toast.error('Unable to load hotel info');
      }
    }

    loadAboutContent();
  }, []);

  async function handleAboutImageUpload(file: File) {
    const url = await uploadImage({
      file,
      bucket: 'content-images',
      id: 'about',
      target: 'about',
    });
    if (!url) {
      toast.error('Image upload failed');
      return;
    }
    setAboutData((current) => ({ ...current, imagePath: url }));
    toast.success('Hotel image uploaded');
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    const response = await fetch('/api/content/about', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: aboutData.title,
        subtitle: aboutData.subtitle,
        body: aboutData.body,
        imagePath: aboutData.imagePath || null,
      }),
    });

    setIsSaving(false);

    if (response.ok) {
      toast.success('Hotel info saved');
    } else {
      toast.error(await readErrorMessage(response, 'Unable to save hotel info'));
    }
  }

  if (!currentUser) {
    return (
      <div className="animate-in fade-in duration-500">
        <div className="card p-12 text-center">
          <p className="text-[var(--color-text-secondary)]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader
        title="Hotel Information"
        subtitle="Update hotel descriptions, services, and policies."
      />

      <form onSubmit={handleSave} className="mx-auto mt-8 max-w-2xl space-y-6">
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
            readOnly={!isManager}
            tabIndex={isManager ? undefined : -1}
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
            readOnly={!isManager}
            tabIndex={isManager ? undefined : -1}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">About text</label>
          <textarea
            value={aboutData.body}
            onChange={(event) => setAboutData({ ...aboutData, body: event.target.value })}
            className="input-field min-h-36 w-full"
            required
            readOnly={!isManager}
            tabIndex={isManager ? undefined : -1}
          />
        </div>
        {isManager && (
          <div className="flex justify-center pt-2">
            <button type="submit" disabled={isSaving} className="btn-primary min-w-40 disabled:opacity-50">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

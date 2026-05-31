'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { CloudUpload } from 'lucide-react';
import { toast } from 'sonner';

type ImageUploadFieldProps = {
  label: string;
  hint?: string;
  previewUrl?: string | null;
  onFileSelect: (file: File) => void | Promise<void>;
  shape?: 'circle' | 'rectangle';
  accept?: string;
  disabled?: boolean;
};

export function ImageUploadField({
  label,
  hint,
  previewUrl,
  onFileSelect,
  shape = 'rectangle',
  accept = 'image/jpeg,image/png,image/webp',
  disabled = false,
}: ImageUploadFieldProps) {
  const [preview, setPreview] = useState<string | null>(previewUrl ?? null);

  useEffect(() => {
    setPreview(previewUrl ?? null);
  }, [previewUrl]);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5MB or smaller');
      event.target.value = '';
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    try {
      await onFileSelect(file);
    } catch (error) {
      setPreview(previewUrl ?? null);
      URL.revokeObjectURL(localPreview);
      toast.error(error instanceof Error ? error.message : 'Unable to upload image');
    } finally {
      event.target.value = '';
    }
  }

  const frameClass = shape === 'circle' ? 'h-28 w-28 rounded-full' : 'h-40 w-full rounded-xl';

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">{label}</label>
      <label
        className={`relative flex cursor-pointer items-center justify-center overflow-hidden border border-dashed border-border bg-surface-secondary transition-colors hover:border-primary/40 hover:bg-primary/5 ${frameClass} ${
          disabled ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 px-3 text-center text-[var(--color-text-secondary)]">
            <CloudUpload className="h-6 w-6" />
            <span className="text-xs font-medium">Click to upload</span>
          </div>
        )}
        <input type="file" accept={accept} className="hidden" onChange={handleChange} disabled={disabled} />
      </label>
      {hint ? <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{hint}</p> : null}
    </div>
  );
}

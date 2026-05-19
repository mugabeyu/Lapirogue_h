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
  accept = 'image/*',
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
      return;
    }

    setPreview(URL.createObjectURL(file));

    try {
      await onFileSelect(file);
    } catch {
      toast.error('Unable to upload image');
    }
  }

  const frameClass = shape === 'circle' ? 'h-24 w-24 rounded-full' : 'h-40 w-full rounded-xl';

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-ink-700">{label}</label>
      <label
        className={`relative flex cursor-pointer items-center justify-center overflow-hidden border border-dashed border-sand-300 bg-sand-50 transition-colors hover:border-primary/40 hover:bg-primary/5 ${frameClass} ${
          disabled ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 px-3 text-center text-ink-500">
            <CloudUpload className="h-6 w-6" />
            <span className="text-xs font-medium">Click to upload</span>
          </div>
        )}
        <input type="file" accept={accept} className="hidden" onChange={handleChange} disabled={disabled} />
      </label>
      {hint ? <p className="mt-2 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

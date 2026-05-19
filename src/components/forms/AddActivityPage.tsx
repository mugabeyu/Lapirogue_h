'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, useState } from 'react';
import { CloudUpload } from 'lucide-react';
import { toast } from 'sonner';
import { ACTIVITY_CATEGORIES } from '@/lib/activities';

function parseCapacityLabel(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes('unlimited')) return 99;
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : 10;
}

export default function AddActivityPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>(ACTIVITY_CATEGORIES[1]);
  const [price, setPrice] = useState(0);
  const [description, setDescription] = useState('');
  const [durationLabel, setDurationLabel] = useState('');
  const [capacityLabel, setCapacityLabel] = useState('');
  const [meetingPoint, setMeetingPoint] = useState('');
  const [requiresAdvanceBooking, setRequiresAdvanceBooking] = useState(false);
  const [weatherDependent, setWeatherDependent] = useState(false);
  const [suitableForChildren, setSuitableForChildren] = useState(false);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5MB or smaller');
      return;
    }
    setImageFile(file);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error('Activity title is required');
      return;
    }

    setIsSaving(true);

    const response = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        category,
        description: description.trim() || undefined,
        price: Number(price) || 0,
        durationLabel: durationLabel.trim() || '1 Hour',
        capacity: parseCapacityLabel(capacityLabel || '10'),
        meetingPoint: meetingPoint.trim() || undefined,
        requiresAdvanceBooking,
        weatherDependent,
        suitableForChildren,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setIsSaving(false);
      toast.error(payload.error ?? 'Unable to save activity');
      return;
    }

    const activityId = payload.data?.id as string | undefined;
    let imagePath = payload.data?.imagePath as string | undefined;

    if (imageFile && activityId) {
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('bucket', 'activity-images');
      formData.append('id', activityId);

      const uploadResponse = await fetch('/api/upload', { method: 'POST', body: formData });
      if (uploadResponse.ok) {
        const uploadPayload = await uploadResponse.json();
        imagePath = uploadPayload.data?.publicUrl;
        await fetch('/api/activities', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: activityId,
            name: name.trim(),
            category,
            description: description.trim() || undefined,
            price: Number(price) || 0,
            durationLabel: durationLabel.trim() || '1 Hour',
            capacity: parseCapacityLabel(capacityLabel || '10'),
            meetingPoint: meetingPoint.trim() || undefined,
            requiresAdvanceBooking,
            weatherDependent,
            suitableForChildren,
            imagePath,
          }),
        });
      }
    }

    setIsSaving(false);
    toast.success('Activity saved');
    router.push('/activities');
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h1 className="font-display text-3xl font-semibold text-ink-900">Add New Activity</h1>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 font-display text-xl font-semibold text-ink-900">Activity Details</h2>
            <div className="space-y-5">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink-700">Activity Title</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="input-field"
                  placeholder="e.g. Catamaran Cruise to Île aux Cerfs"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-ink-700">Category</span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="input-field"
                  >
                    {ACTIVITY_CATEGORIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-ink-700">Price (Rs)</span>
                  <input
                    type="number"
                    min={0}
                    value={price}
                    onChange={(event) => setPrice(Number(event.target.value))}
                    className="input-field"
                    placeholder="0 for complimentary"
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink-700">Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="input-field min-h-32"
                  placeholder="Describe the activity, what's included, and what guests should expect..."
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-ink-700">Duration</span>
                  <input
                    value={durationLabel}
                    onChange={(event) => setDurationLabel(event.target.value)}
                    className="input-field"
                    placeholder="e.g. 3 Hours, Full Day"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-ink-700">Maximum Capacity</span>
                  <input
                    value={capacityLabel}
                    onChange={(event) => setCapacityLabel(event.target.value)}
                    className="input-field"
                    placeholder="e.g. 12 max, Unlimited"
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink-700">Meeting Point / Location</span>
                <input
                  value={meetingPoint}
                  onChange={(event) => setMeetingPoint(event.target.value)}
                  className="input-field"
                  placeholder="e.g. Hotel Lobby, Beach Hut"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-xl font-semibold text-ink-900">Schedule & Requirements</h2>
            <p className="mt-2 text-sm text-ink-500">
              Scheduling functionality will be configured after creating the activity profile.
            </p>
            <div className="mt-5 space-y-3">
              <label className="flex items-center gap-3 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={requiresAdvanceBooking}
                  onChange={(event) => setRequiresAdvanceBooking(event.target.checked)}
                  className="h-4 w-4 rounded border-sand-300 text-primary focus:ring-primary"
                />
                Requires advance booking (24h)
              </label>
              <label className="flex items-center gap-3 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={weatherDependent}
                  onChange={(event) => setWeatherDependent(event.target.checked)}
                  className="h-4 w-4 rounded border-sand-300 text-primary focus:ring-primary"
                />
                Weather dependent (may be cancelled)
              </label>
              <label className="flex items-center gap-3 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={suitableForChildren}
                  onChange={(event) => setSuitableForChildren(event.target.checked)}
                  className="h-4 w-4 rounded border-sand-300 text-primary focus:ring-primary"
                />
                Suitable for children
              </label>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-display text-lg font-semibold text-ink-900">Activity Image</h2>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-sand-300 bg-sand-50/50 px-4 py-10 text-center transition-colors hover:border-primary/40 hover:bg-sand-50">
              <CloudUpload className="mb-3 h-8 w-8 text-ink-400" />
              <span className="text-sm font-semibold text-ink-800">Click to upload or drag and drop</span>
              <span className="mt-1 text-xs text-ink-500">SVG, PNG, JPG or GIF (max. 5MB)</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
            {imageFile && (
              <p className="mt-3 text-center text-xs text-ink-500">{imageFile.name}</p>
            )}
          </section>

          <div className="flex gap-3">
            <Link href="/activities" className="btn-secondary flex-1 text-center">
              Cancel
            </Link>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Activity'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

export type UploadBucket =
  | 'room-images'
  | 'activity-images'
  | 'menu-images'
  | 'staff-avatars'
  | 'content-images'
  | 'chat_uploads'
  | 'guest-photos'
  | 'guest-documents';

export type UploadTarget = 'room' | 'activity' | 'menu-item' | 'staff' | 'profile' | 'about' | 'guest' | 'message';

type UploadImageOptions = {
  file: File;
  bucket: UploadBucket;
  id: string;
  target?: UploadTarget;
};

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function assertUploadFile(file: File) {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    throw new Error('Only JPEG, PNG, and WebP images are supported');
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('Image must be 5MB or smaller');
  }
}

function sanitizePathSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'file';
}

function getFileExtension(file: File) {
  if (file.type === 'image/jpeg') return 'jpg';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';

  const extension = file.name.split('.').pop()?.trim().toLowerCase();
  return extension || 'img';
}

function createStoragePath(bucket: UploadBucket, id: string, file: File, target?: UploadTarget) {
  const scope = sanitizePathSegment(target ?? bucket);
  const resourceId = sanitizePathSegment(id);
  const extension = getFileExtension(file);
  const filename = sanitizePathSegment(file.name).slice(0, 48) || 'image';
  return `${scope}/${resourceId}/${Date.now()}-${filename}.${extension}`;
}

function extractStoragePathFromPublicUrl(url: string | null | undefined, bucket: UploadBucket) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const path = url.slice(index + marker.length);
  return path ? decodeURIComponent(path) : null;
}

async function ensureAuthenticatedClient() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase browser client is not configured');
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Please sign in again before uploading an image');
  }

  return supabase;
}

async function uploadAuthenticatedImage({ file, bucket, id, target }: UploadImageOptions) {
  assertUploadFile(file);

  const supabase = await ensureAuthenticatedClient();
  const path = createStoragePath(bucket, id, file, target);
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message || 'Failed to upload image');
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return {
    bucket,
    path,
    publicUrl: data.publicUrl,
  };
}

export async function uploadImage({ file, bucket, id, target }: UploadImageOptions) {
  const result = await uploadAuthenticatedImage({ file, bucket, id, target });
  return result.publicUrl;
}

export async function uploadProfileAvatar({
  file,
  userId,
}: {
  file: File;
  userId: string;
}) {
  const result = await uploadAuthenticatedImage({ file, bucket: 'staff-avatars', id: userId, target: 'profile' });
  return result.publicUrl;
}

export async function deleteStoredImage({
  bucket,
  publicUrl,
}: {
  bucket: UploadBucket;
  publicUrl?: string | null;
}) {
  const supabase = await ensureAuthenticatedClient();
  const path = extractStoragePathFromPublicUrl(publicUrl, bucket);

  if (!path) return false;

  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    throw new Error(error.message || 'Failed to remove previous image');
  }

  return true;
}

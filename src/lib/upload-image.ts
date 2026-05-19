export type UploadBucket =
  | 'room-images'
  | 'activity-images'
  | 'menu-images'
  | 'staff-avatars'
  | 'content-images'
  | 'chat_uploads'
  | 'guest-documents';

export type UploadTarget = 'room' | 'activity' | 'menu-item' | 'staff' | 'profile' | 'about' | 'guest' | 'message';

type UploadImageOptions = {
  file: File;
  bucket: UploadBucket;
  id: string;
  target?: UploadTarget;
};

export async function uploadImage({ file, bucket, id, target }: UploadImageOptions) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('bucket', bucket);
  formData.append('id', id);
  if (target) formData.append('target', target);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? 'Upload failed');
  }

  return payload.data?.publicUrl as string | undefined;
}

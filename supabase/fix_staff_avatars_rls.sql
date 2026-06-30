-- Fix staff-avatars RLS to allow RECEPTIONIST to upload their own avatar
-- The v2 migration only allowed ADMIN and MANAGER, blocking receptionists.

DROP POLICY IF EXISTS "Staff avatars admin_manager" ON storage.objects;

CREATE POLICY "Staff avatars admin_manager" ON storage.objects FOR ALL USING (
    bucket_id = 'staff-avatars' AND EXISTS (
        SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text IN ('ADMIN', 'MANAGER', 'RECEPTIONIST')
    )
);

-- ⚠️  SUPERSEDED by 007_supabase_auth_verification.sql
-- This migration created a custom registration_otps table.
-- The active system uses Supabase Auth's built-in OTP via pending_reservations.
-- KEPT ONLY FOR REFERENCE - do not execute on fresh databases.
-- If you have this table, you can drop it: DROP TABLE IF EXISTS public.registration_otps;

CREATE TABLE IF NOT EXISTS public.registration_otps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    otp_code text NOT NULL,
    verification_type text NOT NULL DEFAULT 'registration',
    temp_guest_data jsonb NOT NULL DEFAULT '{}',
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
    is_verified boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_registration_otps_email 
    ON public.registration_otps(email);

CREATE INDEX IF NOT EXISTS idx_registration_otps_expires 
    ON public.registration_otps(expires_at);

CREATE INDEX IF NOT EXISTS idx_registration_otps_verification_type 
    ON public.registration_otps(verification_type);
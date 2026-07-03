-- =============================================
-- MIGRATION 008: Create pending_reservations for OTP flow
-- This was missing from the original schema setup.
-- The reservation flow requires:
--   1. pending_reservations table (for pre-verification storage)
--   2. create_pending_reservation() RPC
--   3. verify_pending_reservation() RPC
--   4. cleanup_expired_pending_reservations() function
-- =============================================

-- 0. ENABLE pgcrypto EXTENSION (required for gen_random_bytes)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. ENSURE 'RESERVED' EXISTS IN reservation_status ENUM
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status') THEN
        CREATE TYPE public.reservation_status AS ENUM ('RESERVED', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');
    ELSE
        ALTER TYPE public.reservation_status ADD VALUE IF NOT EXISTS 'RESERVED';
    END IF;
END$$;

-- 2. ENSURE order_origin TYPE EXISTS
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_origin') THEN
        CREATE TYPE public.order_origin AS ENUM ('MOBILE_APP', 'RECEPTION_DESK', 'MANAGER_PORTAL');
    END IF;
END$$;

-- 3. ADD origin COLUMNS (idempotent)
ALTER TABLE IF EXISTS public.reservations
    ADD COLUMN IF NOT EXISTS origin public.order_origin NOT NULL DEFAULT 'RECEPTION_DESK';

ALTER TABLE IF EXISTS public.activity_bookings
    ADD COLUMN IF NOT EXISTS origin public.order_origin DEFAULT 'MOBILE_APP';

-- 4. CREATE pending_reservations TABLE
CREATE TABLE IF NOT EXISTS public.pending_reservations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    check_in date NOT NULL,
    check_out date NOT NULL,
    adults int NOT NULL,
    children int NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    origin text DEFAULT 'MOBILE_APP',
    verification_token text UNIQUE,
    verification_code text,
    failed_attempts int DEFAULT 0,
    verified_at timestamptz,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz DEFAULT (now() + interval '30 minutes'),
    CONSTRAINT valid_dates CHECK (check_out > check_in)
);

CREATE INDEX IF NOT EXISTS idx_pending_reservations_email
    ON public.pending_reservations(email);

CREATE INDEX IF NOT EXISTS idx_pending_reservations_token
    ON public.pending_reservations(verification_token);

CREATE INDEX IF NOT EXISTS idx_pending_reservations_expires
    ON public.pending_reservations(expires_at);

-- Add columns for custom OTP verification (idempotent for existing tables)
ALTER TABLE IF EXISTS public.pending_reservations
    ADD COLUMN IF NOT EXISTS verification_code text,
    ADD COLUMN IF NOT EXISTS failed_attempts int DEFAULT 0;

-- 5. FUNCTION: cleanup_expired_pending_reservations
CREATE OR REPLACE FUNCTION public.cleanup_expired_pending_reservations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.pending_reservations
  WHERE expires_at < now();
END;
$$;

-- 6. FUNCTION: create_pending_reservation
CREATE OR REPLACE FUNCTION public.create_pending_reservation(
    p_guest_id uuid,
    p_email text,
    p_room_id uuid,
    p_check_in date,
    p_check_out date,
    p_adults int,
    p_children int,
    p_total_amount numeric,
    p_origin text DEFAULT 'MOBILE_APP'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token text;
BEGIN
    v_token := encode(gen_random_bytes(32), 'hex');

    INSERT INTO public.pending_reservations (
        guest_id, email, room_id, check_in, check_out,
        adults, children, total_amount, origin, verification_token
    ) VALUES (
        p_guest_id, p_email, p_room_id, p_check_in, p_check_out,
        p_adults, p_children, p_total_amount, p_origin, v_token
    );

    RETURN jsonb_build_object(
        'token', v_token,
        'email', p_email,
        'expires_in_seconds', 1800
    );
END;
$$;

-- 7. FUNCTION: verify_pending_reservation
CREATE OR REPLACE FUNCTION public.verify_pending_reservation(
    p_token text,
    p_auth_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pending record;
    v_reservation_id uuid;
BEGIN
    SELECT * INTO v_pending
    FROM public.pending_reservations
    WHERE verification_token = p_token
    FOR UPDATE;

    IF v_pending IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Verification token not found or expired'
        );
    END IF;

    IF v_pending.expires_at < now() THEN
        DELETE FROM public.pending_reservations WHERE id = v_pending.id;
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Verification token has expired'
        );
    END IF;

    IF v_pending.verified_at IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'This reservation has already been verified'
        );
    END IF;

    -- Re-check room availability (race condition guard)
    IF EXISTS (
        SELECT 1 FROM public.reservations
        WHERE room_id = v_pending.room_id
          AND status != 'CANCELLED'
          AND check_in < v_pending.check_out
          AND check_out > v_pending.check_in
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Room is no longer available for these dates'
        );
    END IF;

    -- Create actual reservation
    INSERT INTO public.reservations (
        guest_id, room_id, check_in, check_out,
        adults, children, total_amount, origin, status
    ) VALUES (
        v_pending.guest_id,
        v_pending.room_id,
        v_pending.check_in,
        v_pending.check_out,
        v_pending.adults,
        v_pending.children,
        v_pending.total_amount,
        v_pending.origin::public.order_origin,
        'RESERVED'
    ) RETURNING id INTO v_reservation_id;

    -- Mark pending as verified
    UPDATE public.pending_reservations
    SET verified_at = now()
    WHERE id = v_pending.id;

    RETURN jsonb_build_object(
        'success', true,
        'reservation_id', v_reservation_id,
        'guest_id', v_pending.guest_id,
        'room_id', v_pending.room_id,
        'check_in', v_pending.check_in,
        'check_out', v_pending.check_out
    );
END;
$$;

-- 8. RLS POLICY FOR pending_reservations
ALTER TABLE public.pending_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guests view own pending" ON public.pending_reservations;
CREATE POLICY "Guests view own pending" ON public.pending_reservations
  FOR SELECT
  USING (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE auth_id = auth.uid() OR (auth_id IS NULL AND email = auth.email())
    )
  );

-- =============================================
-- MIGRATION 007: Supabase Auth-based OTP Verification
-- Replaces custom registration_otps table with Supabase Auth's built-in OTP
-- =============================================

-- 1. CREATE TEMP RESERVATIONS TABLE
-- Stores reservation details while awaiting OTP verification
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
    verified_at timestamptz,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz DEFAULT (now() + interval '30 minutes'),
    
    CONSTRAINT valid_dates CHECK (check_out > check_in)
);

CREATE INDEX IF NOT EXISTS idx_pending_res_email 
    ON public.pending_reservations(email);

CREATE INDEX IF NOT EXISTS idx_pending_res_token 
    ON public.pending_reservations(verification_token);

CREATE INDEX IF NOT EXISTS idx_pending_res_expires 
    ON public.pending_reservations(expires_at);

-- 2. AUTO-DELETE EXPIRED PENDING RESERVATIONS
-- Run every 5 minutes to clean up expired entries
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

-- 3. FUNCTION: Create pending reservation
-- Called by backend when guest initiates booking
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
    v_result jsonb;
BEGIN
    -- Generate unique verification token
    v_token := encode(gen_random_bytes(32), 'hex');
    
    -- Insert pending reservation
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

-- 4. FUNCTION: Verify pending reservation and create actual reservation
-- Called after Supabase Auth OTP verification succeeds
CREATE OR REPLACE FUNCTION public.verify_pending_reservation(
    p_token text,
    p_auth_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pending record;
    v_reservation_id uuid;
    v_result jsonb;
BEGIN
    -- Get pending reservation
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
    
    -- Check room availability again
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
        v_pending.origin,
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

-- 5. RLS POLICY FOR pending_reservations
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

-- 6. VERIFICATION
SELECT 'Migration 007 complete - Supabase Auth OTP verification enabled' as status;

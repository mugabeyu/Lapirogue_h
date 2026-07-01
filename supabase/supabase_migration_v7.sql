-- =============================================
-- LA PIROGUE HMS - V7 GUEST APP IMPROVEMENTS
-- Changes: gender column, cancellation webhooks,
-- available rooms RPC, account_status improvements
-- =============================================

-- =============================================
-- 1. ADD gender COLUMN TO guests (idempotent)
-- =============================================
ALTER TABLE IF EXISTS public.guests
    ADD COLUMN IF NOT EXISTS gender text;

COMMENT ON COLUMN public.guests.gender IS 'Gender of the guest (Male, Female, Other)';

-- =============================================
-- 2. ENSURE account_status EXISTS ON guests
-- =============================================
ALTER TABLE IF EXISTS public.guests
    ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'PENDING';

-- =============================================
-- 3. CREATE reservation_status ENUM UPDATE
--    Add 'RESERVED' if not in enum already
-- =============================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status') THEN
        CREATE TYPE public.reservation_status AS ENUM ('RESERVED', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');
    ELSE
        ALTER TYPE public.reservation_status ADD VALUE IF NOT EXISTS 'RESERVED';
    END IF;
END$$;

-- Ensure reservations table uses correct status
-- Safe: only adds constraint if not present
ALTER TABLE IF EXISTS public.reservations
    ALTER COLUMN status SET DEFAULT 'RESERVED';

-- =============================================
-- 4. CANCELLATION WEBHOOK / TRIGGER
--    When a reservation is CANCELLED, auto-cancel
--    all pre-booked activities, schedule items
--    and food orders within the reservation dates.
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_reservation_cancellation()
RETURNS trigger AS $$
BEGIN
    -- Only act when status changes TO 'CANCELLED'
    IF NEW.status = 'CANCELLED' AND (OLD.status IS NULL OR OLD.status != 'CANCELLED') THEN
        -- Cancel activity bookings within reservation dates
        UPDATE public.activity_bookings
        SET status = 'CANCELLED',
            updated_at = now()
        WHERE guest_id = NEW.guest_id
          AND booking_date >= NEW.check_in
          AND booking_date <= NEW.check_out
          AND status IN ('CONFIRMED', 'PENDING');

        -- Cancel guest_schedule_items within reservation dates
        UPDATE public.guest_schedule_items
        SET status = 'CANCELLED',
            updated_at = now()
        WHERE guest_id = NEW.guest_id
          AND start_at::date >= NEW.check_in
          AND start_at::date <= NEW.check_out
          AND status IN ('SCHEDULED', 'CONFIRMED');

        -- Cancel itinerary events within reservation dates
        UPDATE public.itinerary_events
        SET status = 'CANCELLED',
            updated_at = now()
        WHERE guest_id = NEW.guest_id
          AND start_at::date >= NEW.check_in
          AND start_at::date <= NEW.check_out
          AND status IN ('CONFIRMED', 'SCHEDULED');

        -- Cancel food orders that are not yet served
        UPDATE public.food_orders
        SET status = 'CANCELLED',
            updated_at = now()
        WHERE guest_id = NEW.guest_id
          AND created_at::date >= NEW.check_in
          AND created_at::date <= NEW.check_out
          AND status IN ('PENDING', 'PREPARING');

        -- Cancel guest orders that are not yet served
        UPDATE public.guest_orders
        SET status = 'CANCELLED',
            updated_at = now()
        WHERE guest_id = NEW.guest_id
          AND (order_time::date >= NEW.check_in OR order_time IS NULL)
          AND order_time::date <= NEW.check_out
          AND status IN ('PENDING', 'CONFIRMED');

        -- Update guest status to CANCELLED if they have no other active reservations
        IF NOT EXISTS (
            SELECT 1 FROM public.reservations
            WHERE guest_id = NEW.guest_id
              AND status NOT IN ('CANCELLED', 'NO_SHOW', 'CHECKED_OUT')
              AND id != NEW.id
        ) THEN
            UPDATE public.guests
            SET status = 'CANCELLED',
                updated_at = now()
            WHERE id = NEW.guest_id;
        END IF;
    END IF;

    -- When reservation is CHECKED_IN, update guest status
    IF NEW.status = 'CHECKED_IN' AND (OLD.status IS NULL OR OLD.status != 'CHECKED_IN') THEN
        UPDATE public.guests
        SET status = 'CHECKED_IN',
            updated_at = now()
        WHERE id = NEW.guest_id;
    END IF;

    -- When reservation is CHECKED_OUT, update guest status
    IF NEW.status = 'CHECKED_OUT' AND (OLD.status IS NULL OR OLD.status != 'CHECKED_OUT') THEN
        UPDATE public.guests
        SET status = 'CHECKED_OUT',
            updated_at = now()
        WHERE id = NEW.guest_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_reservation_cancellation ON public.reservations;
CREATE TRIGGER trg_reservation_cancellation
    AFTER UPDATE OF status ON public.reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_reservation_cancellation();

-- Also handle INSERT case (when a reservation is created as CANCELLED)
DROP TRIGGER IF EXISTS trg_reservation_cancellation_insert ON public.reservations;
CREATE TRIGGER trg_reservation_cancellation_insert
    AFTER INSERT ON public.reservations
    FOR EACH ROW
    WHEN (NEW.status = 'CANCELLED')
    EXECUTE FUNCTION public.handle_reservation_cancellation();

-- =============================================
-- 5. SET guest.account_status WHEN auth_id is linked
-- =============================================
CREATE OR REPLACE FUNCTION public.set_guest_active_on_auth_link()
RETURNS trigger AS $$
BEGIN
    IF NEW.auth_id IS NOT NULL AND (OLD.auth_id IS NULL OR OLD.auth_id != NEW.auth_id) THEN
        NEW.account_status = 'ACTIVE';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guest_auth_active ON public.guests;
CREATE TRIGGER trg_guest_auth_active
    BEFORE UPDATE OF auth_id ON public.guests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_guest_active_on_auth_link();

-- =============================================
-- 6. RPC: get_available_rooms
--    Returns rooms that are available for the
--    entire check-in to check-out period.
-- =============================================
CREATE OR REPLACE FUNCTION public.get_available_rooms(
    p_check_in date,
    p_check_out date
)
RETURNS TABLE (
    id uuid,
    room_number text,
    type text,
    floor text,
    capacity integer,
    price numeric,
    status text,
    description text,
    amenities text[],
    image_path text,
    image_paths text[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT r.id, r.room_number, r.type::text, r.floor, r.capacity, r.price,
           r.status::text, r.description, r.amenities, r.image_path, r.image_paths
    FROM public.rooms r
    WHERE r.status != 'MAINTENANCE'
      AND NOT EXISTS (
          SELECT 1 FROM public.reservations res
          WHERE res.room_id = r.id
            AND res.status NOT IN ('CANCELLED', 'NO_SHOW', 'CHECKED_OUT')
            AND res.check_in < p_check_out
            AND res.check_out > p_check_in
      )
    ORDER BY r.price ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =============================================
-- 7. RPC: get_guest_active_reservation
--    Returns the guest's latest active reservation
-- =============================================
CREATE OR REPLACE FUNCTION public.get_guest_active_reservation(p_guest_id uuid)
RETURNS jsonb AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'id', r.id,
        'reservation_id', r.reservation_id,
        'room_id', r.room_id,
        'check_in', r.check_in,
        'check_out', r.check_out,
        'adults', r.adults,
        'children', r.children,
        'status', r.status,
        'total_amount', r.total_amount,
        'room', CASE WHEN rm.id IS NOT NULL THEN
            jsonb_build_object(
                'id', rm.id,
                'room_number', rm.room_number,
                'type', rm.type,
                'floor', rm.floor,
                'capacity', rm.capacity,
                'price', rm.price,
                'description', rm.description,
                'amenities', rm.amenities,
                'image_path', rm.image_path
            )
        ELSE NULL END
    )
    INTO result
    FROM public.reservations r
    LEFT JOIN public.rooms rm ON rm.id = r.room_id
    WHERE r.guest_id = p_guest_id
      AND r.status IN ('RESERVED', 'CHECKED_IN', 'CONFIRMED')
    ORDER BY r.created_at DESC
    LIMIT 1;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =============================================
-- 8. RPC: create_mobile_reservation
--    Creates a reservation from the mobile app
--    with status RESERVED and sends notification
-- =============================================
CREATE OR REPLACE FUNCTION public.create_mobile_reservation(
    p_guest_id uuid,
    p_room_id uuid,
    p_check_in date,
    p_check_out date,
    p_adults integer DEFAULT 1,
    p_children integer DEFAULT 0
)
RETURNS jsonb AS $$
DECLARE
    new_reservation_id text;
    nights integer;
    room_price numeric;
    total numeric;
    guest_email text;
    guest_name text;
    room_number text;
    room_type text;
    hotel_name text := 'La Pirogue Hotel Mauritius';
    hotel_address text := 'La Pirogue, Belle Mare, Mauritius';
    tax_rate numeric := 0.15;
    tax_amount numeric;
    cancel_policy text := 'Free cancellation up to 48 hours before check-in. Cancellations within 48 hours may incur a one-night charge.';
BEGIN
    -- Get room price
    SELECT price, room_number, type INTO room_price, room_number, room_type
    FROM public.rooms WHERE id = p_room_id;

    IF room_price IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Room not found');
    END IF;

    -- Check room availability
    IF EXISTS (
        SELECT 1 FROM public.reservations
        WHERE room_id = p_room_id
          AND status NOT IN ('CANCELLED', 'NO_SHOW', 'CHECKED_OUT')
          AND check_in < p_check_out
          AND check_out > p_check_in
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Room not available for selected dates');
    END IF;

    nights := p_check_out - p_check_in;
    total := room_price * nights;
    tax_amount := total * tax_rate;

    -- Create reservation
    INSERT INTO public.reservations (
        guest_id, room_id, check_in, check_out,
        adults, children, status, total_amount,
        created_by_name
    ) VALUES (
        p_guest_id, p_room_id, p_check_in, p_check_out,
        p_adults, p_children, 'RESERVED', total,
        'self'
    )
    RETURNING reservation_id INTO new_reservation_id;

    -- Get guest details for email
    SELECT email, first_name || ' ' || last_name
    INTO guest_email, guest_name
    FROM public.guests WHERE id = p_guest_id;

    -- Return reservation data (email sending handled by application layer)
    RETURN jsonb_build_object(
        'success', true,
        'reservation_id', new_reservation_id,
        'total_amount', total,
        'tax_amount', tax_amount,
        'nights', nights,
        'room_number', room_number,
        'room_type', room_type,
        'check_in', p_check_in,
        'check_out', p_check_out,
        'guest_name', guest_name,
        'guest_email', guest_email,
        'hotel_name', hotel_name,
        'hotel_address', hotel_address,
        'cancellation_policy', cancel_policy
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 9. RPC: book_activity_for_reserved_guest
--    Allows guests with RESERVED status to
--    pre-book activities within their reservation dates
-- =============================================
CREATE OR REPLACE FUNCTION public.book_activity_pre_checkin(
    p_activity_id uuid,
    p_guest_id uuid,
    p_booking_date date,
    p_booking_time time,
    p_participants integer DEFAULT 1,
    p_pickup_point text DEFAULT '',
    p_notes text DEFAULT ''
)
RETURNS jsonb AS $$
DECLARE
    new_booking_id uuid;
    has_reservation boolean;
    within_dates boolean;
BEGIN
    -- Check guest has active reservation (RESERVED or CHECKED_IN)
    SELECT EXISTS (
        SELECT 1 FROM public.reservations
        WHERE guest_id = p_guest_id
          AND status IN ('RESERVED', 'CHECKED_IN')
    ) INTO has_reservation;

    IF NOT has_reservation THEN
        RETURN jsonb_build_object('success', false, 'error', 'Guest must have an active reservation to book activities');
    END IF;

    -- Check the booking date is within reservation dates
    SELECT EXISTS (
        SELECT 1 FROM public.reservations
        WHERE guest_id = p_guest_id
          AND status IN ('RESERVED', 'CHECKED_IN')
          AND p_booking_date >= check_in
          AND p_booking_date <= check_out
    ) INTO within_dates;

    IF NOT within_dates THEN
        RETURN jsonb_build_object('success', false, 'error', 'Booking date must be within your reservation dates');
    END IF;

    INSERT INTO public.activity_bookings (
        activity_id, guest_id, booking_date, booking_time,
        participants, status, pickup_point, notes, origin, created_by_name
    ) VALUES (
        p_activity_id, p_guest_id, p_booking_date, p_booking_time,
        p_participants, 'CONFIRMED', p_pickup_point, p_notes, 'MOBILE_APP', 'self'
    )
    RETURNING id INTO new_booking_id;

    RETURN jsonb_build_object('success', true, 'booking_id', new_booking_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 10. RPC: create_guest_profile
--     Called from mobile app after email confirmation
--     Creates the guest record linked to the authenticated user
-- =============================================
CREATE OR REPLACE FUNCTION public.create_guest_profile(
    p_first_name text,
    p_last_name text,
    p_phone text DEFAULT NULL,
    p_nationality text DEFAULT NULL,
    p_passport text DEFAULT NULL,
    p_date_of_birth date DEFAULT NULL,
    p_gender text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auth_id uuid;
    v_guest_id text;
    v_email text;
BEGIN
    v_auth_id := auth.uid();
    IF v_auth_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = v_auth_id;

    INSERT INTO public.guests (
        auth_id, first_name, last_name, email, phone,
        nationality, passport, date_of_birth, gender,
        account_status, status, created_by_name
    ) VALUES (
        v_auth_id, p_first_name, p_last_name, v_email,
        p_phone, p_nationality, p_passport, p_date_of_birth, p_gender,
        'ACTIVE', 'RESERVED', 'self'
    )
    ON CONFLICT (auth_id) DO NOTHING
    RETURNING guest_id INTO v_guest_id;

    IF v_guest_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Guest profile already exists');
    END IF;

    -- Also create profile entry for consistency
    INSERT INTO public.profiles (auth_id, email, full_name, role, is_active)
    VALUES (v_auth_id, v_email, p_first_name || ' ' || p_last_name, 'GUEST', true)
    ON CONFLICT (auth_id) DO NOTHING;

    RETURN jsonb_build_object('success', true, 'guest_id', v_guest_id);
END;
$$;

-- Grant access to authenticated users
REVOKE ALL ON FUNCTION public.create_guest_profile(text, text, text, text, text, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_guest_profile(text, text, text, text, text, date, text) TO authenticated;

-- =============================================
-- END OF V7 MIGRATION
-- =============================================

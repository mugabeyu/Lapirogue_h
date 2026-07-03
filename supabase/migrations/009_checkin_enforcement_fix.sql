-- =============================================
-- Migration 009: Fix check-in enforcement rules
-- =============================================
-- Business rules:
--   - Activities/tours: can be booked while RESERVED (within stay window) OR CHECKED_IN
--   - Food/beverages:   must be CHECKED_IN
-- =============================================

-- New function: check if guest can book activities
-- (RESERVED with date in stay window, or CHECKED_IN)
CREATE OR REPLACE FUNCTION public.check_guest_can_book_activity(p_guest_id uuid, p_booking_date date)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.reservations
        WHERE guest_id = p_guest_id
        AND status IN ('RESERVED', 'CHECKED_IN')
            AND (
                status = 'CHECKED_IN'
                OR (
                    status = 'RESERVED'
                    AND p_booking_date >= check_in
                    AND p_booking_date <= check_out
                )
            )
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Updated trigger: allow RESERVED guests with valid dates
CREATE OR REPLACE FUNCTION public.trg_enforce_checkin_for_activities()
RETURNS trigger AS $$
BEGIN
    IF NOT public.check_guest_can_book_activity(NEW.guest_id, NEW.booking_date) THEN
        RAISE EXCEPTION 'Guest must have an active reservation within their stay period to book activities.'
            USING HINT = 'Reservation status must be RESERVED (with date in stay window) or CHECKED_IN';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger (drop first for idempotency)
DROP TRIGGER IF EXISTS enforce_checkin_activity_bookings ON public.activity_bookings;
CREATE TRIGGER enforce_checkin_activity_bookings
    BEFORE INSERT ON public.activity_bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_enforce_checkin_for_activities();

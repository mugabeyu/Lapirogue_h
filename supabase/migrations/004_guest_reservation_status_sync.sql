-- Keep guest.status and reservation.status aligned for admin and mobile flows.

CREATE OR REPLACE FUNCTION public.compute_guest_status_from_reservations(p_guest_id uuid)
RETURNS public.guest_status
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    derived_status public.guest_status;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.reservations
        WHERE guest_id = p_guest_id
          AND status = 'CHECKED_IN'
    ) THEN
        RETURN 'CHECKED_IN'::public.guest_status;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.reservations
        WHERE guest_id = p_guest_id
          AND status IN ('RESERVED', 'CONFIRMED')
    ) THEN
        RETURN 'RESERVED'::public.guest_status;
    END IF;

    SELECT CASE
        WHEN r.status = 'CHECKED_OUT' THEN 'CHECKED_OUT'::public.guest_status
        WHEN r.status IN ('CANCELLED', 'NO_SHOW') THEN 'CANCELLED'::public.guest_status
        ELSE 'RESERVED'::public.guest_status
    END
    INTO derived_status
    FROM public.reservations r
    WHERE r.guest_id = p_guest_id
    ORDER BY r.check_in DESC NULLS LAST, r.created_at DESC NULLS LAST
    LIMIT 1;

    RETURN COALESCE(derived_status, 'RESERVED'::public.guest_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_guest_status_from_reservations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_guest_id uuid := COALESCE(NEW.guest_id, OLD.guest_id);
BEGIN
    IF pg_trigger_depth() > 1 OR target_guest_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    UPDATE public.guests
    SET status = public.compute_guest_status_from_reservations(target_guest_id),
        updated_at = now()
    WHERE id = target_guest_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_guest_status_from_reservations ON public.reservations;
CREATE TRIGGER trg_sync_guest_status_from_reservations
AFTER INSERT OR UPDATE OR DELETE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.sync_guest_status_from_reservations();

CREATE OR REPLACE FUNCTION public.sync_reservations_from_guest_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_reservation_id uuid;
    today date := CURRENT_DATE;
BEGIN
    IF pg_trigger_depth() > 1 OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;

    IF NEW.status = 'CANCELLED' THEN
        UPDATE public.reservations
        SET status = 'CANCELLED'::public.reservation_status,
            updated_at = now()
        WHERE guest_id = NEW.id
          AND status IN ('RESERVED', 'CONFIRMED', 'CHECKED_IN');

        RETURN NEW;
    END IF;

    SELECT r.id
    INTO target_reservation_id
    FROM public.reservations r
    WHERE r.guest_id = NEW.id
      AND r.status NOT IN ('CANCELLED', 'NO_SHOW')
      AND (
        (NEW.status = 'CHECKED_IN' AND r.status IN ('RESERVED', 'CONFIRMED', 'CHECKED_IN') AND r.check_in <= today AND r.check_out > today)
        OR (NEW.status = 'CHECKED_OUT' AND r.status IN ('CHECKED_IN', 'CHECKED_OUT'))
        OR (NEW.status = 'RESERVED' AND r.status IN ('RESERVED', 'CONFIRMED', 'CHECKED_IN'))
      )
    ORDER BY r.check_in DESC NULLS LAST, r.created_at DESC NULLS LAST
    LIMIT 1;

    IF target_reservation_id IS NOT NULL THEN
        UPDATE public.reservations
        SET status = CASE
                WHEN NEW.status = 'RESERVED' THEN 'RESERVED'::public.reservation_status
                WHEN NEW.status = 'CHECKED_IN' THEN 'CHECKED_IN'::public.reservation_status
                WHEN NEW.status = 'CHECKED_OUT' THEN 'CHECKED_OUT'::public.reservation_status
                ELSE 'CANCELLED'::public.reservation_status
            END,
            updated_at = now()
        WHERE id = target_reservation_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_reservations_from_guest_status ON public.guests;
CREATE TRIGGER trg_sync_reservations_from_guest_status
AFTER UPDATE OF status ON public.guests
FOR EACH ROW
EXECUTE FUNCTION public.sync_reservations_from_guest_status();

-- Backfill guest.status from the current reservation state.
UPDATE public.guests g
SET status = public.compute_guest_status_from_reservations(g.id),
    updated_at = now()
WHERE EXISTS (
    SELECT 1
    FROM public.reservations r
    WHERE r.guest_id = g.id
);
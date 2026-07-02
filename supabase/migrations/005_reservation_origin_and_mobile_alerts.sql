-- Preserve reservation source across both apps and alert staff when a booking comes from the mobile app.

ALTER TABLE IF EXISTS public.reservations
    ADD COLUMN IF NOT EXISTS origin public.order_origin NOT NULL DEFAULT 'RECEPTION_DESK';

UPDATE public.reservations
SET origin = 'RECEPTION_DESK'
WHERE origin IS NULL;

CREATE OR REPLACE FUNCTION public.notify_staff_on_mobile_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    guest_name text;
    room_label text;
BEGIN
    IF NEW.origin <> 'MOBILE_APP' THEN
        RETURN NEW;
    END IF;

    SELECT trim(concat_ws(' ', g.first_name, g.last_name))
    INTO guest_name
    FROM public.guests g
    WHERE g.id = NEW.guest_id;

    SELECT concat('Room ', r.room_number)
    INTO room_label
    FROM public.rooms r
    WHERE r.id = NEW.room_id;

    INSERT INTO public.notifications (guest_id, title, message, category, is_read)
    VALUES (
        NULL,
        'New Mobile Reservation',
        concat(
            coalesce(nullif(guest_name, ''), 'Guest'),
            ' reserved ',
            coalesce(room_label, 'a room'),
            ' from ',
            NEW.check_in,
            ' to ',
            NEW.check_out,
            '. Reference: ',
            coalesce(NEW.reservation_id, NEW.id::text),
            '.'
        ),
        'Reservation',
        false
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_staff_mobile_reservation ON public.reservations;
CREATE TRIGGER trg_notify_staff_mobile_reservation
AFTER INSERT ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.notify_staff_on_mobile_reservation();

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
    SELECT price, room_number, type INTO room_price, room_number, room_type
    FROM public.rooms WHERE id = p_room_id;

    IF room_price IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Room not found');
    END IF;

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

    INSERT INTO public.reservations (
        guest_id, room_id, check_in, check_out,
        adults, children, status, total_amount,
        created_by_name, origin
    ) VALUES (
        p_guest_id, p_room_id, p_check_in, p_check_out,
        p_adults, p_children, 'RESERVED', total,
        'self', 'MOBILE_APP'
    )
    RETURNING reservation_id INTO new_reservation_id;

    SELECT email, first_name || ' ' || last_name
    INTO guest_email, guest_name
    FROM public.guests WHERE id = p_guest_id;

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

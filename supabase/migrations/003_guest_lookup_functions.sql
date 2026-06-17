-- Guest lookup functions for the Flutter guest app
-- SECURITY DEFINER = bypasses RLS so anonymous users can look up their booking

-- Look up a guest by reservation ID + last name
-- Returns guest + reservation data as JSON, or null if no match
CREATE OR REPLACE FUNCTION public.lookup_guest_by_booking(
  p_reservation_id text,
  p_last_name text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id',               g.id,
    'guest_id',         g.guest_id,
    'first_name',       g.first_name,
    'last_name',        g.last_name,
    'email',            g.email,
    'phone',            g.phone,
    'nationality',      g.nationality,
    'image_path',       g.image_path,
    'vip',              g.vip,
    'reservation_id',   r.reservation_id,
    'check_in',         r.check_in,
    'check_out',        r.check_out,
    'room_id',          r.room_id,
    'reservation_status', r.status
  ) INTO result
  FROM public.guests g
  JOIN public.reservations r ON r.guest_id = g.id
  WHERE r.reservation_id = p_reservation_id
    AND LOWER(g.last_name) = LOWER(p_last_name)
  LIMIT 1;

  RETURN result;
END;
$$;

-- Link an anonymous auth user to a guest record
-- Called after signInAnonymously() so RLS policies work for the anonymous session
CREATE OR REPLACE FUNCTION public.link_guest_auth(
  p_guest_id uuid,
  p_auth_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.guests
  SET auth_id = p_auth_id
  WHERE id = p_guest_id;
  RETURN FOUND;
END;
$$;

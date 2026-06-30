-- =============================================
-- LA PIROGUE HMS - V2 RPC FUNCTIONS FOR FLUTTER APP
-- Run this AFTER laprogue_v2_migration.sql
-- =============================================

-- =============================================
-- 1. get_guest_eco_points - returns total points
-- =============================================
CREATE OR REPLACE FUNCTION public.get_guest_eco_points(p_guest_id uuid)
RETURNS integer
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  total integer;
BEGIN
  SELECT COALESCE(SUM(points), 0) INTO total
  FROM public.guest_eco_point_events
  WHERE guest_id = p_guest_id
    AND status = 'COMPLETED';
  RETURN total;
END;
$$;

-- =============================================
-- 2. get_eco_leaderboard - ranking by total points
-- =============================================
CREATE OR REPLACE FUNCTION public.get_eco_leaderboard(p_limit integer DEFAULT 10)
RETURNS TABLE(
  guest_id uuid,
  first_name text,
  last_name text,
  points bigint
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id AS guest_id,
    g.first_name,
    g.last_name,
    COALESCE(SUM(e.points), 0) AS points
  FROM public.guests g
  LEFT JOIN public.guest_eco_point_events e ON e.guest_id = g.id AND e.status = 'COMPLETED'
  GROUP BY g.id, g.first_name, g.last_name
  ORDER BY points DESC
  LIMIT p_limit;
END;
$$;

-- =============================================
-- 3. increment_eco_points - legacy RPC kept for 
--    backward compatibility with old migration scripts
-- =============================================
CREATE OR REPLACE FUNCTION public.increment_eco_points(p_guest_id uuid, p_points integer)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- No-op: eco points are now computed from guest_eco_point_events directly.
  -- This function is kept for compatibility with older scripts.
END;
$$;

-- =============================================
-- 4. lookkup_guest_by_booking - for Flutter app
-- =============================================
CREATE OR REPLACE FUNCTION public.lookup_guest_by_booking(
  p_reservation_id text,
  p_last_name text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', g.id,
    'guest_id', g.guest_id,
    'first_name', g.first_name,
    'last_name', g.last_name,
    'email', g.email,
    'reservation_id', r.reservation_id,
    'check_in', r.check_in,
    'check_out', r.check_out,
    'room_number', rm.room_number
  ) INTO result
  FROM public.reservations r
  JOIN public.guests g ON g.id = r.guest_id
  LEFT JOIN public.rooms rm ON rm.id = r.room_id
  WHERE r.reservation_id = p_reservation_id
    AND LOWER(g.last_name) = LOWER(p_last_name)
  LIMIT 1;

  RETURN result;
END;
$$;

-- =============================================
-- 5. link_guest_auth - for Flutter app
-- =============================================
CREATE OR REPLACE FUNCTION public.link_guest_auth(
  p_guest_id uuid,
  p_auth_id uuid
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.guests
  SET auth_id = p_auth_id,
      auth_user_id = p_auth_id::text,
      account_status = 'ACTIVE'
  WHERE id = p_guest_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Also create/update profile
  INSERT INTO public.profiles (auth_id, email, role, is_active)
  VALUES (
    p_auth_id,
    (SELECT email FROM public.guests WHERE id = p_guest_id),
    'GUEST',
    true
  )
  ON CONFLICT (auth_id) DO UPDATE
    SET role = 'GUEST', is_active = true;

  RETURN true;
END;
$$;

-- =============================================
-- 6. auto_complete_schedule_items - for Flutter app
-- =============================================
CREATE OR REPLACE FUNCTION public.auto_complete_schedule_items()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.guest_schedule_items
  SET status = 'COMPLETED',
      completed_at = now(),
      eco_points_awarded = true
  WHERE status NOT IN ('COMPLETED', 'CANCELLED')
    AND end_at < now() - interval '5 minutes';
END;
$$;

-- =============================================
-- COMPLETE
-- =============================================

-- FCM Push Notifications for La Pirogue Hotel
-- Part A: Ensure fcm_token column exists on guests table
-- Part B: Trigger function to notify when reservation status changes to CHECKED_IN
-- Part C: The trigger on reservations table
--
-- Note: For actual FCM delivery, deploy a Supabase Edge Function that
-- listens on the 'fcm_push' pg_notify channel and sends HTTP requests
-- to the Firebase Cloud Messaging API using the Firebase Admin SDK.

-- ============================================================
-- PART A: Ensure fcm_token column exists
-- ============================================================
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS fcm_token text;

-- ============================================================
-- PART B: Trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_guest_checked_in()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_fcm_token text;
  v_guest_name text;
  v_notification_id uuid;
  v_title text;
  v_message text;
BEGIN
  -- Only proceed when status changes to CHECKED_IN
  IF NEW.status = 'CHECKED_IN' AND OLD.status IS DISTINCT FROM 'CHECKED_IN' THEN
    -- Fetch guest details
    SELECT g.fcm_token, COALESCE(g.first_name || ' ' || g.last_name, 'Guest')
    INTO v_guest_fcm_token, v_guest_name
    FROM public.guests g
    WHERE g.id = NEW.guest_id;

    v_title := 'Welcome to La Pirogue Hotel!';
    v_message := 'You have been checked in. Welcome, ' || v_guest_name || '! Enjoy your stay.';

    -- Insert notification record (picked up by realtime subscription in Flutter app)
    INSERT INTO public.notifications (guest_id, title, message, category)
    VALUES (NEW.guest_id, v_title, v_message, 'CHECK_IN')
    RETURNING id INTO v_notification_id;

    -- Notify via pg_notify channel for FCM dispatch (consumed by an Edge Function)
    IF v_guest_fcm_token IS NOT NULL THEN
      PERFORM pg_notify(
        'fcm_push',
        jsonb_build_object(
          'token', v_guest_fcm_token,
          'notification', jsonb_build_object(
            'title', v_title,
            'body', v_message
          ),
          'data', jsonb_build_object(
            'id', v_notification_id::text,
            'type', 'CHECK_IN',
            'guest_id', NEW.guest_id::text
          )
        )::text
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- PART C: Attach trigger to reservations table
-- ============================================================
DROP TRIGGER IF EXISTS trg_notify_guest_checked_in ON public.reservations;
CREATE TRIGGER trg_notify_guest_checked_in
  AFTER UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_guest_checked_in();

-- =============================================
-- LA PIROGUE - FIX GUEST MESSAGING & RLS POLICIES
-- Run in SQL Editor: https://supabase.com/dashboard/project/txalwdljaxltchcrauhp/sql/new
-- =============================================

-- =============================================
-- 1. ENSURE file_url COLUMNS ON messages TABLE
-- =============================================
ALTER TABLE IF EXISTS public.messages
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_type text,
  ADD COLUMN IF NOT EXISTS file_size integer;

-- =============================================
-- 2. CREATE SECURITY DEFINER RPC FOR GUEST LOOKUP BY EMAIL
-- This bypasses RLS so guests can find themselves on first login
-- =============================================
CREATE OR REPLACE FUNCTION public.lookup_guest_by_email(p_email text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest record;
BEGIN
  SELECT id, auth_id, email, first_name, last_name
  INTO v_guest
  FROM public.guests
  WHERE email = p_email
  LIMIT 1;

  IF v_guest.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_guest.id,
    'auth_id', v_guest.auth_id,
    'email', v_guest.email,
    'first_name', v_guest.first_name,
    'last_name', v_guest.last_name
  );
END;
$$;

-- =============================================
-- 3. CREATE SECURITY DEFINER RPC TO LINK AUTH
-- Bypasses RLS for the initial auth_id linking
-- =============================================
CREATE OR REPLACE FUNCTION public.link_guest_auth(
  p_guest_id uuid,
  p_auth_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.guests
  SET auth_id = p_auth_id,
      auth_user_id = p_auth_id::text
  WHERE id = p_guest_id;
  RETURN FOUND;
END;
$$;

-- =============================================
-- 4. FIX RLS: GUESTS TABLE (with email fallback)
-- =============================================
ALTER TABLE IF EXISTS public.guests ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on guests to avoid conflicts
DROP POLICY IF EXISTS "Guests view own profile" ON public.guests;
DROP POLICY IF EXISTS "Guests select own" ON public.guests;
DROP POLICY IF EXISTS "Guests update own" ON public.guests;
DROP POLICY IF EXISTS "Guests insert own" ON public.guests;
DROP POLICY IF EXISTS "Staff full access on guests" ON public.guests;

-- SELECT policy with email fallback
CREATE POLICY "Guests view own profile" ON public.guests
  FOR SELECT USING (
    auth_id = auth.uid()
    OR (auth_id IS NULL AND email = auth.email())
  );

-- UPDATE policy with email fallback (needed for linking auth_id on first login)
CREATE POLICY "Guests update own" ON public.guests
  FOR UPDATE USING (
    auth_id = auth.uid()
    OR (auth_id IS NULL AND email = auth.email())
  )
  WITH CHECK (
    auth_id = auth.uid()
    OR (auth_id IS NULL AND email = auth.email())
  );

-- Staff full access
CREATE POLICY "Staff full access on guests" ON public.guests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('MAIN_RECEPTIONIST','RECEPTIONIST','ADMIN'))
  );

-- =============================================
-- 5. FIX RLS: MESSAGES TABLE (with email fallback)
-- =============================================
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guests view own messages" ON public.messages;
DROP POLICY IF EXISTS "Guests manage own messages" ON public.messages;
DROP POLICY IF EXISTS "Staff full access on messages" ON public.messages;

CREATE POLICY "Guests manage own messages" ON public.messages
  FOR ALL
  USING (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE auth_id = auth.uid()
         OR (auth_id IS NULL AND email = auth.email())
    )
  )
  WITH CHECK (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE auth_id = auth.uid()
         OR (auth_id IS NULL AND email = auth.email())
    )
  );

-- =============================================
-- 6. FIX RLS: RESERVATIONS (with email fallback)
-- =============================================
ALTER TABLE IF EXISTS public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guests view own reservations" ON public.reservations;

CREATE POLICY "Guests view own reservations" ON public.reservations
  FOR SELECT USING (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE auth_id = auth.uid()
         OR (auth_id IS NULL AND email = auth.email())
    )
  );

-- =============================================
-- 7. FIX RLS: ACTIVITY BOOKINGS (with email fallback)
-- =============================================
ALTER TABLE IF EXISTS public.activity_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guests view own bookings" ON public.activity_bookings;
DROP POLICY IF EXISTS "Guests manage own bookings" ON public.activity_bookings;

CREATE POLICY "Guests manage own bookings" ON public.activity_bookings
  FOR ALL
  USING (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE auth_id = auth.uid()
         OR (auth_id IS NULL AND email = auth.email())
    )
  )
  WITH CHECK (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE auth_id = auth.uid()
         OR (auth_id IS NULL AND email = auth.email())
    )
  );

-- =============================================
-- 8. FIX RLS: FOOD ORDERS (with email fallback)
-- =============================================
ALTER TABLE IF EXISTS public.food_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guests view own food orders" ON public.food_orders;
DROP POLICY IF EXISTS "Guests manage own food orders" ON public.food_orders;

CREATE POLICY "Guests manage own food orders" ON public.food_orders
  FOR ALL
  USING (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE auth_id = auth.uid()
         OR (auth_id IS NULL AND email = auth.email())
    )
  )
  WITH CHECK (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE auth_id = auth.uid()
         OR (auth_id IS NULL AND email = auth.email())
    )
  );

-- =============================================
-- 9. FIX RLS: GUEST SCHEDULE ITEMS (with email fallback)
-- =============================================
ALTER TABLE IF EXISTS public.guest_schedule_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guests view own schedule" ON public.guest_schedule_items;
DROP POLICY IF EXISTS "Guests manage own schedule items" ON public.guest_schedule_items;

CREATE POLICY "Guests manage own schedule items" ON public.guest_schedule_items
  FOR ALL
  USING (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE auth_id = auth.uid()
         OR (auth_id IS NULL AND email = auth.email())
    )
  )
  WITH CHECK (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE auth_id = auth.uid()
         OR (auth_id IS NULL AND email = auth.email())
    )
  );

-- =============================================
-- 10. FIX RLS: NOTIFICATIONS (with email fallback)
-- =============================================
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guests view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Guests read own notifications" ON public.notifications;

CREATE POLICY "Guests read own notifications" ON public.notifications
  FOR SELECT USING (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE auth_id = auth.uid()
         OR (auth_id IS NULL AND email = auth.email())
    )
    OR guest_id IS NULL
  );

-- =============================================
-- 11. FIX RLS: GUEST FEEDBACK (with email fallback)
-- =============================================
ALTER TABLE IF EXISTS public.guest_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guests view own feedback" ON public.guest_feedback;
DROP POLICY IF EXISTS "Guests manage own feedback" ON public.guest_feedback;

CREATE POLICY "Guests manage own feedback" ON public.guest_feedback
  FOR ALL
  USING (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE auth_id = auth.uid()
         OR (auth_id IS NULL AND email = auth.email())
    )
  )
  WITH CHECK (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE auth_id = auth.uid()
         OR (auth_id IS NULL AND email = auth.email())
    )
  );

-- =============================================
-- 12. FIX RLS: PAYMENTS (with email fallback)
-- =============================================
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guests view own payments" ON public.payments;

CREATE POLICY "Guests view own payments" ON public.payments
  FOR SELECT USING (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE auth_id = auth.uid()
         OR (auth_id IS NULL AND email = auth.email())
    )
  );

-- =============================================
-- 13. FIX RLS: ECO POINTS (with email fallback)
-- =============================================
ALTER TABLE IF EXISTS public.eco_points_balance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guests view own balance" ON public.eco_points_balance;

CREATE POLICY "Guests view own balance" ON public.eco_points_balance
  FOR SELECT USING (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE auth_id = auth.uid()
         OR (auth_id IS NULL AND email = auth.email())
    )
  );

ALTER TABLE IF EXISTS public.eco_points_tx ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guests manage own eco points tx" ON public.eco_points_tx;

CREATE POLICY "Guests manage own eco points tx" ON public.eco_points_tx
  FOR ALL
  USING (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE auth_id = auth.uid()
         OR (auth_id IS NULL AND email = auth.email())
    )
  )
  WITH CHECK (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE auth_id = auth.uid()
         OR (auth_id IS NULL AND email = auth.email())
    )
  );

-- =============================================
-- 14. FIX RLS: GUEST ECO ACTIONS (with email fallback)
-- =============================================
ALTER TABLE IF EXISTS public.guest_eco_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guests manage own eco actions" ON public.guest_eco_actions;

CREATE POLICY "Guests manage own eco actions" ON public.guest_eco_actions
  FOR ALL
  USING (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE auth_id = auth.uid()
         OR (auth_id IS NULL AND email = auth.email())
    )
  )
  WITH CHECK (
    guest_id IN (
      SELECT id FROM public.guests
      WHERE auth_id = auth.uid()
         OR (auth_id IS NULL AND email = auth.email())
    )
  );

-- =============================================
-- 15. FIX STORAGE RLS: chat_uploads for guests
-- =============================================
DROP POLICY IF EXISTS "Chat uploads authenticated" ON storage.objects;
CREATE POLICY "Chat uploads authenticated" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat_uploads'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Chat uploads read all" ON storage.objects;
CREATE POLICY "Chat uploads read all" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'chat_uploads'
  );

-- =============================================
-- 16. ENSURE REALTIME PUBLICATION INCLUDES messages
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END;
$$;

-- =============================================
-- VERIFICATION
-- =============================================
SELECT 'Fix complete' as status;

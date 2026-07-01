-- =============================================
-- LA PIROGUE HMS - V3 GUEST APP MIGRATION
-- Adds created_by tracking across all guest-facing tables
-- Ensures compatibility between web admin + mobile app
-- =============================================

-- =============================================
-- 1. ADD created_by_name COLUMNS (idempotent)
-- =============================================

ALTER TABLE IF EXISTS public.guests
    ADD COLUMN IF NOT EXISTS created_by_name text DEFAULT 'self';

COMMENT ON COLUMN public.guests.created_by_name IS 'Name of who created this record: "self" for mobile registration, or staff name for desk registration';

ALTER TABLE IF EXISTS public.reservations
    ADD COLUMN IF NOT EXISTS created_by_name text DEFAULT 'self';

COMMENT ON COLUMN public.reservations.created_by_name IS 'Name of who created this reservation: "self" for mobile, or staff name for desk';

ALTER TABLE IF EXISTS public.food_orders
    ADD COLUMN IF NOT EXISTS created_by_name text DEFAULT 'self';

ALTER TABLE IF EXISTS public.activity_bookings
    ADD COLUMN IF NOT EXISTS created_by_name text DEFAULT 'self';

ALTER TABLE IF EXISTS public.payments
    ADD COLUMN IF NOT EXISTS created_by_name text DEFAULT 'self';

ALTER TABLE IF EXISTS public.guest_schedule_items
    ADD COLUMN IF NOT EXISTS created_by_name text DEFAULT 'self';

ALTER TABLE IF EXISTS public.messages
    ADD COLUMN IF NOT EXISTS created_by_name text;

ALTER TABLE IF EXISTS public.food_orders
    ADD COLUMN IF NOT EXISTS origin public.order_origin DEFAULT 'MOBILE_APP';

ALTER TABLE IF EXISTS public.activity_bookings
    ADD COLUMN IF NOT EXISTS origin public.order_origin DEFAULT 'MOBILE_APP';

-- =============================================
-- 2. INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_guests_created_by_name ON public.guests(created_by_name);
CREATE INDEX IF NOT EXISTS idx_reservations_created_by_name ON public.reservations(created_by_name);
CREATE INDEX IF NOT EXISTS idx_food_orders_created_by_name ON public.food_orders(created_by_name);
CREATE INDEX IF NOT EXISTS idx_activity_bookings_created_by_name ON public.activity_bookings(created_by_name);

-- =============================================
-- 3. AUTO-SET created_by_name ON INSERT TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION public.set_guest_created_by()
RETURNS trigger AS $$
BEGIN
    IF NEW.created_by_name IS NULL THEN
        IF EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid()) THEN
            NEW.created_by_name = COALESCE(
                (SELECT full_name FROM public.profiles WHERE auth_id = auth.uid()),
                'Staff'
            );
        ELSE
            NEW.created_by_name = 'self';
        END IF;
    END IF;
    IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
        NEW.created_by = auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_guest_created_by ON public.guests;
CREATE TRIGGER trg_set_guest_created_by
    BEFORE INSERT ON public.guests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_guest_created_by();

CREATE OR REPLACE FUNCTION public.set_reservation_created_by()
RETURNS trigger AS $$
BEGIN
    IF NEW.created_by_name IS NULL THEN
        IF EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid()) THEN
            NEW.created_by_name = COALESCE(
                (SELECT full_name FROM public.profiles WHERE auth_id = auth.uid()),
                'Staff'
            );
        ELSE
            NEW.created_by_name = 'self';
        END IF;
    END IF;
    IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
        NEW.created_by = auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_reservation_created_by ON public.reservations;
CREATE TRIGGER trg_set_reservation_created_by
    BEFORE INSERT ON public.reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_reservation_created_by();

CREATE OR REPLACE FUNCTION public.set_food_order_created_by()
RETURNS trigger AS $$
BEGIN
    IF NEW.created_by_name IS NULL THEN
        IF EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid()) THEN
            NEW.created_by_name = COALESCE(
                (SELECT full_name FROM public.profiles WHERE auth_id = auth.uid()),
                'Staff'
            );
        ELSE
            NEW.created_by_name = 'self';
        END IF;
    END IF;
    IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
        NEW.created_by = auth.uid();
    END IF;
    IF NEW.origin IS NULL THEN
        NEW.origin = 'MOBILE_APP';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_food_order_created_by ON public.food_orders;
CREATE TRIGGER trg_set_food_order_created_by
    BEFORE INSERT ON public.food_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.set_food_order_created_by();

CREATE OR REPLACE FUNCTION public.set_activity_booking_created_by()
RETURNS trigger AS $$
BEGIN
    IF NEW.created_by_name IS NULL THEN
        IF EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid()) THEN
            NEW.created_by_name = COALESCE(
                (SELECT full_name FROM public.profiles WHERE auth_id = auth.uid()),
                'Staff'
            );
        ELSE
            NEW.created_by_name = 'self';
        END IF;
    END IF;
    IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
        NEW.created_by = auth.uid();
    END IF;
    IF NEW.origin IS NULL THEN
        NEW.origin = 'MOBILE_APP';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_activity_booking_created_by ON public.activity_bookings;
CREATE TRIGGER trg_set_activity_booking_created_by
    BEFORE INSERT ON public.activity_bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_activity_booking_created_by();

CREATE OR REPLACE FUNCTION public.set_payment_created_by()
RETURNS trigger AS $$
BEGIN
    IF NEW.created_by_name IS NULL THEN
        IF EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid()) THEN
            NEW.created_by_name = COALESCE(
                (SELECT full_name FROM public.profiles WHERE auth_id = auth.uid()),
                'Staff'
            );
        ELSE
            NEW.created_by_name = 'self';
        END IF;
    END IF;
    IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
        NEW.created_by = auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_payment_created_by ON public.payments;
CREATE TRIGGER trg_set_payment_created_by
    BEFORE INSERT ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_payment_created_by();

-- =============================================
-- 4. GUEST APP PUBLIC READ POLICIES
--    (wrapped in DO blocks so missing tables won't error)
-- =============================================

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rooms') THEN
        DROP POLICY IF EXISTS "Public read rooms" ON public.rooms;
        CREATE POLICY "Public read rooms" ON public.rooms FOR SELECT USING (true);
    END IF;
END$$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'activities') THEN
        DROP POLICY IF EXISTS "Public read activities" ON public.activities;
        CREATE POLICY "Public read activities" ON public.activities FOR SELECT USING (true);
    END IF;
END$$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'menu_items') THEN
        DROP POLICY IF EXISTS "Public read menu_items" ON public.menu_items;
        CREATE POLICY "Public read menu_items" ON public.menu_items FOR SELECT USING (true);
    END IF;
END$$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'hotel_services') THEN
        DROP POLICY IF EXISTS "Public read hotel_services" ON public.hotel_services;
        CREATE POLICY "Public read hotel_services" ON public.hotel_services FOR SELECT USING (true);
    END IF;
END$$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'hotel_service_categories') THEN
        DROP POLICY IF EXISTS "Public read hotel_service_categories" ON public.hotel_service_categories;
        CREATE POLICY "Public read hotel_service_categories" ON public.hotel_service_categories FOR SELECT USING (true);
    END IF;
END$$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'emergency_contacts') THEN
        DROP POLICY IF EXISTS "Public read emergency_contacts" ON public.emergency_contacts;
        CREATE POLICY "Public read emergency_contacts" ON public.emergency_contacts FOR SELECT USING (true);
    END IF;
END$$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'site_content_pages') THEN
        DROP POLICY IF EXISTS "Public read site_content_pages" ON public.site_content_pages;
        CREATE POLICY "Public read site_content_pages" ON public.site_content_pages FOR SELECT USING (true);
    END IF;
END$$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'eco_actions') THEN
        DROP POLICY IF EXISTS "Public read eco_actions" ON public.eco_actions;
        CREATE POLICY "Public read eco_actions" ON public.eco_actions FOR SELECT USING (true);
    END IF;
END$$;

-- Guest INSERT policies (these tables should always exist)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'food_orders') THEN
        DROP POLICY IF EXISTS "Guests insert own food orders" ON public.food_orders;
        CREATE POLICY "Guests insert own food orders" ON public.food_orders
            FOR INSERT WITH CHECK (
                guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid())
            );
    END IF;
END$$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'activity_bookings') THEN
        DROP POLICY IF EXISTS "Guests insert own activity bookings" ON public.activity_bookings;
        CREATE POLICY "Guests insert own activity bookings" ON public.activity_bookings
            FOR INSERT WITH CHECK (
                guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid())
            );
    END IF;
END$$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'guest_feedback') THEN
        DROP POLICY IF EXISTS "Guests insert own feedback" ON public.guest_feedback;
        CREATE POLICY "Guests insert own feedback" ON public.guest_feedback
            FOR INSERT WITH CHECK (
                guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid())
            );
    END IF;
END$$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
        DROP POLICY IF EXISTS "Guests send messages" ON public.messages;
        CREATE POLICY "Guests send messages" ON public.messages
            FOR INSERT WITH CHECK (
                guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid())
                AND sender_type = 'guest'
            );
    END IF;
END$$;

-- =============================================
-- 5. RPC FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION public.get_guest_with_active_reservation(p_auth_id uuid)
RETURNS jsonb AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'guest', to_jsonb(g.*),
        'active_reservation', to_jsonb(r.*),
        'reservation_room', to_jsonb(rm.*)
    )
    INTO result
    FROM public.guests g
    LEFT JOIN public.reservations r ON r.guest_id = g.id AND r.status IN ('RESERVED', 'CHECKED_IN', 'CONFIRMED')
    LEFT JOIN public.rooms rm ON rm.id = r.room_id
    WHERE g.auth_id = p_auth_id
    ORDER BY r.created_at DESC
    LIMIT 1;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_guest_reservation_status(p_guest_id uuid)
RETURNS text AS $$
DECLARE
    current_status text;
BEGIN
    SELECT status INTO current_status
    FROM public.reservations
    WHERE guest_id = p_guest_id
    ORDER BY created_at DESC
    LIMIT 1;

    RETURN COALESCE(current_status, 'NONE');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.place_food_order(
    p_guest_id uuid,
    p_items jsonb,
    p_subtotal numeric,
    p_service_charge numeric,
    p_tax_amount numeric,
    p_total numeric,
    p_notes text DEFAULT ''
)
RETURNS jsonb AS $$
DECLARE
    new_order_id text;
    is_checked_in boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.reservations
        WHERE guest_id = p_guest_id AND status = 'CHECKED_IN'
    ) INTO is_checked_in;

    IF NOT is_checked_in THEN
        RETURN jsonb_build_object('success', false, 'error', 'Guest must be checked in to place food orders');
    END IF;

    INSERT INTO public.food_orders (
        guest_id, items, subtotal, service_charge, tax_amount, total,
        status, notes, origin, created_by_name
    ) VALUES (
        p_guest_id, p_items, p_subtotal, p_service_charge, p_tax_amount, p_total,
        'PENDING', p_notes, 'MOBILE_APP', 'self'
    )
    RETURNING order_id INTO new_order_id;

    RETURN jsonb_build_object('success', true, 'order_id', new_order_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.book_activity(
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
    is_checked_in boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.reservations
        WHERE guest_id = p_guest_id AND status = 'CHECKED_IN'
    ) INTO is_checked_in;

    IF NOT is_checked_in THEN
        RETURN jsonb_build_object('success', false, 'error', 'Guest must be checked in to book activities');
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
-- END OF MIGRATION
-- =============================================

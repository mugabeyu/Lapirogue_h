-- =============================================
-- LA PIROGUE HMS - COMPREHENSIVE CLEANUP
-- Drops unused tables, creates missing ones,
-- adds missing columns, applies RLS
-- =============================================

-- =============================================
-- 1. DROP VIEWS that depend on deprecated tables
-- =============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'guest_eco_point_events' AND relnamespace = 'public'::regnamespace) THEN
    IF (SELECT relkind FROM pg_class WHERE relname = 'guest_eco_point_events' AND relnamespace = 'public'::regnamespace) = 'v' THEN
      DROP VIEW public.guest_eco_point_events CASCADE;
    ELSE
      DROP TABLE public.guest_eco_point_events CASCADE;
    END IF;
  END IF;
END $$;
DROP VIEW IF EXISTS public.staff_directory CASCADE;

-- =============================================
-- 2. DROP UNUSED / DEPRECATED TABLES
-- =============================================
DROP TABLE IF EXISTS public.eco_actions CASCADE;
DROP TABLE IF EXISTS public.eco_points_tx CASCADE;
DROP TABLE IF EXISTS public.guest_onboarding CASCADE;
DROP TABLE IF EXISTS public.eco_points_balance CASCADE;
DROP TABLE IF EXISTS public.staff CASCADE;
DROP TABLE IF EXISTS public.staff_onboarding CASCADE;
DROP TABLE IF EXISTS public.guest_eco_actions CASCADE;

-- =============================================
-- 3. CREATE MISSING TABLES
-- =============================================

-- 3a. sustainability_activities (used by eco-points.ts, sustainability route)
CREATE TABLE IF NOT EXISTS public.sustainability_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    category text,
    default_points integer NOT NULL DEFAULT 10,
    carbon_offset_kg numeric DEFAULT 0,
    color text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- 3b. eco_tiers (used by sustainability route)
CREATE TABLE IF NOT EXISTS public.eco_tiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    min_points integer NOT NULL DEFAULT 0,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- 3c. emergency_contacts (used by emergency-contacts route)
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    phone_number text NOT NULL,
    icon_name text,
    color_hex text,
    is_24h boolean DEFAULT true,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- 3d. guest_eco_point_events (replaces old VIEW, used by eco-points.ts upsert)
CREATE TABLE IF NOT EXISTS public.guest_eco_point_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    activity_id uuid REFERENCES public.sustainability_activities(id) ON DELETE SET NULL,
    source_type text NOT NULL DEFAULT 'MANUAL',
    source_record_id text NOT NULL DEFAULT '',
    source_label text,
    points integer NOT NULL DEFAULT 0,
    carbon_offset_kg numeric DEFAULT 0,
    metadata jsonb DEFAULT '{}',
    status text DEFAULT 'COMPLETED',
    earned_at timestamptz DEFAULT now() NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (source_type, source_record_id)
);

-- =============================================
-- 4. INDEXES FOR NEW TABLES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_sustainability_activities_active ON public.sustainability_activities(is_active);
CREATE INDEX IF NOT EXISTS idx_eco_tiers_sort ON public.eco_tiers(sort_order);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_display_order ON public.emergency_contacts(display_order);
CREATE INDEX IF NOT EXISTS idx_guest_eco_point_events_guest_id ON public.guest_eco_point_events(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_eco_point_events_earned_at ON public.guest_eco_point_events(earned_at);

-- =============================================
-- 5. ADD MISSING COLUMNS TO EXISTING TABLES
-- (safe to re-run, uses IF NOT EXISTS)
-- =============================================

-- 5a. Profiles - add home_address
ALTER TABLE IF EXISTS public.profiles
    ADD COLUMN IF NOT EXISTS home_address text;

-- 5b. Guests - add account_status and home_address
ALTER TABLE IF EXISTS public.guests
    ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS home_address text;

-- Update guests that have auth_id to ACTIVE, leave null auth_id as PENDING
UPDATE public.guests
SET account_status = 'ACTIVE'
WHERE account_status IS NULL AND auth_id IS NOT NULL;

UPDATE public.guests
SET account_status = 'PENDING'
WHERE account_status IS NULL AND auth_id IS NULL;

-- 5c. Food orders - add origin column
ALTER TABLE IF EXISTS public.food_orders
    ADD COLUMN IF NOT EXISTS origin text DEFAULT 'RECEPTION_DESK';

-- 5d. Activity bookings - add origin column
ALTER TABLE IF EXISTS public.activity_bookings
    ADD COLUMN IF NOT EXISTS origin text DEFAULT 'RECEPTION_DESK';

-- =============================================
-- 6. ROW LEVEL SECURITY FOR NEW TABLES
-- =============================================

ALTER TABLE IF EXISTS public.sustainability_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.eco_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.guest_eco_point_events ENABLE ROW LEVEL SECURITY;

-- Staff manage sustainability activities
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sustainability_activities' AND policyname='Staff manage sustainability activities') THEN
        CREATE POLICY "Staff manage sustainability activities" ON public.sustainability_activities FOR ALL USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text IN ('ADMIN', 'MANAGER'))
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sustainability_activities' AND policyname='Staff view sustainability activities') THEN
        CREATE POLICY "Staff view sustainability activities" ON public.sustainability_activities FOR SELECT USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text IN ('ADMIN', 'MANAGER', 'RECEPTIONIST'))
        );
    END IF;
END$$;

-- Staff manage eco tiers
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='eco_tiers' AND policyname='Staff manage eco tiers') THEN
        CREATE POLICY "Staff manage eco tiers" ON public.eco_tiers FOR ALL USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text IN ('ADMIN', 'MANAGER'))
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='eco_tiers' AND policyname='Staff view eco tiers') THEN
        CREATE POLICY "Staff view eco tiers" ON public.eco_tiers FOR SELECT USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text IN ('ADMIN', 'MANAGER', 'RECEPTIONIST'))
        );
    END IF;
END$$;

-- Staff manage eco point events, guests view own
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='guest_eco_point_events' AND policyname='Staff manage eco events') THEN
        CREATE POLICY "Staff manage eco events" ON public.guest_eco_point_events FOR ALL USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text IN ('ADMIN', 'MANAGER', 'RECEPTIONIST'))
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='guest_eco_point_events' AND policyname='Guests view own eco events') THEN
        CREATE POLICY "Guests view own eco events" ON public.guest_eco_point_events FOR SELECT USING (
            guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid())
        );
    END IF;
END$$;

-- =============================================
-- 7. SEED DATA FOR SUSTAINABILITY ACTIVITIES
-- (only inserts if table was just created)
-- =============================================
INSERT INTO public.sustainability_activities (name, category, default_points, carbon_offset_kg, color, is_active)
SELECT * FROM (VALUES
    ('Reuse Towels', 'Housekeeping', 10, 0.5, '#22c55e', true),
    ('Reuse Linens', 'Housekeeping', 15, 0.8, '#16a34a', true),
    ('No Room Service Today', 'Housekeeping', 20, 1.0, '#15803d', true),
    ('Beach Clean-up', 'Activity', 50, 2.5, '#3b82f6', true),
    ('Recycling', 'Waste', 10, 0.3, '#eab308', true),
    ('Energy Saving', 'Energy', 10, 1.0, '#f97316', true),
    ('Water Conservation', 'Water', 10, 0.2, '#06b6d4', true),
    ('Food & Beverage', 'Dining', 25, 0.5, '#f59e0b', true),
    ('Room Service', 'Dining', 20, 0.3, '#d97706', true)
) AS v(name, category, default_points, carbon_offset_kg, color, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.sustainability_activities LIMIT 1);

INSERT INTO public.eco_tiers (name, min_points, sort_order)
SELECT * FROM (VALUES
    ('Bronze', 0, 1),
    ('Silver', 200, 2),
    ('Gold', 500, 3),
    ('Platinum', 1000, 4)
) AS v(name, min_points, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.eco_tiers LIMIT 1);

-- =============================================
-- 8. CLEAN UP OLD INDEXES
-- =============================================
DROP INDEX IF EXISTS public.idx_guest_eco_actions_guest_id;

-- =============================================
-- COMPLETE
-- =============================================

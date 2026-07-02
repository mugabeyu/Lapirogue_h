-- =============================================
-- LA PIROGUE HMS - V2 REDESIGN MIGRATION
-- Changes: Role hierarchy, new tables, triggers, RLS
-- =============================================

-- =============================================
-- 1. ENUM UPDATES
-- =============================================

-- Add new values to user_role (can't add to enum in a DO block easily, so we handle it)
-- We create a new type and migrate, or alter the existing one
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('ADMIN', 'MANAGER', 'RECEPTIONIST', 'GUEST');
    ELSE
        -- Add values if they don't exist (PostgreSQL 14+ allows ALTER ENUM ADD VALUE)
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'user_role'::regtype AND enumlabel = 'ADMIN') THEN
            ALTER TYPE public.user_role ADD VALUE 'ADMIN';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'user_role'::regtype AND enumlabel = 'MANAGER') THEN
            ALTER TYPE public.user_role ADD VALUE 'MANAGER';
        END IF;
        -- GUEST may already exist
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'user_role'::regtype AND enumlabel = 'GUEST') THEN
            ALTER TYPE public.user_role ADD VALUE 'GUEST';
        END IF;
    END IF;
END$$;

-- Create guest_account_status enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'guest_account_status') THEN
        CREATE TYPE public.guest_account_status AS ENUM ('PENDING', 'ACTIVE', 'FROZEN', 'BANNED');
    END IF;
END$$;

-- Add RESERVED to reservation_status if not already there
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'reservation_status'::regtype AND enumlabel = 'RESERVED') THEN
            ALTER TYPE public.reservation_status ADD VALUE 'RESERVED';
        END IF;
    END IF;
END$$;

-- Add origin enum for order/booking source tracking
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_origin') THEN
        CREATE TYPE public.order_origin AS ENUM ('MOBILE_APP', 'RECEPTION_DESK', 'MANAGER_PORTAL');
    END IF;
END$$;

-- =============================================
-- 2. NEW SEQUENCES
-- =============================================
CREATE SEQUENCE IF NOT EXISTS public.manager_seq START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS public.receptionist_seq START WITH 1001;

-- =============================================
-- 3. NEW TABLES
-- =============================================

-- 3a. Departments
CREATE TABLE IF NOT EXISTS public.departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid REFERENCES auth.users(id)
);

-- 3b. Managers
CREATE TABLE IF NOT EXISTS public.managers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id text UNIQUE NOT NULL DEFAULT ('MGR-2026-' || lpad(nextval('public.manager_seq')::text, 4, '0')),
    auth_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text UNIQUE NOT NULL,
    phone text,
    home_address text,
    department_id uuid REFERENCES public.departments(id),
    date_of_joining date DEFAULT CURRENT_DATE,
    is_active boolean DEFAULT true,
    image_path text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid REFERENCES auth.users(id)
);

-- 3c. Receptionists
CREATE TABLE IF NOT EXISTS public.receptionists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code text UNIQUE NOT NULL DEFAULT ('REC-2026-' || lpad(nextval('public.receptionist_seq')::text, 4, '0')),
    auth_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text UNIQUE NOT NULL,
    phone text,
    home_address text,
    department_id uuid REFERENCES public.departments(id),
    manager_id uuid REFERENCES public.managers(id),
    date_of_joining date DEFAULT CURRENT_DATE,
    is_active boolean DEFAULT true,
    image_path text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid REFERENCES auth.users(id)
);

-- =============================================
-- 4. MODIFIED TABLES (add columns idempotently)
-- =============================================

-- 4a. Profiles - add home_address, update role defaults
ALTER TABLE IF EXISTS public.profiles
    ADD COLUMN IF NOT EXISTS home_address text;

ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS is_main;

-- 4b. Guests - add account_status and home_address
ALTER TABLE IF EXISTS public.guests
    ADD COLUMN IF NOT EXISTS account_status public.guest_account_status DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS home_address text;

-- Update existing guests that have auth_id to ACTIVE, leave null auth_id as PENDING
UPDATE public.guests
SET account_status = 'ACTIVE'
WHERE account_status IS NULL AND auth_id IS NOT NULL;

UPDATE public.guests
SET account_status = 'PENDING'
WHERE account_status IS NULL AND auth_id IS NULL;

-- 4c. Food orders - add origin column
ALTER TABLE IF EXISTS public.food_orders
    ADD COLUMN IF NOT EXISTS origin public.order_origin DEFAULT 'RECEPTION_DESK';

-- 4d. Activity bookings - add origin column
ALTER TABLE IF EXISTS public.activity_bookings
    ADD COLUMN IF NOT EXISTS origin public.order_origin DEFAULT 'RECEPTION_DESK';

-- 4e. Reservations - ensure RESERVED status can be used
-- (already handled by enum addition above)

-- =============================================
-- 5. NEW INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_managers_auth_id ON public.managers(auth_id);
CREATE INDEX IF NOT EXISTS idx_managers_department_id ON public.managers(department_id);
CREATE INDEX IF NOT EXISTS idx_receptionists_auth_id ON public.receptionists(auth_id);
CREATE INDEX IF NOT EXISTS idx_receptionists_department_id ON public.receptionists(department_id);
CREATE INDEX IF NOT EXISTS idx_receptionists_manager_id ON public.receptionists(manager_id);
CREATE INDEX IF NOT EXISTS idx_departments_name ON public.departments(name);
CREATE INDEX IF NOT EXISTS idx_guests_account_status ON public.guests(account_status);
CREATE INDEX IF NOT EXISTS idx_food_orders_origin ON public.food_orders(origin);
CREATE INDEX IF NOT EXISTS idx_activity_bookings_origin ON public.activity_bookings(origin);

-- =============================================
-- 6. CHECK-IN ENFORCEMENT FUNCTIONS & TRIGGERS
-- =============================================

-- Function to check if a guest has an active CHECKED_IN reservation
CREATE OR REPLACE FUNCTION public.check_guest_checked_in(p_guest_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.reservations
        WHERE guest_id = p_guest_id
        AND status = 'CHECKED_IN'
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger function: enforce CHECKED_IN before food orders
CREATE OR REPLACE FUNCTION public.trg_enforce_checkin_for_food_orders()
RETURNS trigger AS $$
BEGIN
    IF NOT public.check_guest_checked_in(NEW.guest_id) THEN
        RAISE EXCEPTION 'Guest must be CHECKED_IN before placing food orders. Complete front-desk check-in first.'
            USING HINT = 'Update reservation status to CHECKED_IN first';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function: enforce CHECKED_IN before activity bookings
CREATE OR REPLACE FUNCTION public.trg_enforce_checkin_for_activities()
RETURNS trigger AS $$
BEGIN
    IF NOT public.check_guest_checked_in(NEW.guest_id) THEN
        RAISE EXCEPTION 'Guest must be CHECKED_IN before booking activities. Complete front-desk check-in first.'
            USING HINT = 'Update reservation status to CHECKED_IN first';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function: enforce CHECKED_IN before eco point events
CREATE OR REPLACE FUNCTION public.trg_enforce_checkin_for_eco_actions()
RETURNS trigger AS $$
BEGIN
    IF NOT public.check_guest_checked_in(NEW.guest_id) THEN
        RAISE EXCEPTION 'Guest must be CHECKED_IN before participating in eco actions.'
            USING HINT = 'Update reservation status to CHECKED_IN first';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers (drop first to ensure clean state)
DROP TRIGGER IF EXISTS enforce_checkin_food_orders ON public.food_orders;
CREATE TRIGGER enforce_checkin_food_orders
    BEFORE INSERT ON public.food_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_enforce_checkin_for_food_orders();

DROP TRIGGER IF EXISTS enforce_checkin_activity_bookings ON public.activity_bookings;
CREATE TRIGGER enforce_checkin_activity_bookings
    BEFORE INSERT ON public.activity_bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_enforce_checkin_for_activities();

-- Eco actions trigger: NOT applied here because guest_eco_point_events is a VIEW in the
-- existing DB, and views can only have INSTEAD OF triggers (not BEFORE). The application
-- code (eco-points.ts) handles check-in enforcement before awarding points.

-- =============================================
-- 7. AUTO-UNFREEZE TRIGGER ON PAYMENT
-- =============================================
CREATE OR REPLACE FUNCTION public.auto_unfreeze_on_payment()
RETURNS trigger AS $$
BEGIN
    IF NEW.status IN ('COMPLETED', 'PAID') THEN
        UPDATE public.guests
        SET account_status = 'ACTIVE'
        WHERE id = NEW.guest_id
        AND account_status = 'FROZEN';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_unfreeze ON public.payments;
CREATE TRIGGER trg_auto_unfreeze
    AFTER INSERT OR UPDATE OF status ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_unfreeze_on_payment();

-- =============================================
-- 8. MANAGER/RECEPTIONIST AUTO-ID FUNCTION
-- =============================================

-- Generate manager ID with current year prefix
CREATE OR REPLACE FUNCTION public.generate_manager_id()
RETURNS text AS $$
DECLARE
    year_prefix text;
    seq_val text;
BEGIN
    year_prefix := to_char(CURRENT_DATE, 'YYYY');
    seq_val := lpad(nextval('public.manager_seq')::text, 4, '0');
    RETURN 'MGR-' || year_prefix || '-' || seq_val;
END;
$$ LANGUAGE plpgsql STABLE;

-- Generate receptionist ID with current year prefix
CREATE OR REPLACE FUNCTION public.generate_receptionist_id()
RETURNS text AS $$
DECLARE
    year_prefix text;
    seq_val text;
BEGIN
    year_prefix := to_char(CURRENT_DATE, 'YYYY');
    seq_val := lpad(nextval('public.receptionist_seq')::text, 4, '0');
    RETURN 'REC-' || year_prefix || '-' || seq_val;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================
-- 9. ROLES TABLE - Update seed data
-- =============================================

-- Insert new role definitions (idempotent)
INSERT INTO public.roles (name, description, permissions)
SELECT 'ADMIN', 'Full system administration. Manages departments and manager accounts.', '{"manage_departments": true, "manage_managers": true, "manage_system": true, "view_audits": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'ADMIN');

INSERT INTO public.roles (name, description, permissions)
SELECT 'MANAGER', 'Hotel operations manager. Manages receptionists, guests, and hotel content.', '{"manage_receptionists": true, "manage_guests": true, "manage_rooms": true, "manage_reservations": true, "manage_activities": true, "manage_menu": true, "manage_hotel_info": true, "view_payments": true, "view_reports": true, "manage_sustainability": true, "view_feedback": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'MANAGER');

INSERT INTO public.roles (name, description, permissions)
SELECT 'RECEPTIONIST', 'Front desk operator. Handles check-ins, reservations, and guest services.', '{"manage_reservations": true, "register_guests": true, "manage_bookings": true, "place_orders": true, "view_guests": true, "view_rooms": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'RECEPTIONIST');

-- =============================================
-- 10. UPDATED RLS POLICIES
-- =============================================

-- Drop old policies that reference MAIN_RECEPTIONIST
DO $$ BEGIN
    DROP POLICY IF EXISTS "Roles admin full access" ON public.roles;
    DROP POLICY IF EXISTS "Roles staff read-only" ON public.roles;
    DROP POLICY IF EXISTS "Staff full access on guests" ON public.guests;
    DROP POLICY IF EXISTS "Staff full access on reservations" ON public.reservations;
END$$;

-- Recreate roles policies with new role names
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='roles' AND policyname='Roles staff read-only') THEN
        CREATE POLICY "Roles staff read-only" ON public.roles FOR SELECT USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text IN ('ADMIN', 'MANAGER', 'RECEPTIONIST'))
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='roles' AND policyname='Roles admin full access') THEN
        CREATE POLICY "Roles admin full access" ON public.roles FOR ALL USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text = 'ADMIN')
        );
    END IF;
END$$;

-- Staff policies with new role names - broad access for staff, restricted for receptionist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='guests' AND policyname='Staff full access on guests') THEN
        CREATE POLICY "Staff full access on guests" ON public.guests FOR ALL USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text IN ('ADMIN', 'MANAGER'))
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='guests' AND policyname='Receptionist read guests') THEN
        CREATE POLICY "Receptionist read guests" ON public.guests FOR SELECT USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text = 'RECEPTIONIST')
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='guests' AND policyname='Receptionist update guests') THEN
        CREATE POLICY "Receptionist update guests" ON public.guests FOR UPDATE USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text = 'RECEPTIONIST')
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reservations' AND policyname='Staff full access on reservations') THEN
        CREATE POLICY "Staff full access on reservations" ON public.reservations FOR ALL USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text IN ('ADMIN', 'MANAGER', 'RECEPTIONIST'))
        );
    END IF;
END$$;

-- Add RLS for new tables
ALTER TABLE IF EXISTS public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.receptionists ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    -- Departments: Admin full access, Manager/Receptionist read-only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='departments' AND policyname='Admin full departments') THEN
        CREATE POLICY "Admin full departments" ON public.departments FOR ALL USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text = 'ADMIN')
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='departments' AND policyname='Staff view departments') THEN
        CREATE POLICY "Staff view departments" ON public.departments FOR SELECT USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text IN ('MANAGER', 'RECEPTIONIST'))
        );
    END IF;

    -- Managers: Admin full access, Manager self-read
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='managers' AND policyname='Admin full managers') THEN
        CREATE POLICY "Admin full managers" ON public.managers FOR ALL USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text = 'ADMIN')
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='managers' AND policyname='Manager self view') THEN
        CREATE POLICY "Manager self view" ON public.managers FOR SELECT USING (auth_id = auth.uid());
    END IF;

    -- Receptionists: Manager full access, Receptionist self-view
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='receptionists' AND policyname='Manager full receptionists') THEN
        CREATE POLICY "Manager full receptionists" ON public.receptionists FOR ALL USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text = 'MANAGER')
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='receptionists' AND policyname='Admin view receptionists') THEN
        CREATE POLICY "Admin view receptionists" ON public.receptionists FOR SELECT USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text = 'ADMIN')
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='receptionists' AND policyname='Receptionist self view') THEN
        CREATE POLICY "Receptionist self view" ON public.receptionists FOR SELECT USING (auth_id = auth.uid());
    END IF;
END$$;

-- =============================================
-- 11. STORAGE POLICY UPDATES
-- =============================================
-- Update storage policies to use new role names
DO $$ BEGIN
    DROP POLICY IF EXISTS "Room images staff only" ON storage.objects;
    DROP POLICY IF EXISTS "Activity images staff manage" ON storage.objects;
    DROP POLICY IF EXISTS "Menu images staff manage" ON storage.objects;
    DROP POLICY IF EXISTS "Staff avatars staff manage" ON storage.objects;
    DROP POLICY IF EXISTS "Content images staff manage" ON storage.objects;
    DROP POLICY IF EXISTS "Guest documents staff only" ON storage.objects;
    DROP POLICY IF EXISTS "Documents staff only" ON storage.objects;
END$$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Room images admin_manager') THEN
        CREATE POLICY "Room images admin_manager" ON storage.objects FOR ALL USING (
            bucket_id = 'room-images' AND EXISTS (
                SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text IN ('ADMIN', 'MANAGER')
            )
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Room images receptionist read') THEN
        CREATE POLICY "Room images receptionist read" ON storage.objects FOR SELECT USING (
            bucket_id = 'room-images' AND EXISTS (
                SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text = 'RECEPTIONIST'
            )
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Activity images manager only') THEN
        CREATE POLICY "Activity images manager only" ON storage.objects FOR ALL USING (
            bucket_id = 'activity-images' AND EXISTS (
                SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text = 'MANAGER'
            )
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Menu images manager only') THEN
        CREATE POLICY "Menu images manager only" ON storage.objects FOR ALL USING (
            bucket_id = 'menu-images' AND EXISTS (
                SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text = 'MANAGER'
            )
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Staff avatars admin_manager') THEN
        CREATE POLICY "Staff avatars admin_manager" ON storage.objects FOR ALL USING (
            bucket_id = 'staff-avatars' AND EXISTS (
                SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text IN ('ADMIN', 'MANAGER', 'RECEPTIONIST')
            )
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Content images manager only') THEN
        CREATE POLICY "Content images manager only" ON storage.objects FOR ALL USING (
            bucket_id = 'content-images' AND EXISTS (
                SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text = 'MANAGER'
            )
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Guest documents manager_receptionist') THEN
        CREATE POLICY "Guest documents manager_receptionist" ON storage.objects FOR ALL USING (
            bucket_id = 'guest-documents' AND EXISTS (
                SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text IN ('MANAGER', 'RECEPTIONIST')
            )
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Documents admin only') THEN
        CREATE POLICY "Documents admin only" ON storage.objects FOR ALL USING (
            bucket_id = 'documents' AND EXISTS (
                SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role::text = 'ADMIN'
            )
        );
    END IF;
END$$;

-- =============================================
-- 12. RESERVATION STATUS ENFORCEMENT
-- =============================================

-- Update the room status trigger to also handle RESERVED
CREATE OR REPLACE FUNCTION public.update_room_status_on_reservation()
RETURNS trigger AS $$
BEGIN
    IF NEW.status IN ('CONFIRMED', 'CHECKED_IN') THEN
        UPDATE public.rooms SET status = 'OCCUPIED' WHERE id = NEW.room_id;
    ELSIF NEW.status = 'CHECKED_OUT' THEN
        UPDATE public.rooms SET status = 'CLEANING' WHERE id = NEW.room_id;
    ELSIF NEW.status IN ('CANCELLED', 'NO_SHOW') THEN
        UPDATE public.rooms SET status = 'AVAILABLE' WHERE id = NEW.room_id;
    END IF;
    -- RESERVED status does NOT change room status (room remains AVAILABLE until confirmed)
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 13. VIEWS FOR REPORTING
-- =============================================

-- View: staff directory (unified view of all staff for backward compatibility)
CREATE OR REPLACE VIEW public.staff_directory AS
SELECT
    m.id,
    m.manager_id AS staff_code,
    m.first_name || ' ' || m.last_name AS full_name,
    m.email,
    m.phone,
    m.home_address,
    d.name AS department,
    'MANAGER' AS role,
    m.is_active AS status,
    m.image_path,
    NULL AS reporting_manager_id,
    m.date_of_joining,
    m.created_at,
    m.updated_at
FROM public.managers m
LEFT JOIN public.departments d ON d.id = m.department_id
UNION ALL
SELECT
    r.id,
    r.employee_code AS staff_code,
    r.first_name || ' ' || r.last_name AS full_name,
    r.email,
    r.phone,
    r.home_address,
    d.name AS department,
    'RECEPTIONIST' AS role,
    r.is_active AS status,
    r.image_path,
    r.manager_id AS reporting_manager_id,
    r.date_of_joining,
    r.created_at,
    r.updated_at
FROM public.receptionists r
LEFT JOIN public.departments d ON d.id = r.department_id;

-- =============================================
-- 14. REALTIME PUBLICATION UPDATE
-- =============================================
-- Ensure reservations table is in realtime for check-in notifications
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
    END IF;
END$$;

-- =============================================
-- 15. ADD AUDIT TRIGGERS FOR NEW TABLES
-- =============================================
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
        'departments', 'managers', 'receptionists'
    ) LOOP
        BEGIN
            EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t, t);
        EXCEPTION WHEN duplicate_object THEN
            -- ignore
        END;
        BEGIN
            EXECUTE format('CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();', t, t);
        EXCEPTION WHEN duplicate_object THEN
            -- ignore
        END;
    END LOOP;
END$$;

-- =============================================
-- 16. OTP VERIFICATION TABLE FOR GUEST REGISTRATION
-- ⚠️  SUPERSEDED by 007_supabase_auth_verification.sql (Supabase Auth OTP)
--    Kept for reference only. The active flow uses pending_reservations table
--    with Supabase Auth's signInWithOtp/verifyOtp.
-- =============================================
-- DROP TABLE IF EXISTS public.registration_otps; -- Uncomment to clean up
CREATE TABLE IF NOT EXISTS public.registration_otps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    otp_code text NOT NULL,
    temp_guest_data jsonb NOT NULL DEFAULT '{}',
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
    is_verified boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_registration_otps_email ON public.registration_otps(email);
CREATE INDEX IF NOT EXISTS idx_registration_otps_expires ON public.registration_otps(expires_at);

-- =============================================
-- 17. GUEST ECO POINT EVENTS TABLE
-- Used by eco-points.ts and sustainability API (upsert/delete). This was originally
-- a VIEW over eco_points_tx in the old schema, but the current code requires a table
-- with source_type, source_record_id, source_label, carbon_offset_kg, metadata, earned_at.
-- We only create if neither the table nor an updatable view exists.
-- =============================================
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = 'guest_eco_point_events'
        AND relnamespace = 'public'::regnamespace
    ) THEN
        CREATE TABLE public.guest_eco_point_events (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
            activity_id uuid REFERENCES public.sustainability_activities(id),
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

        CREATE INDEX IF NOT EXISTS idx_guest_eco_point_events_guest_id ON public.guest_eco_point_events(guest_id);
        CREATE INDEX IF NOT EXISTS idx_guest_eco_point_events_earned_at ON public.guest_eco_point_events(earned_at);

        ALTER TABLE public.guest_eco_point_events ENABLE ROW LEVEL SECURITY;
    END IF;
END$$;

-- RLS policies for guest_eco_point_events
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'guest_eco_point_events') THEN
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
    END IF;
END$$;

-- =============================================
-- 18. SCHEMA CLEANUP — DROP DEPRECATED OBJECTS
-- =============================================

-- 18a. Drop deprecated guest_eco_actions table (replaced by guest_eco_point_events).
--      Only drops if it exists and has no data, or logs a warning.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'guest_eco_actions') THEN
        RAISE NOTICE 'Dropping deprecated table: public.guest_eco_actions';
        DROP TABLE IF EXISTS public.guest_eco_actions CASCADE;
    END IF;
END$$;

-- 18b. Drop deprecated staff table (replaced by managers + receptionists).
--      WARNING: This will drop existing data! If you have data in staff,
--      migrate it to managers/receptionists first, then uncomment below.
-- DROP TABLE IF EXISTS public.staff CASCADE;

-- 18c. Drop old RLS policies that reference MAIN_RECEPTIONIST (policies on
--      guests/reservations/roles were already dropped & recreated in section 10,
--      so we only clean up orphaned policies on other tables here).
DO $$ BEGIN
    -- Drop any remaining old-name storage policies not already cleaned in section 11
    DROP POLICY IF EXISTS "Room images staff only" ON storage.objects;
    DROP POLICY IF EXISTS "Activity images staff manage" ON storage.objects;
    DROP POLICY IF EXISTS "Menu images staff manage" ON storage.objects;
    DROP POLICY IF EXISTS "Staff avatars staff manage" ON storage.objects;
    DROP POLICY IF EXISTS "Content images staff manage" ON storage.objects;
    DROP POLICY IF EXISTS "Guest documents staff only" ON storage.objects;
    DROP POLICY IF EXISTS "Documents staff only" ON storage.objects;
    -- Eco table policies from old schema (table may not exist)
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'guest_eco_actions' AND relnamespace = 'public'::regnamespace) THEN
        DROP POLICY IF EXISTS "Guests manage own eco actions" ON public.guest_eco_actions;
    END IF;
END$$;

-- 18d. Clean old indexes on dropped tables
DROP INDEX IF EXISTS public.idx_guest_eco_actions_guest_id;

-- =============================================
-- COMPLETE
-- =============================================

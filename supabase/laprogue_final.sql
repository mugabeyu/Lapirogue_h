-- =============================================
-- LA PIROGUE HMS - CONSOLIDATED SUPABASE SCHEMA (FINAL)
-- Generated: Consolidated from existing schema + app requirements
-- Safe to run multiple times (uses IF NOT EXISTS where practical)
-- DO NOT DROP TABLES: this script only creates missing objects and policies.
-- =============================================

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================
-- ENUMS / CUSTOM TYPES
-- =============================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('MAIN_RECEPTIONIST', 'RECEPTIONIST', 'GUEST');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_type') THEN
        CREATE TYPE public.room_type AS ENUM ('STANDARD', 'DELUXE', 'SUITE', 'VILLA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_status') THEN
        CREATE TYPE public.room_status AS ENUM ('AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status') THEN
        CREATE TYPE public.reservation_status AS ENUM ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'guest_status') THEN
        CREATE TYPE public.guest_status AS ENUM ('RESERVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE public.payment_method AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE public.payment_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PAID', 'PARTIALLY_PAID');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE public.order_status AS ENUM ('PENDING', 'PREPARING', 'SERVED', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_status') THEN
        CREATE TYPE public.activity_status AS ENUM ('ACTIVE', 'INACTIVE', 'FULL');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'eco_tx_type') THEN
        CREATE TYPE public.eco_tx_type AS ENUM ('EARN', 'SPEND', 'ADJUST');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'eco_tx_status') THEN
        CREATE TYPE public.eco_tx_status AS ENUM ('COMPLETED', 'PENDING', 'FAILED');
    END IF;
END$$;

-- =============================================
-- SEQUENCES
-- =============================================
CREATE SEQUENCE IF NOT EXISTS public.guest_seq START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS public.reservation_seq START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS public.food_order_seq START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS public.payment_seq START WITH 1001;

-- =============================================
-- CORE TABLES (IF MISSING)
-- Note: this script creates missing tables only (IF NOT EXISTS)
-- =============================================

-- 1. Profiles (Staff)
CREATE TABLE IF NOT EXISTS public.profiles (
    auth_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    email text,
    role public.user_role NOT NULL DEFAULT 'RECEPTIONIST',
    is_main boolean NOT NULL DEFAULT false,
    avatar_url text,
    phone text,
    is_active boolean NOT NULL DEFAULT true,
    fcm_token text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);

-- 2. Staff Directory
CREATE TABLE IF NOT EXISTS public.staff (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code text UNIQUE NOT NULL,
    full_name text NOT NULL,
    department text NOT NULL,
    position text NOT NULL,
    email text,
    phone text,
    status text DEFAULT 'ACTIVE',
    image_path text,
    auth_user_id uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);

-- 3. Guests (Linked with Supabase Auth)
CREATE TABLE IF NOT EXISTS public.guests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    guest_id text UNIQUE NOT NULL DEFAULT ('G' || lpad(nextval('public.guest_seq')::text, 4, '0')),
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text,
    phone text,
    nationality text,
    passport text,
    passport_number text,
    date_of_birth date,
    vip boolean DEFAULT false,
    status public.guest_status DEFAULT 'RESERVED',
    notes text,
    image_path text,
    fcm_token text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);

ALTER TABLE IF EXISTS public.guests
  ADD COLUMN IF NOT EXISTS passport text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'guests' AND column_name = 'passport_number'
  ) THEN
    UPDATE public.guests
    SET passport = passport_number
    WHERE passport IS NULL AND passport_number IS NOT NULL;
  END IF;
END$$;

-- 4. Rooms
CREATE TABLE IF NOT EXISTS public.rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_number text UNIQUE NOT NULL,
    type public.room_type NOT NULL,
    floor text,
    capacity integer NOT NULL DEFAULT 2 CHECK (capacity > 0),
    price numeric(10,2) NOT NULL CHECK (price >= 0),
    status public.room_status DEFAULT 'AVAILABLE' NOT NULL,
    description text,
    amenities text[] DEFAULT '{}',
    image_path text,
    image_paths text[] DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);

-- 5. Reservations
CREATE TABLE IF NOT EXISTS public.reservations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id text UNIQUE NOT NULL DEFAULT ('R' || lpad(nextval('public.reservation_seq')::text, 4, '0')),
    guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    room_id uuid NOT NULL REFERENCES public.rooms(id),
    check_in date NOT NULL,
    check_out date NOT NULL CHECK (check_out > check_in),
    adults integer NOT NULL DEFAULT 1 CHECK (adults > 0),
    children integer DEFAULT 0 CHECK (children >= 0),
    status public.reservation_status DEFAULT 'CONFIRMED' NOT NULL,
    total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);

-- 6. Activities
CREATE TABLE IF NOT EXISTS public.activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    category text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    duration integer NOT NULL DEFAULT 60 CHECK (duration > 0),
    capacity integer NOT NULL DEFAULT 10 CHECK (capacity > 0),
    status public.activity_status DEFAULT 'ACTIVE',
    image_path text,
    meeting_point text,
    default_time time DEFAULT '09:00',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);

CREATE TABLE IF NOT EXISTS public.activity_bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    booking_date date NOT NULL,
    booking_time time,
    participants integer NOT NULL DEFAULT 1 CHECK (participants > 0),
    status text DEFAULT 'CONFIRMED',
    pickup_point text,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);

-- 7. Guest Schedule
CREATE TABLE IF NOT EXISTS public.guest_schedule_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    title text NOT NULL,
    item_type text NOT NULL DEFAULT 'ACTIVITY',
    start_at timestamptz NOT NULL,
    end_at timestamptz NOT NULL,
    location text,
    description text,
    status text DEFAULT 'SCHEDULED',
    color text DEFAULT '#3B82F6',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    source_module text,
    source_record_id uuid,
    notes text
);

-- 8. Food & Beverage
CREATE TABLE IF NOT EXISTS public.menu_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    category text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL CHECK (price >= 0),
    preparation_minutes integer DEFAULT 15,
    is_available boolean DEFAULT true,
    image_path text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);

CREATE TABLE IF NOT EXISTS public.food_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id text UNIQUE NOT NULL DEFAULT ('FO' || lpad(nextval('public.food_order_seq')::text, 4, '0')),
    guest_id uuid REFERENCES public.guests(id) ON DELETE CASCADE,
    room_id uuid REFERENCES public.rooms(id),
    items jsonb NOT NULL DEFAULT '[]',
    subtotal numeric(10,2) NOT NULL DEFAULT 0,
    service_charge numeric(10,2) DEFAULT 0,
    tax_amount numeric(10,2) DEFAULT 0,
    total numeric(10,2) NOT NULL DEFAULT 0,
    status public.order_status DEFAULT 'PENDING',
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);

CREATE TABLE IF NOT EXISTS public.guest_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id text UNIQUE NOT NULL,
    guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    room_id uuid REFERENCES public.rooms(id),
    total_price numeric(10,2) NOT NULL,
    status text DEFAULT 'PENDING',
    order_time timestamptz DEFAULT now(),
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    order_type text
);

CREATE TABLE IF NOT EXISTS public.guest_order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_order_id uuid NOT NULL REFERENCES public.guest_orders(id) ON DELETE CASCADE,
    menu_item_id uuid REFERENCES public.menu_items(id),
    item_name text NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    unit_price numeric(10,2) NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- 9. Payments
CREATE TABLE IF NOT EXISTS public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id text UNIQUE NOT NULL DEFAULT ('P' || lpad(nextval('public.payment_seq')::text, 4, '0')),
    guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    reservation_id uuid REFERENCES public.reservations(id),
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    method public.payment_method NOT NULL,
    status public.payment_status DEFAULT 'PENDING',
    reference text,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);

CREATE TABLE IF NOT EXISTS public.payment_extra_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id uuid REFERENCES public.payments(id) ON DELETE CASCADE,
    guest_id uuid REFERENCES public.guests(id) ON DELETE CASCADE,
    category text NOT NULL,
    label text NOT NULL,
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- 10. Messaging & Notifications
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    sender_type text NOT NULL DEFAULT 'staff',
    content text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id uuid REFERENCES public.guests(id) ON DELETE CASCADE,
    title text NOT NULL,
    message text NOT NULL,
    category text DEFAULT 'General',
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- 11. Feedback
CREATE TABLE IF NOT EXISTS public.guest_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
    category text NOT NULL,
    comment text,
    staff_response text,
    responded_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- 12. Hotel Services & Emergency
CREATE TABLE IF NOT EXISTS public.hotel_service_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    icon_name text,
    color_hex text,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.hotel_services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid REFERENCES public.hotel_service_categories(id),
    name text NOT NULL,
    description text,
    phone_number text,
    email text,
    hours_text text,
    location text,
    image_url text,
    sort_order integer DEFAULT 0,
    is_available boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

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

-- Sustainability & eco
CREATE TABLE IF NOT EXISTS public.eco_points_balance (
    guest_id uuid PRIMARY KEY REFERENCES public.guests(id) ON DELETE CASCADE,
    points integer DEFAULT 0 NOT NULL,
    tier text DEFAULT 'Bronze'
);

CREATE TABLE IF NOT EXISTS public.eco_points_tx (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    tx_type public.eco_tx_type NOT NULL,
    points integer NOT NULL,
    description text,
    status public.eco_tx_status DEFAULT 'COMPLETED',
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE VIEW public.guest_eco_point_events AS
    SELECT id, guest_id, tx_type AS activity_id, points, description, status, created_at FROM public.eco_points_tx;

-- Function to increment eco points and update tier
CREATE OR REPLACE FUNCTION public.increment_eco_points(p_guest_id uuid, p_points integer)
RETURNS void AS $$
BEGIN
    -- Insert or update balance
    INSERT INTO public.eco_points_balance (guest_id, points, tier)
    VALUES (p_guest_id, p_points, 'Bronze')
    ON CONFLICT (guest_id)
    DO UPDATE SET
        points = eco_points_balance.points + p_points,
        tier = CASE
            WHEN (eco_points_balance.points + p_points) >= 1000 THEN 'Platinum'
            WHEN (eco_points_balance.points + p_points) >= 500 THEN 'Gold'
            WHEN (eco_points_balance.points + p_points) >= 200 THEN 'Silver'
            ELSE 'Bronze'
        END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eco Actions - Available sustainability actions guests can participate in
CREATE TABLE IF NOT EXISTS public.eco_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    points integer NOT NULL DEFAULT 10 CHECK (points > 0),
    icon_name text DEFAULT 'eco',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Track guest participation in eco actions
CREATE TABLE IF NOT EXISTS public.guest_eco_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    eco_action_id uuid NOT NULL REFERENCES public.eco_actions(id) ON DELETE CASCADE,
    earned_points integer NOT NULL DEFAULT 0,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Seed eco actions (run only if table is empty)
INSERT INTO public.eco_actions (title, description, points, icon_name)
SELECT 'Beach Clean-up Program', 'Participate in our weekly beach clean-up initiative', 50, 'beach'
WHERE NOT EXISTS (SELECT 1 FROM public.eco_actions WHERE title = 'Beach Clean-up Program');

INSERT INTO public.eco_actions (title, description, points, icon_name)
SELECT 'Reuse Towels & Linens', 'Opt out of daily towel and linen replacement', 10, 'towel'
WHERE NOT EXISTS (SELECT 1 FROM public.eco_actions WHERE title = 'Reuse Towels & Linens');

INSERT INTO public.eco_actions (title, description, points, icon_name)
SELECT 'Digital Invoice', 'Choose digital invoice instead of printed receipt', 15, 'digital'
WHERE NOT EXISTS (SELECT 1 FROM public.eco_actions WHERE title = 'Digital Invoice');

INSERT INTO public.eco_actions (title, description, points, icon_name)
SELECT 'Sustainability Workshop', 'Attend our eco-friendly sustainability workshops', 30, 'workshop'
WHERE NOT EXISTS (SELECT 1 FROM public.eco_actions WHERE title = 'Sustainability Workshop');

INSERT INTO public.eco_actions (title, description, points, icon_name)
SELECT 'Use Bicycle', 'Use hotel bicycles instead of transport services', 20, 'bicycle'
WHERE NOT EXISTS (SELECT 1 FROM public.eco_actions WHERE title = 'Use Bicycle');

INSERT INTO public.eco_actions (title, description, points, icon_name)
SELECT 'Environmental Tour', 'Join our guided environmental awareness tours', 25, 'tour'
WHERE NOT EXISTS (SELECT 1 FROM public.eco_actions WHERE title = 'Environmental Tour');

INSERT INTO public.eco_actions (title, description, points, icon_name)
SELECT 'Decline Room Cleaning', 'Skip daily room cleaning service', 15, 'cleaning'
WHERE NOT EXISTS (SELECT 1 FROM public.eco_actions WHERE title = 'Decline Room Cleaning');

INSERT INTO public.eco_actions (title, description, points, icon_name)
SELECT 'Refillable Water Station', 'Use refillable water stations during stay', 5, 'water'
WHERE NOT EXISTS (SELECT 1 FROM public.eco_actions WHERE title = 'Refillable Water Station');

-- Itinerary events
CREATE TABLE IF NOT EXISTS public.itinerary_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id uuid REFERENCES public.guests(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    category text,
    start_at timestamptz NOT NULL,
    end_at timestamptz NOT NULL,
    location text,
    status text DEFAULT 'CONFIRMED',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Site content pages
CREATE TABLE IF NOT EXISTS public.site_content_pages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text UNIQUE NOT NULL,
    title text NOT NULL,
    subtitle text,
    body text,
    highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
    metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
    image_path text,
    updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    is_active boolean NOT NULL DEFAULT true,
    metadata jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE IF EXISTS public.site_content_pages
    ADD COLUMN IF NOT EXISTS subtitle text,
    ADD COLUMN IF NOT EXISTS highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS image_path text,
    ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.site_content_pages
SET
    subtitle = COALESCE(subtitle, NULLIF(metadata->>'subtitle', '')),
    highlights = CASE
        WHEN jsonb_typeof(metadata->'highlights') = 'array' AND highlights = '[]'::jsonb
            THEN metadata->'highlights'
        ELSE highlights
    END,
    metrics = CASE
        WHEN jsonb_typeof(metadata->'metrics') = 'array' AND metrics = '[]'::jsonb
            THEN metadata->'metrics'
        ELSE metrics
    END,
    image_path = COALESCE(image_path, NULLIF(metadata->>'image_path', ''), NULLIF(metadata->>'imagePath', '')),
    is_active = COALESCE(
        is_active,
        CASE
            WHEN metadata ? 'is_active' THEN (metadata->>'is_active')::boolean
            WHEN metadata ? 'isActive' THEN (metadata->>'isActive')::boolean
            ELSE true
        END,
        true
    )
WHERE metadata IS NOT NULL;

-- Audit
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name text NOT NULL,
    record_id uuid,
    action text NOT NULL,
    actor_id uuid,
    previous_data jsonb,
    new_data jsonb,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_guests_auth_id ON public.guests(auth_id);
CREATE INDEX IF NOT EXISTS idx_guests_email ON public.guests(email);
CREATE INDEX IF NOT EXISTS idx_reservations_guest_id ON public.reservations(guest_id);
CREATE INDEX IF NOT EXISTS idx_reservations_room_id ON public.reservations(room_id);
CREATE INDEX IF NOT EXISTS idx_activity_bookings_guest_id ON public.activity_bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_messages_guest_id ON public.messages(guest_id);
CREATE INDEX IF NOT EXISTS idx_notifications_guest_id ON public.notifications(guest_id);
CREATE INDEX IF NOT EXISTS idx_payments_guest_id ON public.payments(guest_id);
CREATE INDEX IF NOT EXISTS idx_food_orders_guest_id ON public.food_orders(guest_id);
CREATE INDEX IF NOT EXISTS idx_eco_points_tx_guest_id ON public.eco_points_tx(guest_id);
CREATE INDEX IF NOT EXISTS idx_eco_actions_active ON public.eco_actions(is_active);
CREATE INDEX IF NOT EXISTS idx_guest_eco_actions_guest_id ON public.guest_eco_actions(guest_id);

-- =============================================
-- ROLES TABLE (for staff management)
-- =============================================
CREATE TABLE IF NOT EXISTS public.roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    permissions jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Seed default roles (run only if table is empty)
INSERT INTO public.roles (name, description, permissions)
SELECT 'MAIN_RECEPTIONIST', 'Full administrative access to all hotel management features', '{"manage_staff": true, "manage_rooms": true, "manage_reservations": true, "manage_payments": true, "manage_guests": true, "view_reports": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'MAIN_RECEPTIONIST');

INSERT INTO public.roles (name, description, permissions)
SELECT 'RECEPTIONIST', 'Standard receptionist access with limited permissions', '{"manage_reservations": true, "manage_guests": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'RECEPTIONIST');

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
    'profiles','guests','rooms','reservations','activities','activity_bookings','guest_schedule_items', 'menu_items','food_orders','guest_orders','guest_order_items','payments','payment_extra_items','messages','hotel_service_categories','hotel_services','emergency_contacts','eco_points_tx','eco_actions','guest_eco_actions','site_content_pages','itinerary_events','roles'
  ) LOOP
    BEGIN
      EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t, t);
    EXCEPTION WHEN duplicate_object THEN
      -- ignore
    END;
  END LOOP;
END$$;

CREATE OR REPLACE FUNCTION public.update_room_status_on_reservation()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IN ('CONFIRMED','CHECKED_IN') THEN
    UPDATE public.rooms SET status = 'OCCUPIED' WHERE id = NEW.room_id;
  ELSIF NEW.status = 'CHECKED_OUT' THEN
    UPDATE public.rooms SET status = 'CLEANING' WHERE id = NEW.room_id;
  ELSIF NEW.status = 'CANCELLED' THEN
    UPDATE public.rooms SET status = 'AVAILABLE' WHERE id = NEW.room_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_reservation_room_status ON public.reservations;
CREATE TRIGGER trg_reservation_room_status AFTER INSERT OR UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.update_room_status_on_reservation();

CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.audit_logs(table_name, record_id, action, actor_id, previous_data, new_data)
  VALUES (TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP, auth.uid(), 
          CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
          to_jsonb(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
    'profiles','guests','reservations','activities','payments','food_orders','messages','guest_feedback','hotel_services','guest_orders','eco_points_tx','guest_eco_actions','roles'
  ) LOOP
    BEGIN
      EXECUTE format('CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();', t, t);
    EXCEPTION WHEN duplicate_object THEN
      -- ignore
    END;
  END LOOP;
END$$;

-- =============================================
-- RLS POLICIES
-- =============================================
ALTER TABLE IF EXISTS public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.guest_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.food_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.guest_schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.eco_points_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.eco_points_tx ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.guest_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.eco_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.guest_eco_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.roles ENABLE ROW LEVEL SECURITY;

-- Guest policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='guests' AND policyname='Guests view own profile') THEN
    CREATE POLICY "Guests view own profile" ON public.guests FOR SELECT USING (auth.uid() = auth_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reservations' AND policyname='Guests view own reservations') THEN
    CREATE POLICY "Guests view own reservations" ON public.reservations FOR SELECT USING (guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='activity_bookings' AND policyname='Guests view own bookings') THEN
    CREATE POLICY "Guests view own bookings" ON public.activity_bookings FOR SELECT USING (guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='guest_schedule_items' AND policyname='Guests view own schedule') THEN
    CREATE POLICY "Guests view own schedule" ON public.guest_schedule_items FOR SELECT USING (guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages' AND policyname='Guests view own messages') THEN
    CREATE POLICY "Guests view own messages" ON public.messages FOR ALL USING (guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='Guests view own notifications') THEN
    CREATE POLICY "Guests view own notifications" ON public.notifications FOR SELECT USING (guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='guest_feedback' AND policyname='Guests view own feedback') THEN
    CREATE POLICY "Guests view own feedback" ON public.guest_feedback FOR ALL USING (guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payments' AND policyname='Guests view own payments') THEN
    CREATE POLICY "Guests view own payments" ON public.payments FOR SELECT USING (guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='food_orders' AND policyname='Guests view own food orders') THEN
    CREATE POLICY "Guests view own food orders" ON public.food_orders FOR SELECT USING (guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid()));
  END IF;
  -- Eco actions policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='eco_actions' AND policyname='Eco actions public read') THEN
    CREATE POLICY "Eco actions public read" ON public.eco_actions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='guest_eco_actions' AND policyname='Guests manage own eco actions') THEN
    CREATE POLICY "Guests manage own eco actions" ON public.guest_eco_actions FOR ALL USING (guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='eco_points_balance' AND policyname='Guests view own balance') THEN
    CREATE POLICY "Guests view own balance" ON public.eco_points_balance FOR SELECT USING (guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid()));
  END IF;
  -- Roles read-only for staff
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='roles' AND policyname='Roles staff read-only') THEN
    CREATE POLICY "Roles staff read-only" ON public.roles FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('MAIN_RECEPTIONIST','RECEPTIONIST')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='roles' AND policyname='Roles admin full access') THEN
    CREATE POLICY "Roles admin full access" ON public.roles FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role = 'MAIN_RECEPTIONIST'));
  END IF;
END$$;

-- Staff policies (broad access)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='guests' AND policyname='Staff full access on guests') THEN
    CREATE POLICY "Staff full access on guests" ON public.guests FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('MAIN_RECEPTIONIST','RECEPTIONIST')));
  END IF;
  -- repeat for other admin tables as needed (reservations, payments, etc.)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reservations' AND policyname='Staff full access on reservations') THEN
    CREATE POLICY "Staff full access on reservations" ON public.reservations FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('MAIN_RECEPTIONIST','RECEPTIONIST')));
  END IF;
END$$;

-- =============================================
-- STORAGE BUCKETS & POLICIES (idempotent)
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('room-images', 'room-images', true, 5242880, ARRAY['image/png','image/jpeg','image/jpg','image/webp']) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('activity-images', 'activity-images', true, 5242880, ARRAY['image/png','image/jpeg','image/jpg','image/webp']) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('menu-images', 'menu-images', true, 5242880, ARRAY['image/png','image/jpeg','image/jpg','image/webp']) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('staff-avatars', 'staff-avatars', true, 5242880, ARRAY['image/png','image/jpeg','image/jpg','image/webp']) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('content-images', 'content-images', true, 5242880, ARRAY['image/png','image/jpeg','image/jpg','image/webp']) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat_uploads', 'chat_uploads', true, 5242880, ARRAY['image/png','image/jpeg','image/jpg','image/webp']) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('guest-photos', 'guest-photos', true, 5242880, ARRAY['image/png','image/jpeg','image/jpg','image/webp']) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('guest-documents', 'guest-documents', false, 10485760, ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, 10485760, ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) ON CONFLICT (id) DO NOTHING;

ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;

-- Storage policies (create if missing)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Room images staff only') THEN
    CREATE POLICY "Room images staff only" ON storage.objects FOR ALL USING (bucket_id = 'room-images' AND EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('MAIN_RECEPTIONIST','RECEPTIONIST')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Activity images public read') THEN
    CREATE POLICY "Activity images public read" ON storage.objects FOR SELECT USING (bucket_id = 'activity-images');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Activity images staff manage') THEN
    CREATE POLICY "Activity images staff manage" ON storage.objects FOR ALL USING (bucket_id = 'activity-images' AND EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('MAIN_RECEPTIONIST','RECEPTIONIST')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Menu images public read') THEN
    CREATE POLICY "Menu images public read" ON storage.objects FOR SELECT USING (bucket_id = 'menu-images');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Menu images staff manage') THEN
    CREATE POLICY "Menu images staff manage" ON storage.objects FOR ALL USING (bucket_id = 'menu-images' AND EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('MAIN_RECEPTIONIST','RECEPTIONIST')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Staff avatars staff manage') THEN
    CREATE POLICY "Staff avatars staff manage" ON storage.objects FOR ALL USING (bucket_id = 'staff-avatars' AND EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('MAIN_RECEPTIONIST','RECEPTIONIST')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Content images public read') THEN
    CREATE POLICY "Content images public read" ON storage.objects FOR SELECT USING (bucket_id = 'content-images');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Content images staff manage') THEN
    CREATE POLICY "Content images staff manage" ON storage.objects FOR ALL USING (bucket_id = 'content-images' AND EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('MAIN_RECEPTIONIST','RECEPTIONIST')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Chat uploads authenticated') THEN
    CREATE POLICY "Chat uploads authenticated" ON storage.objects FOR ALL USING (bucket_id = 'chat_uploads' AND EXISTS (SELECT 1 FROM public.guests WHERE auth_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Guest photos authenticated') THEN
    CREATE POLICY "Guest photos authenticated" ON storage.objects FOR ALL USING (bucket_id = 'guest-photos' AND EXISTS (SELECT 1 FROM public.guests WHERE auth_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Guest documents staff only') THEN
    CREATE POLICY "Guest documents staff only" ON storage.objects FOR ALL USING (bucket_id = 'guest-documents' AND EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('MAIN_RECEPTIONIST','RECEPTIONIST')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Documents staff only') THEN
    CREATE POLICY "Documents staff only" ON storage.objects FOR ALL USING (bucket_id = 'documents' AND EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('MAIN_RECEPTIONIST','RECEPTIONIST')));
  END IF;
END$$;

-- =============================================
-- REALTIME: create publication if missing
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
  END IF;
END$$;

-- =============================================

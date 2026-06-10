-- =============================================
-- LA PIROGUE HMS - PRODUCTION SQL SCHEMA

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================
-- ENUMS / CUSTOM TYPES
-- =============================================
CREATE TYPE public.user_role AS ENUM (
    'MAIN_RECEPTIONIST', 'RECEPTIONIST', 'GUEST'
);

CREATE TYPE public.room_type AS ENUM ('STANDARD', 'DELUXE', 'SUITE', 'VILLA');
CREATE TYPE public.room_status AS ENUM ('AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE');
CREATE TYPE public.reservation_status AS ENUM ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');
CREATE TYPE public.guest_status AS ENUM ('RESERVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');
CREATE TYPE public.payment_method AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE');
CREATE TYPE public.payment_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PAID', 'PARTIALLY_PAID');
CREATE TYPE public.order_status AS ENUM ('PENDING', 'PREPARING', 'SERVED', 'CANCELLED');
CREATE TYPE public.activity_status AS ENUM ('ACTIVE', 'INACTIVE', 'FULL');
CREATE TYPE public.eco_tx_type AS ENUM ('EARN', 'SPEND', 'ADJUST');
CREATE TYPE public.eco_tx_status AS ENUM ('COMPLETED', 'PENDING', 'FAILED');


-- SEQUENCES
-- =============================================
CREATE SEQUENCE IF NOT EXISTS public.guest_seq START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS public.reservation_seq START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS public.food_order_seq START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS public.payment_seq START WITH 1001;

-- =============================================
-- TABLES
-- =============================================

-- 1. Profiles (Staff)
CREATE TABLE public.profiles (
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
CREATE TABLE public.staff (
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
CREATE TABLE public.guests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    guest_id text UNIQUE NOT NULL DEFAULT ('G' || lpad(nextval('public.guest_seq')::text, 4, '0')),
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text,
    phone text,
    nationality text,
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

-- 4. Rooms
CREATE TABLE public.rooms (
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
CREATE TABLE public.reservations (
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
CREATE TABLE public.activities (
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

CREATE TABLE public.activity_bookings (
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
CREATE TABLE public.guest_schedule_items (
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
    updated_by uuid
);

-- 8. Food & Beverage
CREATE TABLE public.menu_items (
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

CREATE TABLE public.food_orders (
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

CREATE TABLE public.guest_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id text UNIQUE NOT NULL,
    guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    room_id uuid REFERENCES public.rooms(id),
    total_price numeric(10,2) NOT NULL,
    status text DEFAULT 'PENDING',
    order_time timestamptz DEFAULT now(),
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.guest_order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_order_id uuid NOT NULL REFERENCES public.guest_orders(id) ON DELETE CASCADE,
    menu_item_id uuid REFERENCES public.menu_items(id),
    item_name text NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    unit_price numeric(10,2) NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- 9. Payments
CREATE TABLE public.payments (
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

CREATE TABLE public.payment_extra_items (
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
CREATE TABLE public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    sender_type text NOT NULL DEFAULT 'staff',
    content text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id uuid REFERENCES public.guests(id) ON DELETE CASCADE,
    title text NOT NULL,
    message text NOT NULL,
    category text DEFAULT 'General',
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- 11. Feedback
CREATE TABLE public.guest_feedback (
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
CREATE TABLE public.hotel_service_categories (
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

CREATE TABLE public.hotel_services (
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

CREATE TABLE public.emergency_contacts (
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

-- Sustainability (Optional but recommended)
CREATE TABLE public.eco_points_balance (
    guest_id uuid PRIMARY KEY REFERENCES public.guests(id) ON DELETE CASCADE,
    points integer DEFAULT 0 NOT NULL,
    tier text DEFAULT 'Bronze'
);

CREATE TABLE public.eco_points_tx (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    tx_type public.eco_tx_type NOT NULL,
    points integer NOT NULL,
    description text,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Audit Log
CREATE TABLE public.audit_logs (
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
CREATE INDEX idx_guests_auth_id ON public.guests(auth_id);
CREATE INDEX idx_guests_email ON public.guests(email);
CREATE INDEX idx_reservations_guest_id ON public.reservations(guest_id);
CREATE INDEX idx_reservations_room_id ON public.reservations(room_id);
CREATE INDEX idx_activity_bookings_guest_id ON public.activity_bookings(guest_id);
CREATE INDEX idx_messages_guest_id ON public.messages(guest_id);
CREATE INDEX idx_notifications_guest_id ON public.notifications(guest_id);
CREATE INDEX idx_payments_guest_id ON public.payments(guest_id);
CREATE INDEX idx_food_orders_guest_id ON public.food_orders(guest_id);

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Auto updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to main tables
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_guests_updated_at BEFORE UPDATE ON public.guests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_rooms_updated_at BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_reservations_updated_at BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_activities_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Room status management
CREATE OR REPLACE FUNCTION public.update_room_status_on_reservation()
RETURNS trigger AS $$
BEGIN
    IF NEW.status IN ('CONFIRMED', 'CHECKED_IN') THEN
        UPDATE public.rooms SET status = 'OCCUPIED' WHERE id = NEW.room_id;
    ELSIF NEW.status = 'CHECKED_OUT' THEN
        UPDATE public.rooms SET status = 'CLEANING' WHERE id = NEW.room_id;
    ELSIF NEW.status = 'CANCELLED' THEN
        UPDATE public.rooms SET status = 'AVAILABLE' WHERE id = NEW.room_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_reservation_room_status 
AFTER INSERT OR UPDATE ON public.reservations 
FOR EACH ROW EXECUTE FUNCTION public.update_room_status_on_reservation();

-- Audit trigger (basic)
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.audit_logs(table_name, record_id, action, actor_id, previous_data, new_data)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, auth.uid(), 
            CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
            to_jsonb(NEW));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- RLS POLICIES (CRITICAL FOR GUEST APP)
-- =============================================

ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_points_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_points_tx ENABLE ROW LEVEL SECURITY;

-- Guest Policies
CREATE POLICY "Guests view own profile" ON public.guests
    FOR SELECT USING (auth.uid() = auth_id);

CREATE POLICY "Guests view own reservations" ON public.reservations
    FOR SELECT USING (guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid()));

CREATE POLICY "Guests view own bookings" ON public.activity_bookings
    FOR SELECT USING (guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid()));

CREATE POLICY "Guests view own schedule" ON public.guest_schedule_items
    FOR SELECT USING (guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid()));

CREATE POLICY "Guests view own messages" ON public.messages
    FOR ALL USING (guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid()));

CREATE POLICY "Guests view own notifications" ON public.notifications
    FOR SELECT USING (guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid()));

CREATE POLICY "Guests view own feedback" ON public.guest_feedback
    FOR ALL USING (guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid()));

CREATE POLICY "Guests view own payments" ON public.payments
    FOR SELECT USING (guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid()));

CREATE POLICY "Guests view own food orders" ON public.food_orders
    FOR SELECT USING (guest_id IN (SELECT id FROM public.guests WHERE auth_id = auth.uid()));

-- Staff Policies (Broad access)
CREATE POLICY "Staff full access on guests" ON public.guests
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE auth_id = auth.uid() 
        AND role IN ('MAIN_RECEPTIONIST', 'RECEPTIONIST')
    ));

-- Similar staff policies can be added for other tables.

-- =============================================
-- STORAGE BUCKETS
-- =============================================

-- Guest profile images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('guest-images', 'guest-images', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Room images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('room-images', 'room-images', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Staff profile images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('staff-images', 'staff-images', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Menu item images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('menu-images', 'menu-images', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Activity images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('activity-images', 'activity-images', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Hotel service images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('service-images', 'service-images', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Documents (for invoices, receipts - private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, 10485760, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- STORAGE POLICIES
-- =============================================

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Guest images - public read, guests insert their own, staff manage all
CREATE POLICY "Guest images public read" ON storage.objects FOR SELECT USING (bucket_id = 'guest-images');
CREATE POLICY "Guest images authenticated insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'guest-images');
CREATE POLICY "Guest images staff update" ON storage.objects FOR UPDATE USING (bucket_id = 'guest-images' AND EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('MAIN_RECEPTIONIST', 'RECEPTIONIST')));
CREATE POLICY "Guest images staff delete" ON storage.objects FOR DELETE USING (bucket_id = 'guest-images' AND EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('MAIN_RECEPTIONIST', 'RECEPTIONIST')));

-- Room images - staff only
CREATE POLICY "Room images staff only" ON storage.objects FOR ALL USING (bucket_id = 'room-images' AND EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('MAIN_RECEPTIONIST', 'RECEPTIONIST')));

-- Staff images - staff manage
CREATE POLICY "Staff images staff only" ON storage.objects FOR ALL USING (bucket_id = 'staff-images' AND EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('MAIN_RECEPTIONIST', 'RECEPTIONIST')));

-- Menu images - public read, staff manage
CREATE POLICY "Menu images public read" ON storage.objects FOR SELECT USING (bucket_id = 'menu-images');
CREATE POLICY "Menu images staff manage" ON storage.objects FOR ALL USING (bucket_id = 'menu-images' AND EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('MAIN_RECEPTIONIST', 'RECEPTIONIST')));

-- Activity images - public read, staff manage
CREATE POLICY "Activity images public read" ON storage.objects FOR SELECT USING (bucket_id = 'activity-images');
CREATE POLICY "Activity images staff manage" ON storage.objects FOR ALL USING (bucket_id = 'activity-images' AND EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('MAIN_RECEPTIONIST', 'RECEPTIONIST')));

-- Service images - public read, staff manage
CREATE POLICY "Service images public read" ON storage.objects FOR SELECT USING (bucket_id = 'service-images');
CREATE POLICY "Service images staff manage" ON storage.objects FOR ALL USING (bucket_id = 'service-images' AND EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('MAIN_RECEPTIONIST', 'RECEPTIONIST')));

-- Documents - private, staff only
CREATE POLICY "Documents staff only" ON storage.objects FOR ALL USING (bucket_id = 'documents' AND EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('MAIN_RECEPTIONIST', 'RECEPTIONIST')));

-- =============================================
-- GRANTS
-- =============================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA storage TO authenticated;

-- =============================================
-- FINAL NOTES
-- =============================================
-- 1. Run this in Supabase SQL Editor
-- 2. Create RLS policies for remaining tables as needed
-- 3. Guest account creation logic (auth.users + guests row + temp password) should be in your API
-- 4. Temp password format: LastName + RoomNumber + "@lapirogue" (e.g. Smith205@lapirogue)
-- 5. Storage buckets: guest-images, room-images, staff-images, menu-images, activity-images, service-images, documents
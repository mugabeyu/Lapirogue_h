-- Standardized schema for the application
--
-- Architecture guide:
-- 1. auth.users: Supabase-managed security identities for login and password handling.
-- 2. public.users: hotel operations profile table used by this app for roles, status, and staff metadata.
-- 3. Private operational tables: reservations, payments, guests, staff, logs, and related hotel workflows.
--
-- This file keeps your current table names and relationships so the app continues to work.

create extension if not exists pgcrypto;

-- =====================
-- SECURITY / AUTH SETUP
-- =====================
-- Supabase auth.users is managed by the platform and is not created here.
-- The app-specific users table below stores hotel staff/admin profile details.

-- =====================
-- ENUMS
-- =====================
-- Seed-ready; keep uppercase values to match app types.
do $$ begin
  create type user_role as enum ('RECEPTIONIST');
exception when duplicate_object then null; end $$;

do $$ begin
  create type guest_status as enum ('RESERVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type room_type as enum ('STANDARD', 'DELUXE', 'SUITE', 'VILLA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type room_status as enum ('AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reservation_status as enum ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type activity_status as enum ('ACTIVE', 'INACTIVE', 'FULL');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('PENDING', 'PREPARING', 'SERVED', 'CANCELLED');
exception when duplicate_object then null; end $$;

-- =====================
-- SEQUENCES
-- =====================
-- Human-friendly identifiers for hotel operations.
create sequence if not exists guest_seq start 1042;
create sequence if not exists reservation_seq start 20261042;
create sequence if not exists payment_seq start 1001;
create sequence if not exists food_order_seq start 1001;

-- =====================
-- FUNCTIONS
-- =====================
-- Utility function: auto-update updated_at
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Helper: checks for room availability for reservation ranges
create or replace function check_room_available(p_room_id uuid, p_check_in date, p_check_out date, p_exclude_reservation_id uuid default null)
returns boolean as $$
begin
  if exists (
    select 1 from reservations
    where room_id = p_room_id
      and status != 'CANCELLED'
      and check_in < p_check_out
      and check_out > p_check_in
      and (p_exclude_reservation_id is null or id != p_exclude_reservation_id)
  ) then
    return false;
  end if;
  return true;
end;
$$ language plpgsql;

-- Trigger function: update room status when reservations change
create or replace function update_room_status_on_reservation()
returns trigger as $$
begin
  if tg_op = 'insert' or (tg_op = 'update' and (old.status is distinct from new.status or old.room_id is distinct from new.room_id)) then
    if new.status in ('CONFIRMED', 'CHECKED_IN') then
      update rooms set status = 'OCCUPIED' where id = new.room_id;
    elsif new.status = 'CHECKED_OUT' then
      update rooms set status = 'CLEANING' where id = new.room_id;
    elsif new.status = 'CANCELLED' then
      update rooms set status = 'AVAILABLE' where id = new.room_id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

-- =====================
-- HOTEL OPERATIONS / APP TABLES
-- =====================

-- NOTE: The legacy `users` table has been removed. Authentication identities
-- are now managed by Supabase Auth (`auth.users`). Application-level user
-- metadata and roles are stored in `profiles` (keyed by `auth_id`).

-- =====================
-- PROFILES (link auth.uid -> app role)
-- =====================
create table if not exists profiles (
  auth_id uuid primary key,
  full_name text,
  email text,
  role user_role not null default 'RECEPTIONIST',
  is_main boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at before update on profiles for each row execute function set_updated_at();


-- sessions (server session tokens)
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  -- reference the Supabase Auth user via `profiles.auth_id`
  user_id uuid not null references profiles(auth_id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- guests (hotel guests)
create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  -- Optional link to a Supabase Auth user (if guest has an account)
  auth_id uuid unique references profiles(auth_id) on delete set null,
  guest_id text not null unique default ('G-' || nextval('guest_seq')),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  nationality text,
  passport text unique,
  date_of_birth date,
  vip boolean not null default false,
  status guest_status not null default 'RESERVED',
  notes text,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- rooms (inventory)
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  room_number text not null unique,
  type room_type not null,
  floor text,
  capacity integer not null default 2 check (capacity > 0),
  price numeric(10,2) not null check (price >= 0),
  status room_status not null default 'AVAILABLE',
  description text,
  amenities text[] not null default '{}',
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- reservations (bookings)
create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  reservation_id text not null unique default ('R-' || nextval('reservation_seq')),
  guest_id uuid not null references guests(id) on delete restrict,
  room_id uuid not null references rooms(id) on delete restrict,
  check_in date not null,
  check_out date not null,
  adults integer not null default 1 check (adults > 0),
  children integer not null default 0 check (children >= 0),
  status reservation_status not null default 'CONFIRMED',
  total_amount numeric(12,2) not null check (total_amount >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out > check_in)
);

create trigger reservation_room_status_trigger
after insert or update on reservations
for each row execute function update_room_status_on_reservation();

-- payments (canonical ledger) - supports reservation-linked and guest-only payments
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  payment_id text not null unique default ('P-' || nextval('payment_seq')),
  reservation_id uuid references reservations(id) on delete cascade,
  guest_id uuid references guests(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method payment_method not null,
  status payment_status not null default 'PENDING',
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- activities and bookings
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'General',
  description text,
  price numeric(10,2) not null default 0 check (price >= 0),
  duration integer not null default 60 check (duration > 0),
  duration_label text,
  capacity integer not null default 10 check (capacity > 0),
  meeting_point text,
  requires_advance_booking boolean not null default false,
  weather_dependent boolean not null default false,
  suitable_for_children boolean not null default false,
  default_time text default '09:00',
  status activity_status not null default 'ACTIVE',
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activity_bookings (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  guest_id uuid not null references guests(id) on delete cascade,
  booking_date date not null,
  booking_time time,
  pickup_point text,
  participants integer not null default 1 check (participants > 0),
  status text not null default 'CONFIRMED',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- menu and food orders
create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  preparation_minutes integer,
  is_available boolean not null default true,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists food_orders (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique default ('FO-' || nextval('food_order_seq')),
  room_id uuid references rooms(id) on delete set null,
  guest_id uuid references guests(id) on delete set null,
  items jsonb not null default '[]'::jsonb,
  total numeric(10,2) not null default 0 check (total >= 0),
  status order_status not null default 'PENDING',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists guest_orders (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique default ('GO-' || nextval('food_order_seq')),
  guest_id uuid references guests(id) on delete cascade,
  room_id uuid references rooms(id) on delete set null,
  order_type text not null default 'in_room_dining',
  status text not null default 'PENDING',
  total_price numeric(10,2) not null check (total_price >= 0),
  order_time timestamptz not null default now(),
  eta timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists guest_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references guest_orders(id) on delete cascade,
  menu_item_id uuid,
  item_name text not null,
  quantity integer not null default 1,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- content, services, misc
create table if not exists site_content_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  body text not null,
  highlights text[] not null default '{}',
  metrics jsonb not null default '[]'::jsonb,
  image_path text,
  is_active boolean not null default true,
  -- who updated this content; reference Supabase Auth identity via profiles
  updated_by uuid references profiles(auth_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hotel_service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  icon_name text not null default 'room_service',
  color_hex text not null default '#9B59B6',
  bg_color_hex text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hotel_services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references hotel_service_categories(id) on delete set null,
  name text not null,
  description text not null default '',
  subtitle text,
  phone_number text,
  email text,
  hours_text text,
  location text,
  image_url text,
  sort_order integer not null default 0,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  phone_number text not null,
  icon_name text,
  color_hex text,
  bg_color_hex text,
  is_24h boolean not null default true,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id) on delete cascade,
  message_type text not null default 'guest' check (message_type in ('guest', 'admin')),
  subject text,
  content text not null,
  is_read boolean not null default false,
  attachment_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists itinerary_events (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid references guests(id) on delete cascade,
  title text not null,
  category text not null default 'General',
  description text,
  event_time timestamptz,
  location text,
  status text not null default 'CONFIRMED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists guest_schedule_items (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id) on delete cascade,
  title text not null,
  item_type text not null default 'CUSTOM' check (item_type in ('RESERVATION', 'ACTIVITY', 'BOOKING', 'ORDER', 'SERVICE', 'CUSTOM')),
  source_module text,
  source_record_id uuid,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED')),
  notes text,
  color text,
  created_by uuid references profiles(auth_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  full_name text not null,
  department text not null,
  position text not null,
  email text unique,
  phone text,
  status text not null default 'ACTIVE',
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  category text not null default 'General',
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(auth_id) on delete set null,
  action text not null,
  resource text not null,
  resource_id text,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- =====================
-- INDEXES
-- =====================
create index if not exists guests_name_idx on guests (first_name, last_name);
create index if not exists rooms_status_idx on rooms (status);
create index if not exists reservations_dates_idx on reservations (check_in, check_out);
create index if not exists payments_status_created_at_idx on payments (status, created_at);
create index if not exists activities_category_idx on activities (category);
create index if not exists menu_items_category_idx on menu_items (category);
create index if not exists staff_department_idx on staff (department);
create index if not exists notifications_created_at_idx on notifications (created_at);
create index if not exists hotel_service_categories_display_order_idx on hotel_service_categories (display_order);
create index if not exists hotel_services_category_id_idx on hotel_services (category_id);
create index if not exists hotel_services_sort_order_idx on hotel_services (sort_order);
create index if not exists emergency_contacts_display_order_idx on emergency_contacts (display_order);

-- Additional FK indexes for common join/lookups
create index if not exists reservations_guest_id_idx on reservations (guest_id);
create index if not exists reservations_room_id_idx on reservations (room_id);
create index if not exists payments_reservation_id_idx on payments (reservation_id);
create index if not exists payments_guest_id_idx on payments (guest_id);
create index if not exists activity_bookings_activity_id_idx on activity_bookings (activity_id);
create index if not exists activity_bookings_guest_id_idx on activity_bookings (guest_id);
create index if not exists guest_orders_guest_id_idx on guest_orders (guest_id);
create index if not exists guest_orders_room_id_idx on guest_orders (room_id);
create index if not exists guest_order_items_order_id_idx on guest_order_items (order_id);
create index if not exists sessions_user_id_idx on sessions (user_id);
create index if not exists sessions_expires_at_idx on sessions (expires_at);

-- =====================
-- TRIGGERS
-- =====================
-- Legacy users trigger removed: `users` table deprecated in favor of `profiles`.
drop trigger if exists guests_set_updated_at on guests;
create trigger guests_set_updated_at before update on guests for each row execute function set_updated_at();
drop trigger if exists rooms_set_updated_at on rooms;
create trigger rooms_set_updated_at before update on rooms for each row execute function set_updated_at();
drop trigger if exists reservations_set_updated_at on reservations;
create trigger reservations_set_updated_at before update on reservations for each row execute function set_updated_at();
drop trigger if exists payments_set_updated_at on payments;
create trigger payments_set_updated_at before update on payments for each row execute function set_updated_at();
drop trigger if exists activities_set_updated_at on activities;
create trigger activities_set_updated_at before update on activities for each row execute function set_updated_at();
drop trigger if exists food_orders_set_updated_at on food_orders;
create trigger food_orders_set_updated_at before update on food_orders for each row execute function set_updated_at();
drop trigger if exists activity_bookings_set_updated_at on activity_bookings;
create trigger activity_bookings_set_updated_at before update on activity_bookings for each row execute function set_updated_at();
drop trigger if exists menu_items_set_updated_at on menu_items;
create trigger menu_items_set_updated_at before update on menu_items for each row execute function set_updated_at();
drop trigger if exists staff_set_updated_at on staff;
create trigger staff_set_updated_at before update on staff for each row execute function set_updated_at();
drop trigger if exists roles_set_updated_at on roles;
create trigger roles_set_updated_at before update on roles for each row execute function set_updated_at();
drop trigger if exists notifications_set_updated_at on notifications;
create trigger notifications_set_updated_at before update on notifications for each row execute function set_updated_at();
drop trigger if exists site_content_pages_set_updated_at on site_content_pages;
create trigger site_content_pages_set_updated_at before update on site_content_pages for each row execute function set_updated_at();
drop trigger if exists hotel_service_categories_set_updated_at on hotel_service_categories;
create trigger hotel_service_categories_set_updated_at before update on hotel_service_categories for each row execute function set_updated_at();
drop trigger if exists hotel_services_set_updated_at on hotel_services;
create trigger hotel_services_set_updated_at before update on hotel_services for each row execute function set_updated_at();
drop trigger if exists emergency_contacts_set_updated_at on emergency_contacts;
create trigger emergency_contacts_set_updated_at before update on emergency_contacts for each row execute function set_updated_at();
drop trigger if exists messages_set_updated_at on messages;
create trigger messages_set_updated_at before update on messages for each row execute function set_updated_at();
drop trigger if exists itinerary_events_set_updated_at on itinerary_events;
create trigger itinerary_events_set_updated_at before update on itinerary_events for each row execute function set_updated_at();
drop trigger if exists guest_schedule_items_set_updated_at on guest_schedule_items;
create trigger guest_schedule_items_set_updated_at before update on guest_schedule_items for each row execute function set_updated_at();
drop trigger if exists guest_orders_set_updated_at on guest_orders;
create trigger guest_orders_set_updated_at before update on guest_orders for each row execute function set_updated_at();
drop trigger if exists guest_order_items_set_updated_at on guest_order_items;
create trigger guest_order_items_set_updated_at before update on guest_order_items for each row execute function set_updated_at();

-- =====================
-- ROW LEVEL SECURITY
-- =====================
-- Note: there is no `users` table in this schema (Supabase Auth manages auth.users).
-- The following ALTER was removed to avoid runtime errors in the SQL editor:
--    alter table users enable row level security;
-- RLS is enabled for the app tables below (profiles, sessions, etc.).
alter table profiles enable row level security;
alter table sessions enable row level security;
alter table guests enable row level security;
alter table rooms enable row level security;
alter table reservations enable row level security;
alter table payments enable row level security;
alter table activities enable row level security;
alter table food_orders enable row level security;
alter table activity_bookings enable row level security;
alter table menu_items enable row level security;
alter table staff enable row level security;
alter table roles enable row level security;
alter table notifications enable row level security;
alter table site_content_pages enable row level security;
alter table hotel_service_categories enable row level security;
alter table hotel_services enable row level security;
alter table emergency_contacts enable row level security;
alter table messages enable row level security;
alter table audit_logs enable row level security;
alter table itinerary_events enable row level security;
alter table guest_orders enable row level security;
alter table guest_order_items enable row level security;
alter table guest_schedule_items enable row level security;

-- =====================
-- RLS POLICIES (role based access)
-- =====================

-- Helper policies are expressed inline per table.

-- Profiles: users can read their own profile; the main receptionist can manage all.
create policy "profiles_select" on profiles for select using (
  auth.uid() = auth_id
  or exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST' and p.is_main = true)
);

create policy "profiles_insert" on profiles for insert with check (
  auth.uid() = auth_id
  or exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST' and p.is_main = true)
);

create policy "profiles_update" on profiles for update using (
  auth.uid() = auth_id
  or exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST')
) with check (
  auth.uid() = auth_id
  or exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST')
);

create policy "profiles_delete" on profiles for delete using (
  exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST' and p.is_main = true)
);

-- Rooms: select by authenticated users; create/update by any receptionist; delete only by the main receptionist
create policy "rooms_select_auth" on rooms for select using (auth.uid() is not null);
create policy "rooms_modify_receptionist_insert" on rooms for insert with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
create policy "rooms_modify_receptionist_update" on rooms for update using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST')) with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
create policy "rooms_delete_main_receptionist" on rooms for delete using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST' and p.is_main = true));

-- Reservations: authenticated can select; receptionists can insert/update; delete only main receptionist
create policy "reservations_select_auth" on reservations for select using (auth.uid() is not null);
create policy "reservations_modify_receptionist_insert" on reservations for insert with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
create policy "reservations_modify_receptionist_update" on reservations for update using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST')) with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
create policy "reservations_delete_main_receptionist" on reservations for delete using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST' and p.is_main = true));

-- Payments: only receptionists can create/update; delete only main receptionist
create policy "payments_select_auth" on payments for select using (auth.uid() is not null);
create policy "payments_modify_receptionist_insert" on payments for insert with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
create policy "payments_modify_receptionist_update" on payments for update using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST')) with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
create policy "payments_delete_main_receptionist" on payments for delete using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST' and p.is_main = true));

-- Activities and menu items: select by authenticated; modify by receptionists; delete only main receptionist
create policy "activities_select_auth" on activities for select using (auth.uid() is not null);
create policy "activities_modify_receptionist_insert" on activities for insert with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
create policy "activities_modify_receptionist_update" on activities for update using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST')) with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
create policy "activities_delete_main_receptionist" on activities for delete using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST' and p.is_main = true));

create policy "menu_items_select_auth" on menu_items for select using (is_available = true or auth.uid() is not null);
create policy "menu_items_modify_receptionist_insert" on menu_items for insert with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
create policy "menu_items_modify_receptionist_update" on menu_items for update using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST')) with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
create policy "menu_items_delete_main_receptionist" on menu_items for delete using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST' and p.is_main = true));

-- Guests and orders: select by authenticated; modify by receptionists; delete only main receptionist
create policy "guests_select_auth" on guests for select using (auth.uid() is not null);
create policy "guests_modify_receptionist_insert" on guests for insert with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
create policy "guests_modify_receptionist_update" on guests for update using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST')) with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
create policy "guests_delete_main_receptionist" on guests for delete using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST' and p.is_main = true));

-- Staff, roles: receptionist-only access; the main receptionist may delete roles.
create policy "staff_select_auth" on staff for select using (auth.uid() is not null);
create policy "staff_modify_receptionist_insert" on staff for insert with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
create policy "staff_modify_receptionist_update" on staff for update using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST')) with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
create policy "staff_delete_main_receptionist" on staff for delete using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST' and p.is_main = true));

create policy "guest_schedule_items_select_auth" on guest_schedule_items for select using (auth.uid() is not null);
create policy "guest_schedule_items_modify_receptionist_insert" on guest_schedule_items for insert with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
create policy "guest_schedule_items_modify_receptionist_update" on guest_schedule_items for update using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST')) with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
create policy "guest_schedule_items_delete_main_receptionist" on guest_schedule_items for delete using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST' and p.is_main = true));

-- Public content pages: allow public select
create policy "site_content_public_select" on site_content_pages for select using (is_active = true);


-- The Next.js backend uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
-- No anon policies are created for private tables.

-- The application relies on Supabase Auth and RLS to enforce authorization.
-- Server-side routes should use authenticated sessions and RLS-aware clients.
-- No client-side secret keys should be exposed.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('room-images', 'room-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('activity-images', 'activity-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('menu-images', 'menu-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('chat_uploads', 'chat_uploads', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']),
  ('content-images', 'content-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('staff-avatars', 'staff-avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('guest-documents', 'guest-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
SET public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public room images are readable" on storage.objects;
create policy "Public room images are readable"
on storage.objects for select
using (bucket_id = 'room-images');

drop policy if exists "Public activity images are readable" on storage.objects;
create policy "Public activity images are readable"
on storage.objects for select
using (bucket_id = 'activity-images');

drop policy if exists "Public menu images are readable" on storage.objects;
create policy "Public menu images are readable"
on storage.objects for select
using (bucket_id = 'menu-images');

drop policy if exists "Public chat uploads are readable" on storage.objects;
create policy "Public chat uploads are readable"
on storage.objects for select
using (bucket_id = 'chat_uploads');

drop policy if exists "Public content images are readable" on storage.objects;
create policy "Public content images are readable"
on storage.objects for select
using (bucket_id = 'content-images');

-- Private documents intentionally have no anon policies. Uploads and downloads
-- should go through backend API routes that use the service role key.
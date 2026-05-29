-- Canonical schema is maintained in a dedicated migration file.
-- This file is intentionally kept as a single SQL source of truth for reviews,
-- but the live deployment should be applied through the migration pipeline.

create extension if not exists pgcrypto;

do $$ begin
  create type user_role as enum ('ADMIN', 'MANAGER', 'RECEPTION', 'RESTAURANT', 'TOUR_MANAGER', 'STAFF', 'RECEPTIONIST');
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
  create type payment_status as enum ('PENDING', 'PARTIALLY_PAID', 'PAID', 'REFUNDED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type activity_status as enum ('ACTIVE', 'INACTIVE', 'FULL');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('PENDING', 'PREPARING', 'SERVED', 'CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type eco_tx_type as enum ('EARN', 'SPEND', 'ADJUST');
exception when duplicate_object then null; end $$;

do $$ begin
  create type eco_tx_status as enum ('COMPLETED', 'PENDING', 'FAILED');
exception when duplicate_object then null; end $$;

create sequence if not exists guest_seq start 1042;
create sequence if not exists reservation_seq start 20261042;
create sequence if not exists payment_seq start 1001;
create sequence if not exists food_order_seq start 1001;
create sequence if not exists guest_order_seq start 1001;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function set_created_by_and_updated_by()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by = auth.uid();
    end if;
    if new.updated_by is null then
      new.updated_by = coalesce(new.created_by, auth.uid());
    end if;
  elsif tg_op = 'UPDATE' then
    new.updated_by = coalesce(auth.uid(), new.updated_by);
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function log_audit_event()
returns trigger as $$
declare
  actor_id uuid;
  row_id uuid;
begin
  actor_id := coalesce(auth.uid(), old.updated_by, old.created_by, new.updated_by, new.created_by);
  row_id := coalesce(new.id, old.id);
  if tg_op = 'DELETE' then
    insert into audit_logs(table_name, record_id, action, actor_id, previous_data, new_data)
    values (tg_table_name, row_id, tg_op, actor_id, to_jsonb(old), null);
    return old;
  end if;
  insert into audit_logs(table_name, record_id, action, actor_id, previous_data, new_data)
  values (tg_table_name, row_id, tg_op, actor_id, case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new));
  return new;
end;
$$ language plpgsql;

create or replace function update_room_status_on_reservation()
returns trigger as $$
begin
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and (old.status is distinct from new.status or old.room_id is distinct from new.room_id)) then
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

create table if not exists profiles (
  auth_id uuid primary key,
  full_name text,
  email text unique,
  phone text,
  avatar_url text,
  role user_role not null default 'RECEPTIONIST',
  is_main boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
  blocked_by uuid references profiles(auth_id) on delete set null,
  blocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action text not null,
  actor_id uuid references profiles(auth_id) on delete set null,
  previous_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_table_name_idx on audit_logs (table_name);
create index if not exists audit_logs_record_id_idx on audit_logs (record_id);
create index if not exists audit_logs_actor_id_idx on audit_logs (actor_id);
create index if not exists audit_logs_created_at_idx on audit_logs (created_at desc);

do $$ begin
  if exists (select 1 from profiles where lower(email) = 'mugabeyunusu@gmail.com') then
    update profiles set is_main = false;
    update profiles set is_main = true where lower(email) = 'mugabeyunusu@gmail.com';
  end if;
end $$;

with ranked_main as (
  select auth_id, row_number() over (order by created_at asc, auth_id asc) as rn
  from profiles
  where is_main = true
)
update profiles
set is_main = false
where auth_id in (select auth_id from ranked_main where rn > 1);

update profiles
set is_main = true
where auth_id = (
  select auth_id from profiles order by created_at asc, auth_id asc limit 1
)
and not exists (select 1 from profiles where is_main = true);

create unique index if not exists profiles_single_main_receptionist_idx on profiles (is_main) where is_main = true;

alter table profiles drop constraint if exists profiles_role_receptionist_only;
alter table profiles add constraint profiles_role_receptionist_only check (role = 'RECEPTIONIST');

create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
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
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
  deleted_by uuid references profiles(auth_id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  image_paths text[] not null default '{}',
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
  deleted_by uuid references profiles(auth_id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
  deleted_by uuid references profiles(auth_id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out > check_in)
);

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
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
  processed_by uuid references profiles(auth_id) on delete set null,
  deleted_by uuid references profiles(auth_id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payment_extra_items (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  guest_id uuid not null references guests(id) on delete cascade,
  reservation_id uuid references reservations(id) on delete set null,
  category text not null check (category in ('Transport services', 'Laundry/services', 'Additional hotel purchases')),
  label text not null,
  amount numeric(12,2) not null check (amount > 0),
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
  deleted_by uuid references profiles(auth_id) on delete set null,
  deleted_at timestamptz,
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
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
  deleted_by uuid references profiles(auth_id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  preparation_minutes integer,
  is_available boolean not null default true,
  image_path text,
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
  deleted_by uuid references profiles(auth_id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists food_orders (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique default ('FO-' || nextval('food_order_seq')),
  room_id uuid references rooms(id) on delete set null,
  guest_id uuid references guests(id) on delete set null,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(10,2) not null default 0 check (subtotal >= 0),
  service_charge numeric(10,2) not null default 0 check (service_charge >= 0),
  tax_amount numeric(10,2) not null default 0 check (tax_amount >= 0),
  total numeric(10,2) not null default 0 check (total >= 0),
  status order_status not null default 'PENDING',
  notes text,
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
  processed_by uuid references profiles(auth_id) on delete set null,
  deleted_by uuid references profiles(auth_id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists guest_orders (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique default ('GO-' || nextval('guest_order_seq')),
  guest_id uuid references guests(id) on delete cascade,
  room_id uuid references rooms(id) on delete set null,
  order_type text not null default 'in_room_dining',
  status text not null default 'PENDING',
  total_price numeric(10,2) not null check (total_price >= 0),
  order_time timestamptz not null default now(),
  eta timestamptz,
  notes text,
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
  deleted_by uuid references profiles(auth_id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  created_by uuid references profiles(auth_id) on delete set null,
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
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
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
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
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
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id) on delete cascade,
  message_type text not null default 'guest' check (message_type in ('guest', 'receptionist', 'admin')),
  subject text,
  content text not null,
  is_read boolean not null default false,
  attachment_url text,
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
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
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
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
  updated_by uuid references profiles(auth_id) on delete set null,
  deleted_by uuid references profiles(auth_id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references profiles(auth_id) on delete set null,
  employee_code text not null unique,
  full_name text not null,
  department text not null,
  position text not null,
  email text unique,
  phone text,
  status text not null default 'ACTIVE',
  blocked_by uuid references profiles(auth_id) on delete set null,
  blocked_at timestamptz,
  deleted_by uuid references profiles(auth_id) on delete set null,
  deleted_at timestamptz,
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  permissions jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into roles (name, description, permissions)
values
  ('MAIN_RECEPTIONIST', 'Primary receptionist with elevated administrative control.', '{}'::jsonb),
  ('RECEPTIONIST', 'Standard receptionist role for day-to-day operations.', '{}'::jsonb)
on conflict (name) do update
set description = excluded.description,
    permissions = excluded.permissions,
    updated_at = now();

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  category text not null default 'General',
  is_read boolean not null default false,
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists guest_feedback (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  category text not null,
  comment text,
  staff_response text,
  responded_at timestamptz,
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sustainability_activities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#10b981',
  default_points integer not null default 0 check (default_points >= 0),
  carbon_offset_kg numeric(10,2) not null default 0 check (carbon_offset_kg >= 0),
  is_active boolean not null default true,
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists eco_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  min_points integer not null default 0 check (min_points >= 0),
  sort_order integer not null default 0,
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists guest_eco_point_events (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id) on delete cascade,
  activity_id uuid not null references sustainability_activities(id) on delete restrict,
  source_type text not null default 'ACTIVITY_BOOKING' check (source_type in ('ACTIVITY_BOOKING', 'SERVICE_REQUEST', 'MANUAL')),
  source_record_id uuid not null,
  source_label text,
  points integer not null check (points > 0),
  carbon_offset_kg numeric(10,2) not null default 0 check (carbon_offset_kg >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
  earned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists eco_points_balance (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id) on delete cascade,
  balance bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique (guest_id)
);

create table if not exists eco_points_tx (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id) on delete cascade,
  amount bigint not null,
  type eco_tx_type not null,
  status eco_tx_status not null default 'COMPLETED',
  reference text,
  notes text,
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists staff_onboarding (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references staff(id) on delete cascade,
  invite_token text,
  expires_at timestamptz,
  created_by uuid references profiles(auth_id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists storage_files (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  path text not null,
  content_type text,
  size bigint,
  uploaded_by uuid references profiles(auth_id) on delete set null,
  uploaded_at timestamptz not null default now(),
  created_by uuid references profiles(auth_id) on delete set null,
  updated_by uuid references profiles(auth_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists guests_name_idx on guests (first_name, last_name);
create index if not exists rooms_status_idx on rooms (status);
create index if not exists reservations_dates_idx on reservations (check_in, check_out);
create index if not exists payments_status_created_at_idx on payments (status, created_at);
create index if not exists activities_category_idx on activities (category);
create index if not exists menu_items_category_idx on menu_items (category);
create index if not exists staff_department_idx on staff (department);
create index if not exists staff_auth_user_id_idx on staff (auth_user_id);
create index if not exists notifications_created_at_idx on notifications (created_at);
create index if not exists guest_feedback_guest_id_idx on guest_feedback (guest_id);
create index if not exists guest_feedback_created_at_idx on guest_feedback (created_at desc);
create index if not exists guest_feedback_rating_idx on guest_feedback (rating);
create index if not exists guest_eco_point_events_guest_id_idx on guest_eco_point_events (guest_id);
create index if not exists guest_eco_point_events_activity_id_idx on guest_eco_point_events (activity_id);
create unique index if not exists guest_eco_point_events_source_unique_idx on guest_eco_point_events (source_type, source_record_id);
create index if not exists guest_eco_point_events_earned_at_idx on guest_eco_point_events (earned_at desc);
create index if not exists hotel_service_categories_display_order_idx on hotel_service_categories (display_order);
create index if not exists hotel_services_category_id_idx on hotel_services (category_id);
create index if not exists hotel_services_sort_order_idx on hotel_services (sort_order);
create index if not exists emergency_contacts_display_order_idx on emergency_contacts (display_order);
create index if not exists reservations_guest_id_idx on reservations (guest_id);
create index if not exists reservations_room_id_idx on reservations (room_id);
create index if not exists payments_reservation_id_idx on payments (reservation_id);
create index if not exists payments_guest_id_idx on payments (guest_id);
create index if not exists activity_bookings_activity_id_idx on activity_bookings (activity_id);
create index if not exists activity_bookings_guest_id_idx on activity_bookings (guest_id);
create index if not exists guest_orders_guest_id_idx on guest_orders (guest_id);
create index if not exists guest_orders_room_id_idx on guest_orders (room_id);
create index if not exists guest_orders_order_time_idx on guest_orders (order_time);
create index if not exists guest_orders_status_idx on guest_orders (status);
create index if not exists food_orders_guest_id_idx on food_orders (guest_id);
create index if not exists food_orders_room_id_idx on food_orders (room_id);
create index if not exists food_orders_status_idx on food_orders (status);
create index if not exists food_orders_created_at_idx on food_orders (created_at desc);
create index if not exists activity_bookings_booking_date_idx on activity_bookings (booking_date);
create index if not exists guest_schedule_items_guest_id_idx on guest_schedule_items (guest_id);
create index if not exists guest_schedule_items_start_at_idx on guest_schedule_items (start_at);
create index if not exists messages_guest_id_idx on messages (guest_id);
create index if not exists messages_created_at_idx on messages (created_at desc);
create index if not exists notifications_is_read_idx on notifications (is_read);
create index if not exists itinerary_events_guest_id_idx on itinerary_events (guest_id);
create index if not exists storage_files_bucket_idx on storage_files (bucket);
create index if not exists storage_files_uploaded_by_idx on storage_files (uploaded_by);
create index if not exists eco_points_tx_guest_id_idx on eco_points_tx (guest_id);
create index if not exists eco_points_tx_created_at_idx on eco_points_tx (created_at desc);
create index if not exists eco_points_balance_guest_id_idx on eco_points_balance (guest_id);

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at before update on profiles for each row execute function set_updated_at();
drop trigger if exists guests_set_updated_at on guests;
create trigger guests_set_updated_at before update on guests for each row execute function set_updated_at();
drop trigger if exists rooms_set_updated_at on rooms;
create trigger rooms_set_updated_at before update on rooms for each row execute function set_updated_at();
drop trigger if exists reservations_set_updated_at on reservations;
create trigger reservations_set_updated_at before update on reservations for each row execute function set_updated_at();
drop trigger if exists payments_set_updated_at on payments;
create trigger payments_set_updated_at before update on payments for each row execute function set_updated_at();
drop trigger if exists payment_extra_items_set_updated_at on payment_extra_items;
create trigger payment_extra_items_set_updated_at before update on payment_extra_items for each row execute function set_updated_at();
drop trigger if exists activities_set_updated_at on activities;
create trigger activities_set_updated_at before update on activities for each row execute function set_updated_at();
drop trigger if exists activity_bookings_set_updated_at on activity_bookings;
create trigger activity_bookings_set_updated_at before update on activity_bookings for each row execute function set_updated_at();
drop trigger if exists menu_items_set_updated_at on menu_items;
create trigger menu_items_set_updated_at before update on menu_items for each row execute function set_updated_at();
drop trigger if exists food_orders_set_updated_at on food_orders;
create trigger food_orders_set_updated_at before update on food_orders for each row execute function set_updated_at();
drop trigger if exists guest_orders_set_updated_at on guest_orders;
create trigger guest_orders_set_updated_at before update on guest_orders for each row execute function set_updated_at();
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
drop trigger if exists staff_set_updated_at on staff;
create trigger staff_set_updated_at before update on staff for each row execute function set_updated_at();
drop trigger if exists roles_set_updated_at on roles;
create trigger roles_set_updated_at before update on roles for each row execute function set_updated_at();
drop trigger if exists notifications_set_updated_at on notifications;
create trigger notifications_set_updated_at before update on notifications for each row execute function set_updated_at();
drop trigger if exists guest_feedback_set_updated_at on guest_feedback;
create trigger guest_feedback_set_updated_at before update on guest_feedback for each row execute function set_updated_at();
drop trigger if exists sustainability_activities_set_updated_at on sustainability_activities;
create trigger sustainability_activities_set_updated_at before update on sustainability_activities for each row execute function set_updated_at();
drop trigger if exists eco_tiers_set_updated_at on eco_tiers;
create trigger eco_tiers_set_updated_at before update on eco_tiers for each row execute function set_updated_at();
drop trigger if exists guest_eco_point_events_set_updated_at on guest_eco_point_events;
create trigger guest_eco_point_events_set_updated_at before update on guest_eco_point_events for each row execute function set_updated_at();
drop trigger if exists eco_points_tx_set_updated_at on eco_points_tx;
create trigger eco_points_tx_set_updated_at before update on eco_points_tx for each row execute function set_updated_at();
drop trigger if exists storage_files_set_updated_at on storage_files;
create trigger storage_files_set_updated_at before update on storage_files for each row execute function set_updated_at();

drop trigger if exists profiles_set_audit_fields on profiles;
create trigger profiles_set_audit_fields before insert or update on profiles for each row execute function set_created_by_and_updated_by();
drop trigger if exists profiles_audit_log on profiles;
create trigger profiles_audit_log after insert or update or delete on profiles for each row execute function log_audit_event();

drop trigger if exists guests_set_audit_fields on guests;
create trigger guests_set_audit_fields before insert or update on guests for each row execute function set_created_by_and_updated_by();
drop trigger if exists guests_audit_log on guests;
create trigger guests_audit_log after insert or update or delete on guests for each row execute function log_audit_event();

drop trigger if exists rooms_set_audit_fields on rooms;
create trigger rooms_set_audit_fields before insert or update on rooms for each row execute function set_created_by_and_updated_by();
drop trigger if exists rooms_audit_log on rooms;
create trigger rooms_audit_log after insert or update or delete on rooms for each row execute function log_audit_event();

drop trigger if exists reservations_set_audit_fields on reservations;
create trigger reservations_set_audit_fields before insert or update on reservations for each row execute function set_created_by_and_updated_by();
drop trigger if exists reservations_audit_log on reservations;
create trigger reservations_audit_log after insert or update or delete on reservations for each row execute function log_audit_event();

drop trigger if exists payments_set_audit_fields on payments;
create trigger payments_set_audit_fields before insert or update on payments for each row execute function set_created_by_and_updated_by();
drop trigger if exists payments_audit_log on payments;
create trigger payments_audit_log after insert or update or delete on payments for each row execute function log_audit_event();

drop trigger if exists payment_extra_items_set_audit_fields on payment_extra_items;
create trigger payment_extra_items_set_audit_fields before insert or update on payment_extra_items for each row execute function set_created_by_and_updated_by();
drop trigger if exists payment_extra_items_audit_log on payment_extra_items;
create trigger payment_extra_items_audit_log after insert or update or delete on payment_extra_items for each row execute function log_audit_event();

drop trigger if exists activities_set_audit_fields on activities;
create trigger activities_set_audit_fields before insert or update on activities for each row execute function set_created_by_and_updated_by();
drop trigger if exists activities_audit_log on activities;
create trigger activities_audit_log after insert or update or delete on activities for each row execute function log_audit_event();

drop trigger if exists activity_bookings_set_audit_fields on activity_bookings;
create trigger activity_bookings_set_audit_fields before insert or update on activity_bookings for each row execute function set_created_by_and_updated_by();
drop trigger if exists activity_bookings_audit_log on activity_bookings;
create trigger activity_bookings_audit_log after insert or update or delete on activity_bookings for each row execute function log_audit_event();

drop trigger if exists menu_items_set_audit_fields on menu_items;
create trigger menu_items_set_audit_fields before insert or update on menu_items for each row execute function set_created_by_and_updated_by();
drop trigger if exists menu_items_audit_log on menu_items;
create trigger menu_items_audit_log after insert or update or delete on menu_items for each row execute function log_audit_event();

drop trigger if exists food_orders_set_audit_fields on food_orders;
create trigger food_orders_set_audit_fields before insert or update on food_orders for each row execute function set_created_by_and_updated_by();
drop trigger if exists food_orders_audit_log on food_orders;
create trigger food_orders_audit_log after insert or update or delete on food_orders for each row execute function log_audit_event();

drop trigger if exists guest_orders_set_audit_fields on guest_orders;
create trigger guest_orders_set_audit_fields before insert or update on guest_orders for each row execute function set_created_by_and_updated_by();
drop trigger if exists guest_orders_audit_log on guest_orders;
create trigger guest_orders_audit_log after insert or update or delete on guest_orders for each row execute function log_audit_event();

drop trigger if exists site_content_pages_set_audit_fields on site_content_pages;
create trigger site_content_pages_set_audit_fields before insert or update on site_content_pages for each row execute function set_created_by_and_updated_by();
drop trigger if exists site_content_pages_audit_log on site_content_pages;
create trigger site_content_pages_audit_log after insert or update or delete on site_content_pages for each row execute function log_audit_event();

drop trigger if exists hotel_service_categories_set_audit_fields on hotel_service_categories;
create trigger hotel_service_categories_set_audit_fields before insert or update on hotel_service_categories for each row execute function set_created_by_and_updated_by();
drop trigger if exists hotel_service_categories_audit_log on hotel_service_categories;
create trigger hotel_service_categories_audit_log after insert or update or delete on hotel_service_categories for each row execute function log_audit_event();

drop trigger if exists hotel_services_set_audit_fields on hotel_services;
create trigger hotel_services_set_audit_fields before insert or update on hotel_services for each row execute function set_created_by_and_updated_by();
drop trigger if exists hotel_services_audit_log on hotel_services;
create trigger hotel_services_audit_log after insert or update or delete on hotel_services for each row execute function log_audit_event();

drop trigger if exists emergency_contacts_set_audit_fields on emergency_contacts;
create trigger emergency_contacts_set_audit_fields before insert or update on emergency_contacts for each row execute function set_created_by_and_updated_by();
drop trigger if exists emergency_contacts_audit_log on emergency_contacts;
create trigger emergency_contacts_audit_log after insert or update or delete on emergency_contacts for each row execute function log_audit_event();

drop trigger if exists messages_set_audit_fields on messages;
create trigger messages_set_audit_fields before insert or update on messages for each row execute function set_created_by_and_updated_by();
drop trigger if exists messages_audit_log on messages;
create trigger messages_audit_log after insert or update or delete on messages for each row execute function log_audit_event();

drop trigger if exists itinerary_events_set_audit_fields on itinerary_events;
create trigger itinerary_events_set_audit_fields before insert or update on itinerary_events for each row execute function set_created_by_and_updated_by();
drop trigger if exists itinerary_events_audit_log on itinerary_events;
create trigger itinerary_events_audit_log after insert or update or delete on itinerary_events for each row execute function log_audit_event();

drop trigger if exists guest_schedule_items_set_audit_fields on guest_schedule_items;
create trigger guest_schedule_items_set_audit_fields before insert or update on guest_schedule_items for each row execute function set_created_by_and_updated_by();
drop trigger if exists guest_schedule_items_audit_log on guest_schedule_items;
create trigger guest_schedule_items_audit_log after insert or update or delete on guest_schedule_items for each row execute function log_audit_event();

drop trigger if exists staff_set_audit_fields on staff;
create trigger staff_set_audit_fields before insert or update on staff for each row execute function set_created_by_and_updated_by();
drop trigger if exists staff_audit_log on staff;
create trigger staff_audit_log after insert or update or delete on staff for each row execute function log_audit_event();

drop trigger if exists roles_set_audit_fields on roles;
create trigger roles_set_audit_fields before insert or update on roles for each row execute function set_created_by_and_updated_by();
drop trigger if exists roles_audit_log on roles;
create trigger roles_audit_log after insert or update or delete on roles for each row execute function log_audit_event();

drop trigger if exists notifications_set_audit_fields on notifications;
create trigger notifications_set_audit_fields before insert or update on notifications for each row execute function set_created_by_and_updated_by();
drop trigger if exists notifications_audit_log on notifications;
create trigger notifications_audit_log after insert or update or delete on notifications for each row execute function log_audit_event();

drop trigger if exists guest_feedback_set_audit_fields on guest_feedback;
create trigger guest_feedback_set_audit_fields before insert or update on guest_feedback for each row execute function set_created_by_and_updated_by();
drop trigger if exists guest_feedback_audit_log on guest_feedback;
create trigger guest_feedback_audit_log after insert or update or delete on guest_feedback for each row execute function log_audit_event();

drop trigger if exists sustainability_activities_set_audit_fields on sustainability_activities;
create trigger sustainability_activities_set_audit_fields before insert or update on sustainability_activities for each row execute function set_created_by_and_updated_by();
drop trigger if exists sustainability_activities_audit_log on sustainability_activities;
create trigger sustainability_activities_audit_log after insert or update or delete on sustainability_activities for each row execute function log_audit_event();

drop trigger if exists eco_tiers_set_audit_fields on eco_tiers;
create trigger eco_tiers_set_audit_fields before insert or update on eco_tiers for each row execute function set_created_by_and_updated_by();
drop trigger if exists eco_tiers_audit_log on eco_tiers;
create trigger eco_tiers_audit_log after insert or update or delete on eco_tiers for each row execute function log_audit_event();

drop trigger if exists guest_eco_point_events_set_audit_fields on guest_eco_point_events;
create trigger guest_eco_point_events_set_audit_fields before insert or update on guest_eco_point_events for each row execute function set_created_by_and_updated_by();
drop trigger if exists guest_eco_point_events_audit_log on guest_eco_point_events;
create trigger guest_eco_point_events_audit_log after insert or update or delete on guest_eco_point_events for each row execute function log_audit_event();

drop trigger if exists eco_points_tx_set_audit_fields on eco_points_tx;
create trigger eco_points_tx_set_audit_fields before insert or update on eco_points_tx for each row execute function set_created_by_and_updated_by();
drop trigger if exists eco_points_tx_audit_log on eco_points_tx;
create trigger eco_points_tx_audit_log after insert or update or delete on eco_points_tx for each row execute function log_audit_event();

drop trigger if exists storage_files_set_audit_fields on storage_files;
create trigger storage_files_set_audit_fields before insert or update on storage_files for each row execute function set_created_by_and_updated_by();
drop trigger if exists storage_files_audit_log on storage_files;
create trigger storage_files_audit_log after insert or update or delete on storage_files for each row execute function log_audit_event();

alter table profiles enable row level security;
alter table guests enable row level security;
alter table rooms enable row level security;
alter table reservations enable row level security;
alter table payments enable row level security;
alter table payment_extra_items enable row level security;
alter table activities enable row level security;
alter table food_orders enable row level security;
alter table activity_bookings enable row level security;
alter table menu_items enable row level security;
alter table staff enable row level security;
alter table roles enable row level security;
alter table notifications enable row level security;
alter table guest_feedback enable row level security;
alter table sustainability_activities enable row level security;
alter table eco_tiers enable row level security;
alter table guest_eco_point_events enable row level security;
alter table site_content_pages enable row level security;
alter table hotel_service_categories enable row level security;
alter table hotel_services enable row level security;
alter table emergency_contacts enable row level security;
alter table messages enable row level security;
alter table itinerary_events enable row level security;
alter table guest_orders enable row level security;
alter table guest_schedule_items enable row level security;
alter table eco_points_tx enable row level security;
alter table eco_points_balance enable row level security;
alter table storage_files enable row level security;

drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select using (
  auth.uid() = auth_id
);
drop policy if exists "profiles_insert" on profiles;
create policy "profiles_insert" on profiles for insert with check (
  auth.uid() = auth_id
);
drop policy if exists "profiles_update" on profiles;
create policy "profiles_update" on profiles for update using (
  auth.uid() = auth_id
) with check (
  auth.uid() = auth_id
);
drop policy if exists "profiles_delete" on profiles;
create policy "profiles_delete" on profiles for delete using (
  auth.uid() = auth_id
);

drop policy if exists "rooms_select_auth" on rooms;
create policy "rooms_select_auth" on rooms for select using (auth.uid() is not null);
drop policy if exists "rooms_modify_receptionist_insert" on rooms;
create policy "rooms_modify_receptionist_insert" on rooms for insert with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
drop policy if exists "rooms_modify_receptionist_update" on rooms;
create policy "rooms_modify_receptionist_update" on rooms for update using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST')) with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
drop policy if exists "rooms_delete_main_receptionist" on rooms;
create policy "rooms_delete_main_receptionist" on rooms for delete using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST' and p.is_main = true));

drop policy if exists "reservations_select_auth" on reservations;
create policy "reservations_select_auth" on reservations for select using (auth.uid() is not null);
drop policy if exists "reservations_modify_receptionist_insert" on reservations;
create policy "reservations_modify_receptionist_insert" on reservations for insert with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
drop policy if exists "reservations_modify_receptionist_update" on reservations;
create policy "reservations_modify_receptionist_update" on reservations for update using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST')) with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
drop policy if exists "reservations_delete_main_receptionist" on reservations;
create policy "reservations_delete_main_receptionist" on reservations for delete using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST' and p.is_main = true));

drop policy if exists "payments_select_auth" on payments;
create policy "payments_select_auth" on payments for select using (auth.uid() is not null);
drop policy if exists "payments_modify_receptionist_insert" on payments;
create policy "payments_modify_receptionist_insert" on payments for insert with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
drop policy if exists "payments_modify_receptionist_update" on payments;
create policy "payments_modify_receptionist_update" on payments for update using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST')) with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
drop policy if exists "payments_delete_main_receptionist" on payments;
create policy "payments_delete_main_receptionist" on payments for delete using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST' and p.is_main = true));

drop policy if exists "guests_select_auth" on guests;
create policy "guests_select_auth" on guests for select using (auth.uid() is not null);
drop policy if exists "guests_modify_receptionist_insert" on guests;
create policy "guests_modify_receptionist_insert" on guests for insert with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
drop policy if exists "guests_modify_receptionist_update" on guests;
create policy "guests_modify_receptionist_update" on guests for update using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST')) with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
drop policy if exists "guests_delete_main_receptionist" on guests;
create policy "guests_delete_main_receptionist" on guests for delete using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST' and p.is_main = true));

drop policy if exists "site_content_public_select" on site_content_pages;
create policy "site_content_public_select" on site_content_pages for select using (is_active = true);
drop policy if exists "site_content_update_receptionist" on site_content_pages;
create policy "site_content_update_receptionist" on site_content_pages for all using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST')) with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('room-images', 'room-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('activity-images', 'activity-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('menu-images', 'menu-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('chat_uploads', 'chat_uploads', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']),
  ('content-images', 'content-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('staff-avatars', 'staff-avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('guest-photos', 'guest-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('guest-documents', 'guest-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
SET public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public room images are readable" on storage.objects;
create policy "Public room images are readable" on storage.objects for select using (bucket_id = 'room-images');
drop policy if exists "Public activity images are readable" on storage.objects;
create policy "Public activity images are readable" on storage.objects for select using (bucket_id = 'activity-images');
drop policy if exists "Public menu images are readable" on storage.objects;
create policy "Public menu images are readable" on storage.objects for select using (bucket_id = 'menu-images');
drop policy if exists "Public chat uploads are readable" on storage.objects;
create policy "Public chat uploads are readable" on storage.objects for select using (bucket_id = 'chat_uploads');
drop policy if exists "Public content images are readable" on storage.objects;
create policy "Public content images are readable" on storage.objects for select using (bucket_id = 'content-images');
drop policy if exists "Private staff avatars readable by authenticated users" on storage.objects;
drop policy if exists "Public staff avatars are readable" on storage.objects;
create policy "Public staff avatars are readable" on storage.objects for select using (bucket_id = 'staff-avatars');
drop policy if exists "Public guest photos are readable" on storage.objects;
create policy "Public guest photos are readable" on storage.objects for select using (bucket_id = 'guest-photos');
drop policy if exists "Private guest documents readable by authenticated users" on storage.objects;
create policy "Private guest documents readable by authenticated users" on storage.objects for select using (bucket_id = 'guest-documents' and auth.uid() is not null);
drop policy if exists "Authenticated uploads to allowed buckets" on storage.objects;
create policy "Authenticated uploads to allowed buckets" on storage.objects for insert with check (auth.uid() is not null and bucket_id in ('room-images', 'activity-images', 'menu-images', 'chat_uploads', 'content-images', 'staff-avatars', 'guest-photos', 'guest-documents'));
drop policy if exists "Authenticated updates to allowed buckets" on storage.objects;
create policy "Authenticated updates to allowed buckets" on storage.objects for update using (auth.uid() is not null and bucket_id in ('room-images', 'activity-images', 'menu-images', 'chat_uploads', 'content-images', 'staff-avatars', 'guest-photos', 'guest-documents')) with check (auth.uid() is not null and bucket_id in ('room-images', 'activity-images', 'menu-images', 'chat_uploads', 'content-images', 'staff-avatars', 'guest-photos', 'guest-documents'));
drop policy if exists "Authenticated deletes in allowed buckets" on storage.objects;
create policy "Authenticated deletes in allowed buckets" on storage.objects for delete using (auth.uid() is not null and bucket_id in ('room-images', 'activity-images', 'menu-images', 'chat_uploads', 'content-images', 'staff-avatars', 'guest-photos', 'guest-documents'));

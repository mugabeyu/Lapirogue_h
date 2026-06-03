-- Live patch set for project afilatpihmbicqadwslm
-- Date: 2026-06-03
-- Safe to run multiple times.

begin;

-- 1) Ensure guest audit columns exist in live DB (some environments missed these).
alter table if exists public.guests
  add column if not exists created_by uuid references public.profiles(auth_id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(auth_id) on delete set null,
  add column if not exists deleted_by uuid references public.profiles(auth_id) on delete set null,
  add column if not exists deleted_at timestamptz;

-- 1b) Ensure audit logs has JSON columns expected by trigger/function code.
alter table if exists public.audit_logs
  add column if not exists previous_data jsonb,
  add column if not exists new_data jsonb;

-- 1c) Align messages table with app expectations (audit columns and defaults).
alter table if exists public.messages
  add column if not exists guest_id uuid references public.guests(id) on delete cascade,
  add column if not exists message_type text not null default 'guest',
  add column if not exists subject text,
  add column if not exists content text,
  add column if not exists is_read boolean not null default false,
  add column if not exists attachment_url text,
  add column if not exists created_by uuid references public.profiles(auth_id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(auth_id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.messages
  alter column content set not null;

-- 2) Keep foreign-key query paths indexed for performance.
create index if not exists reservations_guest_id_idx on public.reservations (guest_id);
create index if not exists reservations_room_id_idx on public.reservations (room_id);
create index if not exists food_orders_guest_id_idx on public.food_orders (guest_id);
create index if not exists payments_guest_id_idx on public.payments (guest_id);
create index if not exists messages_guest_id_idx on public.messages (guest_id);
create index if not exists messages_created_at_idx on public.messages (created_at desc);
create index if not exists messages_guest_id_is_read_idx on public.messages (guest_id, is_read);
create index if not exists messages_guest_id_created_at_idx on public.messages (guest_id, created_at desc);

alter table if exists public.messages
  drop constraint if exists messages_message_type_check;

alter table if exists public.messages
  add constraint messages_message_type_check
  check (message_type in ('guest', 'receptionist', 'admin'));

comment on table public.messages is 'Admin and guest direct chat messages grouped by guest_id conversation.';
comment on column public.messages.message_type is 'guest = guest sender, receptionist/admin = staff sender.';

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.messages;
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;

drop trigger if exists messages_set_updated_at on public.messages;
create trigger messages_set_updated_at
before update on public.messages
for each row execute function public.set_updated_at();

drop trigger if exists messages_set_audit_fields on public.messages;
create trigger messages_set_audit_fields
before insert or update on public.messages
for each row execute function public.set_created_by_and_updated_by();

drop trigger if exists messages_audit_log on public.messages;
create trigger messages_audit_log
after insert or update or delete on public.messages
for each row execute function public.log_audit_event();

-- 2b) Restore analytics tables when they are missing in live projects.
create table if not exists public.guest_feedback (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  category text not null,
  comment text,
  staff_response text,
  responded_at timestamptz,
  created_by uuid references public.profiles(auth_id) on delete set null,
  updated_by uuid references public.profiles(auth_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sustainability_activities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#10b981',
  default_points integer not null default 0 check (default_points >= 0),
  carbon_offset_kg numeric(10,2) not null default 0 check (carbon_offset_kg >= 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles(auth_id) on delete set null,
  updated_by uuid references public.profiles(auth_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.eco_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  min_points integer not null default 0 check (min_points >= 0),
  sort_order integer not null default 0,
  created_by uuid references public.profiles(auth_id) on delete set null,
  updated_by uuid references public.profiles(auth_id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.guest_eco_point_events (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests(id) on delete cascade,
  activity_id uuid not null references public.sustainability_activities(id) on delete restrict,
  source_type text not null default 'ACTIVITY_BOOKING' check (source_type in ('ACTIVITY_BOOKING', 'SERVICE_REQUEST', 'MANUAL')),
  source_record_id uuid not null,
  source_label text,
  points integer not null check (points > 0),
  carbon_offset_kg numeric(10,2) not null default 0 check (carbon_offset_kg >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(auth_id) on delete set null,
  updated_by uuid references public.profiles(auth_id) on delete set null,
  earned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists guest_feedback_guest_id_idx on public.guest_feedback (guest_id);
create index if not exists guest_feedback_created_at_idx on public.guest_feedback (created_at desc);
create index if not exists guest_eco_point_events_guest_id_idx on public.guest_eco_point_events (guest_id);
create index if not exists guest_eco_point_events_activity_id_idx on public.guest_eco_point_events (activity_id);
create index if not exists guest_eco_point_events_earned_at_idx on public.guest_eco_point_events (earned_at desc);

-- 2c) Enforce calendar-aware status transitions in DB.
create or replace function public.validate_reservation_status_dates()
returns trigger as $$
begin
  if new.status = 'CHECKED_IN' and (new.check_in > current_date or new.check_out <= current_date) then
    raise exception 'Check-in is only allowed on or after check-in date and before check-out date';
  end if;

  if new.status = 'CHECKED_OUT' and new.check_out > current_date then
    raise exception 'Check-out is only allowed on or after the check-out date';
  end if;

  return new;
end;
$$ language plpgsql;

create or replace function public.validate_guest_status_dates()
returns trigger as $$
declare
  has_active_stay boolean;
begin
  if new.status = 'CHECKED_IN' then
    execute $q$
      select exists (
        select 1
        from public.reservations r
        where r.guest_id = $1
          and r.status <> 'CANCELLED'
          and r.check_in <= current_date
          and r.check_out > current_date
      )
    $q$
    into has_active_stay
    using new.id;

    if not has_active_stay then
      raise exception 'Guest can only be checked in when there is an active stay for today';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists reservations_validate_status_dates on public.reservations;
create trigger reservations_validate_status_dates
before insert or update on public.reservations
for each row execute function public.validate_reservation_status_dates();

drop trigger if exists guests_validate_status_dates on public.guests;
create trigger guests_validate_status_dates
before insert or update on public.guests
for each row execute function public.validate_guest_status_dates();

-- 3) Disable admin/staff uploads for guest profile photos while preserving read access.
drop policy if exists "Authenticated uploads to allowed buckets" on storage.objects;
create policy "Authenticated uploads to allowed buckets"
on storage.objects for insert
with check (
  auth.uid() is not null
  and bucket_id in (
    'room-images',
    'activity-images',
    'menu-images',
    'chat_uploads',
    'content-images',
    'staff-avatars',
    'guest-documents'
  )
);

drop policy if exists "Authenticated updates to allowed buckets" on storage.objects;
create policy "Authenticated updates to allowed buckets"
on storage.objects for update
using (
  auth.uid() is not null
  and bucket_id in (
    'room-images',
    'activity-images',
    'menu-images',
    'chat_uploads',
    'content-images',
    'staff-avatars',
    'guest-documents'
  )
)
with check (
  auth.uid() is not null
  and bucket_id in (
    'room-images',
    'activity-images',
    'menu-images',
    'chat_uploads',
    'content-images',
    'staff-avatars',
    'guest-documents'
  )
);

drop policy if exists "Authenticated deletes in allowed buckets" on storage.objects;
create policy "Authenticated deletes in allowed buckets"
on storage.objects for delete
using (
  auth.uid() is not null
  and bucket_id in (
    'room-images',
    'activity-images',
    'menu-images',
    'chat_uploads',
    'content-images',
    'staff-avatars',
    'guest-documents'
  )
);

commit;

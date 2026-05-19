-- Convert legacy admin roles to receptionist-only access and add guest schedule storage.

update profiles
set role = 'RECEPTIONIST',
    is_main = false
where role = 'ADMIN';

update profiles
set is_main = true
where auth_id = (
  select auth_id
  from profiles
  order by created_at
  limit 1
);

update roles
set name = 'RECEPTIONIST'
where name = 'ADMIN';

delete from roles
where name <> 'RECEPTIONIST';

insert into roles (name, description, permissions)
values (
  'RECEPTIONIST',
  'Main hotel administrator with full access to the system.',
  '{}'::jsonb
)
on conflict (name) do update
set description = excluded.description,
    permissions = excluded.permissions;

update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'RECEPTIONIST')
where coalesce(raw_user_meta_data->>'role', '') = 'ADMIN';

alter table profiles
  drop constraint if exists profiles_role_receptionist_only;

alter table profiles
  add constraint profiles_role_receptionist_only check (role = 'RECEPTIONIST');

alter table roles
  drop constraint if exists roles_name_receptionist_only;

alter table roles
  add constraint roles_name_receptionist_only check (name = 'RECEPTIONIST');

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

create index if not exists guest_schedule_items_guest_id_idx on guest_schedule_items (guest_id);
create index if not exists guest_schedule_items_start_at_idx on guest_schedule_items (start_at);

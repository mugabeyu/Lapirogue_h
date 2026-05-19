create table if not exists sustainability_activities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#10b981',
  default_points integer not null default 0 check (default_points >= 0),
  carbon_offset_kg numeric(10, 2) not null default 0 check (carbon_offset_kg >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists eco_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  min_points integer not null default 0 check (min_points >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists guest_eco_point_events (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id) on delete cascade,
  activity_id uuid not null references sustainability_activities(id) on delete restrict,
  points integer not null check (points > 0),
  carbon_offset_kg numeric(10, 2) not null default 0 check (carbon_offset_kg >= 0),
  earned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists guest_eco_point_events_guest_id_idx on guest_eco_point_events (guest_id);
create index if not exists guest_eco_point_events_activity_id_idx on guest_eco_point_events (activity_id);
create index if not exists guest_eco_point_events_earned_at_idx on guest_eco_point_events (earned_at desc);

alter table sustainability_activities enable row level security;
alter table eco_tiers enable row level security;
alter table guest_eco_point_events enable row level security;

create policy "sustainability_activities_select_auth" on sustainability_activities for select using (auth.uid() is not null);
create policy "eco_tiers_select_auth" on eco_tiers for select using (auth.uid() is not null);
create policy "guest_eco_point_events_select_auth" on guest_eco_point_events for select using (auth.uid() is not null);
create policy "guest_eco_point_events_modify_receptionist_insert" on guest_eco_point_events for insert with check (
  exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST')
);
create policy "guest_eco_point_events_modify_receptionist_update" on guest_eco_point_events for update using (
  exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST')
);
create policy "guest_eco_point_events_delete_main_receptionist" on guest_eco_point_events for delete using (
  exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST' and p.is_main = true)
);

drop trigger if exists sustainability_activities_set_updated_at on sustainability_activities;
create trigger sustainability_activities_set_updated_at before update on sustainability_activities for each row execute function set_updated_at();

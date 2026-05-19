create table if not exists guest_feedback (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  category text not null,
  comment text,
  staff_response text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists guest_feedback_guest_id_idx on guest_feedback (guest_id);
create index if not exists guest_feedback_created_at_idx on guest_feedback (created_at desc);
create index if not exists guest_feedback_rating_idx on guest_feedback (rating);

alter table guest_feedback enable row level security;

create policy "guest_feedback_select_auth" on guest_feedback for select using (auth.uid() is not null);
create policy "guest_feedback_modify_receptionist_insert" on guest_feedback for insert with check (
  exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST')
);
create policy "guest_feedback_modify_receptionist_update" on guest_feedback for update using (
  exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST')
);
create policy "guest_feedback_delete_main_receptionist" on guest_feedback for delete using (
  exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST' and p.is_main = true)
);

-- Extended activity fields for UI (duration label, location, requirements)
alter table activities
  add column if not exists duration_label text,
  add column if not exists meeting_point text,
  add column if not exists requires_advance_booking boolean not null default false,
  add column if not exists weather_dependent boolean not null default false,
  add column if not exists suitable_for_children boolean not null default false,
  add column if not exists default_time text default '09:00';

alter table activity_bookings
  add column if not exists booking_time time,
  add column if not exists pickup_point text;

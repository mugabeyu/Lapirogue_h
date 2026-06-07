-- Migration: Fix room status auto-update trigger for Supabase
-- Run this in Supabase SQL Editor to fix the occupancy/check-in/check-out issue

-- Enable pgcrypto extension if not exists
create extension if not exists pgcrypto;

-- Add missing payment_status enum values
DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'PAID';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'REFUNDED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add missing reservation_status enum value
DO $$ BEGIN
  ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'NO_SHOW';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create the room status update function with SECURITY DEFINER to bypass RLS
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
$$ language plpgsql security definer;

-- Drop and recreate the trigger to ensure it exists
DROP TRIGGER IF EXISTS reservations_update_room_status ON reservations;
CREATE TRIGGER reservations_update_room_status
  AFTER INSERT OR UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_room_status_on_reservation();

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION update_room_status_on_reservation() TO authenticated, service_role;

-- FIX EXISTING ROOMS: Update room status based on current reservations
-- Set rooms with CONFIRMED or CHECKED_IN reservations to OCCUPIED
UPDATE rooms SET status = 'OCCUPIED'
WHERE id IN (
  SELECT room_id FROM reservations WHERE status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
);

-- Set rooms with no active reservations back to AVAILABLE
UPDATE rooms SET status = 'AVAILABLE'
WHERE id NOT IN (
  SELECT room_id FROM reservations WHERE status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
) AND status != 'MAINTENANCE';

-- Verify trigger exists
SELECT tgname, tgrelid::regclass, tgfoid::regproc, tgtype 
FROM pg_trigger 
WHERE tgname = 'reservations_update_room_status';

-- Show current room status summary
SELECT status, count(*) as room_count 
FROM rooms 
GROUP BY status 
ORDER BY status;
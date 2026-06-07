-- ===========================================
-- FIX ROOM STATUS TRIGGER ONLY
-- Run this in Supabase SQL Editor to fix occupancy
-- ===========================================

-- Create the room status update function
-- SECURITY DEFINER allows this to bypass RLS
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

-- Create the trigger
DROP TRIGGER IF EXISTS reservations_update_room_status ON reservations;
CREATE TRIGGER reservations_update_room_status
  AFTER INSERT OR UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_room_status_on_reservation();

-- Grant permissions for the service role
GRANT EXECUTE ON FUNCTION update_room_status_on_reservation() TO authenticated, service_role;

-- FIX EXISTING ROOMS based on current reservations
UPDATE rooms SET status = 'OCCUPIED'
WHERE id IN (
  SELECT room_id FROM reservations WHERE status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
);

-- Reset rooms with no active reservations back to AVAILABLE  
UPDATE rooms SET status = 'AVAILABLE'
WHERE id NOT IN (
  SELECT room_id FROM reservations WHERE status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
) AND status != 'MAINTENANCE';

-- Verify results
SELECT 'Trigger installed successfully' as status;
SELECT status, count(*) as room_count FROM rooms GROUP BY status ORDER BY status;
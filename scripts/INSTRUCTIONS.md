-- =============================================
-- LA PIROGUE HMS - RUN THESE SCRIPTS IN ORDER
-- =============================================
-- HOW TO RUN:
-- 1. Open https://supabase.com/dashboard/project/txalwdljaxltchcrauhp/sql/new
-- 2. Copy ALL of cleanup_complete.sql content and paste it, run it
-- 3. Copy ALL of laprogue_v2_migration.sql content and paste it, run it
-- 4. Verify with the queries below

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Check new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'departments', 'managers', 'receptionists', 
    'sustainability_activities', 'eco_tiers', 
    'emergency_contacts', 'guest_eco_point_events',
    'registration_otps'
  )
ORDER BY table_name;

-- Check old tables are dropped (should return 0 rows)
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'staff', 'staff_onboarding', 'guest_onboarding',
    'eco_actions', 'eco_points_tx', 'eco_points_balance',
    'guest_eco_actions'
  );

-- Check new columns exist on guests
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'guests' 
  AND column_name IN ('account_status', 'home_address');

-- Check new columns on food_orders and activity_bookings
SELECT table_name, column_name FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('food_orders', 'activity_bookings')
  AND column_name = 'origin';

-- Check triggers exist
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
  AND trigger_name IN (
    'enforce_checkin_food_orders', 
    'enforce_checkin_activity_bookings',
    'trg_auto_unfreeze'
  );

-- Check RLS policies
SELECT tablename, policyname FROM pg_policies 
WHERE schemaname = 'public' 
  AND policyname IN (
    'Admin full departments', 'Admin full managers',
    'Manager full receptionists', 'Staff view departments',
    'Staff manage sustainability activities'
  );

-- Check seed data
SELECT name, default_points FROM public.sustainability_activities ORDER BY default_points;
SELECT name, min_points FROM public.eco_tiers ORDER BY sort_order;

-- Check roles
SELECT name, description FROM public.roles WHERE name IN ('ADMIN', 'MANAGER', 'RECEPTIONIST');

-- Check guest_account_status values
SELECT unnest(enum_range(NULL::public.guest_account_status)) AS account_status_value;

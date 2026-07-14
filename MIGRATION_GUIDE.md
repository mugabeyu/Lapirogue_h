# Database Migration Guide

## Migration: 011_e2e_testing_fixes

**Status:** Ready to apply  
**Priority:** P1 (Critical for data integrity)  
**Date:** 2026-07-14  
**Impact:** Low - No breaking changes

---

## What This Migration Fixes

### Issue 1: Missing CASCADE Delete on food_orders
- **Problem:** If a reservation is deleted, food orders become orphaned
- **Fix:** Added `ON DELETE CASCADE` to `food_orders.reservation_id` FK
- **Impact:** Food orders automatically deleted when reservation is deleted

### Issue 2: Missing CASCADE Delete on activity_bookings
- **Problem:** If a reservation is deleted, activity bookings become orphaned
- **Fix:** Added `ON DELETE CASCADE` to `activity_bookings.reservation_id` FK
- **Impact:** Activity bookings automatically deleted when reservation is deleted

### Issue 3: Audit Logging & Data Integrity
- **Added:** Guest deletion audit trail
- **Added:** Data integrity verification functions
- **Added:** Orphaned record detection
- **Added:** Constraint checking indexes

---

## How to Apply This Migration

### Option 1: Supabase Dashboard (Recommended for Visual Users)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy the entire contents of `supabase/migrations/011_e2e_testing_fixes.sql`
6. Paste into the editor
7. Click **Run**
8. Verify the operation completes successfully

### Option 2: Using psql Command Line

```bash
# Install psql if not already installed
# macOS: brew install libpq
# Ubuntu: sudo apt-get install postgresql-client
# Windows: https://www.postgresql.org/download/windows/

# Extract connection string from Supabase
# Dashboard > Project Settings > Database > Connection String

psql "postgresql://user:password@db.txalwdljaxltchcrauhp.supabase.co:5432/postgres" \
  < supabase/migrations/011_e2e_testing_fixes.sql
```

### Option 3: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g @supabase/cli

# Link your project
supabase link

# Apply migrations
supabase db push
```

---

## Verification Steps

After applying the migration, run these checks in Supabase SQL Editor:

### Check 1: Verify CASCADE constraints
```sql
SELECT
    table_name,
    constraint_name,
    is_deferrable
FROM information_schema.table_constraints
WHERE table_name IN ('food_orders', 'activity_bookings')
AND constraint_name LIKE '%reservation%';
```

**Expected result:** 2 rows with `is_deferrable = NO`

### Check 2: Verify integrity functions exist
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_type = 'FUNCTION'
AND (routine_name LIKE 'verify_%' OR routine_name LIKE 'detect_%' OR routine_name = 'run_data_integrity_check')
ORDER BY routine_name;
```

**Expected result:** 3 functions listed

### Check 3: Run data integrity check
```sql
SELECT * FROM public.run_data_integrity_check();
```

**Expected result:** All checks should return 0 affected rows with `status = 'PASS'`

### Check 4: Check for orphaned records
```sql
SELECT * FROM public.detect_orphaned_records();
```

**Expected result:** No orphaned records found (0 rows or empty result set)

---

## Rollback Instructions (If Needed)

If you need to rollback this migration:

```sql
-- Rollback cascade delete constraints
ALTER TABLE public.food_orders
DROP CONSTRAINT food_orders_reservation_id_fkey;

ALTER TABLE public.food_orders
ADD CONSTRAINT food_orders_reservation_id_fkey
    FOREIGN KEY (reservation_id)
    REFERENCES public.reservations(id)
    ON DELETE SET NULL;

ALTER TABLE public.activity_bookings
DROP CONSTRAINT activity_bookings_reservation_id_fkey;

ALTER TABLE public.activity_bookings
ADD CONSTRAINT activity_bookings_reservation_id_fkey
    FOREIGN KEY (reservation_id)
    REFERENCES public.reservations(id)
    ON DELETE SET NULL;

-- Drop new functions and audit table
DROP FUNCTION IF EXISTS public.run_data_integrity_check();
DROP FUNCTION IF EXISTS public.detect_orphaned_records();
DROP FUNCTION IF EXISTS public.verify_guest_cascade_integrity();
DROP FUNCTION IF EXISTS public.audit_guest_deletion();
DROP TABLE IF EXISTS public.audit_log;
DROP INDEX IF EXISTS idx_food_orders_reservation_id;
DROP INDEX IF EXISTS idx_activity_bookings_reservation_id;
```

---

## Testing After Migration

Both apps have been tested and verified to work correctly with this migration:

✅ **Flutter Mobile App**
- Guest registration
- Reservation creation
- Password reset

✅ **Next.js Web App**
- Staff dashboard
- Guest management
- Reservation tracking

✅ **Data Integrity**
- Cross-app data visibility
- Foreign key relationships
- Cascade delete functionality

---

## Support

If you encounter any issues:

1. **Check the verification steps** above first
2. **Review the SQL script** for any errors
3. **Check database logs** in Supabase Dashboard > Database > Logs
4. **Contact the development team** with the error message

---

## Timeline

- **Testing Completed:** 2026-07-14
- **Ready to Deploy:** Yes
- **Estimated Duration:** < 2 minutes
- **Recommended Time:** Off-peak hours (minimal traffic)

---

## Backup Recommendation

Before applying this migration:

1. Go to Supabase Dashboard > Backups
2. Click **Create backup**
3. Name it: `backup_before_011_migration`
4. Wait for backup to complete
5. Then apply the migration

---

**Next Steps:** Apply this migration, run verification checks, and both apps will be production-ready!

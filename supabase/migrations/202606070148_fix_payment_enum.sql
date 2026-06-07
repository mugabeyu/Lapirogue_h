-- Fix payment_status enum to match schema.sql definition
-- Run this migration on the live Supabase database before deploying the backend.
-- The live DB only has 'PENDING' in payment_status, but the code queries PAID and PARTIALLY_PAID.

DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'PAID';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'REFUNDED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add missing reservation_status value (schema has NO_SHOW but live DB may not)
DO $$ BEGIN
  ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'NO_SHOW';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

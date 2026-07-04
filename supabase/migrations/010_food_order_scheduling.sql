-- =============================================
-- Migration 010: Add scheduled date/time to food orders
-- =============================================
-- Allows guests and staff to set a desired delivery time
-- when placing food & beverage orders.
-- =============================================

ALTER TABLE IF EXISTS public.food_orders
    ADD COLUMN IF NOT EXISTS scheduled_date date;

ALTER TABLE IF EXISTS public.food_orders
    ADD COLUMN IF NOT EXISTS scheduled_time time without time zone;

COMMENT ON COLUMN public.food_orders.scheduled_date IS 'The date the guest wants the order delivered/served';
COMMENT ON COLUMN public.food_orders.scheduled_time IS 'The time slot the guest wants the order delivered/served';

CREATE INDEX IF NOT EXISTS idx_food_orders_scheduled_date ON public.food_orders(scheduled_date);

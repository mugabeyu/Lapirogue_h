-- =============================================
-- CREATE ROLES TABLE FOR STAFF MANAGEMENT
-- Run in SQL Editor: https://supabase.com/dashboard/project/txalwdljaxltchcrauhp/sql/new
-- =============================================

-- Create roles table
CREATE TABLE IF NOT EXISTS public.roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    permissions jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE IF EXISTS public.roles ENABLE ROW LEVEL SECURITY;

-- Staff read-only access (drop then create to handle re-runs)
DROP POLICY IF EXISTS "Roles staff read-only" ON public.roles;
CREATE POLICY "Roles staff read-only" ON public.roles FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('MAIN_RECEPTIONIST','RECEPTIONIST')));

-- Admin full access (drop then create to handle re-runs)
DROP POLICY IF EXISTS "Roles admin full access" ON public.roles;
CREATE POLICY "Roles admin full access" ON public.roles FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role = 'MAIN_RECEPTIONIST'));

-- Seed default roles
INSERT INTO public.roles (name, description, permissions)
VALUES ('MAIN_RECEPTIONIST', 'Full administrative access to all hotel management features', '{"manage_staff": true, "manage_rooms": true, "manage_reservations": true, "manage_payments": true, "manage_guests": true, "view_reports": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.roles (name, description, permissions)
VALUES ('RECEPTIONIST', 'Standard receptionist access with limited permissions', '{"manage_reservations": true, "manage_guests": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Create update trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_roles_updated_at ON public.roles;
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Verification
SELECT 'Roles table created successfully' as status;
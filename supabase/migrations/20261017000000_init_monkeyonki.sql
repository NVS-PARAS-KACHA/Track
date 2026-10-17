-- ====================================================================
-- MonkeyOnki Location Application Schema
-- PostgreSQL & Supabase Migration
-- ====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Profiles Table (Admins & Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Create Location Sessions Table
CREATE TABLE IF NOT EXISTS public.location_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    display_name TEXT NOT NULL,
    device_info TEXT,
    browser_info TEXT,
    consent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    ended_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('active', 'ended', 'demo')) DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Create Location Updates Table
CREATE TABLE IF NOT EXISTS public.location_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.location_sessions(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy_meters DOUBLE PRECISION,
    resolved_address TEXT,
    is_demo BOOLEAN NOT NULL DEFAULT false,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_location_sessions_status ON public.location_sessions(status);
CREATE INDEX IF NOT EXISTS idx_location_sessions_user_id ON public.location_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_location_updates_session_id ON public.location_updates(session_id);
CREATE INDEX IF NOT EXISTS idx_location_updates_recorded_at ON public.location_updates(recorded_at DESC);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_updates ENABLE ROW LEVEL SECURITY;

-- 7. Helper Security Function: Check if caller is Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Profiles RLS Policies
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- 9. Location Sessions RLS Policies
CREATE POLICY "Public visitor can start an authorized session"
    ON public.location_sessions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Session holder can update their own session status"
    ON public.location_sessions FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Admins can view all sessions"
    ON public.location_sessions FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Admins can delete sessions"
    ON public.location_sessions FOR DELETE
    USING (public.is_admin());

-- 10. Location Updates RLS Policies
CREATE POLICY "Public visitor can submit update to active session"
    ON public.location_updates FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.location_sessions
            WHERE id = session_id AND status = 'active'
        )
    );

CREATE POLICY "Admins can view all location updates"
    ON public.location_updates FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Admins can delete location updates"
    ON public.location_updates FOR DELETE
    USING (public.is_admin());

-- 11. Profile Auto-Creation Trigger on Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, role)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', new.email),
        COALESCE(new.raw_user_meta_data->>'role', 'user')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. Retention Policy Cleanup Function
CREATE OR REPLACE FUNCTION public.cleanup_old_location_history(days_to_keep INT)
RETURNS INT AS $$
DECLARE
    deleted_rows INT;
BEGIN
    DELETE FROM public.location_updates
    WHERE recorded_at < (timezone('utc'::text, now()) - (days_to_keep || ' days')::INTERVAL);
    
    GET DIAGNOSTICS deleted_rows = ROW_COUNT;
    RETURN deleted_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

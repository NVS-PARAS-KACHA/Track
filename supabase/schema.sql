-- ====================================================================
-- TechPulse IT Services / MonkeyOnki GPS Telemetry Database Schema
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ====================================================================

-- 1. Create location_sessions Table (stores each applicant/visitor session)
CREATE TABLE IF NOT EXISTS public.location_sessions (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    device_info TEXT,
    browser_info TEXT,
    consent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    ended_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create location_updates Table (stores real-time GPS coordinates stream)
CREATE TABLE IF NOT EXISTS public.location_updates (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES public.location_sessions(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy_meters DOUBLE PRECISION,
    resolved_address TEXT,
    is_demo BOOLEAN NOT NULL DEFAULT false,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. High-performance indexes
CREATE INDEX IF NOT EXISTS idx_location_sessions_status ON public.location_sessions(status);
CREATE INDEX IF NOT EXISTS idx_location_sessions_started_at ON public.location_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_updates_session_id ON public.location_updates(session_id);
CREATE INDEX IF NOT EXISTS idx_location_updates_recorded_at ON public.location_updates(recorded_at DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.location_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_updates ENABLE ROW LEVEL SECURITY;

-- 5. Drop previous restrictive policies if they exist
DROP POLICY IF EXISTS "Public insert sessions" ON public.location_sessions;
DROP POLICY IF EXISTS "Public select sessions" ON public.location_sessions;
DROP POLICY IF EXISTS "Public update sessions" ON public.location_sessions;
DROP POLICY IF EXISTS "Public delete sessions" ON public.location_sessions;
DROP POLICY IF EXISTS "Public visitor can start an authorized session" ON public.location_sessions;
DROP POLICY IF EXISTS "Session holder can update their own session status" ON public.location_sessions;
DROP POLICY IF EXISTS "Admins can view all sessions" ON public.location_sessions;
DROP POLICY IF EXISTS "Admins can delete sessions" ON public.location_sessions;

DROP POLICY IF EXISTS "Public insert updates" ON public.location_updates;
DROP POLICY IF EXISTS "Public select updates" ON public.location_updates;
DROP POLICY IF EXISTS "Public delete updates" ON public.location_updates;
DROP POLICY IF EXISTS "Public visitor can submit update to active session" ON public.location_updates;
DROP POLICY IF EXISTS "Admins can view all location updates" ON public.location_updates;
DROP POLICY IF EXISTS "Admins can delete location updates" ON public.location_updates;

-- 6. Clean, open RLS Policies for Anon Public Key
-- Allows applicants from any phone/browser to submit coordinates
CREATE POLICY "Public insert sessions" ON public.location_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public select sessions" ON public.location_sessions FOR SELECT USING (true);
CREATE POLICY "Public update sessions" ON public.location_sessions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete sessions" ON public.location_sessions FOR DELETE USING (true);

-- Allows admin dashboard to read live coordinates without blocking
CREATE POLICY "Public insert updates" ON public.location_updates FOR INSERT WITH CHECK (true);
CREATE POLICY "Public select updates" ON public.location_updates FOR SELECT USING (true);
CREATE POLICY "Public delete updates" ON public.location_updates FOR DELETE USING (true);

-- 7. Enable Realtime Publications (pushes coordinates to admin map automatically)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'location_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.location_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'location_updates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.location_updates;
  END IF;
END $$;

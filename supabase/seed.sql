-- ====================================================================
-- MonkeyOnki Demo Seed Data (Matching User Interface Mockup)
-- Pune, Maharashtra, India
-- ====================================================================

-- Demo Admin user instruction:
-- In Supabase Auth dashboard, create an admin user (e.g. admin@monkeyonki.com)
-- Then elevate role:
-- UPDATE public.profiles SET role = 'admin' WHERE id = '<auth_user_id>';

-- Insert Demonstration Sessions
INSERT INTO public.location_sessions (id, display_name, device_info, browser_info, consent_at, started_at, status)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'User 1', 'Mobile (Android 14)', 'Chrome 128.0', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes', 'active'),
    ('c0000000-0000-0000-0000-000000000002', 'User 2', 'Desktop (Windows 11)', 'Chrome 129.0', NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '45 minutes', 'active'),
    ('c0000000-0000-0000-0000-000000000003', 'User 3', 'Mobile (iPhone 15)', 'Safari 17.5', NOW() - INTERVAL '60 minutes', NOW() - INTERVAL '60 minutes', 'active'),
    ('c0000000-0000-0000-0000-000000000004', 'User 4', 'Desktop (Windows 11)', 'Edge 128.0', NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes', 'active'),
    ('c0000000-0000-0000-0000-000000000005', 'User 5', 'Mobile (Android 13)', 'Chrome 128.0', NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '15 minutes', 'active')
ON CONFLICT (id) DO NOTHING;

-- Insert Demonstration Location Updates
INSERT INTO public.location_updates (id, session_id, latitude, longitude, accuracy_meters, resolved_address, is_demo, recorded_at)
VALUES
    -- User 1: Hinjawadi, Pune
    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001', 18.5912, 73.7389, 14.5, 'Hinjawadi, Pune, Maharashtra', true, NOW() - INTERVAL '2 minutes'),
    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001', 18.5901, 73.7375, 18.2, 'Phase 1 Hinjawadi, Pune', true, NOW() - INTERVAL '4 minutes'),
    
    -- User 2: Pune Central (Camp / Deccan)
    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002', 18.5204, 73.8567, 8.2, 'Pune, Maharashtra, India', true, NOW() - INTERVAL '30 seconds'),
    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002', 18.5195, 73.8550, 10.0, 'Budhwar Peth, Pune', true, NOW() - INTERVAL '2 minutes 30 seconds'),
    
    -- User 3: Kalyani Nagar, Pune
    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000003', 18.5476, 73.8891, 12.0, 'Kalyani Nagar, Pune', true, NOW() - INTERVAL '4 minutes'),
    
    -- User 4: Pune Central / Swargate
    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000004', 18.5204, 73.8567, 15.0, 'Pune, Maharashtra, India', true, NOW() - INTERVAL '6 minutes'),
    
    -- User 5: Baner, Pune
    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000005', 18.5607, 73.7698, 9.8, 'Baner, Pune, Maharashtra', true, NOW() - INTERVAL '3 minutes')
ON CONFLICT (id) DO NOTHING;

-- Explicit table grants for the Data API (supabase-js / PostgREST).
--
-- WHY THIS EXISTS
-- Supabase is changing its defaults: from October 30, 2026, tables in the
-- public schema will no longer be accessible via the Data API unless they
-- have an explicit GRANT. This migration adds those grants for every table
-- that the app currently accesses through supabase-js.
--
-- Row-level security (RLS) is already enabled on all tables and controls
-- what each user can actually read or write. These grants are the outer
-- door that lets PostgREST see the table at all; RLS is the inner lock
-- that controls which rows each user sees.
--
-- ROLES
--   authenticated  - any signed-in user
--   service_role   - Supabase's server-side role (used for admin operations
--                    and bypasses RLS; granted broadly here as a safety net)
--
-- HOW TO APPLY
-- Run "supabase db push" from the speedy-deliveries-fresh folder, or paste
-- this file's contents into the Supabase SQL editor and click Run.

-- user_roles: users read their own role; admins read all (via RLS)
GRANT SELECT ON public.user_roles TO authenticated, service_role;

-- profiles: users read/create/update their own profile; admins read all
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated, service_role;

-- difficulty_presets: all signed-in users read; admins update (via RLS)
GRANT SELECT, UPDATE ON public.difficulty_presets TO authenticated, service_role;

-- t3_ranges: all signed-in users read; admins update (via RLS)
GRANT SELECT, UPDATE ON public.t3_ranges TO authenticated, service_role;

-- game_sessions: users insert and read their own; admins read all (via RLS)
GRANT SELECT, INSERT, UPDATE ON public.game_sessions TO authenticated, service_role;

-- round_events: users insert and read their own sessions' events (via RLS)
GRANT SELECT, INSERT ON public.round_events TO authenticated, service_role;

-- feedback: users submit their own; admins read all (via RLS)
GRANT SELECT, INSERT ON public.feedback TO authenticated, service_role;

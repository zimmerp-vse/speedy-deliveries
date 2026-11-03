-- Add device / viewport / pointer / locale capture to game_sessions.
--
-- Pavel's research workflow needs device-type information per session for
-- downstream analysis (a phone session is qualitatively different from a
-- laptop session for a driving game). Captured client-side at session
-- creation in src/pages/Play.tsx and inserted as columns rather than
-- stuffed into params jsonb so they're easy to query / index from Python.
--
-- All five columns are nullable: existing rows from before this migration
-- predate the capture, and the capture itself can fail silently if a
-- browser doesn't expose a given API (e.g. very old browsers without
-- matchMedia).
--
-- Note: user_agent is a fingerprinting input. The registration form text
-- should mention research-data capture before the next pilot — see task #15.

ALTER TABLE public.game_sessions
  ADD COLUMN user_agent      text,
  ADD COLUMN viewport_width  integer,
  ADD COLUMN viewport_height integer,
  ADD COLUMN pointer_coarse  boolean,
  ADD COLUMN locale          text;

COMMENT ON COLUMN public.game_sessions.user_agent      IS 'navigator.userAgent at session start';
COMMENT ON COLUMN public.game_sessions.viewport_width  IS 'window.innerWidth at session start (px)';
COMMENT ON COLUMN public.game_sessions.viewport_height IS 'window.innerHeight at session start (px)';
COMMENT ON COLUMN public.game_sessions.pointer_coarse  IS 'true if primary pointer is touch (matchMedia "pointer: coarse")';
COMMENT ON COLUMN public.game_sessions.locale          IS 'navigator.language at session start';

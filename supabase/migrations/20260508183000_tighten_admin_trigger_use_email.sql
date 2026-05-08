-- Tighten admin role assignment in the handle_new_user trigger.
--
-- The original trigger (migration 20260430183904, lines 51-55) matched on
-- nickname: IF _nick = 'zimmerp'. Exact-case, typo-prone — Pavel hit this
-- on 2026-05-07 by registering as 'zimmer' and getting role='user' (the
-- fallback row was then patched manually in user_roles).
--
-- Email is validated at signup, lower()-comparison is unambiguous, and
-- the client-side whitelist in src/lib/auth.ts:67-71 already keys off
-- the same email anyway, so this brings DB and client into agreement.
--
-- CREATE OR REPLACE FUNCTION is atomic; safe to apply against a live DB.
-- The trigger fires on INSERT only, so this does not affect existing
-- auth.users rows. Pavel's existing admin assignment was set manually
-- and remains intact.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _nick TEXT := NEW.raw_user_meta_data->>'nickname';
  _age INTEGER := COALESCE((NEW.raw_user_meta_data->>'age')::int, 18);
  _dob DATE := NULLIF(NEW.raw_user_meta_data->>'date_of_birth','')::date;
BEGIN
  INSERT INTO public.profiles (id, nickname, age, date_of_birth)
  VALUES (NEW.id, COALESCE(_nick, 'user_'||substr(NEW.id::text,1,8)), _age, _dob);

  IF lower(NEW.email) = 'zimmerp@vse.cz' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$;

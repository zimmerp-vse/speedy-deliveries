CREATE OR REPLACE FUNCTION public.ensure_current_user_profile()
RETURNS TABLE(nickname text, age integer, is_admin boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _jwt jsonb := auth.jwt();
  _email text := COALESCE(_jwt->>'email', '');
  _meta jsonb := COALESCE(_jwt->'user_metadata', '{}'::jsonb);
  _nick text := NULLIF(btrim(_meta->>'nickname'), '');
  _age integer := COALESCE(NULLIF(_meta->>'age', '')::integer, 18);
  _dob date := NULLIF(_meta->>'date_of_birth','')::date;
  _is_admin boolean;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _nick IS NULL THEN
    _nick := COALESCE(NULLIF(split_part(_email, '@', 1), ''), 'user_' || substr(_user_id::text, 1, 8));
  END IF;

  INSERT INTO public.profiles (id, nickname, age, date_of_birth)
  VALUES (_user_id, _nick, _age, _dob)
  ON CONFLICT (id) DO UPDATE
  SET nickname = COALESCE(NULLIF(public.profiles.nickname, ''), EXCLUDED.nickname),
      age = COALESCE(public.profiles.age, EXCLUDED.age),
      date_of_birth = COALESCE(public.profiles.date_of_birth, EXCLUDED.date_of_birth);

  _is_admin := lower(_nick) = 'zimmerp' OR lower(_email) = 'zimmerp@vse.cz';

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, CASE WHEN _is_admin THEN 'admin'::public.app_role ELSE 'user'::public.app_role END)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF _is_admin THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN QUERY
  SELECT p.nickname, p.age, public.has_role(_user_id, 'admin'::public.app_role)
  FROM public.profiles p
  WHERE p.id = _user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_current_user_profile() TO authenticated;
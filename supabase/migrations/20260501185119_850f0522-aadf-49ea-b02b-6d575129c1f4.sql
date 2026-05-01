DROP FUNCTION IF EXISTS public.ensure_current_user_profile();

INSERT INTO public.profiles (id, nickname, age, date_of_birth)
SELECT
  u.id,
  COALESCE(NULLIF(btrim(u.raw_user_meta_data->>'nickname'), ''), split_part(u.email, '@', 1), 'user_' || substr(u.id::text, 1, 8)),
  COALESCE(NULLIF(u.raw_user_meta_data->>'age', '')::integer, 18),
  NULLIF(u.raw_user_meta_data->>'date_of_birth','')::date
FROM auth.users u
WHERE lower(u.email) = 'zimmerp@vse.cz'
   OR lower(COALESCE(u.raw_user_meta_data->>'nickname', '')) = 'zimmerp'
ON CONFLICT (id) DO UPDATE
SET nickname = 'zimmerp';

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::public.app_role
FROM public.profiles p
WHERE lower(p.nickname) = 'zimmerp'
ON CONFLICT (user_id, role) DO NOTHING;

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());
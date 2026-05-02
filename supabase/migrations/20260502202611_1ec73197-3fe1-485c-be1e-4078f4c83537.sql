CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Admin write presets" ON public.difficulty_presets;
CREATE POLICY "Admin write presets"
ON public.difficulty_presets
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can read feedback" ON public.feedback;
CREATE POLICY "Admins can read feedback"
ON public.feedback
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users read own sessions" ON public.game_sessions;
CREATE POLICY "Users read own sessions"
ON public.game_sessions
FOR SELECT
TO authenticated
USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING ((id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users read own rounds" ON public.round_events;
CREATE POLICY "Users read own rounds"
ON public.round_events
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.game_sessions s
  WHERE s.id = round_events.session_id
    AND (s.user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role))
));

DROP POLICY IF EXISTS "Admin write ranges" ON public.t3_ranges;
CREATE POLICY "Admin write ranges"
ON public.t3_ranges
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users see own roles" ON public.user_roles;
CREATE POLICY "Users see own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));
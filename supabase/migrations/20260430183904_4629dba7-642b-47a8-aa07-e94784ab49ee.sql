
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL UNIQUE,
  age INTEGER NOT NULL CHECK (age >= 6 AND age <= 120),
  date_of_birth DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- Signup trigger: create profile + assign role (admin if nickname=zimmerp)
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

  IF _nick = 'zimmerp' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Difficulty presets (T1)
CREATE TYPE public.preset_regime AS ENUM ('T1_easy','T1_medium','T1_hard');

CREATE TABLE public.difficulty_presets (
  regime public.preset_regime PRIMARY KEY,
  params JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.difficulty_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read presets" ON public.difficulty_presets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write presets" ON public.difficulty_presets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.difficulty_presets (regime, params) VALUES
('T1_easy', '{"difficulty":{"totalRounds":5,"tripDurationMs":45000,"carSpawnRate":0.02,"obstacleSpawnRate":0.003,"pedestrianSpawnRate":0.002,"malfunctionProbability":0.1,"maxSpeed":120,"acceleration":18,"braking":80},"economy":{"startingMoney":1000,"deliveryReward":600,"carCollisionCost":200,"obstacleCollisionCost":150,"pedestrianCollisionCost":100,"malfunctionCost":150}}'),
('T1_medium', '{"difficulty":{"totalRounds":8,"tripDurationMs":35000,"carSpawnRate":0.04,"obstacleSpawnRate":0.006,"pedestrianSpawnRate":0.004,"malfunctionProbability":0.25,"maxSpeed":120,"acceleration":18,"braking":80},"economy":{"startingMoney":1000,"deliveryReward":500,"carCollisionCost":300,"obstacleCollisionCost":200,"pedestrianCollisionCost":150,"malfunctionCost":250}}'),
('T1_hard', '{"difficulty":{"totalRounds":10,"tripDurationMs":25000,"carSpawnRate":0.07,"obstacleSpawnRate":0.012,"pedestrianSpawnRate":0.008,"malfunctionProbability":0.45,"maxSpeed":120,"acceleration":18,"braking":80},"economy":{"startingMoney":1000,"deliveryReward":400,"carCollisionCost":500,"obstacleCollisionCost":300,"pedestrianCollisionCost":250,"malfunctionCost":400}}');

-- T3 ranges (single row)
CREATE TABLE public.t3_ranges (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  params_min JSONB NOT NULL,
  params_max JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.t3_ranges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read ranges" ON public.t3_ranges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write ranges" ON public.t3_ranges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.t3_ranges (id, params_min, params_max) VALUES (1,
  '{"totalRounds":3,"tripDurationMs":20000,"carSpawnRate":0.01,"obstacleSpawnRate":0.002,"pedestrianSpawnRate":0.001,"malfunctionProbability":0.05,"deliveryReward":300,"carCollisionCost":150,"obstacleCollisionCost":100,"pedestrianCollisionCost":75,"malfunctionCost":100}',
  '{"totalRounds":12,"tripDurationMs":50000,"carSpawnRate":0.09,"obstacleSpawnRate":0.015,"pedestrianSpawnRate":0.010,"malfunctionProbability":0.6,"deliveryReward":800,"carCollisionCost":600,"obstacleCollisionCost":400,"pedestrianCollisionCost":300,"malfunctionCost":500}'
);

-- Sessions
CREATE TABLE public.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  regime TEXT NOT NULL,
  params JSONB NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  ended_reason TEXT,
  totals JSONB
);
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own sessions" ON public.game_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users insert own sessions" ON public.game_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own sessions" ON public.game_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Round events
CREATE TABLE public.round_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  time_ms INTEGER NOT NULL,
  scene TEXT,
  money_earned INTEGER NOT NULL DEFAULT 0,
  money_lost INTEGER NOT NULL DEFAULT 0,
  money_balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.round_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own rounds" ON public.round_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = session_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Users insert own rounds" ON public.round_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));

CREATE INDEX idx_round_events_session ON public.round_events(session_id);
CREATE INDEX idx_sessions_user ON public.game_sessions(user_id);

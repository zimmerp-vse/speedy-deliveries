import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user, loading };
}

export function useProfile(userOrId: User | string | null | undefined) {
  const [profile, setProfile] = useState<{ nickname: string; age: number } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = typeof userOrId === 'object' ? userOrId : null;
    const userId = typeof userOrId === 'string' ? userOrId : userOrId?.id;
    let cancelled = false;

    const load = async () => {
      if (!userId) { setProfile(null); setIsAdmin(false); setLoading(false); return; }
      setLoading(true);

      let { data: profileData } = await supabase.from('profiles').select('nickname, age').eq('id', userId).maybeSingle();
      if (!profileData && user) {
        const meta = user.user_metadata ?? {};
        const nickname = String(meta.nickname || user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`);
        const age = Number(meta.age || 18);
        await supabase.from('profiles').insert({ id: user.id, nickname, age, date_of_birth: meta.date_of_birth || null });
        const retry = await supabase.from('profiles').select('nickname, age').eq('id', userId).maybeSingle();
        profileData = retry.data;
      }

      const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
      if (!cancelled) {
        setProfile(profileData ?? null);
        setIsAdmin(!!roleData);
        setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [userOrId]);

  return { profile, isAdmin, loading };
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/';
}

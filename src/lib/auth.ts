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

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<{ nickname: string; age: number } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!userId) { setProfile(null); setIsAdmin(false); return; }
    supabase.from('profiles').select('nickname, age').eq('id', userId).maybeSingle()
      .then(({ data }) => setProfile(data ?? null));
    supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [userId]);

  return { profile, isAdmin };
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/';
}

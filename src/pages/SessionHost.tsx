import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, useProfile } from '@/lib/auth';
import { toast } from 'sonner';
import { FeedbackDialog } from '@/components/FeedbackDialog';
import { isTransientDatabaseError } from '@/lib/regimes';

const SRC = 'dash-delivery';

export default function SessionHost() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile(user);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ended, setEnded] = useState<null | { totals: any; reason: string }>(null);
  const [session, setSession] = useState<any>(null);
  const [gameReady, setGameReady] = useState(false);
  const sessionRef = useRef<any>(null);
  const initSentRef = useRef(false);

  useEffect(() => {
    if (!id || !user) return;
    if (id.startsWith('local-')) {
      const raw = sessionStorage.getItem(`local-session:${id}`);
      if (!raw) { toast.error('Session not found'); nav('/play'); return; }
      const localSession = JSON.parse(raw);
      sessionRef.current = localSession;
      setSession(localSession);
      return;
    }
    supabase.from('game_sessions').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error || !data) { toast.error('Session not found'); nav('/play'); return; }
      sessionRef.current = data;
      setSession(data);
    });
  }, [id, user, nav]);

  useEffect(() => {
    if (!gameReady || !session || !user || initSentRef.current) return;
    initSentRef.current = true;
    const nickname = profile?.nickname || user.user_metadata?.nickname || user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`;
    iframeRef.current?.contentWindow?.postMessage({
      source: SRC, type: 'INIT', version: 1,
      payload: {
        session: { sessionId: session.id },
        player: { nickname, id: user.id },
        difficulty: session.params.difficulty,
        economy: session.params.economy,
        ui: { showQuitButton: true, autoStart: true },
        extra: { regime: session.regime },
      },
    }, '*');
    // Give the iframe keyboard focus so arrow keys/space work without an extra click.
    setTimeout(() => {
      try { iframeRef.current?.focus(); iframeRef.current?.contentWindow?.focus(); } catch {}
    }, 50);
  }, [gameReady, session, user, profile]);

  // Re-focus iframe whenever user clicks the page (so controls work after any UI interaction).
  useEffect(() => {
    const refocus = () => { try { iframeRef.current?.contentWindow?.focus(); } catch {} };
    window.addEventListener('click', refocus);
    return () => window.removeEventListener('click', refocus);
  }, []);

  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.source !== SRC) return;
      const currentSession = sessionRef.current;
      if (d.type === 'READY') {
        setGameReady(true);
      } else if (d.type === 'ROUND_END') {
        if (!currentSession) return;
        const p = d.payload;
        if (String(currentSession.id).startsWith('local-')) return;
        const { error } = await supabase.from('round_events').insert({
          session_id: currentSession.id,
          round_number: p.round,
          outcome: p.outcome,
          time_ms: p.timeMs,
          scene: p.scene,
          money_earned: p.moneyEarned,
          money_lost: p.moneyLost,
          money_balance: p.moneyBalance,
        });
        if (error && !isTransientDatabaseError(error)) console.error('round_events insert failed', error);
      } else if (d.type === 'GAME_END') {
        if (!currentSession) return;
        const p = d.payload;
        if (String(currentSession.id).startsWith('local-')) { setEnded({ totals: p.totals, reason: p.endedReason }); return; }
        const { error } = await supabase.from('game_sessions').update({
          ended_at: new Date().toISOString(),
          ended_reason: p.endedReason,
          totals: p.totals,
        }).eq('id', currentSession.id);
        if (error && !isTransientDatabaseError(error)) console.error('game_sessions update failed', error);
        setEnded({ totals: p.totals, reason: p.endedReason });
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  if (ended) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full border border-border rounded-lg p-6 bg-card text-center space-y-4">
          <h1 className="text-2xl font-arcade text-primary">Session {ended.reason}</h1>
          <pre className="text-xs text-left bg-background border border-border rounded p-3 overflow-x-auto">
{JSON.stringify(ended.totals, null, 2)}
          </pre>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => nav('/play')}>Back to regimes</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-background relative">
      <iframe ref={iframeRef} src="/game" className="w-full h-full border-0" title="Dash Delivery game" />
      <Button variant="outline" size="sm" onClick={() => nav('/play')} className="absolute top-2 left-2 z-50">← Exit</Button>
      <FeedbackDialog />
    </div>
  );
}

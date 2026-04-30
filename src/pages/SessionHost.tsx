import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, useProfile } from '@/lib/auth';
import { toast } from 'sonner';

const SRC = 'dash-delivery';

export default function SessionHost() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ended, setEnded] = useState<null | { totals: any; reason: string }>(null);
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    if (!id || !user) return;
    supabase.from('game_sessions').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error || !data) { toast.error('Session not found'); nav('/play'); return; }
      sessionRef.current = data;
    });
  }, [id, user, nav]);

  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.source !== SRC) return;
      const session = sessionRef.current;
      if (d.type === 'READY' && session && profile) {
        iframeRef.current?.contentWindow?.postMessage({
          source: SRC, type: 'INIT', version: 1,
          payload: {
            session: { sessionId: session.id },
            player: { nickname: profile.nickname, id: user?.id },
            difficulty: session.params.difficulty,
            economy: session.params.economy,
            ui: { showQuitButton: true },
            extra: { regime: session.regime },
          },
        }, '*');
      } else if (d.type === 'ROUND_END') {
        const p = d.payload;
        await supabase.from('round_events').insert({
          session_id: session.id,
          round_number: p.round,
          outcome: p.outcome,
          time_ms: p.timeMs,
          scene: p.scene,
          money_earned: p.moneyEarned,
          money_lost: p.moneyLost,
          money_balance: p.moneyBalance,
        });
      } else if (d.type === 'GAME_END') {
        const p = d.payload;
        await supabase.from('game_sessions').update({
          ended_at: new Date().toISOString(),
          ended_reason: p.endedReason,
          totals: p.totals,
        }).eq('id', session.id);
        setEnded({ totals: p.totals, reason: p.endedReason });
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [profile, user]);

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
    <div className="w-screen h-screen bg-background">
      <iframe ref={iframeRef} src="/game" className="w-full h-full border-0" title="Dash Delivery game" />
    </div>
  );
}

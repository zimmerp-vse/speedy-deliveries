import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, useProfile } from '@/lib/auth';
import { AppHeader } from '@/components/AppHeader';
import {
  loadAllPresets, loadT3Ranges, generateT3, flattenParams, unflattenParams,
  NUMERIC_FIELD_LIST, FIELD_LABELS, type ResolvedParams, type RegimeKey,
} from '@/lib/regimes';
import { toast } from 'sonner';

export default function Play() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { profile, isAdmin } = useProfile(user?.id);
  const [presets, setPresets] = useState<Record<string, ResolvedParams>>({});
  const [ranges, setRanges] = useState<{ params_min: any; params_max: any } | null>(null);
  const [t2Params, setT2Params] = useState<Record<string, number>>({});

  useEffect(() => {
    loadAllPresets().then(rows => {
      const m: any = {}; for (const r of rows) m[r.regime] = r.params; setPresets(m);
      if (rows.length) setT2Params(flattenParams(rows.find((r: any) => r.regime === 'T1_medium')?.params ?? rows[0].params));
    });
    loadT3Ranges().then(setRanges);
  }, []);

  const startSession = async (regime: RegimeKey, params: ResolvedParams) => {
    if (!user) { toast.error('Not signed in'); return; }
    if (!profile) { toast.error('Profile not loaded yet — try again'); return; }
    const { data, error } = await supabase.from('game_sessions').insert([{
      user_id: user.id, nickname: profile.nickname, regime, params: params as any,
    }]).select('id').single();
    if (error) { toast.error(error.message); return; }
    nav(`/session/${data.id}`);
  };

  const startT1 = async (level: 'easy' | 'medium' | 'hard') => {
    const key = `T1_${level}` as const;
    const p = presets[key]; if (!p) { toast.error('Preset not loaded'); return; }
    await startSession(key, p);
  };
  const startT2 = async () => { await startSession('T2', unflattenParams(t2Params)); };
  const startT3 = async () => {
    if (!ranges) return;
    const p = generateT3(ranges.params_min, ranges.params_max);
    toast.message('T3 parameters generated', { description: JSON.stringify(flattenParams(p)) });
    await startSession('T3', p);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="p-6 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* unused vars referenced to keep linter happy when header was removed */}
        {void isAdmin}
        {/* T1 */}
        <div className="border border-border rounded-lg p-5 bg-card space-y-3">
          <h2 className="font-arcade text-primary">T1 — Preset</h2>
          <p className="text-xs text-muted-foreground">Admin-defined easy / medium / hard.</p>
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={() => startT1('easy')}>Easy</Button>
            <Button onClick={() => startT1('medium')}>Medium</Button>
            <Button onClick={() => startT1('hard')}>Hard</Button>
          </div>
        </div>

        {/* T2 */}
        <div className="border border-border rounded-lg p-5 bg-card space-y-3">
          <h2 className="font-arcade text-primary">T2 — Custom</h2>
          <p className="text-xs text-muted-foreground">Set your own parameters.</p>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {NUMERIC_FIELD_LIST.map(f => (
              <div key={f} className="grid grid-cols-2 items-center gap-2 text-xs">
                <Label className="text-xs">{FIELD_LABELS[f]}</Label>
                <Input type="number" step="any" value={t2Params[f] ?? ''} onChange={e => setT2Params({ ...t2Params, [f]: Number(e.target.value) })} className="h-8" />
              </div>
            ))}
          </div>
          <Button onClick={startT2} className="w-full">Start T2</Button>
        </div>

        {/* T3 */}
        <div className="border border-border rounded-lg p-5 bg-card space-y-3">
          <h2 className="font-arcade text-primary">T3 — Random</h2>
          <p className="text-xs text-muted-foreground">Parameters randomized within admin-defined ranges.</p>
          {ranges && (
            <div className="text-xs text-muted-foreground space-y-1 max-h-56 overflow-y-auto">
              {NUMERIC_FIELD_LIST.map(f => (
                <div key={f} className="flex justify-between">
                  <span>{FIELD_LABELS[f]}</span>
                  <span className="font-mono">[{ranges.params_min[f]} – {ranges.params_max[f]}]</span>
                </div>
              ))}
            </div>
          )}
          <Button onClick={startT3} className="w-full">Generate & play</Button>
        </div>
      </div>
    </div>
  );
}

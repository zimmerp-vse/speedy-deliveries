import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { AppHeader } from '@/components/AppHeader';
import {
  loadAllPresets, loadT3Ranges, flattenParams, unflattenParams,
  NUMERIC_FIELD_LIST, FIELD_LABELS,
} from '@/lib/regimes';
import { downloadCSV } from '@/lib/csv';
import { toast } from 'sonner';

type PresetKey = 'T1_easy' | 'T1_medium' | 'T1_hard';

export default function Admin() {
  const { user } = useAuth();
  const [presets, setPresets] = useState<Record<PresetKey, Record<string, number>>>({} as any);
  const [rangesMin, setRangesMin] = useState<Record<string, number>>({});
  const [rangesMax, setRangesMax] = useState<Record<string, number>>({});

  useEffect(() => {
    loadAllPresets().then(rows => {
      const m: any = {}; for (const r of rows) m[r.regime] = flattenParams(r.params); setPresets(m);
    });
    loadT3Ranges().then(r => { setRangesMin(r.params_min); setRangesMax(r.params_max); });
  }, []);

  const savePreset = async (regime: PresetKey) => {
    const { error } = await supabase.from('difficulty_presets').update({
      params: unflattenParams(presets[regime]) as any,
      updated_at: new Date().toISOString(),
      updated_by: user?.id,
    }).eq('regime', regime);
    error ? toast.error(error.message) : toast.success(`${regime} saved`);
  };

  const saveRanges = async () => {
    const { error } = await supabase.from('t3_ranges').update({
      params_min: rangesMin, params_max: rangesMax,
      updated_at: new Date().toISOString(), updated_by: user?.id,
    }).eq('id', 1);
    error ? toast.error(error.message) : toast.success('T3 ranges saved');
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Admin · Dash Delivery Lab" />
      <Tabs defaultValue="presets" className="max-w-6xl mx-auto p-6">
        <TabsList>
          <TabsTrigger value="presets">T1 presets</TabsTrigger>
          <TabsTrigger value="ranges">T3 ranges</TabsTrigger>
          <TabsTrigger value="sessions">Sessions & export</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value="presets" className="grid md:grid-cols-3 gap-4 mt-4">
          {(['T1_easy','T1_medium','T1_hard'] as PresetKey[]).map(k => (
            <div key={k} className="border border-border rounded-lg p-4 bg-card space-y-2">
              <h3 className="font-arcade text-sm text-primary">{k}</h3>
              {NUMERIC_FIELD_LIST.map(f => (
                <div key={f} className="grid grid-cols-2 gap-2 items-center text-xs">
                  <Label className="text-xs">{FIELD_LABELS[f]}</Label>
                  <Input type="number" step="any" value={presets[k]?.[f] ?? ''} onChange={e => setPresets({ ...presets, [k]: { ...presets[k], [f]: Number(e.target.value) } })} className="h-8" />
                </div>
              ))}
              <Button onClick={() => savePreset(k)} className="w-full mt-2" size="sm">Save {k}</Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="ranges" className="mt-4">
          <div className="border border-border rounded-lg p-4 bg-card space-y-2">
            <h3 className="font-arcade text-sm text-primary">T3 random parameter ranges</h3>
            <div className="grid grid-cols-3 gap-2 items-center text-xs font-semibold pb-2 border-b border-border">
              <span>Parameter</span><span>Min</span><span>Max</span>
            </div>
            {NUMERIC_FIELD_LIST.map(f => (
              <div key={f} className="grid grid-cols-3 gap-2 items-center text-xs">
                <Label className="text-xs">{FIELD_LABELS[f]}</Label>
                <Input type="number" step="any" value={rangesMin[f] ?? ''} onChange={e => setRangesMin({ ...rangesMin, [f]: Number(e.target.value) })} className="h-8" />
                <Input type="number" step="any" value={rangesMax[f] ?? ''} onChange={e => setRangesMax({ ...rangesMax, [f]: Number(e.target.value) })} className="h-8" />
              </div>
            ))}
            <Button onClick={saveRanges} className="mt-2">Save ranges</Button>
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <SessionsPanel />
        </TabsContent>
        <TabsContent value="feedback" className="mt-4">
          <FeedbackPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SessionsPanel() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('game_sessions').select('*').order('started_at', { ascending: false }).limit(500)
      .then(({ data, error }) => {
        setLoadError(error?.message ?? null);
        setSessions(data ?? []);
      });
  }, []);

  const exportCSV = async () => {
    setBusy(true);
    try {
      const { data: sess, error: e1 } = await supabase.from('game_sessions').select('*').order('started_at');
      const { data: rounds, error: e2 } = await supabase.from('round_events').select('*');
      const { data: profiles, error: e3 } = await supabase.from('profiles').select('id, nickname, age');
      console.info('[CSV export] sessions=%d rounds=%d profiles=%d', sess?.length ?? 0, rounds?.length ?? 0, profiles?.length ?? 0);
      if (e1 || e2 || e3) { toast.error(e1?.message || e2?.message || e3?.message || 'Export failed'); return; }
      const profById = new Map((profiles ?? []).map(p => [p.id, p]));
      const sessById = new Map((sess ?? []).map(s => [s.id, s]));

      const buildSessionRow = (s: any) => {
        const p = profById.get(s.user_id);
        const params = (s.params || {}) as any;
        const flat = { ...(params.difficulty || {}), ...(params.economy || {}) };
        const totals = (s.totals || {}) as any;
        return {
          session_id: s.id, user_id: s.user_id, nickname: p?.nickname, age: p?.age,
          regime: s.regime, started_at: s.started_at, ended_at: s.ended_at, ended_reason: s.ended_reason,
          ...flat,
          totals_deliveries: totals.deliveries, totals_money: totals.money,
        };
      };

      let rows: any[] = [];
      if ((rounds ?? []).length > 0) {
        rows = rounds!.map(r => {
          const s = sessById.get(r.session_id); if (!s) return null;
          return {
            ...buildSessionRow(s),
            round_number: r.round_number, outcome: r.outcome, time_ms: r.time_ms, scene: r.scene,
            money_earned: r.money_earned, money_lost: r.money_lost, money_balance: r.money_balance,
          };
        }).filter(Boolean) as any[];
      } else {
        rows = (sess ?? []).map(buildSessionRow);
      }

      const ok = downloadCSV(`dash-delivery-${new Date().toISOString().slice(0,10)}.csv`, rows);
      if (ok) toast.success(`Exported ${rows.length} row${rows.length === 1 ? '' : 's'}`);
      else toast.warning('Nothing to export yet — no sessions found.');
    } catch (err: any) {
      console.error('[CSV export] failed', err);
      toast.error(err?.message ?? 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{sessions.length} sessions (latest 500 shown)</p>
        <Button onClick={exportCSV} disabled={busy}>{busy ? 'Exporting…' : 'Export CSV (all rounds)'}</Button>
      </div>
      {loadError && <p className="text-sm text-destructive">Could not load sessions: {loadError}</p>}
      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr><th className="p-2 text-left">Started</th><th className="p-2 text-left">Nickname</th><th className="p-2 text-left">Regime</th><th className="p-2 text-left">Ended</th><th className="p-2 text-left">Totals</th></tr>
          </thead>
          <tbody>
            {sessions.map(s => (
              <tr key={s.id} className="border-t border-border">
                <td className="p-2">{new Date(s.started_at).toLocaleString()}</td>
                <td className="p-2">{s.nickname}</td>
                <td className="p-2">{s.regime}</td>
                <td className="p-2">{s.ended_reason ?? '—'}</td>
                <td className="p-2 font-mono">{s.totals ? `D:${s.totals.deliveries} $${s.totals.money}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeedbackPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(1000)
      .then(({ data, error }) => {
        setLoadError(error?.message ?? null);
        setItems(data ?? []);
      });
  };
  useEffect(load, []);

  const exportCSV = async () => {
    setBusy(true);
    const { data, error } = await supabase.from('feedback').select('*').order('created_at');
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    downloadCSV(`dash-delivery-feedback-${new Date().toISOString().slice(0,10)}.csv`,
      (data ?? []).map(r => ({
        created_at: r.created_at, nickname: r.nickname, email: r.email,
        user_id: r.user_id, message: r.message,
      })));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} feedback entries</p>
        <Button onClick={exportCSV} disabled={busy}>{busy ? 'Exporting…' : 'Export CSV'}</Button>
      </div>
      {loadError && <p className="text-sm text-destructive">Could not load feedback: {loadError}</p>}
      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Nickname</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Message</th>
            </tr>
          </thead>
          <tbody>
            {items.map(r => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-2">{r.nickname ?? '—'}</td>
                <td className="p-2">{r.email ?? '—'}</td>
                <td className="p-2 max-w-md whitespace-pre-wrap break-words">{r.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const schema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  nickname: z.string().trim().min(2).max(24).regex(/^[a-zA-Z0-9_]+$/, 'Letters, digits and _ only'),
  age: z.coerce.number().int().min(6).max(120),
  date_of_birth: z.string().optional().or(z.literal('')),
});

export default function Register() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', nickname: '', age: '', date_of_birth: '' });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    const { email, password, nickname, age, date_of_birth } = parsed.data;
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/play`,
        data: { nickname, age, date_of_birth: date_of_birth || null },
      },
    });
    setBusy(false);
    if (error) {
      if (error.message.includes('duplicate') || error.message.toLowerCase().includes('nickname')) {
        toast.error('Nickname already taken or signup failed.');
      } else toast.error(error.message);
      return;
    }
    toast.success('Account created — welcome!');
    nav('/play');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 border border-border rounded-lg p-6 bg-card">
        <h1 className="text-2xl font-arcade text-primary text-center">Register</h1>
        <div className="space-y-1"><Label>Nickname</Label><Input value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} required /></div>
        <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
        <div className="space-y-1"><Label>Password (min 8)</Label><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Age</Label><Input type="number" min={6} max={120} value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} required /></div>
          <div className="space-y-1"><Label>DOB (optional)</Label><Input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} /></div>
        </div>
        <Button type="submit" disabled={busy} className="w-full">{busy ? 'Creating…' : 'Create account'}</Button>
        <p className="text-xs text-muted-foreground text-center">Have an account? <Link to="/login" className="underline">Log in</Link></p>
      </form>
    </div>
  );
}

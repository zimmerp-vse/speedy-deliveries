import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { MessageSquare } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, useProfile } from '@/lib/auth';
import { toast } from 'sonner';

const schema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(5000),
});

interface Props { variant?: 'floating' | 'inline'; }

export function FeedbackDialog({ variant = 'floating' }: Props) {
  const { user } = useAuth();
  const { profile } = useProfile(user);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const onOpen = (v: boolean) => {
    if (v) {
      setMessage('');
    }
    setOpen(v);
  };

  const submit = async () => {
    if (!user?.email) { toast.error('Please log in to send feedback'); return; }
    const nickname = profile?.nickname || user.user_metadata?.nickname || user.email.split('@')[0];
    const parsed = schema.safeParse({ message });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    const { error } = await supabase.from('feedback').insert({
      user_id: user.id,
      nickname,
      email: user.email,
      message: parsed.data.message,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Thanks for your feedback!');
    setOpen(false);
  };

  const trigger = variant === 'floating' ? (
    <Button size="sm" className="fixed bottom-4 right-4 z-50 shadow-lg gap-2">
      <MessageSquare className="h-4 w-4" /> Feedback
    </Button>
  ) : (
    <Button variant="outline" size="sm" className="gap-2">
      <MessageSquare className="h-4 w-4" /> Feedback
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Send feedback</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="fb-nick" className="text-xs">Nickname</Label>
            <Input id="fb-nick" value={nickname} maxLength={100} onChange={e => setNickname(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fb-email" className="text-xs">Email</Label>
            <Input id="fb-email" type="email" value={email} maxLength={320} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fb-msg" className="text-xs">Message *</Label>
            <Textarea id="fb-msg" value={message} maxLength={5000} rows={5} onChange={e => setMessage(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Sending…' : 'Send'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

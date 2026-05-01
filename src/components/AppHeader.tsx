import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth, useProfile, signOut } from '@/lib/auth';
import { FeedbackDialog } from './FeedbackDialog';
import { Shield, Gamepad2, LogOut } from 'lucide-react';

interface Props { title?: string; }

export function AppHeader({ title = 'Dash Delivery Lab' }: Props) {
  const { user } = useAuth();
  const { profile, isAdmin, loading: profileLoading } = useProfile(user);
  const { pathname } = useLocation();

  return (
    <header className="border-b border-border bg-card/30 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3 gap-3">
        <Link to="/play" className="font-arcade text-primary text-sm md:text-base">{title}</Link>
        <nav className="flex items-center gap-2">
          {pathname !== '/play' && (
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link to="/play"><Gamepad2 className="h-4 w-4" /> Play</Link>
            </Button>
          )}
          {!profileLoading && isAdmin && pathname !== '/admin' && (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/admin"><Shield className="h-4 w-4" /> Admin</Link>
            </Button>
          )}
          <FeedbackDialog variant="inline" />
          {profile && <span className="hidden md:inline text-xs text-muted-foreground">{profile.nickname}</span>}
          {user && (
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1">
              <LogOut className="h-4 w-4" /> <span className="hidden md:inline">Log out</span>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

import { forwardRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { isWhitelistedAdmin, useAuth, useProfile, signOut } from '@/lib/auth';
import { FeedbackDialog } from './FeedbackDialog';
import { Shield, Gamepad2, LogOut } from 'lucide-react';

interface Props { title?: string; }

export const AppHeader = forwardRef<HTMLElement, Props>(function AppHeader({ title = 'Dash Delivery Lab' }, ref) {
  const { user } = useAuth();
  const { profile, isAdmin } = useProfile(user);
  const { pathname } = useLocation();
  const showAdmin = isAdmin || isWhitelistedAdmin(user);

  return (
    <header ref={ref} className="border-b border-border bg-card/30 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3 gap-3">
        <Link to="/play" className="font-arcade text-primary text-sm md:text-base">{title}</Link>
        <nav className="flex items-center gap-2">
          {pathname !== '/play' && (
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link to="/play"><Gamepad2 className="h-4 w-4" /> Play</Link>
            </Button>
          )}
          {showAdmin && pathname !== '/admin' && (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/admin"><Shield className="h-4 w-4" /> Admin</Link>
            </Button>
          )}
          <FeedbackDialog variant="inline" />
          <span className="hidden md:inline text-xs text-muted-foreground">{profile?.nickname || user?.user_metadata?.nickname || user?.email?.split('@')[0]}</span>
          {user && (
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1">
              <LogOut className="h-4 w-4" /> <span className="hidden md:inline">Log out</span>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
});

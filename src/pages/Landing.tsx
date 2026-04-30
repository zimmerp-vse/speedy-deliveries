import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';

export default function Landing() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/play" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-xl w-full text-center space-y-6">
        <h1 className="text-4xl md:text-5xl font-arcade text-primary">Dash Delivery Lab</h1>
        <p className="text-muted-foreground">
          A research platform where volunteers play timed delivery rounds under
          configurable difficulty regimes. Sign up, pick a regime, and play —
          your gameplay data helps us study driving outcomes.
        </p>
        <div className="flex gap-3 justify-center">
          <Button asChild size="lg"><Link to="/register">Register</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/login">Log in</Link></Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Try the game directly: <Link to="/game" className="underline">/game</Link>
        </p>
      </div>
    </div>
  );
}

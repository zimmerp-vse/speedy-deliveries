import { Navigate } from 'react-router-dom';
import { useAuth, useProfile } from '@/lib/auth';

export function RequireAuth({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  const { isAdmin, loading: profileLoading } = useProfile(user);
  if (loading || (user && profileLoading)) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && !isAdmin) return <Navigate to="/play" replace />;
  return <>{children}</>;
}

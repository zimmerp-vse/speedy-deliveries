import { Navigate } from 'react-router-dom';
import { isWhitelistedAdmin, useAuth, useProfile } from '@/lib/auth';

export function RequireAuth({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  const { isAdmin, loading: profileLoading } = useProfile(user);
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && profileLoading && !isWhitelistedAdmin(user)) return null;
  if (admin && !isAdmin && !isWhitelistedAdmin(user)) return <Navigate to="/play" replace />;
  return <>{children}</>;
}

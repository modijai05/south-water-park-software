import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import type { Role } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, token, fetchUser } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (token && !user) fetchUser();
  }, [token, user, fetchUser]);

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user === undefined) return null;
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/staff'} replace />;
  }

  return <>{children}</>;
}

import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import ErrorBoundary from '@/components/ErrorBoundary';

// Lazy load all route components for code splitting
const Login = lazy(() => import('@/pages/Login').then(m => ({ default: m.Login })));
const TicketForm = lazy(() => import('@/pages/TicketForm').then(m => ({ default: m.TicketForm })));
const Payment = lazy(() => import('@/pages/Payment').then(m => ({ default: m.Payment })));
const Staff = lazy(() => import('@/pages/Staff').then(m => ({ default: m.Staff })));
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminEntries = lazy(() => import('@/pages/AdminEntries').then(m => ({ default: m.AdminEntries })));
const AdminUsers = lazy(() => import('@/pages/AdminUsers').then(m => ({ default: m.AdminUsers })));
const AdminExport = lazy(() => import('@/pages/AdminExport').then(m => ({ default: m.AdminExport })));
const AdminTicketConfig = lazy(() => import('@/pages/AdminTicketConfig').then(m => ({ default: m.AdminTicketConfig })));
const EditableTicketForm = lazy(() => import('@/pages/EditableTicketForm').then(m => ({ default: m.EditableTicketForm })));
const TicketAnalytics = lazy(() => import('@/pages/TicketAnalytics').then(m => ({ default: m.TicketAnalytics })));

// Optimized loading component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
      <p className="text-gray-700 font-medium">Loading...</p>
    </div>
  </div>
);

function AppRoutes() {
  const { user, token, fetchUser, isLoading, logout } = useAuthStore();

  useEffect(() => {
    if (token && !user && !isLoading) fetchUser();
  }, [token, user, fetchUser, isLoading]);

  // Handle global auth expiration events
  useEffect(() => {
    const handleAuthExpired = (event: CustomEvent) => {
      console.log('🔐 Global auth expired event received:', event.detail);
      logout();
    };

    window.addEventListener('auth-expired', handleAuthExpired as EventListener);
    
    return () => {
      window.removeEventListener('auth-expired', handleAuthExpired as EventListener);
    };
  }, [logout]);

  // Show loading state while checking authentication
  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('🚨 Global App Error:', error, errorInfo);
        // You can also send error to logging service here
      }}
    >
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={token && user ? <Navigate to={user.role === 'admin' ? '/admin' : '/staff'} replace /> : <Login />} />
          <Route
            path="/ticket"
            element={
              <ProtectedRoute>
                <TicketForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ticket-editable"
            element={
              <ProtectedRoute>
                <EditableTicketForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payment"
            element={
              <ProtectedRoute>
                <Payment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff"
            element={
              <ProtectedRoute allowedRoles={['staff', 'admin']}>
                <Staff />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/entries"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminEntries />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/export"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminExport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ticket-config"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminTicketConfig />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <TicketAnalytics />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to={token && user ? (user.role === 'admin' ? '/admin' : '/staff') : '/login'} replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return <AppRoutes />;
}

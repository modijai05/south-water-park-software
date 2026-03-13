import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Login } from '@/pages/Login';
import { TicketForm } from '@/pages/TicketForm';
import { Payment } from '@/pages/Payment';
import { Staff } from '@/pages/Staff';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { AdminEntries } from '@/pages/AdminEntries';
import { AdminUsers } from '@/pages/AdminUsers';
import { AdminExport } from '@/pages/AdminExport';
import { AdminTicketConfig } from '@/pages/AdminTicketConfig';
import { EditableTicketForm } from '@/pages/EditableTicketForm';
import { TicketAnalytics } from '@/pages/TicketAnalytics';

function AppRoutes() {
  const { user, token, fetchUser, isLoading } = useAuthStore();

  useEffect(() => {
    if (token && !user && !isLoading) fetchUser();
  }, [token, user, fetchUser, isLoading]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading application...</p>
        </div>
      </div>
    );
  }

  return (
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
  );
}

export default function App() {
  return <AppRoutes />;
}

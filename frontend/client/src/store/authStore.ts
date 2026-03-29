import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { authApi } from '@/lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  hasHydrated: boolean;
  setAuth: (user: User | null, token: string | null) => void;
  logout: () => void;
  forceLogout: (reason?: string) => void;
  fetchUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,
      hasHydrated: false,
      setAuth: (user, token) => {
        if (token) {
          localStorage.setItem('token', token);
          sessionStorage.setItem('token', token); // Backup session storage
        } else {
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
        }
        set({ user, token, error: null });
      },
      logout: () => {
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        set({ user: null, token: null, error: null });
      },
      forceLogout: (reason) => {
        console.log('Force logout:', reason);
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        set({ user: null, token: null, error: reason || 'Session expired' });
      },
      fetchUser: async () => {
        const { token, setAuth, logout } = get();
        if (!token) return;

        set({ isLoading: true, error: null });
        
        try {
          const response = await authApi.me();
          if (response.user) {
            setAuth({
              ...response.user,
              role: response.user.role as 'admin' | 'staff'
            }, token);
          } else {
            logout();
          }
        } catch (error) {
          console.error('Failed to fetch user:', error);
          set({ error: 'Failed to fetch user data' });
          logout();
        } finally {
          set({ isLoading: false });
        }
      },
      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => {
        // Fix hydration issues
        if (state) {
          state.hasHydrated = true;
        }
        return state;
      },
      skipHydration: false,
    }
  )
);

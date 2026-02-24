import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { authApi } from '@/lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User | null, token: string | null) => void;
  logout: () => void;
  forceLogout: (reason?: string) => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        if (token) {
          localStorage.setItem('token', token);
          sessionStorage.setItem('token', token); // Backup session storage
        } else {
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
        }
        set({ user, token });
      },
      logout: () => {
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        set({ user: null, token: null });
      },
      forceLogout: (reason?: string) => {
        console.log('Force logout called:', reason);
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        set({ user: null, token: null });
        // Trigger a global event to notify all components
        window.dispatchEvent(new CustomEvent('force-logout', { 
          detail: { reason: reason || 'Session expired' } 
        }));
      },
      fetchUser: async () => {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
          set({ user: null, token: null });
          return;
        }
        // Store token in both storages for redundancy
        localStorage.setItem('token', token);
        sessionStorage.setItem('token', token);
        try {
          const { user } = await authApi.me();
          if (user) set({ user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role as User['role'] }, token });
          else {
            localStorage.removeItem('token');
            sessionStorage.removeItem('token');
            set({ user: null, token: null });
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
          set({ user: null, token: null });
        }
      },
    }),
    { 
      name: 'auth', 
      partialize: (s) => ({ token: s.token })
    }
  )
);

import React, {
  createContext,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { authService } from '@/services/auth.service';
import type { User } from '@/types/api';

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const { user: fetchedUser } = await authService.getMe();
      setUser(fetchedUser);
    } catch {
      setUser(null);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Proceed with local state reset even if server logout fails
    } finally {
      setUser(null);
    }
  }, []);

  // On mount: Clean token from query string if backend redirected with ?token=,
  // then query GET /api/auth/me relying on the HTTP-only cookie set by the backend.
  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.has('token')) {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('token');
        window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search);
      }

      await refreshUser();
      setLoading(false);
    };

    void init();
  }, [refreshUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
